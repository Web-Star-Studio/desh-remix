// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { callWhatsappProxy } from "@/lib/whatsappProxy";
import { useWorkspaceSafe } from "@/contexts/WorkspaceContext";
import { wrapResult, type WABAResult } from "@/services/zernio/types";

export type WhatsappWebStatus =
  | "idle"
  | "connecting"
  | "QR_PENDING"
  | "CONNECTED"
  | "DISCONNECTED"
  | "ERROR"
  | "RECONNECTING";
export type RealtimeStatus = "connecting" | "live" | "error";

export interface WhatsappWebSession {
  sessionId: string | null;
  status: WhatsappWebStatus;
  qrCode: string | null;
  lastError: string | null;
  lastConnectedAt: string | null;
}

/** Derive per-user+workspace instance name (must match edge function logic) */
function userInstanceName(userId: string, workspaceId?: string | null): string {
  const userPart = userId.replace(/-/g, "").slice(0, 8);
  if (workspaceId) {
    const wsPart = workspaceId.replace(/-/g, "").slice(0, 6);
    return `desh_${userPart}_${wsPart}`;
  }
  return `desh_${userPart}`;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_BASE_DELAY = 8_000;
// Must stay below backend expiry threshold (currently 2 minutes)
const HEARTBEAT_INTERVAL = 55_000; // 55s — safely under 2min expiry
const STATUS_CHECK_EVERY_N = 3; // Only call /status API every 3rd heartbeat
const DISCONNECT_DEBOUNCE_MS = 4_000;

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useWhatsappWebSession() {
  const { user } = useAuth();
  const wsCtx = useWorkspaceSafe();
  const activeWorkspaceId = wsCtx?.activeWorkspaceId ?? null;
  const defaultWorkspaceId = wsCtx?.workspaces?.find(w => w.is_default)?.id ?? null;
  const [resolvedWorkspaceId, setResolvedWorkspaceId] = useState<string | null>(null);
  const effectiveWorkspaceId = activeWorkspaceId ?? resolvedWorkspaceId ?? defaultWorkspaceId;
  const [session, setSession] = useState<WhatsappWebSession>({
    sessionId: null,
    status: "idle",
    qrCode: null,
    lastError: null,
    lastConnectedAt: null,
  });
  const [loading, setLoading] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("connecting");
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReconnectTriggerRef = useRef(0);
  const userRef = useRef(user);
  userRef.current = user;
  const loadingRef = useRef(false);
  const heartbeatCountRef = useRef(0);

  // Resolve workspace in "Todos" mode using most recent WhatsApp activity
  useEffect(() => {
    if (!user) {
      setResolvedWorkspaceId(null);
      return;
    }
    if (activeWorkspaceId) {
      setResolvedWorkspaceId(activeWorkspaceId);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data: latestConvo } = await supabase
          .from("whatsapp_conversations")
          .select("workspace_id, last_message_at")
          .eq("user_id", user.id)
          .not("workspace_id", "is", null)
          .order("last_message_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const convoWorkspaceId = (latestConvo as any)?.workspace_id as string | null;
        if (!cancelled && convoWorkspaceId) {
          setResolvedWorkspaceId(convoWorkspaceId);
          return;
        }

        const { data: latestSession } = await supabase
          .from("whatsapp_web_sessions")
          .select("workspace_id, updated_at")
          .eq("user_id", user.id)
          .not("workspace_id", "is", null)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!cancelled) {
          setResolvedWorkspaceId(((latestSession as any)?.workspace_id as string | null) ?? defaultWorkspaceId ?? null);
        }
      } catch {
        if (!cancelled) setResolvedWorkspaceId(defaultWorkspaceId ?? null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, activeWorkspaceId, defaultWorkspaceId]);

  // ── Load existing session on mount ────────────────────────────────────────

  useEffect(() => {
    if (!user || !effectiveWorkspaceId) return;
    let cancelled = false;
    (async () => {
      let query = supabase
        .from("whatsapp_web_sessions")
        .select("session_id, status, last_qr_code, last_error, last_connected_at")
        .eq("user_id", user.id);
      if (effectiveWorkspaceId) {
        query = query.eq("workspace_id", effectiveWorkspaceId);
      }
      const { data } = await query
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled || !data) return;

      const dbStatus = data.status as WhatsappWebStatus;

      const mappedStatus = dbStatus === "CONNECTED" ? "CONNECTED"
        : dbStatus === "QR_PENDING" ? "QR_PENDING"
        : dbStatus === "ERROR" || dbStatus === "DISCONNECTED"
          ? "DISCONNECTED"
          : "idle";

      setSession({
        sessionId: data.session_id,
        status: mappedStatus,
        qrCode: data.last_qr_code,
        lastError: data.last_error,
        lastConnectedAt: data.last_connected_at,
      });

      // Background verification against Evolution API for ANY status
      // This heals stale DB states (e.g. DB says DISCONNECTED but API is actually CONNECTED)
      let healed = false;
      try {
        const statusData = await callWhatsappProxy("GET", "/status", undefined, effectiveWorkspaceId, 12_000);
        if (cancelled) return;
        const serverStatus = statusData.status as string;

        if (serverStatus === "CONNECTED" && mappedStatus !== "CONNECTED") {
          console.debug("[wa-init] DB says", mappedStatus, "but server says CONNECTED — auto-recovering");
          setSession(s => ({ ...s, status: "CONNECTED", lastError: null }));
          healed = true;
        } else if (serverStatus === "DISCONNECTED" && mappedStatus === "CONNECTED") {
          console.warn("[wa-init] DB says CONNECTED but server says DISCONNECTED");
          setSession(s => ({ ...s, status: "DISCONNECTED", lastError: "Sessão expirou no servidor" }));
        }
      } catch {
        // Network error — trust DB state
      }

      // Fallback: if status probe didn't heal, check recent activity for THIS workspace
      if (!healed && mappedStatus !== "CONNECTED") {
        try {
          const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
          const { count } = await (supabase
            .from("whatsapp_conversations" as any)
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("workspace_id", effectiveWorkspaceId)
            .gte("last_message_at", fiveMinAgo) as any);
          if (cancelled) return;
          if (count && count > 0) {
            console.debug("[wa-init] Found", count, "recent conversations in workspace — forcing CONNECTED:", effectiveWorkspaceId);
            setSession(s => ({ ...s, status: "CONNECTED", lastError: null }));
          }
        } catch {
          // Ignore — best-effort fallback
        }
      }
    })();
    return () => { cancelled = true; };
  }, [user, effectiveWorkspaceId]);

  // ── Supabase Realtime subscription ────────────────────────────────────────

  useEffect(() => {
    if (!user || !effectiveWorkspaceId) return;

    setRealtimeStatus("connecting");

    const channel = supabase
      .channel(`wa_rt_${user.id}_${effectiveWorkspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_web_sessions",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as {
            session_id: string;
            status: string;
            last_qr_code: string | null;
            last_error: string | null;
            last_connected_at: string | null;
            workspace_id: string | null;
          };

          // Client-side workspace filter
          if (effectiveWorkspaceId && row.workspace_id && row.workspace_id !== effectiveWorkspaceId) {
            return;
          }

          const newStatus = row.status as WhatsappWebStatus;

          if (newStatus === "CONNECTED") {
            setReconnectAttempt(0);
            if (reconnectTimerRef.current) {
              clearTimeout(reconnectTimerRef.current);
              reconnectTimerRef.current = null;
            }
            if (disconnectDebounceRef.current) {
              clearTimeout(disconnectDebounceRef.current);
              disconnectDebounceRef.current = null;
            }
            setSession({
              sessionId: row.session_id,
              status: "CONNECTED",
              qrCode: row.last_qr_code,
              lastError: null,
              lastConnectedAt: row.last_connected_at,
            });
            return;
          }

          // For DISCONNECTED/ERROR, debounce to avoid rapid state changes
          if (newStatus === "DISCONNECTED" || newStatus === "ERROR") {
            if (disconnectDebounceRef.current) {
              clearTimeout(disconnectDebounceRef.current);
            }
            disconnectDebounceRef.current = setTimeout(() => {
              disconnectDebounceRef.current = null;
              setSession((prev) => ({
                ...prev,
                sessionId: row.session_id,
                status: newStatus,
                qrCode: row.last_qr_code,
                lastError: row.last_error,
                lastConnectedAt: row.last_connected_at,
              }));
            }, DISCONNECT_DEBOUNCE_MS);
            return;
          }

          // QR_PENDING, RECONNECTING etc — update immediately
          setSession((prev) => ({
            ...prev,
            sessionId: row.session_id,
            status: newStatus,
            qrCode: row.last_qr_code,
            lastError: row.last_error,
            lastConnectedAt: row.last_connected_at,
          }));
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtimeStatus("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setRealtimeStatus("error");
      });

    return () => {
      supabase.removeChannel(channel);
      if (disconnectDebounceRef.current) {
        clearTimeout(disconnectDebounceRef.current);
        disconnectDebounceRef.current = null;
      }
    };
  }, [user, effectiveWorkspaceId]);

  // ── Auto-reconnect logic ─────────────────────────────────────────────────

  const triggerAutoReconnect = useCallback((sessionId: string) => {
    const now = Date.now();
    if (now - lastReconnectTriggerRef.current < 15_000) return;
    lastReconnectTriggerRef.current = now;

    setReconnectAttempt((prev) => {
      const attempt = prev + 1;
      if (attempt > MAX_RECONNECT_ATTEMPTS) {
        console.error("[wa-reconnect] Max attempts reached");
        setSession((s) => ({
          ...s,
          status: "DISCONNECTED",
          lastError: "Reconexão falhou após 3 tentativas",
        }));
        return 0;
      }

      const delay = RECONNECT_BASE_DELAY * Math.pow(2, attempt - 1);
      console.debug(`[wa-reconnect] Attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
      setSession((s) => ({ ...s, status: "RECONNECTING" }));

      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);

      reconnectTimerRef.current = setTimeout(async () => {
        try {
          await callWhatsappProxy("POST", "/sessions", undefined, effectiveWorkspaceId);
        } catch (err) {
          console.error("[wa-reconnect] Failed:", err);
        }
      }, delay);

      return attempt;
    });
  }, [effectiveWorkspaceId]);

  // ── Heartbeat (lightweight — only updates updated_at) ────────────────────
  // Status check via API happens every Nth heartbeat to reduce load.

  useEffect(() => {
    const sid = session.sessionId;
    if (session.status !== "CONNECTED" || !sid || !user) return;

    heartbeatCountRef.current = 0;

    // Immediate heartbeat
    supabase
      .from("whatsapp_web_sessions" as any)
      .update({ updated_at: new Date().toISOString() } as any)
      .eq("session_id", sid)
      .eq("user_id", user.id)
      .then(() => {});

    const interval = setInterval(async () => {
      const currentUser = userRef.current;
      if (!currentUser) return;

      // Always write heartbeat to prevent auto-expiry
      await supabase
        .from("whatsapp_web_sessions" as any)
        .update({ updated_at: new Date().toISOString() } as any)
        .eq("session_id", sid)
        .eq("user_id", currentUser.id);

      // Only check real status every Nth heartbeat to reduce API load
      heartbeatCountRef.current += 1;
      if (heartbeatCountRef.current % STATUS_CHECK_EVERY_N !== 0) return;

      try {
        const data = await callWhatsappProxy("GET", "/status", undefined, effectiveWorkspaceId, 12_000);
        if (
          (data.status as string) === "DISCONNECTED" &&
          sessionRef.current.status === "CONNECTED"
        ) {
          console.warn("[wa-heartbeat] Server reports DISCONNECTED");
          triggerAutoReconnect(sid);
        }
      } catch {
        // Network error during heartbeat — ignore silently
      }
    }, HEARTBEAT_INTERVAL);

    return () => clearInterval(interval);
  }, [user, session.status, session.sessionId, triggerAutoReconnect, effectiveWorkspaceId]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (disconnectDebounceRef.current) clearTimeout(disconnectDebounceRef.current);
    };
  }, []);

  // ── Public API ─────────────────────────────────────────────────────────────

  const createSession = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const currentUser = userRef.current;
    setLoading(true);
    setReconnectAttempt(0);
    const instanceId = currentUser ? userInstanceName(currentUser.id, effectiveWorkspaceId) : "desh";
    setSession((prev) => ({
      ...prev,
      status: "connecting",
      lastError: null,
      sessionId: instanceId,
    }));
    try {
      const data = await callWhatsappProxy("POST", "/sessions", undefined, effectiveWorkspaceId);
      setSession((prev) => ({
        ...prev,
        sessionId: (data.sessionId as string) ?? instanceId,
        status: (data.status as WhatsappWebStatus) ?? "QR_PENDING",
        qrCode: (data.qrCode as string | null) ?? prev.qrCode,
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      const isNetworkOrTimeout = msg === "Failed to fetch" || msg.includes("NetworkError") || msg.includes("Gateway timeout");

      if (isNetworkOrTimeout && currentUser) {
        try {
          let fallbackQuery = supabase
            .from("whatsapp_web_sessions")
            .select("session_id, status, last_qr_code, last_error, last_connected_at")
            .eq("user_id", currentUser.id);
          if (effectiveWorkspaceId) {
            fallbackQuery = fallbackQuery.eq("workspace_id", effectiveWorkspaceId);
          }
          const { data: dbSession } = await fallbackQuery
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (dbSession?.status === "CONNECTED") {
            setSession({
              sessionId: dbSession.session_id,
              status: "CONNECTED",
              qrCode: dbSession.last_qr_code,
              lastError: null,
              lastConnectedAt: dbSession.last_connected_at,
            });
            return;
          }
        } catch {
          // DB fallback also failed
        }
      }

      setSession((prev) => ({ ...prev, status: "ERROR", lastError: msg }));
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [effectiveWorkspaceId]);

  const disconnect = useCallback(async () => {
    const sid = sessionRef.current.sessionId;
    if (!sid) return;
    setLoading(true);
    setReconnectAttempt(0);
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    // Optimistically clear UI
    setSession({
      sessionId: null,
      status: "idle",
      qrCode: null,
      lastError: null,
      lastConnectedAt: null,
    });
    try {
      await callWhatsappProxy("DELETE", `/sessions/${sid}`, undefined, effectiveWorkspaceId, 15_000);
    } catch (e) {
      console.warn("[wa-disconnect] Server disconnect failed (UI already cleared):", e);
    } finally {
      setLoading(false);
    }
  }, [effectiveWorkspaceId]);

  // ── Action methods ─────────────────────────────────────────────────────────
  // All return the canonical `WABAResult<T>` envelope (see
  // `@/services/zernio/types`) so they compose with the rest of the WhatsApp
  // hook surface (`useSendWhatsAppMessage`, `useZernioWhatsApp`,
  // `useMultiWhatsappSessions`).

  const sendMessage = useCallback(
    async (
      to: string,
      text: string,
      quotedMessageId?: string,
    ): Promise<WABAResult<unknown>> => {
      return wrapResult(callWhatsappProxy("POST", "/messages", {
        to,
        text,
        ...(quotedMessageId ? { quotedMessageId } : {}),
      }, effectiveWorkspaceId));
    },
    [effectiveWorkspaceId],
  );

  const sendMedia = useCallback(
    async (
      to: string,
      media: string,
      mediatype: string,
      mimetype: string,
      fileName: string,
      caption?: string,
    ): Promise<WABAResult<unknown>> => {
      return wrapResult(callWhatsappProxy("POST", "/send-media", {
        to, media, mediatype, mimetype, fileName, caption,
      }, effectiveWorkspaceId));
    },
    [effectiveWorkspaceId],
  );

  const downloadMedia = useCallback(
    async (messageId: string): Promise<WABAResult<unknown>> => {
      return wrapResult(callWhatsappProxy("POST", "/media-download", { messageId }, effectiveWorkspaceId));
    },
    [effectiveWorkspaceId],
  );

  return {
    session,
    loading,
    realtimeStatus,
    reconnectAttempt,
    createSession,
    disconnect,
    sendMessage,
    sendMedia,
    downloadMedia,
    effectiveWorkspaceId,
  };
}

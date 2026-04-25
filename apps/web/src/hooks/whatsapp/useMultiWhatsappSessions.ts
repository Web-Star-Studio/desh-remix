// TODO: Migrar para edge function — acesso direto ao Supabase
/**
 * useMultiWhatsappSessions — loads WhatsApp session status for ALL workspaces.
 * Used in "view all" mode to know which workspaces have active WA connections
 * and to route send/proxy calls to the correct workspace.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { callWhatsappProxy } from "@/lib/whatsappProxy";
import { wrapResult, type WABAResult } from "@/services/zernio/types";

export interface WorkspaceWaSession {
  workspaceId: string;
  sessionId: string | null;
  status: "idle" | "CONNECTED" | "DISCONNECTED" | "QR_PENDING" | "ERROR" | "connecting";
  lastConnectedAt: string | null;
}

export function useMultiWhatsappSessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<WorkspaceWaSession[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("whatsapp_web_sessions")
        .select("session_id, status, workspace_id, last_connected_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (data) {
        // Deduplicate by workspace_id, keeping the most recent
        const seen = new Set<string>();
        const result: WorkspaceWaSession[] = [];
        for (const row of data) {
          const wsId = (row as any).workspace_id as string | null;
          if (!wsId || seen.has(wsId)) continue;
          seen.add(wsId);
          result.push({
            workspaceId: wsId,
            sessionId: (row as any).session_id,
            status: (row as any).status === "CONNECTED" ? "CONNECTED"
              : (row as any).status === "QR_PENDING" ? "QR_PENDING"
              : "DISCONNECTED",
            lastConnectedAt: (row as any).last_connected_at,
          });
        }
        setSessions(result);
      }
    } catch (err) {
      console.error("[multi-wa-sessions] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchAll();
  }, [fetchAll]);

  // Realtime updates for session status changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("multi_wa_sessions_rt")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "whatsapp_web_sessions",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const row = payload.new as Record<string, unknown>;
        const wsId = row.workspace_id as string | null;
        if (!wsId) return;

        setSessions(prev => {
          const newStatus = row.status as string;
          const mapped: WorkspaceWaSession = {
            workspaceId: wsId,
            sessionId: row.session_id as string,
            status: newStatus === "CONNECTED" ? "CONNECTED"
              : newStatus === "QR_PENDING" ? "QR_PENDING"
              : "DISCONNECTED",
            lastConnectedAt: row.last_connected_at as string | null,
          };
          const existing = prev.find(s => s.workspaceId === wsId);
          if (existing) {
            return prev.map(s => s.workspaceId === wsId ? mapped : s);
          }
          return [...prev, mapped];
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  /** Check if a specific workspace has an active WA connection */
  const isWorkspaceConnected = useCallback((workspaceId: string | null | undefined): boolean => {
    if (!workspaceId) return false;
    return sessions.some(s => s.workspaceId === workspaceId && s.status === "CONNECTED");
  }, [sessions]);

  /** Get connected workspace IDs */
  const connectedWorkspaceIds = sessions
    .filter(s => s.status === "CONNECTED")
    .map(s => s.workspaceId);

  /**
   * Send message via the correct workspace.
   * Returns a `WABAResult` envelope so it composes with the rest of the
   * WhatsApp hook surface (`useSendWhatsAppMessage`, `useZernioWhatsApp`).
   */
  const sendMessageViaWorkspace = useCallback(async (
    workspaceId: string | null | undefined,
    to: string,
    text: string,
    quotedMessageId?: string,
  ): Promise<WABAResult<unknown>> => {
    return wrapResult(callWhatsappProxy("POST", "/messages", {
      to,
      text,
      ...(quotedMessageId ? { quotedMessageId } : {}),
    }, workspaceId));
  }, []);

  /** Send media via the correct workspace. */
  const sendMediaViaWorkspace = useCallback(async (
    workspaceId: string | null | undefined,
    to: string,
    media: string,
    mediatype: string,
    mimetype: string,
    fileName: string,
    caption?: string,
  ): Promise<WABAResult<unknown>> => {
    return wrapResult(callWhatsappProxy("POST", "/send-media", {
      to, media, mediatype, mimetype, fileName, caption,
    }, workspaceId));
  }, []);

  /** Download media via the correct workspace. */
  const downloadMediaViaWorkspace = useCallback(async (
    workspaceId: string | null | undefined,
    messageId: string,
  ): Promise<WABAResult<unknown>> => {
    return wrapResult(callWhatsappProxy("POST", "/media-download", { messageId }, workspaceId));
  }, []);

  return {
    sessions,
    loading,
    isWorkspaceConnected,
    connectedWorkspaceIds,
    sendMessageViaWorkspace,
    sendMediaViaWorkspace,
    downloadMediaViaWorkspace,
    refetch: fetchAll,
  };
}

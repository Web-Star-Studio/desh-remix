// TODO: Migrar para edge function — acesso direto ao Supabase
/**
 * useMessagesSyncEngine — Consolidates all background sync logic for Messages:
 * - Bilateral unread sync (visibility-aware)
 * - Contact enrichment (with retry/backoff)
 * - Last message map via RPC (DISTINCT ON)
 * - Contact name map + realtime subscription
 * - Push name extraction from inbound messages
 * - User display name fetch
 *
 * Extracted from MessagesPage.tsx for maintainability.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callWhatsappProxy } from "@/lib/whatsappProxy";
import { getMessageTypeLabel } from "@/lib/messageUtils";
import type { WhatsappConversation } from "@/hooks/whatsapp/useWhatsappConversations";

export interface UseMessagesSyncEngineParams {
  userId: string | null;
  anyWaConnected: boolean;
  waConversations: WhatsappConversation[];
  refetchConvos: () => void;
  isViewAll: boolean;
  connectedWorkspaceIds: string[];
  waWorkspaceId: string | null | undefined;
  /** Current WA session status — used for status reconciliation */
  waSessionStatus?: string;
}

export function useMessagesSyncEngine({
  userId,
  anyWaConnected,
  waConversations,
  refetchConvos,
  isViewAll,
  connectedWorkspaceIds,
  waWorkspaceId,
  waSessionStatus,
}: UseMessagesSyncEngineParams) {
  const [lastMessageMap, setLastMessageMap] = useState<Record<string, string>>({});
  const [contactNameMap, setContactNameMap] = useState<Record<string, string>>({});
  const [pushNameMap, setPushNameMap] = useState<Record<string, string>>({});
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null);

  // ── Bilateral read sync: visibility-aware (serialized, overlap-protected) ──
  const syncInProgressRef = useRef(false);
  useEffect(() => {
    if (!userId || !anyWaConnected) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const syncUnread = async () => {
      if (document.visibilityState === "hidden") return;
      if (syncInProgressRef.current) return; // prevent overlap
      syncInProgressRef.current = true;
      try {
        if (isViewAll && connectedWorkspaceIds.length > 0) {
          // Serialize: one workspace at a time to avoid overwhelming the edge function
          for (const wsId of connectedWorkspaceIds) {
            try {
              await callWhatsappProxy("POST", "/sync-unread", undefined, wsId, 20_000);
            } catch (e) {
              console.warn("[sync-unread] Error for workspace", wsId, e);
            }
          }
        } else {
          await callWhatsappProxy("POST", "/sync-unread", undefined, waWorkspaceId, 20_000);
        }
        refetchConvos();
      } catch (e) {
        // Only warn, not error — sync-unread failures are expected when WA is disconnected
        console.warn("[sync-unread] Skipped:", e instanceof Error ? e.message : e);
        syncInProgressRef.current = false;
      }
    };

    const startInterval = () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(syncUnread, 45_000); // 45s to reduce pressure
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncUnread();
        startInterval();
      } else if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    // Delay initial sync by 3s to let the page settle
    const initTimer = setTimeout(() => {
      syncUnread();
      startInterval();
    }, 3000);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearTimeout(initTimer);
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [anyWaConnected, userId, refetchConvos, isViewAll, connectedWorkspaceIds]);

  // ── Auto-enrich contacts (with retry/backoff + periodic re-enrichment) ─────
  const enrichTriggeredRef = useRef(false);
  const enrichRetryCountRef = useRef(0);
  const lastEnrichConvCountRef = useRef(0);
  // Use ref so effect doesn't re-run on every waConversations change
  const waConversationsRef = useRef(waConversations);
  waConversationsRef.current = waConversations;
  const waConvoCount = waConversations.length;

  useEffect(() => {
    if (!anyWaConnected || !userId) return;
    if (waConvoCount === 0) return;

    // Reset trigger if conversation count changed significantly (new convos arrived)
    const countDelta = Math.abs(waConvoCount - lastEnrichConvCountRef.current);
    if (countDelta >= 5 && enrichTriggeredRef.current) {
      enrichTriggeredRef.current = false;
      enrichRetryCountRef.current = 0;
    }

    if (enrichTriggeredRef.current) return;

    const currentConvos = waConversationsRef.current;
    const needsEnrichment = currentConvos.some(c => {
      if (!c.profilePictureUrl) return true;
      const title = c.title ?? "";
      const isPhoneTitle = /^\+?\d[\d\s\-().]*$/.test(title.trim()) || title === c.externalContactId || !title;
      return isPhoneTitle && !c.externalContactId.endsWith("@g.us");
    });

    if (!needsEnrichment) return;
    if (enrichRetryCountRef.current >= 3) return;
    enrichTriggeredRef.current = true;
    lastEnrichConvCountRef.current = waConvoCount;

    const enrich = async () => {
      try {
        if (isViewAll && connectedWorkspaceIds.length > 0) {
          let totalEnriched = 0;
          for (const wsId of connectedWorkspaceIds) {
            try {
              const result = await callWhatsappProxy("POST", "/enrich-contacts", undefined, wsId, 55_000);
              totalEnriched += (result as any).enriched ?? 0;
            } catch (e) {
              console.warn("[enrich-contacts] Error for workspace", wsId, e);
            }
          }
          if (totalEnriched > 0) refetchConvos();
        } else {
          const data = await callWhatsappProxy("POST", "/enrich-contacts", undefined, waWorkspaceId, 55_000);
          if ((data as any).enriched > 0) refetchConvos();
        }
      } catch (e) {
        console.error("[enrich-contacts] Error:", e);
        enrichRetryCountRef.current += 1;
        enrichTriggeredRef.current = false;
      }
    };

    const delay = 3000 * Math.pow(2, enrichRetryCountRef.current);
    const timer = setTimeout(enrich, delay);

    // Periodic re-enrichment every 5 minutes
    const periodicTimer = setInterval(() => {
      enrichTriggeredRef.current = false;
      enrichRetryCountRef.current = 0;
    }, 300_000);

    return () => {
      clearTimeout(timer);
      clearInterval(periodicTimer);
    };
  }, [anyWaConnected, userId, waConvoCount, refetchConvos, isViewAll, connectedWorkspaceIds]);

  // ── Last message map + pushName via RPC ────────────────────────────────────
  // Stabilize: only re-fetch when conversation IDs actually change
  const waConvoIdsSorted = useMemo(() =>
    waConversations.map(c => c.id).sort().join(","),
    [waConversations]
  );
  const lastMsgFetchVersionRef = useRef(0);
  useEffect(() => {
    if (!waConvoIdsSorted) return;
    const version = ++lastMsgFetchVersionRef.current;
    const fetchLastMessages = async () => {
      const convIds = waConvoIdsSorted.split(",");
      const map: Record<string, string> = {};
      const pnMap: Record<string, string> = {};

      const { data: rows, error } = await supabase.rpc("get_last_messages", {
        _conv_ids: convIds,
      });

      if (version !== lastMsgFetchVersionRef.current) return;
      if (error || !rows) {
        console.error("[get_last_messages] RPC error:", error);
        return;
      }

      for (const row of rows as any[]) {
        const prefix = row.direction === "outbound" ? "Você: " : "";
        const typeLabel = getMessageTypeLabel(row.type);
        map[row.conversation_id] = `${prefix}${row.content_text || typeLabel || ""}`;

        if (row.direction === "inbound") {
          const raw = row.content_raw as any;
          const pn = raw?.pushName;
          if (pn && typeof pn === "string" && pn.trim()) {
            pnMap[row.conversation_id] = pn.trim();
          }
        }
      }

      setLastMessageMap(prev => ({ ...prev, ...map }));
      setPushNameMap(prev => ({ ...prev, ...pnMap }));
    };
    fetchLastMessages();
  }, [waConvoIdsSorted]);

  // ── Contact name map + realtime subscription ───────────────────────────────
  const contactsFetchedRef = useRef(false);
  const fetchContacts = useCallback(async () => {
    if (!userId) return;
    const { data: contacts } = await supabase
      .from("contacts")
      .select("name, phone")
      .eq("user_id", userId);
    if (!contacts) return;
    const map: Record<string, string> = {};
    for (const c of contacts) {
      if (c.phone) {
        const normalized = c.phone.replace(/\D/g, "");
        if (normalized) map[normalized] = c.name;
      }
    }
    setContactNameMap(map);
  }, [userId]);

  useEffect(() => {
    if (!userId || contactsFetchedRef.current) return;
    contactsFetchedRef.current = true;
    fetchContacts();
    const interval = setInterval(fetchContacts, 120_000);

    const channel = supabase
      .channel("wa_contacts_rt")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "contacts",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        if (payload.eventType === "DELETE") return;
        const row = payload.new as any;
        if (row?.phone) {
          const normalized = row.phone.replace(/\D/g, "");
          if (normalized) {
            setContactNameMap(prev => ({ ...prev, [normalized]: row.name }));
          }
        }
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [userId, fetchContacts]);

  // ── User display name ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    Promise.resolve(supabase.from("profiles").select("display_name").eq("user_id", userId).single())
      .then(({ data }) => { if (data?.display_name) setUserDisplayName(data.display_name); })
      .catch(() => {});
  }, [userId]);

  // ── Status reconciliation: auto-recover when messages flow but status is stale ──
  const lastReconcileRef = useRef(0);
  useEffect(() => {
    if (!userId || waSessionStatus === "CONNECTED") return;
    // Only reconcile if we have real conversations (messages are flowing)
    if (waConversations.length === 0) return;

    const channel = supabase
      .channel("wa_status_reconcile")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "whatsapp_messages",
      }, async () => {
        const now = Date.now();
        if (now - lastReconcileRef.current < 60_000) return; // max once per 60s
        lastReconcileRef.current = now;
        console.debug("[wa-reconcile] New message arrived but status is", waSessionStatus, "— probing server...");
        try {
          await callWhatsappProxy("GET", "/status", undefined, waWorkspaceId, 12_000);
          // The /status call will update the DB, which triggers realtime → useWhatsappWebSession updates
        } catch (e) {
          console.warn("[wa-reconcile] Status probe failed:", e);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, waSessionStatus, waConversations.length, waWorkspaceId]);

  return {
    lastMessageMap,
    setLastMessageMap,
    contactNameMap,
    setContactNameMap,
    pushNameMap,
    userDisplayName,
  };
}

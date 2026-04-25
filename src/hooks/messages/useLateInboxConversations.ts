/**
 * useLateInboxConversations — Fetches and normalizes conversations
 * from the Late Inbox API via the late-proxy edge function.
 * Polls every 60s when tab is visible.
 *
 * Trata explicitamente o `error` retornado por `lateInvoke` (que NÃO lança):
 * sem isso, o estado de erro ficava sempre `null` em falhas de rede/auth.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useLateProxy } from "@/hooks/messages/useLateProxy";
import { lateInboxRoutes } from "@/hooks/messages/lateInboxHelpers";
import type { Conversation } from "@/lib/messageUtils";

interface LateInboxConversation {
  id: string;
  platform: string;
  participantId: string;
  participantName: string;
  participantPicture?: string;
  lastMessage?: string;
  unreadCount: number;
  accountId: string;
  accountUsername?: string;
  updatedAt: string;
  status?: string;
}

interface LateInboxResponse {
  data?: LateInboxConversation[];
  conversations?: LateInboxConversation[];
  nextCursor?: string;
}

export function useLateInboxConversations() {
  const { lateInvoke } = useLateProxy();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: invokeError } = await lateInvoke<LateInboxResponse>(
        lateInboxRoutes.listConversations(),
        "GET",
      );

      if (invokeError) {
        setError(invokeError);
        return;
      }

      const rawConvos = data?.data || data?.conversations || [];

      const normalized: Conversation[] = rawConvos.map((conv) => ({
        id: `late_${conv.id}`,
        name: conv.participantName || conv.participantId || "Desconhecido",
        platform: conv.platform?.toLowerCase() || "messaging",
        lastMessage: conv.lastMessage || "",
        time: conv.updatedAt
          ? new Date(conv.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
          : "",
        lastMessageAt: conv.updatedAt ? new Date(conv.updatedAt).getTime() : 0,
        unread: conv.unreadCount || 0,
        avatar: conv.participantPicture || (conv.participantName || "?")[0],
        channelId: conv.participantId || conv.id,
        pinned: false,
        archived: conv.status === "archived",
        muted: false,
        accountId: conv.accountId,
        accountUsername: conv.accountUsername,
        isLateInbox: true,
      }));

      setConversations(normalized);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao carregar conversas sociais";
      console.error("[useLateInboxConversations] Error:", err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [lateInvoke]);

  // Initial fetch + polling (cleanup-safe across StrictMode remounts)
  useEffect(() => {
    let cancelled = false;
    void fetchConversations();

    const startPolling = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        if (!cancelled && document.visibilityState === "visible") {
          void fetchConversations();
        }
      }, 60_000);
    };

    startPolling();

    const handleVisibility = () => {
      if (cancelled) return;
      if (document.visibilityState === "visible") {
        void fetchConversations();
        startPolling();
      } else if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchConversations]);

  const markAsReadLocally = useCallback((convoId: string) => {
    setConversations(prev => prev.map(c => c.id === convoId ? { ...c, unread: 0 } : c));
  }, []);

  return {
    conversations,
    isLoading,
    error,
    refetch: fetchConversations,
    markAsReadLocally,
  };
}

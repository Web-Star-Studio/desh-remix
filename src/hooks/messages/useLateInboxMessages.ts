/**
 * useLateInboxMessages — Fetches messages for a Late inbox conversation.
 * Only fetches when conversationId starts with "late_".
 *
 * Usa o helper centralizado para garantir encoding correto do accountId
 * e tratar erros estruturados de `lateInvoke`.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useLateProxy } from "@/hooks/messages/useLateProxy";
import {
  lateInboxRoutes,
  withAccountIdQuery,
} from "@/hooks/messages/lateInboxHelpers";
import type { ChatMessage } from "@/lib/messageUtils";

interface LateInboxMessage {
  id: string;
  content?: string;
  text?: string;
  message?: string;
  direction: "incoming" | "outgoing";
  senderName?: string;
  senderPicture?: string;
  createdAt?: string;
  timestamp?: string;
  attachments?: Array<{
    type: string;
    url?: string;
    thumbnailUrl?: string;
    fileName?: string;
    mimeType?: string;
  }>;
  isStoryReply?: boolean;
  isStoryMention?: boolean;
}

interface LateMessagesResponse {
  data?: LateInboxMessage[];
  messages?: LateInboxMessage[];
}

function normalizeMessage(msg: LateInboxMessage): ChatMessage {
  const text = msg.content || msg.text || msg.message || "";
  const dateStr = msg.createdAt || msg.timestamp || new Date().toISOString();
  const isMe = msg.direction === "outgoing";

  let mediaType: ChatMessage["mediaType"];
  let mediaThumbnail: string | undefined;
  let mediaFileName: string | undefined;
  let mediaMimetype: string | undefined;

  if (msg.attachments && msg.attachments.length > 0) {
    const att = msg.attachments[0];
    const t = att.type?.toLowerCase() || "";
    if (t.includes("image")) {
      mediaType = "image";
      mediaThumbnail = att.url || att.thumbnailUrl;
    } else if (t.includes("video")) {
      mediaType = "video";
      mediaThumbnail = att.url || att.thumbnailUrl;
    } else if (t.includes("audio")) {
      mediaType = "audio";
      mediaThumbnail = att.url;
    } else {
      mediaType = "document";
      mediaFileName = att.fileName;
      mediaThumbnail = att.url;
    }
    mediaMimetype = att.mimeType;
  }

  let displayText = text;
  if (msg.isStoryReply && !text) displayText = "📖 Respondeu ao story";
  if (msg.isStoryMention && !text) displayText = "📸 Mencionou no story";

  return {
    id: `late_msg_${msg.id}`,
    sender: isMe ? "Você" : (msg.senderName || "Desconhecido"),
    text: displayText || (mediaType ? "" : ""),
    time: new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    rawDate: dateStr,
    isMe,
    mediaType,
    mediaThumbnail,
    mediaFileName,
    mediaMimetype,
  };
}

export function useLateInboxMessages(conversationId: string | null, accountId?: string) {
  const { lateInvoke } = useLateProxy();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track the (convo, account) pair to avoid stale fetches when account loads late.
  const prevKeyRef = useRef<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!conversationId || !conversationId.startsWith("late_") || !accountId) {
      setMessages([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const route = withAccountIdQuery(
        lateInboxRoutes.listMessages(conversationId),
        accountId,
      );
      const { data, error: invokeError } = await lateInvoke<LateMessagesResponse>(route, "GET");

      if (invokeError) {
        setError(invokeError);
        return;
      }

      const rawMsgs = data?.data || data?.messages || [];
      const normalized = rawMsgs.map(normalizeMessage);
      normalized.sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime());
      setMessages(normalized);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao carregar mensagens";
      console.error("[useLateInboxMessages] Error:", err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, accountId, lateInvoke]);

  // Refetch when convo OR accountId changes (fixes empty state when account loads late).
  useEffect(() => {
    const key = `${conversationId ?? ""}::${accountId ?? ""}`;
    if (key !== prevKeyRef.current) {
      prevKeyRef.current = key;
      fetchMessages();
    }
  }, [conversationId, accountId, fetchMessages]);

  return { messages, isLoading, error, refetch: fetchMessages };
}

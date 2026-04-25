// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

// ─── Model ────────────────────────────────────────────────────────────────────

export interface WhatsappMessage {
  id: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  type: "text" | "image" | "audio" | "template" | "other";
  contentText: string | null;
  contentRaw: Json;
  sentAt: string;
  status: "delivered" | "read" | "failed" | "pending" | "sending";
  starred: boolean;
  deletedForEveryone: boolean;
  reactions: Array<{ emoji: string; fromMe?: boolean; timestamp?: number }>;
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function fromDb(row: Record<string, unknown>): WhatsappMessage {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    direction: row.direction as WhatsappMessage["direction"],
    type: row.type as WhatsappMessage["type"],
    contentText: row.content_text as string | null,
    contentRaw: (row.content_raw as Json) ?? {},
    sentAt: row.sent_at as string,
    status: row.status as WhatsappMessage["status"],
    starred: Boolean(row.starred),
    deletedForEveryone: Boolean(row.deleted_for_everyone),
    reactions: (row.reactions as WhatsappMessage["reactions"]) ?? [],
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SendWhatsappMessage {
  contentText?: string | null;
  contentRaw?: Json;
  type?: WhatsappMessage["type"];
}

export interface ReceiveWhatsappMessage {
  contentText?: string | null;
  contentRaw?: Json;
  type?: WhatsappMessage["type"];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWhatsappMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  // Load latest PAGE_SIZE messages (reset on conversation change)
  const refetch = useCallback(async () => {
    if (!conversationId) return;
    setIsLoading(true);
    offsetRef.current = 0;

    const { data, error, count } = await supabase
      .from("whatsapp_messages")
      .select("*", { count: "exact" })
      .eq("conversation_id", conversationId)
      .order("sent_at", { ascending: false })
      .range(0, PAGE_SIZE - 1);

    // Guard against stale responses
    if (conversationIdRef.current !== conversationId) {
      setIsLoading(false);
      return;
    }

    if (!error && data) {
      // Reverse so newest is at bottom
      setMessages(data.map(fromDb).reverse());
      offsetRef.current = data.length;
      setHasMore((count ?? 0) > data.length);
    }
    setIsLoading(false);
  }, [conversationId]);

  useEffect(() => {
    setMessages([]);
    setHasMore(false);
    refetch();
  }, [refetch]);

  /** Load older messages (prepend) — with deduplication */
  const loadMore = useCallback(async () => {
    if (!conversationId || !hasMore) return;

    const { data, error, count } = await supabase
      .from("whatsapp_messages")
      .select("*", { count: "exact" })
      .eq("conversation_id", conversationId)
      .order("sent_at", { ascending: false })
      .range(offsetRef.current, offsetRef.current + PAGE_SIZE - 1);

    if (!error && data && data.length > 0) {
      const older = data.map(fromDb).reverse();
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const newMsgs = older.filter((m) => !existingIds.has(m.id));
        return [...newMsgs, ...prev];
      });
      offsetRef.current += data.length;
      setHasMore(offsetRef.current < (count ?? 0));
    } else {
      setHasMore(false);
    }
  }, [conversationId, hasMore]);

  /** Add optimistic message to local state (returns temp id) */
  const addOptimistic = useCallback(
    (data: SendWhatsappMessage): WhatsappMessage => {
      const tempMsg: WhatsappMessage = {
        id: `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        conversationId: conversationId || "",
        direction: "outbound",
        type: data.type ?? "text",
        contentText: data.contentText ?? null,
        contentRaw: (data.contentRaw ?? {}) as Json,
        sentAt: new Date().toISOString(),
        status: "sending",
        starred: false,
        deletedForEveryone: false,
        reactions: [],
      };
      setMessages((prev) => [...prev, tempMsg]);
      return tempMsg;
    },
    [conversationId],
  );

  /** Replace optimistic message with real one or update status */
  const resolveOptimistic = useCallback(
    (tempId: string, realMsg?: WhatsappMessage) => {
      setMessages((prev) => {
        if (realMsg) {
          return prev.map((m) => (m.id === tempId ? realMsg : m));
        }
        // Mark as failed
        return prev.map((m) =>
          m.id === tempId ? { ...m, status: "failed" as const } : m,
        );
      });
    },
    [],
  );

  /** Send an outbound message */
  const sendMessage = useCallback(
    async (data: SendWhatsappMessage) => {
      if (!conversationId) return;
      const { data: row, error } = await supabase
        .from("whatsapp_messages")
        .insert({
          conversation_id: conversationId,
          direction: "outbound",
          type: data.type ?? "text",
          content_text: data.contentText ?? null,
          content_raw: (data.contentRaw ?? {}) as Json,
          status: "pending",
          sent_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (!error && row) {
        const mapped = fromDb(row as Record<string, unknown>);
        setMessages((prev) => [...prev, mapped]);
        return mapped;
      }
    },
    [conversationId],
  );

  /** Receive an inbound message (e.g. called from a webhook handler) */
  const receiveMessage = useCallback(
    async (data: ReceiveWhatsappMessage) => {
      if (!conversationId) return;
      const { data: row, error } = await supabase
        .from("whatsapp_messages")
        .insert({
          conversation_id: conversationId,
          direction: "inbound",
          type: data.type ?? "text",
          content_text: data.contentText ?? null,
          content_raw: (data.contentRaw ?? {}) as Json,
          status: "delivered",
          sent_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (!error && row) {
        const mapped = fromDb(row as Record<string, unknown>);
        setMessages((prev) => [...prev, mapped]);
        return mapped;
      }
    },
    [conversationId],
  );

  /** Append a message from realtime (avoid duplicates) */
  const appendFromRealtime = useCallback((row: Record<string, unknown>) => {
    const mapped = fromDb(row);
    setMessages((prev) => {
      // Skip if already exists (exact ID match)
      if (prev.some((m) => m.id === mapped.id)) return prev;
      // Remove matching optimistic messages:
      // Match by direction + approximate time (within 10s) + content similarity
      const withoutOptimistic = prev.filter((m) => {
        if (!m.id.startsWith("optimistic-")) return true;
        if (m.direction !== mapped.direction) return true;
        // Time proximity check
        const timeDiff = Math.abs(
          new Date(m.sentAt).getTime() - new Date(mapped.sentAt).getTime(),
        );
        if (timeDiff > 10_000) return true;
        // Content match (text or type)
        if (m.contentText === mapped.contentText) return false;
        if (m.type === mapped.type && m.type !== "text") return false;
        return true;
      });
      return [...withoutOptimistic, mapped];
    });
  }, []);

  /** Update an existing message from realtime UPDATE event (status changes) */
  const updateFromRealtime = useCallback((row: Record<string, unknown>) => {
    const mapped = fromDb(row);
    setMessages((prev) =>
      prev.map((m) => (m.id === mapped.id ? mapped : m)),
    );
  }, []);

  const updateMessageStatus = useCallback(
    async (id: string, status: WhatsappMessage["status"]) => {
      const { data: row, error } = await supabase
        .from("whatsapp_messages")
        .update({ status })
        .eq("id", id)
        .select()
        .single();
      if (!error && row) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id ? fromDb(row as Record<string, unknown>) : m,
          ),
        );
      }
    },
    [],
  );

  const deleteMessage = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("whatsapp_messages")
      .delete()
      .eq("id", id);
    if (!error) {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }
  }, []);

  return {
    messages,
    isLoading,
    hasMore,
    loadMore,
    sendMessage,
    receiveMessage,
    addOptimistic,
    resolveOptimistic,
    appendFromRealtime,
    updateFromRealtime,
    updateMessageStatus,
    deleteMessage,
    refetch,
  };
}

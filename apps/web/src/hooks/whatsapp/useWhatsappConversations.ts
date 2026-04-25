// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspaceSafe } from "@/contexts/WorkspaceContext";

// ─── Model ────────────────────────────────────────────────────────────────────

export interface WhatsappConversation {
  id: string;
  userId: string;
  channel: "whatsapp" | "whatsapp_web";
  externalContactId: string;
  title: string | null;
  lastMessageAt: string;
  unreadCount: number;
  labels: string[];
  profilePictureUrl: string | null;
  workspaceId: string | null;
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function fromDb(row: Record<string, unknown>): WhatsappConversation {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    channel: row.channel as "whatsapp" | "whatsapp_web",
    externalContactId: row.external_contact_id as string,
    title: row.title as string | null,
    lastMessageAt: row.last_message_at as string,
    unreadCount: row.unread_count as number,
    labels: (row.labels as string[]) ?? [],
    profilePictureUrl: (row.profile_picture_url as string) ?? null,
    workspaceId: (row.workspace_id as string) ?? null,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export type UpsertWhatsappConversation = Pick<
  WhatsappConversation,
  "externalContactId" | "title" | "unreadCount" | "labels"
>;

export function useWhatsappConversations() {
  const { user } = useAuth();
  const wsCtx = useWorkspaceSafe();
  const activeWorkspaceId = wsCtx?.activeWorkspaceId ?? null;
  const [conversations, setConversations] = useState<WhatsappConversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const userIdRef = useRef<string | null>(null);

  // Keep ref in sync
  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user]);

  const refetch = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    let query = supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("last_message_at", { ascending: false });
    if (activeWorkspaceId) {
      query = query.eq("workspace_id", activeWorkspaceId);
    }
    const { data, error } = await query;
    if (!error && data) {
      setConversations(data.map(fromDb));
    }
    setIsLoading(false);
  }, [user, activeWorkspaceId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Realtime subscription — stable, no deps on derived arrays
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("wa_convos_hook_rt")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "whatsapp_conversations",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        if (payload.eventType === "INSERT") {
          const mapped = fromDb(payload.new as Record<string, unknown>);
          setConversations(prev => {
            if (prev.some(c => c.id === mapped.id)) return prev;
            return [mapped, ...prev];
          });
        } else if (payload.eventType === "UPDATE") {
          const mapped = fromDb(payload.new as Record<string, unknown>);
          setConversations(prev =>
            prev.map(c => (c.id === mapped.id ? mapped : c))
              .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
          );
        } else if (payload.eventType === "DELETE") {
          const oldId = (payload.old as Record<string, unknown>).id as string;
          setConversations(prev => prev.filter(c => c.id !== oldId));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]); // stable dep — just user.id string

  /** Insert or update by (user_id, external_contact_id) unique constraint */
  const upsertConversation = useCallback(
    async (data: UpsertWhatsappConversation) => {
      if (!user) return;
      const upsert = {
        user_id: user.id,
        channel: "whatsapp",
        external_contact_id: data.externalContactId,
        title: data.title ?? null,
        unread_count: data.unreadCount ?? 0,
        labels: data.labels ?? [],
        last_message_at: new Date().toISOString(),
      };
      const { data: row, error } = await supabase
        .from("whatsapp_conversations")
        .upsert(upsert, { onConflict: "user_id,external_contact_id" })
        .select()
        .single();
      if (!error && row) {
        const mapped = fromDb(row as Record<string, unknown>);
        setConversations((prev) => {
          const exists = prev.find((c) => c.id === mapped.id);
          return exists
            ? prev.map((c) => (c.id === mapped.id ? mapped : c))
            : [mapped, ...prev];
        });
        return mapped;
      }
    },
    [user]
  );

  const markAsRead = useCallback(async (id: string) => {
    const { data: row, error } = await supabase
      .from("whatsapp_conversations")
      .update({ unread_count: 0 })
      .eq("id", id)
      .select()
      .single();
    if (!error && row) {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? fromDb(row as Record<string, unknown>) : c))
      );
    }
  }, []);

  const markAsUnread = useCallback(async (id: string) => {
    const { data: row, error } = await supabase
      .from("whatsapp_conversations")
      .update({ unread_count: 1 })
      .eq("id", id)
      .select()
      .single();
    if (!error && row) {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? fromDb(row as Record<string, unknown>) : c))
      );
    }
  }, []);

  const updateLabels = useCallback(async (id: string, labels: string[]) => {
    const { data: row, error } = await supabase
      .from("whatsapp_conversations")
      .update({ labels })
      .eq("id", id)
      .select()
      .single();
    if (!error && row) {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? fromDb(row as Record<string, unknown>) : c))
      );
    }
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("whatsapp_conversations")
      .delete()
      .eq("id", id);
    if (!error) {
      setConversations((prev) => prev.filter((c) => c.id !== id));
    }
  }, []);

  return {
    conversations,
    isLoading,
    upsertConversation,
    markAsRead,
    markAsUnread,
    updateLabels,
    deleteConversation,
    refetch,
  };
}

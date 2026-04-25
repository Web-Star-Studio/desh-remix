// TODO: Migrar para edge function — acesso direto ao Supabase
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Types — canonical definitions live in /src/types/ai.ts
export type { AIMessage, AIConversation } from "@/types/ai";
import type { AIMessage, AIConversation } from "@/types/ai";

export function useAIConversations(projectId?: string | null, agentId?: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["ai_conversations", user?.id, projectId, agentId];

  const query = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("ai_conversations")
        .select("*")
        .eq("user_id", user!.id)
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false });
      if (projectId) q = q.eq("project_id", projectId);
      if (agentId) q = q.eq("agent_id", agentId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        messages: (typeof d.messages === "string" ? JSON.parse(d.messages) : d.messages) as AIMessage[],
      })) as AIConversation[];
    },
  });

  const create = useMutation({
    mutationFn: async (params: { title?: string; agent_id?: string | null; project_id?: string | null; messages?: AIMessage[] }) => {
      const { data, error } = await supabase.from("ai_conversations").insert({
        user_id: user!.id,
        title: params.title || "Nova Conversa",
        agent_id: params.agent_id || null,
        project_id: params.project_id || null,
        messages: JSON.stringify(params.messages || []) as any,
      }).select().single();
      if (error) throw error;
      return { ...data, messages: (typeof data.messages === "string" ? JSON.parse(data.messages as any) : data.messages) as AIMessage[] } as AIConversation;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai_conversations"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AIConversation> & { id: string }) => {
      const payload: any = { ...updates };
      if (updates.messages) payload.messages = JSON.stringify(updates.messages);
      delete payload.id;
      delete payload.user_id;
      delete payload.created_at;
      delete payload.updated_at;
      const { error } = await supabase.from("ai_conversations").update(payload).eq("id", id);
      if (error) throw error;
    },
    // Optimistic update for messages to avoid UI lag
    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey: ["ai_conversations"] });
      const prev = qc.getQueryData<AIConversation[]>(key);
      if (prev && variables.messages) {
        qc.setQueryData<AIConversation[]>(key, prev.map(c =>
          c.id === variables.id ? { ...c, ...variables, updated_at: new Date().toISOString() } : c
        ));
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["ai_conversations"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_conversations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai_conversations"] }),
  });

  return { conversations: query.data || [], isLoading: query.isLoading, create, update, remove };
}

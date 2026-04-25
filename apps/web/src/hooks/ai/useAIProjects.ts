// TODO: Migrar para edge function — acesso direto ao Supabase
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Types — canonical definitions live in /src/types/ai.ts
export type { AIProject } from "@/types/ai";
import type { AIProject } from "@/types/ai";

export function useAIProjects() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["ai_projects", user?.id],
    enabled: !!user,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_projects")
        .select("*")
        .eq("user_id", user!.id)
        .eq("archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AIProject[];
    },
  });

  const create = useMutation({
    mutationFn: async (params: { name: string; description?: string; color?: string; icon?: string }) => {
      const { data, error } = await supabase.from("ai_projects").insert({
        user_id: user!.id,
        ...params,
      }).select().single();
      if (error) throw error;
      return data as AIProject;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai_projects"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AIProject> & { id: string }) => {
      const { error } = await supabase.from("ai_projects").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai_projects"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai_projects"] }),
  });

  return { projects: query.data || [], isLoading: query.isLoading, create, update, remove };
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export interface SocialAIInsight {
  id: string;
  action_type: string;
  action_label: string;
  context_data: string | null;
  result_text: string;
  created_at: string;
}

export function useSocialAIInsights() {
  const { user } = useAuth();
  const { activeWorkspaceId, defaultWorkspace } = useWorkspace();
  const wsId = activeWorkspaceId || defaultWorkspace?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["social_ai_insights", user?.id, wsId],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<SocialAIInsight[]> => {
      const { data, error } = await supabase
        .from("social_ai_insights")
        .select("id, action_type, action_label, context_data, result_text, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as SocialAIInsight[];
    },
  });

  const save = useMutation({
    mutationFn: async (insight: { action_type: string; action_label: string; context_data: string; result_text: string }) => {
      const { error } = await supabase.from("social_ai_insights").insert({
        user_id: user!.id,
        workspace_id: wsId ?? null,
        ...insight,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social_ai_insights"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("social_ai_insights").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social_ai_insights"] }),
  });

  return {
    insights: query.data ?? [],
    isLoading: query.isLoading,
    saveInsight: save.mutateAsync,
    removeInsight: remove.mutateAsync,
  };
}

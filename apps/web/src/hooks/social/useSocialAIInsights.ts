import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export interface SocialAIInsight {
  id: string;
  actionType: string;
  actionLabel: string;
  contextData: string | null;
  resultText: string;
  createdAt: string;
}

interface InsertInput {
  actionType: string;
  actionLabel: string;
  contextData: string | null;
  resultText: string;
}

export function useSocialAIInsights() {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["social_ai_insights", user?.id, activeWorkspaceId],
    enabled: !!user && !!activeWorkspaceId,
    staleTime: 60_000,
    queryFn: async (): Promise<SocialAIInsight[]> => {
      if (!activeWorkspaceId) return [];
      const res = await apiFetch<{ insights: SocialAIInsight[] }>(
        `/workspaces/${activeWorkspaceId}/social-ai-insights`,
      );
      return res.insights ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (insight: InsertInput) => {
      if (!activeWorkspaceId) throw new Error("no_workspace");
      await apiFetch(`/workspaces/${activeWorkspaceId}/social-ai-insights`, {
        method: "POST",
        body: JSON.stringify(insight),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social_ai_insights"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!activeWorkspaceId) throw new Error("no_workspace");
      await apiFetch(`/workspaces/${activeWorkspaceId}/social-ai-insights/${id}`, {
        method: "DELETE",
      });
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

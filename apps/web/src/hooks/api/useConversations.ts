import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface ApiConversation {
  id: string;
  workspaceId: string;
  agentProfileId: string;
  createdBy: string;
  title: string | null;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export const conversationsKey = (workspaceId: string) =>
  ["conversations", workspaceId] as const;

export function useConversations(workspaceId: string | null) {
  return useQuery<ApiConversation[]>({
    queryKey: workspaceId ? conversationsKey(workspaceId) : ["conversations", "none"],
    queryFn: () =>
      apiFetch<ApiConversation[]>(`/workspaces/${workspaceId}/conversations`),
    enabled: !!workspaceId,
    staleTime: 15_000,
  });
}

export function useCreateConversation(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title?: string; agentProfileId?: string }) =>
      apiFetch<ApiConversation>(`/workspaces/${workspaceId}/conversations`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      if (workspaceId) qc.invalidateQueries({ queryKey: conversationsKey(workspaceId) });
    },
  });
}

export function useUpdateConversation(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { title?: string; status?: "active" | "archived" } }) =>
      apiFetch<ApiConversation>(`/conversations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      if (workspaceId) qc.invalidateQueries({ queryKey: conversationsKey(workspaceId) });
    },
  });
}

export function useDeleteConversation(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/conversations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      if (workspaceId) qc.invalidateQueries({ queryKey: conversationsKey(workspaceId) });
    },
  });
}

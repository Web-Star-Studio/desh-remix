import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface ApiWorkspace {
  id: string;
  name: string;
  slug: string | null;
  icon: string;
  color: string;
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  role?: "owner" | "admin" | "member";
}

export interface ApiWorkspaceCreate {
  name: string;
  icon?: string;
  color?: string;
  isDefault?: boolean;
}

export interface ApiWorkspacePatch {
  name?: string;
  icon?: string;
  color?: string;
  isDefault?: boolean;
}

export const workspacesKey = ["workspaces"] as const;

export function useWorkspaces(enabled = true) {
  return useQuery<ApiWorkspace[]>({
    queryKey: workspacesKey,
    queryFn: () => apiFetch<ApiWorkspace[]>("/workspaces"),
    enabled,
    staleTime: 30_000,
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ApiWorkspaceCreate) =>
      apiFetch<ApiWorkspace>("/workspaces", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workspacesKey });
    },
  });
}

export function useUpdateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ApiWorkspacePatch }) =>
      apiFetch<ApiWorkspace>(`/workspaces/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workspacesKey });
    },
  });
}

export function useDeleteWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/workspaces/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workspacesKey });
    },
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface ApiAgentProfile {
  id: string;
  workspaceId: string;
  displayName: string;
  hermesProfileName: string;
  hermesPort: number | null;
  status: string;
  provider: string;
  modelId: string;
  systemPrompt: string | null;
  config: Record<string, unknown>;
  lastStartedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useAgentProfiles(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: ["agent-profiles", workspaceId],
    enabled: !!workspaceId,
    queryFn: () =>
      apiFetch<ApiAgentProfile[]>(`/workspaces/${workspaceId}/agent-profiles`),
  });
}

export function useUpdateAgentProfile(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      profileId,
      patch,
    }: {
      profileId: string;
      patch: {
        displayName?: string;
        modelId?: string;
        systemPrompt?: string | null;
        config?: Record<string, unknown>;
      };
    }) =>
      apiFetch<ApiAgentProfile>(
        `/workspaces/${workspaceId}/agent-profiles/${profileId}`,
        { method: "PATCH", body: JSON.stringify(patch) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-profiles", workspaceId] });
    },
  });
}

// Convenience: PATCH only the model id on the workspace's primary profile.
// Backend stops the running gateway so the next message picks up the new model.
export function useUpdateAgentModel(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (modelId: string) =>
      apiFetch<ApiAgentProfile>(
        `/workspaces/${workspaceId}/agent/settings/model`,
        { method: "PATCH", body: JSON.stringify({ modelId }) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-profiles", workspaceId] });
    },
  });
}

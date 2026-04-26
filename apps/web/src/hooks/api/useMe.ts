import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface ApiMe {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  onboardingCompleted: boolean;
}

export interface ApiMePatch {
  displayName?: string;
  onboardingCompleted?: boolean;
}

export const meKey = ["me"] as const;

export function useMe(enabled = true) {
  return useQuery<ApiMe>({
    queryKey: meKey,
    queryFn: () => apiFetch<ApiMe>("/me"),
    enabled,
    staleTime: 30_000,
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ApiMePatch) =>
      apiFetch<ApiMe>("/me", { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: (data) => {
      qc.setQueryData(meKey, data);
    },
  });
}

// TODO: Migrar para edge function — acesso direto ao Supabase
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useComposioWorkspaceId, useDefaultWorkspaceId } from "./useComposioWorkspaceId";

/**
 * useComposioProxy — Wrapper for calling the composio-proxy edge function.
 * Handles NOT_CONNECTED and TOKEN_EXPIRED error mapping.
 * Auto-injects workspace_id for multi-workspace isolation.
 */
export function useComposioProxy() {
  const composioWorkspaceId = useComposioWorkspaceId();
  const defaultWorkspaceId = useDefaultWorkspaceId();

  const callComposioProxy = useCallback(
    async (params: {
      service: string;
      path: string;
      method?: string;
      data?: Record<string, unknown>;
      params?: Record<string, unknown>;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "composio-proxy",
        {
          body: {
            ...params,
            workspace_id: composioWorkspaceId,
            default_workspace_id: defaultWorkspaceId,
          },
        }
      );

      if (error) throw error;

      if (data?.error === "not_connected") {
        throw new Error(`NOT_CONNECTED:${params.service}`);
      }

      if (data?.error === "token_expired") {
        throw new Error(`TOKEN_EXPIRED:${params.service}`);
      }

      return data;
    },
    [composioWorkspaceId, defaultWorkspaceId]
  );

  return { callComposioProxy };
}

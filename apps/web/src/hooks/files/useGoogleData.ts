/**
 * useGoogleData — Low-level hook for making one-off Google API calls via composio-proxy.
 * Automatically invalidates the service cache on successful write operations.
 * Auto-injects workspace_id for multi-workspace isolation.
 */
import { useState, useCallback } from "react";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { invalidateGoogleCache } from "@/hooks/integrations/useGoogleServiceData";
import { useComposioWorkspaceId, useDefaultWorkspaceId } from "@/hooks/integrations/useComposioWorkspaceId";

interface GoogleDataOptions {
  service: string;
  path: string;
  method?: string;
  params?: Record<string, string>;
  body?: unknown;
  connectionId?: string;
}

export function useGoogleData() {
  const { invoke } = useEdgeFn();
  const composioWorkspaceId = useComposioWorkspaceId();
  const defaultWorkspaceId = useDefaultWorkspaceId();
  const [loading, setLoading] = useState(false);

  const fetchGoogleData = useCallback(async <T = unknown>(options: GoogleDataOptions): Promise<T | null> => {
    setLoading(true);
    try {
      const { data, error } = await invoke<T>({
        fn: "composio-proxy",
        body: {
          ...options,
          workspace_id: composioWorkspaceId,
          default_workspace_id: defaultWorkspaceId,
        },
      });
      if (error) {
        console.error("[useGoogleData] error:", error);
        return null;
      }
      // Auto-invalidate cache for the service on successful write operations
      const method = (options.method || "GET").toUpperCase();
      if (method !== "GET" && data) {
        invalidateGoogleCache(options.service);
      }
      return data;
    } catch (err) {
      console.error("[useGoogleData] fetch error:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [composioWorkspaceId, defaultWorkspaceId]);

  return { fetchGoogleData, loading };
}

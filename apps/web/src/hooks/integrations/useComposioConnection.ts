import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useComposioWorkspaceId } from "./useComposioWorkspaceId";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { ComposioConnection } from "@/types/composio";
export type { ComposioConnection };

// Backend response shape for GET /workspaces/:id/composio-connections.
// Mirrors apps/api/src/routes/composio.ts merge output.
interface ApiConnection {
  id: string | null;
  toolkit: string;
  scope: "workspace" | "member";
  status: string;
  composioEntityId: string;
  email: string | null;
  connectedAt: string | null;
  live: boolean;
}

function normalizeToolkitSlug(value: string): string {
  return value.toLowerCase().replace(/\s/g, "").replace(/_/g, "");
}

function toLegacyShape(api: ApiConnection): ComposioConnection {
  return {
    toolkit: api.toolkit,
    connectionId: api.composioEntityId,
    status: api.live ? "ACTIVE" : (api.status?.toUpperCase() ?? "INITIATED"),
    connectedAt: api.connectedAt ?? new Date().toISOString(),
    email: api.email,
  };
}

export function useComposioConnection() {
  const { user } = useAuth();
  const workspaceId = useComposioWorkspaceId();
  const [connections, setConnections] = useState<ComposioConnection[]>([]);
  const [connectedToolkits, setConnectedToolkits] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    if (!user || !workspaceId || workspaceId === "default") {
      setConnections([]);
      setConnectedToolkits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const apiRows = await apiFetch<ApiConnection[]>(
        `/workspaces/${workspaceId}/composio-connections`,
      );
      const normalized = apiRows.map(toLegacyShape);
      setConnections(normalized);
      setConnectedToolkits(normalized.filter((c) => c.status === "ACTIVE").map((c) => c.toolkit));
      setError(null);
    } catch (err) {
      const message = err instanceof ApiError
        ? `composio_list_${err.status}`
        : err instanceof Error ? err.message : "composio_list_failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user, workspaceId]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  // Refresh after returning from an OAuth popup.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const wasConnecting = sessionStorage.getItem("composio_connecting_toolkit");
        if (wasConnecting) {
          sessionStorage.removeItem("composio_connecting_toolkit");
          setTimeout(() => fetchConnections(), 1500);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [fetchConnections]);

  useEffect(() => {
    const handleFocus = () => {
      const wasConnecting = sessionStorage.getItem("composio_connecting_toolkit");
      if (wasConnecting) {
        sessionStorage.removeItem("composio_connecting_toolkit");
        setTimeout(() => fetchConnections(), 1500);
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchConnections]);

  const isConnected = useCallback(
    (toolkit: string) => {
      const checkSlug = normalizeToolkitSlug(toolkit);
      return connections.some(
        (c) => normalizeToolkitSlug(c.toolkit ?? "") === checkSlug && c.status === "ACTIVE",
      );
    },
    [connections],
  );

  // Hits POST /workspaces/:id/composio-connections/:toolkit/connect, returns
  // the Composio OAuth URL (or null on failure).
  const initiate = useCallback(
    async (toolkit: string): Promise<string | null> => {
      if (!user || !workspaceId || workspaceId === "default") return null;
      try {
        const res = await apiFetch<{ redirectUrl: string; toolkit: string }>(
          `/workspaces/${workspaceId}/composio-connections/${encodeURIComponent(toolkit)}/connect`,
          { method: "POST", body: JSON.stringify({}) },
        );
        return res.redirectUrl;
      } catch (err) {
        const message = err instanceof Error ? err.message : "composio_connect_failed";
        setError(message);
        return null;
      }
    },
    [user, workspaceId],
  );

  const connectToolkitAndWait = useCallback(
    (toolkit: string): Promise<boolean> =>
      new Promise(async (resolve) => {
        const url = await initiate(toolkit);
        if (!url) return resolve(false);
        const popup = window.open(url, "_blank", "width=600,height=700,scrollbars=yes,resizable=yes");
        if (!popup) {
          window.location.href = url;
          resolve(false);
          return;
        }
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            setTimeout(async () => {
              await fetchConnections();
              resolve(true);
            }, 1500);
          }
        }, 500);
      }),
    [initiate, fetchConnections],
  );

  const getConnectUrl = useCallback(
    (toolkit: string): Promise<string | null> => initiate(toolkit),
    [initiate],
  );

  const connectToolkit = useCallback(
    async (toolkit: string) => {
      const url = await initiate(toolkit);
      if (!url) throw new Error(error ?? "composio_connect_failed");
      sessionStorage.setItem("composio_connecting_toolkit", toolkit);
      const popup = window.open(url, "_blank", "width=600,height=700,scrollbars=yes,resizable=yes");
      if (popup) {
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            sessionStorage.removeItem("composio_connecting_toolkit");
            setTimeout(() => fetchConnections(), 1500);
          }
        }, 500);
      } else {
        window.location.href = url;
      }
    },
    [initiate, fetchConnections, error],
  );

  const connectMultipleToolkits = useCallback(
    async (
      toolkits: string[],
      onProgress?: (index: number, toolkit: string, status: "connecting" | "done" | "error") => void,
    ): Promise<string[]> => {
      if (!user || toolkits.length === 0) return [];
      const connected: string[] = [];
      for (let i = 0; i < toolkits.length; i++) {
        const tk = toolkits[i];
        onProgress?.(i, tk, "connecting");
        const success = await connectToolkitAndWait(tk);
        if (success) {
          connected.push(tk);
          onProgress?.(i, tk, "done");
        } else {
          onProgress?.(i, tk, "error");
        }
      }
      return connected;
    },
    [user, connectToolkitAndWait],
  );

  const disconnectToolkit = useCallback(
    async (toolkit: string) => {
      if (!user || !workspaceId || workspaceId === "default") return;
      try {
        await apiFetch<{ removed: number; toolkit: string }>(
          `/workspaces/${workspaceId}/composio-connections/${encodeURIComponent(toolkit)}`,
          { method: "DELETE" },
        );
        await fetchConnections();
      } catch (err) {
        const message = err instanceof Error ? err.message : "composio_disconnect_failed";
        setError(message);
        throw err;
      }
    },
    [user, workspaceId, fetchConnections],
  );

  const handleComposioCallback = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const isCallback = params.get("composio_callback") === "true";
    if (!isCallback) return false;

    await new Promise((resolve) => setTimeout(resolve, 2000));
    await fetchConnections();

    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, "", cleanUrl);

    return true;
  }, [fetchConnections]);

  return {
    connections,
    connectedToolkits,
    loading,
    error,
    isConnected,
    getConnectUrl,
    connectToolkit,
    connectMultipleToolkits,
    disconnectToolkit,
    handleComposioCallback,
    fetchConnections,
  };
}

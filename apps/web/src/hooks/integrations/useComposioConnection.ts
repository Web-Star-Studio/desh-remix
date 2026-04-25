// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useComposioWorkspaceId } from "./useComposioWorkspaceId";
import type { ComposioConnection } from "@/types/composio";
export type { ComposioConnection };

export function useComposioConnection() {
  const { user } = useAuth();
  const workspaceId = useComposioWorkspaceId();
  const [connections, setConnections] = useState<ComposioConnection[]>([]);
  const [connectedToolkits, setConnectedToolkits] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "integrations-connect",
        { body: { action: "status", workspace_id: workspaceId } }
      );
      if (error) throw error;

      const normalizeToolkitSlug = (value: string) =>
        value.toLowerCase().replace(/\s/g, '').replace(/_/g, '')

      const getToolkitFamily = (value: string) => {
        const slug = normalizeToolkitSlug(value)
        if (slug === 'gmail' || slug === 'youtube' || slug.startsWith('google')) return 'google'
        if (['outlook', 'onedrive', 'teams'].includes(slug)) return 'microsoft'
        return slug
      }

      const detailed: { toolkit: string; email?: string | null; connectedAt?: string | null }[] = data.detailed || [];
      const connected: string[] = data.connected || detailed.map((d: any) => d.toolkit);
      setConnectedToolkits(connected);

      const detailMap = new Map<string, { email: string | null; connectedAt: string | null }>();
      const familyMap = new Map<string, { email: string | null; connectedAt: string | null }>();

      detailed.forEach((d: any) => {
        const normalizedToolkit = normalizeToolkitSlug(d.toolkit)
        const info = { email: d.email || null, connectedAt: d.connectedAt || null }
        detailMap.set(normalizedToolkit, info)
        if (info.email && !familyMap.has(getToolkitFamily(normalizedToolkit))) {
          familyMap.set(getToolkitFamily(normalizedToolkit), info)
        }
      });

      setConnections(
        connected.map((toolkit: string) => {
          const normalizedToolkit = normalizeToolkitSlug(toolkit)
          const info = detailMap.get(normalizedToolkit) || familyMap.get(getToolkitFamily(normalizedToolkit))
          return {
            toolkit: normalizedToolkit,
            connectionId: normalizedToolkit,
            status: "ACTIVE",
            connectedAt: info?.connectedAt || new Date().toISOString(),
            email: info?.email || null,
          };
        })
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, workspaceId]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const wasConnecting = sessionStorage.getItem('composio_connecting_toolkit')
        if (wasConnecting) {
          sessionStorage.removeItem('composio_connecting_toolkit')
          setTimeout(() => fetchConnections(), 1500)
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [fetchConnections])

  useEffect(() => {
    const handleFocus = () => {
      const wasConnecting = sessionStorage.getItem('composio_connecting_toolkit')
      if (wasConnecting) {
        sessionStorage.removeItem('composio_connecting_toolkit')
        setTimeout(() => fetchConnections(), 1500)
      }
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchConnections])

  const isConnected = useCallback(
    (toolkit: string) => {
      return connections.some(c => {
        const connectedSlug = (c.toolkit || '').toLowerCase().replace(/\s/g, '').replace(/_/g, '')
        const checkSlug = toolkit.toLowerCase().replace(/\s/g, '').replace(/_/g, '')
        return connectedSlug === checkSlug && c.status === 'ACTIVE'
      })
    },
    [connections]
  );

  // Returns a promise that resolves when the popup closes and connections are refreshed
  const connectToolkitAndWait = useCallback(
    (toolkit: string): Promise<boolean> => {
      return new Promise(async (resolve) => {
        if (!user) return resolve(false);
        try {
          const { data, error } = await supabase.functions.invoke(
            "integrations-connect",
            { body: { action: "connect", toolkit, workspace_id: workspaceId } }
          );
          if (error) throw error;
          if (data.url) {
            const popup = window.open(
              data.url,
              "_blank",
              "width=600,height=700,scrollbars=yes,resizable=yes"
            );
            if (popup) {
              const checkClosed = setInterval(() => {
                if (popup.closed) {
                  clearInterval(checkClosed);
                  setTimeout(async () => {
                    await fetchConnections();
                    resolve(true);
                  }, 1500);
                }
              }, 500);
            } else {
              // Popup blocked — fall back to redirect
              window.location.href = data.url;
              resolve(false);
            }
          } else {
            resolve(false);
          }
        } catch (err: any) {
          setError(err.message);
          resolve(false);
        }
      });
    },
    [user, workspaceId, fetchConnections]
  );

  const getConnectUrl = useCallback(
    async (toolkit: string): Promise<string | null> => {
      if (!user) return null;
      try {
        const { data, error } = await supabase.functions.invoke(
          "integrations-connect",
          { body: { action: "connect", toolkit, workspace_id: workspaceId } }
        );
        if (error) throw error;
        return data?.url || null;
      } catch (err: any) {
        setError(err.message);
        return null;
      }
    },
    [user, workspaceId]
  );

  const connectToolkit = useCallback(
    async (toolkit: string) => {
      if (!user) return;
      try {
        const { data, error } = await supabase.functions.invoke(
          "integrations-connect",
          { body: { action: "connect", toolkit, workspace_id: workspaceId } }
        );
        if (error) throw error;
        if (data.url) {
          sessionStorage.setItem("composio_connecting_toolkit", toolkit);
          const popup = window.open(
            data.url,
            "_blank",
            "width=600,height=700,scrollbars=yes,resizable=yes"
          );
          if (popup) {
            const checkClosed = setInterval(() => {
              if (popup.closed) {
                clearInterval(checkClosed);
                sessionStorage.removeItem("composio_connecting_toolkit");
                setTimeout(() => fetchConnections(), 1500);
              }
            }, 500);
          } else {
            window.location.href = data.url;
          }
        }
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [user, workspaceId, fetchConnections]
  );

  const connectMultipleToolkits = useCallback(
    async (
      toolkits: string[],
      onProgress?: (index: number, toolkit: string, status: "connecting" | "done" | "error") => void
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
    [user, connectToolkitAndWait]
  );

  const disconnectToolkit = useCallback(
    async (toolkit: string) => {
      if (!user) return;
      try {
        const { data, error } = await supabase.functions.invoke(
          "integrations-connect",
          { body: { action: "disconnect", toolkit, workspace_id: workspaceId } }
        );
        if (error) throw error;
        await fetchConnections();
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [user, workspaceId, fetchConnections]
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

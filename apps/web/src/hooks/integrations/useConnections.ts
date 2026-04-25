import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspaceFilter } from "@/hooks/workspace/useWorkspaceFilter";

export interface Connection {
  id: string;
  integrationId: string;
  name: string;
  category: string;
  status: "active" | "inactive";
  platform: string;
}

export const useConnections = () => {
  const { user } = useAuth();
  const { activeWorkspaceId, getInsertWorkspaceId } = useWorkspaceFilter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  const abortRef = useRef<AbortController | null>(null);

  const fetchConnections = useCallback(async (signal?: AbortSignal) => {
    if (!user) { setLoading(false); return; }
    let query = supabase
      .from("connections")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (activeWorkspaceId) {
      query = query.eq("workspace_id", activeWorkspaceId);
    }
    if (signal) query = query.abortSignal(signal);

    const { data, error } = await query;

    if (signal?.aborted) return;
    if (error) {
      if (error.message?.includes("AbortError") || error.message?.includes("aborted")) return;
      console.error("Error fetching connections:", error);
      setLoading(false);
      return;
    }

    setConnections(
      (data || []).map((row: any) => ({
        id: row.id,
        integrationId: row.integration_id,
        name: row.name,
        category: row.category,
        status: row.status as "active" | "inactive",
        platform: row.platform,
      }))
    );
    setLoading(false);
  }, [user, activeWorkspaceId]);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    fetchConnections(controller.signal);
    return () => { controller.abort(); };
  }, [fetchConnections]);

  const addConnection = useCallback(async (connection: Connection) => {
    if (!user) return;
    const wsId = getInsertWorkspaceId();
    const { error } = await supabase.from("connections").upsert({
      id: connection.id,
      integration_id: connection.integrationId,
      name: connection.name,
      category: connection.category,
      status: connection.status,
      platform: connection.platform,
      user_id: user.id,
      ...(wsId ? { workspace_id: wsId } : {}),
    } as any);

    if (error) {
      console.error("Error adding connection:", error);
      return;
    }

    setConnections((prev) => {
      const filtered = prev.filter((c) => c.id !== connection.id);
      return [connection, ...filtered];
    });
  }, [user, getInsertWorkspaceId]);

  const removeConnection = useCallback(async (id: string) => {
    const { error } = await supabase.from("connections").delete().eq("id", id);

    if (error) {
      console.error("Error removing connection:", error);
      return;
    }

    setConnections((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const getConnectionByCategory = useCallback(
    (category: string) => {
      return connections.find(
        (c) => c.category === category && c.status === "active"
      );
    },
    [connections]
  );

  const getConnectionsByCategory = useCallback(
    (category: string) => {
      return connections.filter(
        (c) => c.category === category && c.status === "active"
      );
    },
    [connections]
  );

  const connectionCountByCategory = useCallback(
    (category: string) => {
      return connections.filter(
        (c) => c.category === category && c.status === "active"
      ).length;
    },
    [connections]
  );

  const isConnected = useCallback(
    (category: string) => {
      return connections.some(
        (c) => c.category === category && c.status === "active"
      );
    },
    [connections]
  );

  return useMemo(() => ({
    connections,
    loading,
    addConnection,
    removeConnection,
    getConnectionByCategory,
    getConnectionsByCategory,
    connectionCountByCategory,
    isConnected,
  }), [connections, loading, addConnection, removeConnection, getConnectionByCategory, getConnectionsByCategory, connectionCountByCategory, isConnected]);
};

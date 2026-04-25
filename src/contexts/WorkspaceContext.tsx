import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspacePreferences } from "@/hooks/workspace/useWorkspacePreferences";

// Types — canonical definitions live in /src/types/workspace.ts
export type { Workspace, WorkspaceContextShape } from "@/types/workspace";
import type { Workspace, WorkspaceContextShape } from "@/types/workspace";

const WorkspaceContext = createContext<WorkspaceContextShape | null>(null);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  const { preferences, updatePreferences } = useWorkspacePreferences(user?.id);

  useEffect(() => {
    if (!user) {
      setWorkspaces([]);
      setActiveWorkspaceId(null);
      setLoading(false);
      hasFetched.current = false;
      return;
    }
    if (hasFetched.current) return;
    hasFetched.current = true;

    const fetch = async () => {
      setLoading(true);
      try {
        await supabase.rpc("ensure_default_workspace", { _user_id: user.id });

        const [wsRes, profRes] = await Promise.all([
          supabase.from("workspaces").select("*").eq("user_id", user.id).order("sort_order"),
          supabase.from("profiles").select("active_workspace_id").eq("user_id", user.id).single(),
        ]);

        if (wsRes.data) setWorkspaces(wsRes.data as unknown as Workspace[]);
        if (profRes.data) setActiveWorkspaceId((profRes.data as any).active_workspace_id ?? null);
      } catch (err) {
        console.error("WorkspaceContext fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user]);

  const activeWorkspace = useMemo(
    () => workspaces.find(w => w.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId]
  );
  const defaultWorkspace = useMemo(
    () => workspaces.find(w => w.is_default) ?? workspaces[0] ?? null,
    [workspaces]
  );

  const switchWorkspace = useCallback(async (id: string | null) => {
    setActiveWorkspaceId(id);
    if (user) {
      await supabase.from("profiles").update({ active_workspace_id: id } as any).eq("user_id", user.id);
    }
  }, [user]);

  const setViewAll = useCallback(() => switchWorkspace(null), [switchWorkspace]);

  const createWorkspace = useCallback(async (data: { name: string; icon: string; color: string; description?: string; industry?: string }): Promise<Workspace | null> => {
    if (!user) return null;
    const nextOrder = workspaces.length;
    const { data: inserted, error } = await supabase
      .from("workspaces")
      .insert({
        user_id: user.id,
        name: data.name,
        icon: data.icon,
        color: data.color,
        sort_order: nextOrder,
        is_default: false,
        ...(data.description ? { description: data.description } : {}),
        ...(data.industry ? { industry: data.industry } : {}),
      } as any)
      .select()
      .single();
    if (error || !inserted) { console.error(error); return null; }
    const ws = inserted as unknown as Workspace;
    setWorkspaces(prev => [...prev, ws]);
    return ws;
  }, [user, workspaces.length]);

  const updateWorkspace = useCallback(async (id: string, data: Partial<Workspace>) => {
    const { id: _id, user_id: _uid, created_at: _ca, ...safeData } = data as any;
    await supabase.from("workspaces").update(safeData).eq("id", id);
    setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, ...safeData } : w));
  }, []);

  const deleteWorkspace = useCallback(async (id: string) => {
    await supabase.from("workspaces").delete().eq("id", id);
    setWorkspaces(prev => prev.filter(w => w.id !== id));
    if (activeWorkspaceId === id) switchWorkspace(null);
  }, [activeWorkspaceId, switchWorkspace]);

  const setDefaultWorkspace = useCallback(async (id: string) => {
    if (!user) return;
    await supabase.from("workspaces").update({ is_default: false } as any).eq("user_id", user.id);
    await supabase.from("workspaces").update({ is_default: true } as any).eq("id", id);
    setWorkspaces(prev => prev.map(w => ({ ...w, is_default: w.id === id })));
  }, [user]);

  const value = useMemo<WorkspaceContextShape>(() => ({
    workspaces, activeWorkspace, activeWorkspaceId, defaultWorkspace, loading, preferences,
    switchWorkspace, setViewAll, createWorkspace, updateWorkspace, deleteWorkspace, setDefaultWorkspace,
    updatePreferences,
  }), [workspaces, activeWorkspace, activeWorkspaceId, defaultWorkspace, loading, preferences,
    switchWorkspace, setViewAll, createWorkspace, updateWorkspace, deleteWorkspace, setDefaultWorkspace,
    updatePreferences]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
};

/** Safe version that returns null when outside WorkspaceProvider (e.g. at app root level) */
export const useWorkspaceSafe = () => {
  return useContext(WorkspaceContext);
};

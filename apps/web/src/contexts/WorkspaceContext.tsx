import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useCreateWorkspace,
  useDeleteWorkspace,
  useUpdateWorkspace,
  useWorkspaces,
  type ApiWorkspace,
} from "@/hooks/api/useWorkspaces";

// Types — canonical definitions live in /src/types/workspace.ts
export type { Workspace, WorkspaceContextShape } from "@/types/workspace";
import type { Workspace, WorkspaceContextShape } from "@/types/workspace";

const ACTIVE_WORKSPACE_STORAGE_KEY = "desh.activeWorkspaceId";

function toLegacyShape(w: ApiWorkspace, fallbackUserId: string, sortOrder: number): Workspace {
  return {
    id: w.id,
    user_id: w.createdBy ?? fallbackUserId,
    name: w.name,
    icon: w.icon,
    color: w.color,
    is_default: w.isDefault,
    sort_order: sortOrder,
    created_at: w.createdAt,
  };
}

const WorkspaceContext = createContext<WorkspaceContextShape | null>(null);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const enabled = !!user;

  const { data: apiWorkspaces, isLoading } = useWorkspaces(enabled);
  const createMut = useCreateWorkspace();
  const updateMut = useUpdateWorkspace();
  const deleteMut = useDeleteWorkspace();

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY);
  });

  const workspaces = useMemo<Workspace[]>(() => {
    if (!apiWorkspaces) return [];
    const fallbackUid = user?.id ?? "";
    return apiWorkspaces.map((w, idx) => toLegacyShape(w, fallbackUid, idx));
  }, [apiWorkspaces, user?.id]);

  // Auto-pick active workspace from default if nothing stored.
  useEffect(() => {
    if (activeWorkspaceId) return;
    const def = workspaces.find((w) => w.is_default) ?? workspaces[0];
    if (def) setActiveWorkspaceId(def.id);
  }, [workspaces, activeWorkspaceId]);

  // Clear local state on sign-out.
  useEffect(() => {
    if (!user) {
      setActiveWorkspaceId(null);
      window.localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
    }
  }, [user]);

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId],
  );

  const defaultWorkspace = useMemo(
    () => workspaces.find((w) => w.is_default) ?? workspaces[0] ?? null,
    [workspaces],
  );

  const switchWorkspace = useCallback((id: string | null) => {
    setActiveWorkspaceId(id);
    if (id) {
      window.localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, id);
    } else {
      window.localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
    }
  }, []);

  const setViewAll = useCallback(() => switchWorkspace(null), [switchWorkspace]);

  const createWorkspace = useCallback(
    async (data: { name: string; icon: string; color: string; description?: string; industry?: string }): Promise<Workspace | null> => {
      try {
        const created = await createMut.mutateAsync({
          name: data.name,
          icon: data.icon,
          color: data.color,
        });
        return toLegacyShape(created, user?.id ?? "", workspaces.length);
      } catch (err) {
        console.error("createWorkspace failed", err);
        return null;
      }
    },
    [createMut, user?.id, workspaces.length],
  );

  const updateWorkspace = useCallback(
    async (id: string, data: Partial<Workspace>) => {
      const patch: { name?: string; icon?: string; color?: string; isDefault?: boolean } = {};
      if (data.name !== undefined) patch.name = data.name;
      if (data.icon !== undefined) patch.icon = data.icon;
      if (data.color !== undefined) patch.color = data.color;
      if (data.is_default !== undefined) patch.isDefault = data.is_default;
      if (Object.keys(patch).length === 0) return;
      try {
        await updateMut.mutateAsync({ id, patch });
      } catch (err) {
        console.error("updateWorkspace failed", err);
      }
    },
    [updateMut],
  );

  const deleteWorkspace = useCallback(
    async (id: string) => {
      try {
        await deleteMut.mutateAsync(id);
        if (activeWorkspaceId === id) switchWorkspace(null);
      } catch (err) {
        console.error("deleteWorkspace failed", err);
      }
    },
    [deleteMut, activeWorkspaceId, switchWorkspace],
  );

  const setDefaultWorkspace = useCallback(
    async (id: string) => {
      await updateMut.mutateAsync({ id, patch: { isDefault: true } });
    },
    [updateMut],
  );

  // Preferences are not persisted server-side anymore. Stub to keep the
  // WorkspaceContextShape interface stable for legacy callers.
  const updatePreferences = useCallback(async () => {}, []);

  const value = useMemo<WorkspaceContextShape>(
    () => ({
      workspaces,
      activeWorkspace,
      activeWorkspaceId,
      defaultWorkspace,
      loading: isLoading,
      preferences: null,
      switchWorkspace,
      setViewAll,
      createWorkspace,
      updateWorkspace,
      deleteWorkspace,
      setDefaultWorkspace,
      updatePreferences,
    }),
    [
      workspaces,
      activeWorkspace,
      activeWorkspaceId,
      defaultWorkspace,
      isLoading,
      switchWorkspace,
      setViewAll,
      createWorkspace,
      updateWorkspace,
      deleteWorkspace,
      setDefaultWorkspace,
      updatePreferences,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
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

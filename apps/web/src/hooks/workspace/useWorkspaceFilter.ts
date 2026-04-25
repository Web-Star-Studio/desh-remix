import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useCallback } from "react";

/**
 * Hook that provides workspace-aware query filtering.
 * When a specific workspace is active, filters by workspace_id.
 * When in "view all" mode (null), returns all data regardless of workspace_id.
 */
export function useWorkspaceFilter() {
  const { activeWorkspaceId, workspaces } = useWorkspace();

  /**
   * Apply workspace filter to a Supabase query builder.
   * Usage: applyFilter(supabase.from("tasks").select("*").eq("user_id", uid))
   */
  const applyFilter = useCallback(
    <T extends { eq: (col: string, val: string) => T }>(query: T): T => {
      if (activeWorkspaceId) {
        return query.eq("workspace_id", activeWorkspaceId);
      }
      // In "view all" mode, don't filter by workspace_id
      return query;
    },
    [activeWorkspaceId]
  );

  /**
   * Get the workspace_id to attach to new records.
   * Returns the active workspace ID, or the default workspace when in "view all" mode.
   */
  const getInsertWorkspaceId = useCallback((): string | null => {
    if (activeWorkspaceId) return activeWorkspaceId;
    // In "view all" mode, fall back to the default workspace
    const defaultWs = workspaces.find(w => w.is_default);
    return defaultWs?.id ?? workspaces[0]?.id ?? null;
  }, [activeWorkspaceId, workspaces]);

  return { activeWorkspaceId, applyFilter, getInsertWorkspaceId };
}

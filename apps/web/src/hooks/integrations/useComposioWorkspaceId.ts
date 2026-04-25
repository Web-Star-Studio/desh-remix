import { useWorkspaceSafe } from "@/contexts/WorkspaceContext";

/**
 * Returns the effective workspace_id for Composio API calls.
 * - Active workspace → its ID
 * - "All" mode (null) → default workspace ID or 'default'
 * - Outside WorkspaceProvider → 'default'
 */
export function useComposioWorkspaceId(): string {
  const ctx = useWorkspaceSafe();
  if (!ctx) return "default";
  const { activeWorkspaceId, defaultWorkspace } = ctx;
  return activeWorkspaceId || defaultWorkspace?.id || "default";
}

/**
 * Returns the default workspace ID (for 'all' mode fallback).
 */
export function useDefaultWorkspaceId(): string {
  const ctx = useWorkspaceSafe();
  if (!ctx) return "default";
  return ctx.defaultWorkspace?.id || "default";
}

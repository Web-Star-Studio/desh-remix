/**
 * Composite hook that aggregates stable identity data from Auth, Workspace,
 * and Connections contexts into a single memoised object.
 *
 * Components that only need "who am I + where am I + what's connected" can
 * import this single hook instead of three separate context hooks, and will
 * only re-render when one of the selected primitive values actually changes.
 */
import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useConnections } from "@/contexts/ConnectionsContext";

export function useCurrentUserContext() {
  const { user, profile } = useAuth();
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const { isConnected } = useConnections();

  return useMemo(() => ({
    userId: user?.id ?? null,
    displayName: profile?.display_name ?? null,
    workspaceId: activeWorkspaceId,
    workspaceName: activeWorkspace?.name ?? null,
    hasGmail: isConnected("email"),
    hasCalendar: isConnected("calendar"),
    hasWhatsapp: isConnected("whatsapp"),
  }), [
    user?.id,
    profile?.display_name,
    activeWorkspaceId,
    activeWorkspace?.name,
    isConnected,
  ]);
}

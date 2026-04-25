/**
 * useIntegrations — Domain facade for Integrations module.
 */
import { useComposioConnection } from "./useComposioConnection";
import { useComposioWorkspaceId } from "./useComposioWorkspaceId";
import { useConnections } from "./useConnections";

export function useIntegrations() {
  const composio = useComposioConnection();
  const composioWsId = useComposioWorkspaceId();
  const connections = useConnections();

  return {
    composioConnected: composio.isConnected,
    composioLoading: composio.loading,
    composioWorkspaceId: composioWsId,
    connections: connections.connections,
    connectionsLoading: connections.loading,
    addConnection: connections.addConnection,
    removeConnection: connections.removeConnection,
  } as const;
}

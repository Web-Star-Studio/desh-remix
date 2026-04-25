import { createContext, useContext, ReactNode } from "react";
import { useConnections as useConnectionsHook, Connection } from "@/hooks/integrations/useConnections";

interface ConnectionsContextType {
  connections: Connection[];
  loading: boolean;
  addConnection: (connection: Connection) => Promise<void>;
  removeConnection: (id: string) => Promise<void>;
  getConnectionByCategory: (category: string) => Connection | undefined;
  getConnectionsByCategory: (category: string) => Connection[];
  connectionCountByCategory: (category: string) => number;
  isConnected: (category: string) => boolean;
}

const ConnectionsContext = createContext<ConnectionsContextType | null>(null);

export const ConnectionsProvider = ({ children }: { children: ReactNode }) => {
  const value = useConnectionsHook();
  return (
    <ConnectionsContext.Provider value={value}>
      {children}
    </ConnectionsContext.Provider>
  );
};

export const useConnections = (): ConnectionsContextType => {
  const ctx = useContext(ConnectionsContext);
  if (!ctx) throw new Error("useConnections must be used within ConnectionsProvider");
  return ctx;
};

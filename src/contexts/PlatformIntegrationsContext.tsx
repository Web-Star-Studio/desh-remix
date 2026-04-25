import { createContext, useContext, ReactNode } from "react";
import { usePlatformIntegrations } from "@/hooks/integrations/usePlatformIntegrations";

interface PlatformIntegrationsContextType {
  isIntegrationEnabled: (id: string) => boolean;
  loading: boolean;
  integrations: any[];
  toggleIntegration: (id: string, enabled: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

const PlatformIntegrationsContext = createContext<PlatformIntegrationsContextType | null>(null);

export const PlatformIntegrationsProvider = ({ children }: { children: ReactNode }) => {
  const value = usePlatformIntegrations();
  return (
    <PlatformIntegrationsContext.Provider value={value}>
      {children}
    </PlatformIntegrationsContext.Provider>
  );
};

export const usePlatformIntegrationsContext = (): PlatformIntegrationsContextType => {
  const ctx = useContext(PlatformIntegrationsContext);
  if (!ctx) throw new Error("usePlatformIntegrationsContext must be used within PlatformIntegrationsProvider");
  return ctx;
};

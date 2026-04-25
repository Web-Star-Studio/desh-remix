import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceSafe } from "@/contexts/WorkspaceContext";

interface DemoContextType {
  isDemoMode: boolean;
  isLoading: boolean;
  demoWorkspaceId: string | null;
  activateDemo: () => Promise<void>;
  deactivateDemo: () => Promise<void>;
  /** Legacy compat — prefer activateDemo/deactivateDemo */
  toggleDemoMode: () => void;
  setDemoMode: (v: boolean) => void;
}

const DemoContext = createContext<DemoContextType>({
  isDemoMode: false,
  isLoading: false,
  demoWorkspaceId: null,
  activateDemo: async () => {},
  deactivateDemo: async () => {},
  toggleDemoMode: () => {},
  setDemoMode: () => {},
});

const STORAGE_KEY = "desh-demo-mode";
const WS_KEY = "desh-demo-workspace-id";

function loadDemo(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
}
function loadWsId(): string | null {
  try { return localStorage.getItem(WS_KEY); } catch { return null; }
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(loadDemo);
  const [isLoading, setIsLoading] = useState(false);
  const [demoWorkspaceId, setDemoWorkspaceId] = useState<string | null>(loadWsId);
  const wsCtx = useWorkspaceSafe();

  const activateDemo = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("demo-seed", {
        body: { action: "activate" },
      });
      if (error) throw error;
      const wsId = data?.workspaceId;
      setIsDemoMode(true);
      setDemoWorkspaceId(wsId);
      localStorage.setItem(STORAGE_KEY, "true");
      localStorage.setItem(WS_KEY, wsId);
      // Switch workspace context so DashboardContext re-fetches with demo data
      if (wsCtx?.switchWorkspace) {
        wsCtx.switchWorkspace(wsId);
      }
    } catch (err) {
      console.error("Failed to activate demo:", err);
    } finally {
      setIsLoading(false);
    }
  }, [wsCtx]);

  const deactivateDemo = useCallback(async () => {
    setIsLoading(true);
    try {
      const wsIdToClean = demoWorkspaceId;
      await supabase.functions.invoke("demo-seed", {
        body: { action: "deactivate", workspaceId: wsIdToClean },
      });
      setIsDemoMode(false);
      setDemoWorkspaceId(null);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(WS_KEY);

      // Clean up all localStorage keys scoped to the demo workspace
      if (wsIdToClean) {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.includes(wsIdToClean)) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      }

      // Switch back to "view all" so DashboardContext re-fetches without demo data
      if (wsCtx?.switchWorkspace) {
        wsCtx.switchWorkspace(null);
      }
    } catch (err) {
      console.error("Failed to deactivate demo:", err);
    } finally {
      setIsLoading(false);
    }
  }, [demoWorkspaceId, wsCtx]);

  // Legacy compat
  const setDemoMode = useCallback((v: boolean) => {
    if (v) activateDemo();
    else deactivateDemo();
  }, [activateDemo, deactivateDemo]);

  const toggleDemoMode = useCallback(() => {
    if (isDemoMode) deactivateDemo();
    else activateDemo();
  }, [isDemoMode, activateDemo, deactivateDemo]);

  return (
    <DemoContext.Provider value={{ isDemoMode, isLoading, demoWorkspaceId, activateDemo, deactivateDemo, toggleDemoMode, setDemoMode }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  return useContext(DemoContext);
}

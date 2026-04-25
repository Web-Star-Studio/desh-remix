import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "@/hooks/use-toast";
import {
  errResult,
  okResult,
  toWABAError,
  type WABAResult,
} from "@/services/zernio/types";

export interface ZernioSyncResult {
  synced: number;
  profile_id?: string;
  accounts?: { platform: string; username: string; late_account_id: string }[];
}

/**
 * Hook to (re)sync accounts from the linked Zernio profile into local
 * `social_accounts`. Used by the WhatsApp Business overview to hydrate the UI
 * after manually linking a profile.
 *
 * Returns the canonical `WABAResult` envelope so it composes with the rest of
 * the WhatsApp hook surface (`useZernioWhatsApp`, `useSendWhatsAppMessage`).
 */
export function useZernioSyncAccounts() {
  const { activeWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<ZernioSyncResult | null>(null);

  const sync = useCallback(async (): Promise<WABAResult<ZernioSyncResult>> => {
    if (!activeWorkspace?.id) {
      toast({ title: "Selecione um workspace", variant: "destructive" });
      return errResult({
        message: "Selecione um workspace antes de sincronizar.",
        code: "validation_error",
      });
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("zernio-sync-accounts", {
        body: { workspace_id: activeWorkspace.id },
      });
      if (error) throw error;
      const result = data as ZernioSyncResult;
      setLastResult(result);
      toast({
        title: "Sincronização concluída",
        description: `${result.synced} conta(s) sincronizada(s) do Zernio.`,
      });
      return okResult(result);
    } catch (e) {
      const info = toWABAError(e);
      toast({
        title: "Erro na sincronização",
        description: info.message || "Falha ao sincronizar contas Zernio.",
        variant: "destructive",
      });
      return errResult(info);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id]);

  return { sync, loading, lastResult };
}

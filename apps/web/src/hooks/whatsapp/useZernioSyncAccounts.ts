import { useCallback, useState } from "react";
import { zernioClient } from "@/services/zernio/client";
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
  profileId?: string;
  accounts?: { platform: string; username: string | null; zernioAccountId: string }[];
}

/**
 * Hook to (re)sync accounts from the linked Zernio profile into local
 * `social_accounts`. Used by the WhatsApp Business overview to hydrate the UI
 * after manually linking a profile. Now backed by apps/api
 * `POST /workspaces/:id/zernio/sync-accounts`.
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
      const result = await zernioClient.forWorkspace(activeWorkspace.id).accounts.sync();
      const adapted: ZernioSyncResult = {
        synced: result.synced,
        profileId: result.profileId,
        accounts: (result.accounts ?? []).map((a) => ({
          platform: (a as { platform?: string }).platform ?? "unknown",
          username: (a as { username?: string | null }).username ?? null,
          zernioAccountId:
            (a as { zernioAccountId?: string })?.zernioAccountId ??
            (a as { _id?: string })._id ??
            "",
        })),
      };
      setLastResult(adapted);
      toast({
        title: "Sincronização concluída",
        description: `${adapted.synced} conta(s) sincronizada(s) do Zernio.`,
      });
      return okResult(adapted);
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

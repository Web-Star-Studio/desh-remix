import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { toast } from "@/hooks/use-toast";
import { Loader2, FolderSymlink } from "lucide-react";

interface TransferItem {
  id: string;
  name: string;
  mimeType: string;
  connectionId?: string;
}

interface Props {
  item: TransferItem | null;
  currentWorkspaceId?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TransferWorkspaceDialog({ item, currentWorkspaceId, onClose, onSuccess }: Props) {
  const { workspaces } = useWorkspace();
  const { invoke } = useEdgeFn();
  const [connections, setConnections] = useState<any[]>([]);
  const [transferring, setTransferring] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    Promise.resolve(supabase.from("connections").select("*").eq("category", "cloud_storage")).then(({ data }) => {
      if (data) setConnections(data);
    }).catch((err) => console.error("Load connections error:", err));
  }, [item]);

  const otherWorkspaces = workspaces.filter(ws => {
    if (ws.id === currentWorkspaceId) return false;
    return connections.some(c => c.workspace_id === ws.id);
  });

  const handleTransfer = async (targetWsId: string) => {
    if (!item) return;
    const targetConn = connections.find((c: any) => c.workspace_id === targetWsId);
    const sourceConn = item.connectionId
      ? { id: item.connectionId }
      : connections.find((c: any) => c.workspace_id === currentWorkspaceId);
    if (!targetConn || !sourceConn) {
      toast({ title: "Erro", description: "Conexão não encontrada.", variant: "destructive" });
      return;
    }
    const targetWs = workspaces.find(w => w.id === targetWsId);
    setTransferring(targetWsId);
    try {
      const { data, error } = await invoke<any>({
        fn: "drive-cross-copy",
        body: {
          fileId: item.id,
          fileName: item.name,
          mimeType: item.mimeType,
          sourceConnectionId: sourceConn.id,
          targetConnectionId: targetConn.id,
        },
      });
      if (error) throw new Error(error);
      if (data?.error) throw new Error(data.error);
      toast({ title: "Transferido!", description: `"${item.name}" → ${targetWs?.icon} ${targetWs?.name}` });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast({ title: "Erro ao transferir", description: err?.message, variant: "destructive" });
    } finally {
      setTransferring(null);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FolderSymlink className="w-4 h-4 text-primary" />
            Transferir para outro perfil
          </DialogTitle>
        </DialogHeader>
        {item && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground truncate">
              Arquivo: <strong className="text-foreground">{item.name}</strong>
            </p>
            {otherWorkspaces.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum outro perfil com Drive conectado.
              </p>
            ) : (
              <div className="space-y-1.5">
                {otherWorkspaces.map(ws => (
                  <button
                    key={ws.id}
                    onClick={() => handleTransfer(ws.id)}
                    disabled={!!transferring}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-colors text-left disabled:opacity-50"
                  >
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                      style={{ background: `${ws.color}20` }}
                    >
                      {ws.icon}
                    </span>
                    <span className="flex-1 text-sm font-medium text-foreground">{ws.name}</span>
                    {transferring === ws.id && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

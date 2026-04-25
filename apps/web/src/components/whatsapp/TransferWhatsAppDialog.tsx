import { useState, useEffect } from "react";
import { ArrowRightLeft, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  currentWorkspaceId: string | null;
  onTransferred: () => void;
}

export default function TransferWhatsAppDialog({ open, onClose, currentWorkspaceId, onTransferred }: Props) {
  const { workspaces } = useWorkspace();
  const [targetId, setTargetId] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setTargetId(null);
      setConfirming(false);
    }
  }, [open]);

  const available = workspaces.filter(w => w.id !== currentWorkspaceId);
  const currentWs = workspaces.find(w => w.id === currentWorkspaceId);
  const targetWs = workspaces.find(w => w.id === targetId);

  async function handleTransfer() {
    if (!targetId || !currentWorkspaceId) return;

    // First click → show confirmation
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setTransferring(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession?.access_token) throw new Error("Não autenticado");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-transfer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${authSession.access_token}`,
          },
          body: JSON.stringify({
            currentWorkspaceId,
            targetWorkspaceId: targetId,
          }),
        },
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro ao transferir");

      toast({
        title: "WhatsApp transferido ✅",
        description: `Conexão movida para ${targetWs?.icon} ${targetWs?.name}. Reconecte no novo workspace.`,
      });

      onTransferred();
      onClose();
    } catch (err: any) {
      console.error("Transfer error:", err);
      toast({ title: "Erro ao transferir", description: err.message, variant: "destructive" });
      setConfirming(false);
    } finally {
      setTransferring(false);
    }
  }

  // Reset confirmation when target changes
  useEffect(() => {
    setConfirming(false);
  }, [targetId]);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
            Transferir Conexão WhatsApp
          </DialogTitle>
          <DialogDescription>
            Mova sua conexão WhatsApp para outro workspace. Você precisará reconectar via QR Code no novo workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Current workspace */}
          <div className="text-xs text-muted-foreground">Workspace atual</div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border">
            <span className="text-lg">{currentWs?.icon || "🏠"}</span>
            <span className="text-sm font-medium">{currentWs?.name || "Principal"}</span>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <ArrowRightLeft className="w-4 h-4 text-muted-foreground rotate-90" />
          </div>

          {/* Target workspace selection */}
          <div className="text-xs text-muted-foreground">Transferir para</div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {available.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum outro workspace disponível
              </p>
            ) : (
              available.map(ws => (
                <button
                  key={ws.id}
                  onClick={() => setTargetId(ws.id)}
                  disabled={transferring}
                  className={`flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border text-left transition-colors ${
                    targetId === ws.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card hover:bg-accent/10 text-foreground"
                  }`}
                >
                  <span className="text-lg">{ws.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{ws.name}</p>
                    {ws.industry && (
                      <p className="text-[10px] text-muted-foreground truncate">{ws.industry}</p>
                    )}
                  </div>
                  {targetId === ws.id && (
                    <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              A sessão será desconectada e a instância será removida.
              Você precisará escanear o QR Code novamente no novo workspace.
              Todas as conversas serão transferidas.
            </p>
          </div>

          {/* Confirmation banner */}
          {confirming && targetWs && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-xs text-foreground">
                Confirma a transferência de <strong>{currentWs?.icon} {currentWs?.name}</strong> para{" "}
                <strong>{targetWs.icon} {targetWs.name}</strong>? Clique em "Confirmar" para prosseguir.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={transferring}>
            Cancelar
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!targetId || transferring}
            variant={confirming ? "default" : "outline"}
          >
            {transferring ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Transferindo...</>
            ) : confirming ? (
              <><CheckCircle2 className="w-4 h-4 mr-1" /> Confirmar</>
            ) : (
              <><ArrowRightLeft className="w-4 h-4 mr-1" /> Transferir</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

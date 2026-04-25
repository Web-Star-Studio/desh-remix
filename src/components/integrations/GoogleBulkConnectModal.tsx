import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Loader2, Circle, XCircle, AlertTriangle } from "lucide-react";
import {
  startConnectionQueue,
  getConnectionQueue,
  advanceQueue,
  hasNextInQueue,
  getNextToolkit,
  clearConnectionQueue,
  getToolkitDisplayName,
  type ConnectionQueue,
} from "@/lib/google-connection-queue";

const GOOGLE_TOOLKITS = [
  { id: "gmail", name: "Gmail", description: "Emails, inbox e envio", icon: "✉️" },
  { id: "googlecalendar", name: "Google Calendar", description: "Eventos e agenda", icon: "📅" },
  { id: "googledrive", name: "Google Drive", description: "Arquivos e pastas", icon: "📁" },
  { id: "googletasks", name: "Google Tasks", description: "Tarefas e listas", icon: "✅" },
  { id: "googlecontacts", name: "Google Contacts", description: "Contatos sincronizados", icon: "👥" },
];

export type BulkConnectStatus = "idle" | "progress" | "completed";

interface GoogleBulkConnectModalProps {
  open: boolean;
  onClose: () => void;
  isConnected: (toolkit: string) => boolean;
  getConnectUrl: (toolkit: string) => Promise<string | null>;
  /** Optional: called when queue finishes so parent can refresh */
  onQueueFinished?: () => void;
  /** If set, modal opens in progress/completed mode from a queue */
  resumeQueue?: ConnectionQueue | null;
}

export function GoogleBulkConnectModal({
  open,
  onClose,
  isConnected,
  getConnectUrl,
  onQueueFinished,
  resumeQueue,
}: GoogleBulkConnectModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<BulkConnectStatus>("idle");
  const [queue, setQueue] = useState<ConnectionQueue | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const notConnected = useMemo(
    () => GOOGLE_TOOLKITS.filter((t) => !isConnected(t.id)),
    [isConnected]
  );

  // Initialize when modal opens
  useEffect(() => {
    if (!open) return;

    if (resumeQueue) {
      setQueue(resumeQueue);
      if (resumeQueue.currentIndex >= resumeQueue.toolkits.length) {
        setStatus("completed");
      } else {
        setStatus("progress");
      }
      return;
    }

    setSelected(new Set(notConnected.map((t) => t.id)));
    setStatus("idle");
    setQueue(null);
    setRedirecting(false);
  }, [open, resumeQueue, notConnected]);

  // When in progress mode from resume, auto-advance after delay
  useEffect(() => {
    if (status !== "progress" || !queue || redirecting) return;
    if (queue.currentIndex >= queue.toolkits.length) {
      setStatus("completed");
      onQueueFinished?.();
      return;
    }

    // Wait 1.5s so user sees progress, then redirect to next OAuth
    const timer = setTimeout(async () => {
      const nextToolkit = getNextToolkit();
      if (!nextToolkit) {
        setStatus("completed");
        onQueueFinished?.();
        return;
      }

      setRedirecting(true);
      try {
        const url = await getConnectUrl(nextToolkit);
        if (url) {
          window.location.href = url;
        } else {
          // Failed to get URL — mark as error, advance
          const updated = advanceQueue(false);
          setQueue(updated);
          setRedirecting(false);
        }
      } catch {
        const updated = advanceQueue(false);
        setQueue(updated);
        setRedirecting(false);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [status, queue, redirecting, getConnectUrl, onQueueFinished]);

  const selectedCount = selected.size;
  const allNotConnectedSelected =
    notConnected.length > 0 && notConnected.every((t) => selected.has(t.id));

  const toggleAll = () => {
    if (allNotConnectedSelected) setSelected(new Set());
    else setSelected(new Set(notConnected.map((t) => t.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStart = async () => {
    const toolkits = GOOGLE_TOOLKITS.filter((t) => selected.has(t.id)).map((t) => t.id);
    if (toolkits.length === 0) return;

    // Save queue to localStorage
    startConnectionQueue(toolkits, "default");
    const q = getConnectionQueue();
    setQueue(q);
    setStatus("progress");

    // Get URL for first toolkit and redirect
    const firstToolkit = toolkits[0];
    setRedirecting(true);
    try {
      const url = await getConnectUrl(firstToolkit);
      if (url) {
        window.location.href = url;
      } else {
        const updated = advanceQueue(false);
        setQueue(updated);
        setRedirecting(false);
      }
    } catch {
      const updated = advanceQueue(false);
      setQueue(updated);
      setRedirecting(false);
    }
  };

  const handleCancel = () => {
    clearConnectionQueue();
    setStatus("idle");
    setQueue(null);
    setRedirecting(false);
    onClose();
  };

  const handleRetryFailed = async () => {
    if (!queue || queue.failedToolkits.length === 0) return;
    startConnectionQueue(queue.failedToolkits, queue.workspaceId);
    const newQ = getConnectionQueue();
    setQueue(newQ);
    setStatus("progress");
    setRedirecting(false);
  };

  // Build status for each toolkit in the queue
  const getToolkitStatus = (toolkitId: string): "done" | "error" | "connecting" | "pending" | null => {
    if (!queue) return null;
    if (queue.completedToolkits.includes(toolkitId)) return "done";
    if (queue.failedToolkits.includes(toolkitId)) return "error";
    const idx = queue.toolkits.indexOf(toolkitId);
    if (idx === -1) return null;
    if (idx === queue.currentIndex) return "connecting";
    if (idx > queue.currentIndex) return "pending";
    return null;
  };

  const doneCount = queue?.completedToolkits.length || 0;
  const failedCount = queue?.failedToolkits.length || 0;
  const totalCount = queue?.toolkits.length || 0;
  const progressPercent = totalCount > 0 ? ((doneCount + failedCount) / totalCount) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && status !== "progress" && handleCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {status === "completed"
              ? failedCount > 0
                ? `${doneCount} de ${totalCount} conectados`
                : "Tudo conectado! 🎉"
              : status === "progress"
              ? "Conectando serviços..."
              : "Conectar serviços Google"}
          </DialogTitle>
          <DialogDescription>
            {status === "completed"
              ? failedCount > 0
                ? `${failedCount} serviço(s) falharam. Você pode tentar novamente.`
                : `${doneCount} serviço(s) conectado(s) com sucesso`
              : status === "progress"
              ? "Você será redirecionado para autorizar cada serviço. Não feche esta janela."
              : "Selecione os serviços e autorize cada um"}
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        {status !== "idle" && (
          <Progress value={progressPercent} className="h-2" />
        )}

        <div className="space-y-1 max-h-[360px] overflow-y-auto py-2">
          {/* Select all (idle only) */}
          {status === "idle" && notConnected.length > 1 && (
            <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 cursor-pointer border-b border-border/30 mb-1">
              <Checkbox
                checked={allNotConnectedSelected}
                onCheckedChange={toggleAll}
              />
              <span className="text-sm font-medium">Selecionar todos</span>
            </label>
          )}

          {/* Toolkit list */}
          {(status === "idle" ? GOOGLE_TOOLKITS : []).map((toolkit) => {
            const connected = isConnected(toolkit.id);
            return (
              <div
                key={toolkit.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  connected ? "opacity-60" : "hover:bg-muted/50"
                }`}
              >
                <Checkbox
                  checked={connected || selected.has(toolkit.id)}
                  disabled={connected}
                  onCheckedChange={() => !connected && toggleOne(toolkit.id)}
                />
                <span className="text-lg leading-none">{toolkit.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{toolkit.name}</span>
                    {connected && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        Conectado ✓
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {toolkit.description}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Queue progress list */}
          {status !== "idle" && queue && queue.toolkits.map((toolkitId) => {
            const info = GOOGLE_TOOLKITS.find((t) => t.id === toolkitId);
            const tkStatus = getToolkitStatus(toolkitId);

            return (
              <div
                key={toolkitId}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
              >
                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                  {tkStatus === "done" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : tkStatus === "error" ? (
                    <XCircle className="h-4 w-4 text-destructive" />
                  ) : tkStatus === "connecting" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/40" />
                  )}
                </div>
                <span className="text-lg leading-none">{info?.icon || "🔗"}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">
                    {info?.name || getToolkitDisplayName(toolkitId)}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {tkStatus === "done"
                      ? "Conectado"
                      : tkStatus === "error"
                      ? "Falhou"
                      : tkStatus === "connecting"
                      ? "Conectando..."
                      : "Aguardando"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {status === "idle" && (
            <>
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button disabled={selectedCount === 0} onClick={handleStart}>
                Conectar {selectedCount} serviço{selectedCount !== 1 ? "s" : ""} →
              </Button>
            </>
          )}
          {status === "progress" && (
            <>
              <Button variant="ghost" onClick={handleCancel}>
                Cancelar
              </Button>
              <Button disabled>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {redirecting ? "Redirecionando..." : "Aguarde..."}
              </Button>
            </>
          )}
          {status === "completed" && (
            <>
              {failedCount > 0 && (
                <Button variant="outline" onClick={handleRetryFailed}>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Tentar {failedCount} novamente
                </Button>
              )}
              <Button onClick={() => { clearConnectionQueue(); onClose(); }}>
                Fechar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

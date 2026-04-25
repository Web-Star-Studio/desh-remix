import { useState, useEffect, useCallback } from "react";
import { Download, X, CheckCircle2, AlertCircle, Loader2, Clock, RefreshCw, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { CREDIT_COSTS } from "@/constants/credits";
import { toast } from "@/hooks/use-toast";

interface SyncJob {
  id: string;
  status: string;
  chats_total: number;
  chats_done: number;
  messages_synced: number;
  current_chat: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  completed_at: string | null;
}

export default function WhatsAppFullSync() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeJob, setActiveJob] = useState<SyncJob | null>(null);
  const [pastJobs, setPastJobs] = useState<SyncJob[]>([]);
  const [cooldown, setCooldown] = useState(0); // minutes remaining

  // Fetch existing jobs
  const fetchJobs = useCallback(async () => {
    const { data } = await supabase
      .from("whatsapp_sync_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      const jobs = data as unknown as SyncJob[];
      const active = jobs.find(j => j.status === "pending" || j.status === "running");
      setActiveJob(active ?? null);

      const finished = jobs.filter(j => j.status !== "pending" && j.status !== "running");
      setPastJobs(finished.slice(0, 5));

      // Calculate cooldown from most recent finished job
      const lastFinished = finished[0];
      if (lastFinished) {
        const elapsed = Date.now() - new Date(lastFinished.created_at).getTime();
        const remaining = Math.max(0, Math.ceil((3600_000 - elapsed) / 60_000));
        setCooldown(remaining);
      } else {
        setCooldown(0);
      }
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown(prev => Math.max(0, prev - 1));
    }, 60_000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Realtime subscription for active job progress
  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-sync-jobs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_sync_jobs" },
        (payload) => {
          const row = payload.new as unknown as SyncJob;
          if (row.status === "running" || row.status === "pending") {
            setActiveJob(row);
          } else {
            setActiveJob(null);
            fetchJobs();
            if (row.status === "completed") {
              toast({
                title: "Sincronização concluída! ✅",
                description: `${row.messages_synced?.toLocaleString("pt-BR")} mensagens importadas de ${row.chats_total} conversas.`,
              });
            } else if (row.status === "failed") {
              toast({
                title: "Sincronização falhou",
                description: row.error_message || "Erro desconhecido. Tente novamente mais tarde.",
                variant: "destructive",
              });
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchJobs]);

  const startSync = async () => {
    setConfirmOpen(false);
    setLoading(true);
    try {
      const res = await supabase.functions.invoke("whatsapp-web-proxy/sync-history-start", {
        body: {},
      });

      if (res.error) {
        toast({ title: "Erro", description: res.error.message, variant: "destructive" });
      } else if (res.data?.error) {
        toast({ title: "Erro", description: res.data.error, variant: "destructive" });
        if (res.data.cooldownMinutes) setCooldown(res.data.cooldownMinutes);
      } else {
        const msg = res.data?.chatsCapped
          ? `${res.data.chatsTotal} conversas serão sincronizadas (máximo atingido).`
          : `${res.data?.chatsTotal ?? 0} conversas serão sincronizadas.`;
        toast({ title: "Sincronização iniciada", description: msg });
        fetchJobs();
      }
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const cancelSync = async () => {
    if (!activeJob) return;
    try {
      await supabase.functions.invoke("whatsapp-web-proxy/sync-history-cancel", {
        body: { jobId: activeJob.id },
      });
      toast({ title: "Sincronização cancelada" });
      fetchJobs();
    } catch {
      toast({ title: "Erro ao cancelar", variant: "destructive" });
    }
  };

  const progress = activeJob && activeJob.chats_total > 0
    ? Math.round((activeJob.chats_done / activeJob.chats_total) * 100)
    : 0;

  // ETA calculation
  const getETA = () => {
    if (!activeJob || activeJob.chats_done === 0 || !activeJob.chats_total) return null;
    const elapsed = Date.now() - new Date(activeJob.created_at).getTime();
    const msPerChat = elapsed / activeJob.chats_done;
    const remaining = (activeJob.chats_total - activeJob.chats_done) * msPerChat;
    const mins = Math.ceil(remaining / 60_000);
    return mins <= 1 ? "~1 min" : `~${mins} min`;
  };

  const canStart = !activeJob && !loading && cooldown <= 0;

  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Sincronização Completa</h3>
        </div>
        {!activeJob && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmOpen(true)}
            disabled={!canStart}
            className="text-xs"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            {cooldown > 0 ? `Aguarde ${cooldown}min` : "Sincronizar Tudo"}
          </Button>
        )}
      </div>

      {/* Active job progress */}
      {activeJob && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              {activeJob.current_chat ? `Sincronizando "${activeJob.current_chat}"` : "Preparando..."}
            </span>
            <span>{activeJob.chats_done}/{activeJob.chats_total} conversas ({progress}%)</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {activeJob.messages_synced?.toLocaleString("pt-BR")} msgs
              {getETA() && <> • ETA: {getETA()}</>}
              {(activeJob.retry_count ?? 0) > 0 && (
                <span className="text-yellow-500 ml-1">
                  (tentativa {(activeJob.retry_count ?? 0) + 1}/3)
                </span>
              )}
            </span>
            <Button size="sm" variant="ghost" onClick={cancelSync} className="text-xs h-6 px-2 text-destructive">
              <X className="w-3 h-3 mr-1" /> Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Past jobs */}
      {pastJobs.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-border/50">
          <p className="text-xs text-muted-foreground font-medium">Histórico</p>
          {pastJobs.map(job => (
            <div key={job.id} className="flex items-center justify-between text-xs text-muted-foreground py-0.5">
              <span className="flex items-center gap-1">
                {job.status === "completed" && <CheckCircle2 className="w-3 h-3 text-primary" />}
                {job.status === "failed" && <AlertCircle className="w-3 h-3 text-destructive" />}
                {job.status === "cancelled" && <X className="w-3 h-3 text-muted-foreground" />}
                {job.messages_synced?.toLocaleString("pt-BR")} msgs — {job.chats_done}/{job.chats_total} conversas
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(job.created_at).toLocaleDateString("pt-BR")}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Sincronizar histórico completo
            </DialogTitle>
            <DialogDescription>
              Importa <strong>todas</strong> as mensagens do seu WhatsApp de forma segura e em background.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
            <p>• Custo: <strong>{CREDIT_COSTS.WHATSAPP_FULL_SYNC} créditos</strong></p>
            <p>• Máximo: 500 conversas por sincronização</p>
            <p>• Limite: 1 sincronização por hora</p>
            <p>• Mensagens duplicadas são ignoradas automaticamente</p>
            <p>• Você pode cancelar a qualquer momento</p>
            <p>• Créditos são reembolsados em caso de falha</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={startSync} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
              Confirmar ({CREDIT_COSTS.WHATSAPP_FULL_SYNC} créditos)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

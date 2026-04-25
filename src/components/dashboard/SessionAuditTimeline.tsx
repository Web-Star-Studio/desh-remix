import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScrollText, Loader2, RefreshCw, Wifi, WifiOff, QrCode,
  AlertTriangle, MessageSquare, Plus, XCircle, HelpCircle, CheckCircle2,
} from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuditLog {
  id: string;
  session_id: string;
  event: string;
  source: string;
  meta: Record<string, unknown>;
  created_at: string;
}

// ── Event config ──────────────────────────────────────────────────────────────

type EventCfg = {
  icon: React.ReactNode;
  label: string;
  dotCls: string;
  labelCls: string;
};

function getEventCfg(event: string): EventCfg {
  switch (event) {
    case "session_created":
      return { icon: <Plus className="w-3 h-3" />, label: "Sessão criada", dotCls: "bg-primary", labelCls: "text-primary" };
    case "connected":
      return { icon: <Wifi className="w-3 h-3" />, label: "Conectado", dotCls: "bg-primary", labelCls: "text-primary" };
    case "qr_received":
      return { icon: <QrCode className="w-3 h-3" />, label: "QR Code recebido", dotCls: "bg-accent-foreground", labelCls: "text-accent-foreground" };
    case "disconnected":
      return { icon: <WifiOff className="w-3 h-3" />, label: "Desconectado", dotCls: "bg-muted-foreground", labelCls: "text-muted-foreground" };
    case "error":
      return { icon: <AlertTriangle className="w-3 h-3" />, label: "Erro", dotCls: "bg-destructive", labelCls: "text-destructive" };
    case "message_sent":
      return { icon: <MessageSquare className="w-3 h-3" />, label: "Mensagem enviada", dotCls: "bg-primary/70", labelCls: "text-primary" };
    case "message_send_failed":
      return { icon: <XCircle className="w-3 h-3" />, label: "Falha ao enviar", dotCls: "bg-destructive", labelCls: "text-destructive" };
    case "message_received":
      return { icon: <MessageSquare className="w-3 h-3" />, label: "Mensagem recebida", dotCls: "bg-primary/70", labelCls: "text-primary" };
    default:
      return { icon: <HelpCircle className="w-3 h-3" />, label: event, dotCls: "bg-border", labelCls: "text-muted-foreground" };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function MetaBadge({ meta }: { meta: Record<string, unknown> }) {
  const entries = Object.entries(meta).filter(([k]) => k !== "ip");
  if (entries.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {entries.map(([k, v]) => (
        <span key={k} className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-foreground/5 border border-border text-muted-foreground font-mono">
          <span className="text-foreground/50">{k}:</span>
          {String(v).length > 40 ? String(v).slice(0, 40) + "…" : String(v)}
        </span>
      ))}
    </div>
  );
}

// ── Source badge ──────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: string }) {
  const cfg = source === "callback"
    ? { cls: "bg-accent/15 text-accent-foreground border-accent/30", label: "gateway→db" }
    : { cls: "bg-primary/10 text-primary border-primary/20", label: "proxy" };
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SessionAuditTimeline() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionFilter, setSessionFilter] = useState<string>("all");
  const [sessions, setSessions] = useState<string[]>([]);

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from("whatsapp_session_logs" as never)
        .select("id, session_id, event, source, meta, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (sessionFilter !== "all") {
        q = q.eq("session_id", sessionFilter);
      }

      const { data } = await q;
      const rows = (data as AuditLog[]) ?? [];
      setLogs(rows);

      // Collect unique session IDs for filter
      const ids = [...new Set(rows.map((r) => r.session_id))];
      setSessions((prev) => {
        const merged = [...new Set([...prev, ...ids])];
        return merged;
      });
    } finally {
      setLoading(false);
    }
  }, [user, sessionFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Realtime — insert new rows at top
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("wa_audit_timeline")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_session_logs", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const entry = payload.new as AuditLog;
          setLogs((prev) => [entry, ...prev].slice(0, 50));
          setSessions((prev) => prev.includes(entry.session_id) ? prev : [...prev, entry.session_id]);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  return (
    <GlassCard size="auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
            <ScrollText className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="widget-title text-sm">Log de Auditoria de Sessões</p>
            <p className="text-[10px] text-muted-foreground">Eventos das últimas 50 entradas · tempo real</p>
          </div>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-foreground/5 border border-border text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {/* Session filter */}
      {sessions.length > 1 && (
        <div className="flex gap-1.5 flex-wrap mb-3">
          <button
            onClick={() => setSessionFilter("all")}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-colors ${
              sessionFilter === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-foreground/5 border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Todas
          </button>
          {sessions.map((sid) => (
            <button
              key={sid}
              onClick={() => setSessionFilter(sid)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-colors ${
                sessionFilter === sid
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-foreground/5 border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {sid}
            </button>
          ))}
        </div>
      )}

      {/* Timeline */}
      {loading && logs.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Carregando…
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8">
          <ScrollText className="w-10 h-10 text-muted-foreground/20" />
          <p className="text-xs text-muted-foreground">Nenhum evento registrado ainda</p>
          <p className="text-[10px] text-muted-foreground/60">Os eventos serão registrados conforme as sessões evoluem</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[13px] top-2 bottom-2 w-px bg-border" />

          <AnimatePresence initial={false}>
            <div className="space-y-0">
              {logs.map((log, i) => {
                const cfg = getEventCfg(log.event);
                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className="relative flex gap-3 pb-4 last:pb-0"
                  >
                    {/* Dot */}
                    <div className={`relative z-10 mt-0.5 w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center ${cfg.dotCls} text-white shadow-sm`}>
                      {cfg.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs font-semibold ${cfg.labelCls}`}>{cfg.label}</span>
                          <SourceBadge source={log.source} />
                        </div>
                        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                          <span className="text-[9px] text-muted-foreground">{formatRelative(log.created_at)}</span>
                          <span className="text-[9px] text-muted-foreground/60">{formatAbsolute(log.created_at)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 mt-0.5">
                        <code className="text-[9px] font-mono text-muted-foreground/70 bg-foreground/5 px-1 rounded">
                          {log.session_id}
                        </code>
                      </div>

                      <MetaBadge meta={log.meta} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>

          {logs.length === 50 && (
            <p className="text-center text-[10px] text-muted-foreground/60 mt-2">
              Exibindo os 50 eventos mais recentes
            </p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-border">
        <div className="flex items-center gap-1 mb-2">
          <CheckCircle2 className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground font-medium">Legenda das fontes</span>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="px-1.5 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/20 text-[9px] font-semibold">proxy</span>
            Ação iniciada pelo usuário via painel
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="px-1.5 py-0.5 rounded-full border bg-accent/15 text-accent-foreground border-accent/30 text-[9px] font-semibold">gateway→db</span>
            Evento recebido do gateway externo
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

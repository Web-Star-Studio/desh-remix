import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Monitor, Wifi, WifiOff, Loader2, RefreshCw, Clock,
  AlertTriangle, CheckCircle2, QrCode, Activity, RotateCcw,
  Timer, ArrowRight, XCircle,
} from "lucide-react";
import GlassCard from "./GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────

type SessionStatus = "CONNECTED" | "QR_PENDING" | "DISCONNECTED" | "ERROR" | string;

interface WaWebSession {
  id: string;
  session_id: string;
  status: SessionStatus;
  last_connected_at: string | null;
  last_error: string | null;
  reconnect_attempt_count: number;
  created_at: string;
  updated_at: string;
}

interface StatusLog {
  id: string;
  old_status: string | null;
  new_status: string;
  error_message: string | null;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s atrás`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}min atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  return `${Math.floor(hrs / 24)}d atrás`;
}

function formatUptime(connectedAt: string | null): string {
  if (!connectedAt) return "—";
  const diff = Date.now() - new Date(connectedAt).getTime();
  const totalSecs = Math.floor(diff / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

function formatAbsolute(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

// ── Status pill (forwardRef for AnimatePresence compatibility) ────────────────

const STATUS_CFG: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
  CONNECTED:    { cls: "bg-primary/15 text-primary border-primary/30",            icon: <Wifi className="w-2.5 h-2.5" />,          label: "Conectada"    },
  QR_PENDING:   { cls: "bg-accent/20 text-accent-foreground border-accent/30",    icon: <QrCode className="w-2.5 h-2.5" />,        label: "QR Pendente"  },
  DISCONNECTED: { cls: "bg-muted text-muted-foreground border-border",             icon: <WifiOff className="w-2.5 h-2.5" />,       label: "Desconectada" },
  ERROR:        { cls: "bg-destructive/15 text-destructive border-destructive/30", icon: <AlertTriangle className="w-2.5 h-2.5" />, label: "Erro"         },
};

const StatusPill = React.forwardRef<HTMLSpanElement, { status: SessionStatus }>(
  ({ status }, ref) => {
    const cfg = STATUS_CFG[status] ?? { cls: "bg-muted text-muted-foreground border-border", icon: null, label: status };
    return (
      <span ref={ref} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.cls}`}>
        {cfg.icon}{cfg.label}
      </span>
    );
  }
);
StatusPill.displayName = "StatusPill";

function StatusDot({ status }: { status: SessionStatus }) {
  const cls =
    status === "CONNECTED"    ? "bg-primary animate-pulse" :
    status === "QR_PENDING"   ? "bg-accent-foreground" :
    status === "ERROR"        ? "bg-destructive" :
    "bg-muted-foreground";
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cls}`} />;
}

// ── Log entry ─────────────────────────────────────────────────────────────────

const LogEntry = React.forwardRef<HTMLDivElement, { log: StatusLog }>(({ log }, ref) => {
  const from = STATUS_CFG[log.old_status ?? ""] ?? { cls: "text-muted-foreground", label: log.old_status ?? "—" };
  const to   = STATUS_CFG[log.new_status]       ?? { cls: "text-foreground",       label: log.new_status };

  return (
    <div ref={ref} className="flex items-start gap-2 py-1.5 border-b border-border/50 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {log.old_status && (
            <>
              <span className={`text-[10px] font-semibold ${from.cls.split(" ").find(c => c.startsWith("text-")) ?? "text-muted-foreground"}`}>
                {from.label}
              </span>
              <ArrowRight className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
            </>
          )}
          <span className={`text-[10px] font-semibold ${to.cls.split(" ").find(c => c.startsWith("text-")) ?? "text-foreground"}`}>
            {to.label}
          </span>
        </div>
        {log.error_message && (
          <p className="text-[9px] text-destructive mt-0.5 truncate">{log.error_message}</p>
        )}
      </div>
      <span className="text-[9px] text-muted-foreground flex-shrink-0 mt-0.5">
        {formatAbsolute(log.created_at)}
      </span>
    </div>
  );
});
LogEntry.displayName = "LogEntry";

// ── Main component ────────────────────────────────────────────────────────────

export default function WhatsAppWebMonitor() {
  const { user } = useAuth();
  const [session, setSession] = useState<WaWebSession | null>(null);
  const [logs, setLogs] = useState<StatusLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [uptime, setUptime] = useState("—");
  const uptimeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Data fetching ────────────────────────────────────────────────────────

  const fetchSession = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("whatsapp_web_sessions")
        .select("id, session_id, status, last_connected_at, last_error, reconnect_attempt_count, created_at, updated_at")
        .eq("user_id", user.id)
        .in("status", ["CONNECTED", "QR_PENDING", "DISCONNECTED", "ERROR"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setSession(data as WaWebSession | null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchLogs = useCallback(async (sessionId: string) => {
    setLogsLoading(true);
    try {
      const { data } = await supabase
        .from("whatsapp_web_session_logs" as never)
        .select("id, old_status, new_status, error_message, created_at")
        .eq("user_id", user?.id ?? "")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(10);
      setLogs((data as StatusLog[]) ?? []);
    } finally {
      setLogsLoading(false);
    }
  }, [user]);

  const lastDisconnection = logs.find(
    (l) => l.new_status === "DISCONNECTED" || l.new_status === "ERROR"
  );

  // ── Live uptime ticker ────────────────────────────────────────────────────

  useEffect(() => {
    if (uptimeRef.current) clearInterval(uptimeRef.current);
    if (session?.status === "CONNECTED" && session.last_connected_at) {
      const tick = () => setUptime(formatUptime(session.last_connected_at));
      tick();
      uptimeRef.current = setInterval(tick, 1000);
    } else {
      setUptime("—");
    }
    return () => { if (uptimeRef.current) clearInterval(uptimeRef.current); };
  }, [session?.status, session?.last_connected_at]);

  // ── Initial load ──────────────────────────────────────────────────────────

  useEffect(() => { fetchSession(); }, [fetchSession]);

  useEffect(() => {
    if (session?.session_id) fetchLogs(session.session_id);
  }, [session?.session_id, fetchLogs]);

  // ── Realtime (uses payload directly instead of refetching) ────────────────

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("wa_web_monitor_v3")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_web_sessions", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.new) {
            const row = payload.new as WaWebSession;
            setSession(row);
          }
        },
      )
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_web_session_logs", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const entry = payload.new as StatusLog & { session_id: string };
          setLogs((prev) => {
            if (session?.session_id && entry.session_id !== session.session_id) return prev;
            return [entry, ...prev].slice(0, 10);
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, session?.session_id]);

  // ── Render ────────────────────────────────────────────────────────────────

  const isConnected = session?.status === "CONNECTED";

  return (
    <GlassCard size="auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Monitor className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="widget-title text-sm">Monitor WhatsApp Web</p>
            <p className="text-[10px] text-muted-foreground">Sessão atual · tempo real</p>
          </div>
        </div>
        <button
          onClick={() => { fetchSession(); if (session?.session_id) fetchLogs(session.session_id); }}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-foreground/5 border border-border text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {loading && !session ? (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Carregando…
        </div>
      ) : !session ? (
        <div className="flex flex-col items-center gap-2 py-8">
          <Activity className="w-10 h-10 text-muted-foreground/20" />
          <p className="text-xs text-muted-foreground">Nenhuma sessão encontrada</p>
          <p className="text-[10px] text-muted-foreground/60">Crie uma conexão via QR Code para monitorar aqui</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={session.session_id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2 p-3 rounded-lg bg-foreground/5 border border-border">
              <StatusDot status={session.status} />
              <code className="text-xs font-mono text-foreground flex-1 truncate">{session.session_id}</code>
              <StatusPill status={session.status} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className={`flex flex-col gap-0.5 p-3 rounded-lg border ${isConnected ? "bg-primary/10 border-primary/20" : "bg-foreground/5 border-border"}`}>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Timer className="w-3 h-3" />
                  Uptime da sessão
                </div>
                <span className={`text-lg font-bold font-mono ${isConnected ? "text-primary" : "text-muted-foreground"}`}>
                  {isConnected ? uptime : "—"}
                </span>
                {session.last_connected_at && (
                  <span className="text-[9px] text-muted-foreground">
                    desde {formatAbsolute(session.last_connected_at)}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-0.5 p-3 rounded-lg border bg-foreground/5 border-border">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <WifiOff className="w-3 h-3" />
                  Última desconexão
                </div>
                <span className="text-sm font-semibold text-foreground leading-tight">
                  {lastDisconnection ? formatRelative(lastDisconnection.created_at) : "—"}
                </span>
                {lastDisconnection && (
                  <span className="text-[9px] text-muted-foreground">
                    {formatAbsolute(lastDisconnection.created_at)}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-0.5 p-3 rounded-lg border bg-foreground/5 border-border">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <RotateCcw className="w-3 h-3" />
                  Tentativas de reconexão
                </div>
                <span className={`text-lg font-bold ${session.reconnect_attempt_count > 0 ? "text-destructive" : "text-foreground"}`}>
                  {session.reconnect_attempt_count}
                </span>
              </div>

              <div className="flex flex-col gap-0.5 p-3 rounded-lg border bg-foreground/5 border-border">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <XCircle className="w-3 h-3" />
                  Último erro
                </div>
                {session.last_error ? (
                  <span className="text-[10px] text-destructive leading-tight break-words">
                    {session.last_error.length > 60 ? session.last_error.slice(0, 60) + "…" : session.last_error}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-primary">
                    <CheckCircle2 className="w-3 h-3" />
                    Nenhum
                  </span>
                )}
              </div>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-foreground/5 border-b border-border">
                <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  Histórico de status
                </div>
                <span className="text-[10px] text-muted-foreground">últimas 10 mudanças</span>
              </div>

              {logsLoading ? (
                <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Carregando…
                </div>
              ) : logs.length === 0 ? (
                <div className="py-4 text-center text-[10px] text-muted-foreground">
                  Nenhuma mudança de status registrada ainda
                </div>
              ) : (
                <div className="px-3 py-1">
                  <AnimatePresence initial={false}>
                    {logs.map((log, i) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                      >
                        <LogEntry log={log} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </GlassCard>
  );
}

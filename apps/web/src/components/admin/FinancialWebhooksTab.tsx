import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Webhook, CheckCircle, XCircle, Clock, AlertTriangle,
  RefreshCw, Copy, ChevronDown, ChevronUp, Search, Filter
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

interface WebhookLog {
  id: string;
  event: string;
  item_id: string | null;
  connection_id: string | null;
  status: string;
  error_message: string | null;
  payload: Record<string, any>;
  processing_time_ms: number | null;
  created_at: string;
}

const WEBHOOK_URL = `https://fzidukdcyqsqajoebdfe.supabase.co/functions/v1/financial-webhook`;

const FinancialWebhooksTab = () => {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "success" | "error" | "ignored">("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("financial_webhook_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (!error && data) setLogs(data as unknown as WebhookLog[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = logs.filter(l => {
    if (eventFilter && l.event !== eventFilter) return false;
    if (statusFilter && l.status !== statusFilter) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      if (!l.event.toLowerCase().includes(s) && !(l.item_id || "").toLowerCase().includes(s) && !(l.error_message || "").toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const uniqueEvents = [...new Set(logs.map(l => l.event))].sort();

  const totalSuccess = logs.filter(l => l.status === "success").length;
  const totalError = logs.filter(l => l.status === "error").length;
  const totalIgnored = logs.filter(l => l.status === "ignored").length;
  const now = Date.now();
  const last24h = logs.filter(l => now - new Date(l.created_at).getTime() < 86400000).length;
  const avgTime = logs.length > 0
    ? Math.round(logs.filter(l => l.processing_time_ms).reduce((a, l) => a + (l.processing_time_ms || 0), 0) / Math.max(1, logs.filter(l => l.processing_time_ms).length))
    : 0;

  const copyUrl = () => {
    navigator.clipboard.writeText(WEBHOOK_URL);
    toast({ title: "URL copiada", description: "URL do webhook copiada para a área de transferência." });
  };

  const statusBadge = (s: string) => {
    if (s === "success") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-400"><CheckCircle className="w-3 h-3" />OK</span>;
    if (s === "error") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-400"><XCircle className="w-3 h-3" />Erro</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-500/20 text-yellow-400"><AlertTriangle className="w-3 h-3" />Ignorado</span>;
  };

  return (
    <div className="space-y-4">
      {/* Webhook URL */}
      <div className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Webhook className="w-4 h-4 text-primary shrink-0" />
          <span className="text-[11px] text-muted-foreground">Webhook URL:</span>
          <code className="text-[11px] text-foreground font-mono truncate">{WEBHOOK_URL}</code>
        </div>
        <button onClick={copyUrl} className="shrink-0 p-2 rounded-lg hover:bg-white/10 transition-colors">
          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard icon={Webhook} label="Total Eventos" value={logs.length} />
        <MetricCard icon={CheckCircle} label="Sucesso" value={totalSuccess} color="text-emerald-400" />
        <MetricCard icon={XCircle} label="Erros" value={totalError} color="text-red-400" />
        <MetricCard icon={Clock} label="Últimas 24h" value={last24h} color="text-primary" />
        <MetricCard icon={Clock} label="Tempo Médio" value={avgTime} suffix="ms" />
      </div>

      {/* Filters */}
      <div className="glass-card rounded-2xl p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
            placeholder="Buscar evento, item ID..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <select
          value={eventFilter}
          onChange={e => { setEventFilter(e.target.value); setPage(1); }}
          className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          <option value="">Todos eventos</option>
          {uniqueEvents.map(ev => <option key={ev} value={ev}>{ev}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }}
          className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          <option value="">Todos status</option>
          <option value="success">Sucesso</option>
          <option value="error">Erro</option>
          <option value="ignored">Ignorado</option>
        </select>
        <button onClick={fetchLogs} className="p-2 rounded-lg hover:bg-white/10 transition-colors" title="Atualizar">
          <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 text-muted-foreground">
                <th className="text-left py-3 px-4 font-medium">Data</th>
                <th className="text-left py-3 px-4 font-medium">Evento</th>
                <th className="text-left py-3 px-4 font-medium">Item ID</th>
                <th className="text-left py-3 px-4 font-medium">Status</th>
                <th className="text-left py-3 px-4 font-medium">Tempo</th>
                <th className="py-3 px-4 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(log => (
                <>
                  <tr
                    key={log.id}
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    className="border-b border-white/5 hover:bg-white/[0.03] cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-foreground text-[10px] font-medium">
                        {log.event}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground font-mono text-[10px] max-w-[120px] truncate">
                      {log.item_id || "—"}
                    </td>
                    <td className="py-3 px-4">{statusBadge(log.status)}</td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {log.processing_time_ms != null ? `${log.processing_time_ms}ms` : "—"}
                    </td>
                    <td className="py-3 px-4">
                      {expandedId === log.id ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr key={`${log.id}-detail`} className="border-b border-white/5 bg-white/[0.02]">
                      <td colSpan={6} className="p-4 space-y-2">
                        {log.error_message && (
                          <div className="text-red-400 text-[11px]">
                            <strong>Erro:</strong> {log.error_message}
                          </div>
                        )}
                        {log.connection_id && (
                          <div className="text-muted-foreground text-[11px]">
                            <strong>Connection ID:</strong> {log.connection_id}
                          </div>
                        )}
                        <details className="text-[11px]">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                            Ver payload completo
                          </summary>
                          <pre className="mt-2 p-3 rounded-lg bg-black/30 text-foreground/80 overflow-x-auto text-[10px] max-h-64 overflow-y-auto">
                            {JSON.stringify(log.payload, null, 2)}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <Webhook className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    {logs.length === 0 ? "Nenhum webhook recebido ainda" : "Nenhum resultado com esses filtros"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
            <span className="text-[10px] text-muted-foreground">
              {filtered.length} log{filtered.length !== 1 ? "s" : ""} · Página {safePage} de {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white/10 text-muted-foreground hover:bg-white/15 transition-colors disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white/10 text-muted-foreground hover:bg-white/15 transition-colors disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const MetricCard = ({ icon: Icon, label, value, color, suffix }: { icon: React.ElementType; label: string; value: number; color?: string; suffix?: string }) => (
  <div className="glass-card rounded-2xl p-4">
    <div className="flex items-center gap-2 mb-2">
      <Icon className={`w-3.5 h-3.5 ${color || "text-muted-foreground"}`} />
      <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
    </div>
    <p className={`text-xl font-bold ${color || "text-foreground"}`}>{value}{suffix}</p>
  </div>
);

export default FinancialWebhooksTab;

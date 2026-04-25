import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  RefreshCw, CheckCircle, Clock, ChevronDown, ChevronUp, Filter, Search,
  Webhook, Activity, AlertCircle, Copy, Trash2, RotateCcw, Zap, Shield,
  BarChart3, Globe, Timer, TrendingUp, AlertTriangle, Settings, Link2
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface WebhookEvent {
  id: string;
  connection_id: string;
  user_id: string;
  category: string;
  event_type: string;
  object_type: string;
  payload: unknown;
  processed: boolean;
  created_at: string;
  source?: string;
  processing_time_ms?: number;
  error_message?: string;
  trigger_slug?: string;
  metadata?: Record<string, unknown>;
}

const ITEMS_PER_PAGE = 25;

const SOURCE_COLORS: Record<string, string> = {
  composio: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  gmail: "bg-red-500/15 text-red-400 border-red-500/20",
  whatsapp: "bg-green-500/15 text-green-400 border-green-500/20",
  pluggy: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  internal: "bg-muted text-muted-foreground border-border/50",
};

const CATEGORY_COLORS: Record<string, string> = {
  calendar: "bg-blue-500/15 text-blue-400",
  messaging: "bg-violet-500/15 text-violet-400",
  email: "bg-red-500/15 text-red-400",
  storage: "bg-cyan-500/15 text-cyan-400",
  task: "bg-amber-500/15 text-amber-400",
  crm: "bg-emerald-500/15 text-emerald-400",
  auth: "bg-orange-500/15 text-orange-400",
  other: "bg-muted text-muted-foreground",
};

const EVENT_COLORS: Record<string, string> = {
  created: "bg-green-500/15 text-green-500",
  updated: "bg-primary/15 text-primary",
  deleted: "bg-destructive/15 text-destructive",
  trigger: "bg-violet-500/15 text-violet-400",
  expired: "bg-orange-500/15 text-orange-400",
  error: "bg-destructive/15 text-destructive",
};

// ─── Overview Sub-Tab ───────────────────────────────────────────────────────
const OverviewPanel = ({ events }: { events: WebhookEvent[] }) => {
  const stats = useMemo(() => {
    const now = Date.now();
    const last24h = events.filter(e => now - new Date(e.created_at).getTime() < 86400000);
    const processed = events.filter(e => e.processed);
    const failed = events.filter(e => e.error_message);
    const withTime = events.filter(e => e.processing_time_ms != null);
    const avgLatency = withTime.length > 0
      ? Math.round(withTime.reduce((s, e) => s + (e.processing_time_ms || 0), 0) / withTime.length)
      : 0;

    const bySource: Record<string, { total: number; success: number; failed: number }> = {};
    for (const e of events) {
      const src = e.source || "internal";
      if (!bySource[src]) bySource[src] = { total: 0, success: 0, failed: 0 };
      bySource[src].total++;
      if (e.processed && !e.error_message) bySource[src].success++;
      if (e.error_message) bySource[src].failed++;
    }

    // Hourly volume for last 24h
    const hourly: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hourly[i] = 0;
    for (const e of last24h) {
      const h = new Date(e.created_at).getHours();
      hourly[h] = (hourly[h] || 0) + 1;
    }

    return {
      total: events.length,
      last24h: last24h.length,
      successRate: events.length > 0 ? Math.round((processed.length / events.length) * 100) : 0,
      avgLatency,
      failed: failed.length,
      eventsPerHour: last24h.length > 0 ? (last24h.length / 24).toFixed(1) : "0",
      bySource: Object.entries(bySource).sort((a, b) => b[1].total - a[1].total),
      hourly,
    };
  }, [events]);

  const maxHourly = Math.max(...Object.values(stats.hourly), 1);

  return (
    <div className="space-y-4">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { icon: Webhook, label: "Total Eventos", value: stats.total, color: "text-primary" },
          { icon: Activity, label: "Últimas 24h", value: stats.last24h, color: "text-cyan-500" },
          { icon: TrendingUp, label: "Taxa Sucesso", value: `${stats.successRate}%`, color: "text-green-500" },
          { icon: Timer, label: "Latência Média", value: `${stats.avgLatency}ms`, color: "text-amber-500" },
          { icon: AlertTriangle, label: "Falhas", value: stats.failed, color: "text-destructive" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-[11px] text-muted-foreground">{label}</span>
            </div>
            <p className="text-lg font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Hourly Volume Chart */}
      <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-4">
        <h3 className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5" /> Volume por Hora (últimas 24h)
        </h3>
        <div className="flex items-end gap-1 h-20">
          {Array.from({ length: 24 }, (_, i) => {
            const count = stats.hourly[i] || 0;
            const height = maxHourly > 0 ? (count / maxHourly) * 100 : 0;
            const now = new Date().getHours();
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${i}h: ${count} eventos`}>
                <div
                  className={`w-full rounded-t transition-all ${i === now ? "bg-primary" : "bg-primary/30"}`}
                  style={{ height: `${Math.max(height, 2)}%` }}
                />
                {i % 4 === 0 && <span className="text-[9px] text-muted-foreground">{i}h</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Breakdown by Source */}
      <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-4">
        <h3 className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <Globe className="w-3.5 h-3.5" /> Breakdown por Fonte
        </h3>
        <div className="space-y-2">
          {stats.bySource.map(([source, data]) => (
            <div key={source} className="flex items-center gap-3">
              <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] border ${SOURCE_COLORS[source] || SOURCE_COLORS.internal}`}>
                {source}
              </span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary/60 rounded-full transition-all"
                  style={{ width: `${(data.total / Math.max(stats.total, 1)) * 100}%` }}
                />
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="text-foreground font-medium">{data.total}</span>
                <span className="text-green-500">{data.success}✓</span>
                {data.failed > 0 && <span className="text-destructive">{data.failed}✗</span>}
              </div>
            </div>
          ))}
          {stats.bySource.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhum evento registrado.</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Events Table Sub-Tab ───────────────────────────────────────────────────
const EventsPanel = ({ events, loading, onRefresh }: { events: WebhookEvent[]; loading: boolean; onRefresh: () => void }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [processedFilter, setProcessedFilter] = useState<"" | "true" | "false">("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(onRefresh, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, onRefresh]);

  const filtered = useMemo(() => {
    let result = events;
    if (sourceFilter) result = result.filter(e => (e.source || "internal") === sourceFilter);
    if (categoryFilter) result = result.filter(e => e.category === categoryFilter);
    if (processedFilter !== "") result = result.filter(e => e.processed === (processedFilter === "true"));
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(e =>
        e.category.toLowerCase().includes(s) ||
        e.event_type.toLowerCase().includes(s) ||
        e.object_type.toLowerCase().includes(s) ||
        (e.trigger_slug || "").toLowerCase().includes(s) ||
        e.id.toLowerCase().includes(s)
      );
    }
    return result;
  }, [events, sourceFilter, categoryFilter, processedFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const uniqueSources = useMemo(() => [...new Set(events.map(e => e.source || "internal"))], [events]);
  const uniqueCategories = useMemo(() => [...new Set(events.map(e => e.category))], [events]);

  const handleReprocess = async (id: string) => {
    const { error } = await supabase.from("webhook_events").update({ processed: false } as any).eq("id", id);
    if (!error) {
      toast({ title: "Evento marcado para reprocessamento" });
      onRefresh();
    }
  };

  const handleCleanProcessed = async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { error, count } = await supabase
      .from("webhook_events")
      .delete({ count: "exact" } as any)
      .eq("processed", true)
      .lt("created_at", thirtyDaysAgo);
    if (!error) {
      toast({ title: `${count || 0} eventos antigos removidos` });
      onRefresh();
    }
  };

  const copyPayload = (payload: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    toast({ title: "Payload copiado" });
  };

  const formatDate = (d: string) => {
    try { return format(new Date(d), "dd MMM yyyy, HH:mm:ss", { locale: ptBR }); }
    catch { return d; }
  };

  const relativeTime = (d: string) => {
    try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: ptBR }); }
    catch { return ""; }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <select value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setPage(1); }}
            className="bg-background rounded-lg px-3 py-1.5 text-xs text-foreground border border-border outline-none focus:ring-1 focus:ring-primary/30">
            <option value="">Todas fontes</option>
            {uniqueSources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
            className="bg-background rounded-lg px-3 py-1.5 text-xs text-foreground border border-border outline-none focus:ring-1 focus:ring-primary/30">
            <option value="">Todas categorias</option>
            {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={processedFilter} onChange={e => { setProcessedFilter(e.target.value as any); setPage(1); }}
            className="bg-background rounded-lg px-3 py-1.5 text-xs text-foreground border border-border outline-none focus:ring-1 focus:ring-primary/30">
            <option value="">Todos status</option>
            <option value="false">Pendente</option>
            <option value="true">Processado</option>
          </select>
          <div className="relative ml-auto">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
              placeholder="Buscar..." className="pl-8 pr-3 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground w-40 outline-none focus:ring-1 focus:ring-primary/30" />
          </div>
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)}
              className="rounded border-border" />
            Auto-refresh
          </label>
          <button onClick={onRefresh} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={handleCleanProcessed}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Limpar antigos
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50 bg-foreground/[0.02]">
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Data</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Fonte</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Categoria</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Evento</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Trigger</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Latência</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground w-10"></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(ev => (
                <Fragment key={ev.id}>
                  <tr className="border-b border-border/30 hover:bg-foreground/[0.02] transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="text-muted-foreground">{formatDate(ev.created_at)}</div>
                      <div className="text-[10px] text-muted-foreground/60">{relativeTime(ev.created_at)}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] border ${SOURCE_COLORS[ev.source || "internal"] || SOURCE_COLORS.internal}`}>
                        {ev.source || "internal"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] ${CATEGORY_COLORS[ev.category] || CATEGORY_COLORS.other}`}>
                        {ev.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] ${EVENT_COLORS[ev.event_type] || "bg-primary/15 text-primary"}`}>
                        {ev.event_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-foreground/70 font-mono text-[10px] max-w-[140px] truncate">
                      {ev.trigger_slug || ev.object_type}
                    </td>
                    <td className="py-2.5 px-3 text-[10px] text-muted-foreground">
                      {ev.processing_time_ms != null ? `${ev.processing_time_ms}ms` : "—"}
                    </td>
                    <td className="py-2.5 px-3">
                      {ev.error_message ? (
                        <span className="flex items-center gap-1 text-destructive text-[10px] font-medium" title={ev.error_message}>
                          <AlertCircle className="w-3 h-3" /> Erro
                        </span>
                      ) : ev.processed ? (
                        <span className="flex items-center gap-1 text-green-500 text-[10px] font-medium">
                          <CheckCircle className="w-3 h-3" /> OK
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-500 text-[10px] font-medium">
                          <Clock className="w-3 h-3" /> Pendente
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {expandedId === ev.id ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                    </td>
                  </tr>
                  {expandedId === ev.id && (
                    <tr className="border-b border-border/30">
                      <td colSpan={8} className="px-3 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex gap-4 text-[10px] text-muted-foreground flex-wrap">
                            <span>ID: <code className="text-foreground/70">{ev.id.slice(0, 12)}…</code></span>
                            <span>Connection: <code className="text-foreground/70">{ev.connection_id.slice(0, 16)}</code></span>
                            {ev.error_message && <span className="text-destructive">Erro: {ev.error_message}</span>}
                          </div>
                          <div className="flex items-center gap-1">
                            {ev.error_message && (
                              <button onClick={(e) => { e.stopPropagation(); handleReprocess(ev.id); }}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-500 text-[10px] hover:bg-amber-500/20 transition-colors">
                                <RotateCcw className="w-3 h-3" /> Reprocessar
                              </button>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); copyPayload(ev.payload); }}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted text-muted-foreground text-[10px] hover:bg-muted/80 transition-colors">
                              <Copy className="w-3 h-3" /> Copiar
                            </button>
                          </div>
                        </div>
                        {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                          <div className="mb-2 p-2 bg-violet-500/5 rounded-lg border border-violet-500/10">
                            <span className="text-[10px] font-medium text-violet-400 block mb-1">Metadata Composio</span>
                            <pre className="text-[10px] text-foreground/60 font-mono">{JSON.stringify(ev.metadata, null, 2)}</pre>
                          </div>
                        )}
                        <div className="bg-background rounded-xl p-3 max-h-48 overflow-auto border border-border/50">
                          <pre className="text-[10px] text-foreground/70 whitespace-pre-wrap break-all font-mono">
                            {JSON.stringify(ev.payload, null, 2)}
                          </pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    {loading ? "Carregando..." : "Nenhum evento encontrado."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
            <span className="text-[10px] text-muted-foreground">
              {filtered.length} evento{filtered.length !== 1 ? "s" : ""} · Página {safePage}/{totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}
                className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-foreground/5 text-foreground hover:bg-foreground/10 transition-colors disabled:opacity-40">
                Anterior
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-foreground/5 text-foreground hover:bg-foreground/10 transition-colors disabled:opacity-40">
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Composio Subscriptions Sub-Tab ──────────────────────────────────────────
const ComposioSubscriptionsPanel = () => {
  const [loading, setLoading] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    if (projectId) {
      setWebhookUrl(`https://${projectId}.supabase.co/functions/v1/composio-webhook`);
    }
  }, []);

  const handleRegisterWebhook = async () => {
    setRegistering(true);
    try {
      const { data, error } = await supabase.functions.invoke("composio-proxy", {
        body: {
          service: "composio",
          method: "POST",
          path: "/api/v3/webhook_subscriptions",
          data: {
            webhook_url: webhookUrl,
            enabled_events: ["composio.trigger.message", "composio.connected_account.expired"],
          },
        },
      });
      if (error) throw error;
      toast({
        title: "Webhook registrado",
        description: "O webhook do Composio foi configurado com sucesso. Armazene o secret retornado de forma segura.",
      });
      
    } catch (err: any) {
      toast({ title: "Erro ao registrar", description: err.message, variant: "destructive" });
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-foreground">Composio Webhook Subscription</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Registre um webhook no Composio para receber eventos de triggers (mensagens, calendário, etc.)
          e notificações de expiração de contas conectadas.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-1">Webhook URL</label>
            <input
              value={webhookUrl}
              onChange={e => setWebhookUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground font-mono outline-none focus:ring-1 focus:ring-primary/30"
              placeholder="https://...supabase.co/functions/v1/composio-webhook"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-1">Eventos Habilitados</label>
            <div className="flex gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-violet-500/10 text-violet-400 text-[10px] font-mono border border-violet-500/20">
                composio.trigger.message
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-400 text-[10px] font-mono border border-orange-500/20">
                composio.connected_account.expired
              </span>
            </div>
          </div>

          <button
            onClick={handleRegisterWebhook}
            disabled={registering || !webhookUrl}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {registering ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
            {registering ? "Registrando..." : "Registrar Webhook"}
          </button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-green-500" />
            <h4 className="text-xs font-semibold text-foreground">Verificação de Assinatura</h4>
          </div>
          <p className="text-[11px] text-muted-foreground">
            O Composio retorna um <code className="text-foreground/70">secret</code> ao registrar o webhook.
            Armazene-o como secret do projeto para verificar a autenticidade dos payloads recebidos.
          </p>
        </div>
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-4 h-4 text-amber-500" />
            <h4 className="text-xs font-semibold text-foreground">Rotação de Secret</h4>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Para rotacionar o secret, use a API do Composio:
            <code className="block mt-1 text-foreground/70 text-[10px]">
              POST /api/v3/webhook_subscriptions/:id/rotate_secret
            </code>
          </p>
        </div>
      </div>
    </div>
  );
};

// ─── Expired Accounts Sub-Tab ────────────────────────────────────────────────
const ExpiredAccountsPanel = ({ events }: { events: WebhookEvent[] }) => {
  const expiredEvents = useMemo(() => {
    return events
      .filter(e => e.source === "composio" && e.event_type === "expired")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [events]);

  return (
    <div className="space-y-4">
      <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          <h3 className="text-sm font-semibold text-foreground">Contas Composio Expiradas</h3>
          <span className="ml-auto px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 text-[10px] font-medium">
            {expiredEvents.length} evento{expiredEvents.length !== 1 ? "s" : ""}
          </span>
        </div>

        {expiredEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            Nenhuma conta expirada registrada. Quando uma conta conectada via Composio expirar,
            o evento será exibido aqui.
          </p>
        ) : (
          <div className="space-y-2">
            {expiredEvents.map(ev => {
              const meta = ev.metadata as Record<string, unknown> | undefined;
              const toolkit = (meta?.toolkit as string) || "unknown";
              const composioUserId = (meta?.composio_user_id as string) || "—";
              return (
                <div key={ev.id} className="flex items-center gap-3 p-3 rounded-xl bg-background border border-border/50">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      Toolkit: <span className="text-orange-400">{toolkit}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Composio User: {composioUserId} · {format(new Date(ev.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main WebhooksTab ─────────────────────────────────────────────────────────
const WebhooksTab = () => {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("webhook_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (!error && data) setEvents(data as unknown as WebhookEvent[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList className="bg-card/80 border border-border/50">
        <TabsTrigger value="overview" className="text-xs gap-1.5">
          <BarChart3 className="w-3.5 h-3.5" /> Visão Geral
        </TabsTrigger>
        <TabsTrigger value="events" className="text-xs gap-1.5">
          <Webhook className="w-3.5 h-3.5" /> Eventos
        </TabsTrigger>
        <TabsTrigger value="composio" className="text-xs gap-1.5">
          <Zap className="w-3.5 h-3.5" /> Composio
        </TabsTrigger>
        <TabsTrigger value="expired" className="text-xs gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> Expiração
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <OverviewPanel events={events} />
      </TabsContent>
      <TabsContent value="events">
        <EventsPanel events={events} loading={loading} onRefresh={fetchEvents} />
      </TabsContent>
      <TabsContent value="composio">
        <ComposioSubscriptionsPanel />
      </TabsContent>
      <TabsContent value="expired">
        <ExpiredAccountsPanel events={events} />
      </TabsContent>
    </Tabs>
  );
};

export default WebhooksTab;

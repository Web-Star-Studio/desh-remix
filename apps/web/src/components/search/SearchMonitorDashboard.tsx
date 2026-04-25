import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchMonitors, type SearchMonitor, type MonitorResult } from "@/hooks/search/useSearchMonitors";
import GlassCard from "@/components/dashboard/GlassCard";
import { Bell, BellOff, ChevronDown, ChevronRight, Clock, Eye, ExternalLink, Globe, Loader2, Pause, Play, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const FREQUENCY_LABELS: Record<string, string> = {
  hourly: "A cada hora",
  daily: "Diariamente",
  weekly: "Semanalmente",
};

const CreateMonitorForm = ({ onSubmit, onCancel, defaultProvider }: {
  onSubmit: (data: { name: string; query: string; frequency: string; notify_on_change: boolean; provider: "perplexity" | "serpapi" | "both" }) => void;
  onCancel: () => void;
  defaultProvider?: "perplexity" | "serpapi" | "both";
}) => {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [notify, setNotify] = useState(true);
  const [provider, setProvider] = useState<"perplexity" | "serpapi" | "both">(defaultProvider || "both");

  const PROVIDER_OPTIONS = [
    { value: "perplexity" as const, label: "Perplexity", icon: "✨", desc: "Síntese IA" },
    { value: "serpapi" as const, label: "SerpAPI", icon: "🔍", desc: "Dados Google" },
    { value: "both" as const, label: "Ambos", icon: "⚡", desc: "Máxima cobertura" },
  ];

  const COST_MAP = { perplexity: 2, serpapi: 2, both: 4 };

  return (
    <GlassCard size="auto">
      <div className="flex items-center justify-between mb-4">
        <p className="widget-title flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5 text-primary" /> Novo Monitor
        </p>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-foreground/70 mb-1 block">Nome do monitor</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Preço iPhone 16"
            className="w-full bg-foreground/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground/70 mb-1 block">Busca a monitorar</label>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Ex: iPhone 16 Pro preço Brasil"
            className="w-full bg-foreground/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground/70 mb-1 block">Frequência</label>
          <div className="flex gap-2">
            {(["hourly", "daily", "weekly"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFrequency(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  frequency === f ? "bg-primary/20 text-primary ring-1 ring-primary/30" : "text-muted-foreground hover:bg-foreground/5"
                }`}
              >
                {FREQUENCY_LABELS[f]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-foreground/70 mb-1 block">Provedor de busca</label>
          <div className="flex gap-2">
            {PROVIDER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setProvider(opt.value)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                  provider === opt.value ? "bg-primary/20 text-primary ring-1 ring-primary/30" : "text-muted-foreground hover:bg-foreground/5 border border-foreground/5"
                }`}
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            {provider === "perplexity" ? "Respostas sintetizadas com IA e citações" :
             provider === "serpapi" ? "Dados estruturados do Google (links, snippets)" :
             "Combina síntese IA + dados estruturados"}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-foreground/70">Notificar mudanças</label>
          <Switch checked={notify} onCheckedChange={setNotify} />
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => {
              if (name.trim() && query.trim()) {
                onSubmit({ name: name.trim(), query: query.trim(), frequency, notify_on_change: notify, provider });
              }
            }}
            disabled={!name.trim() || !query.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Criar Monitor
          </button>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground/60 mt-3">
        Custo: {COST_MAP[provider]} créditos por verificação automática
      </p>
    </GlassCard>
  );
};

const MonitorResultCard = ({ result }: { result: MonitorResult }) => {
  const [expanded, setExpanded] = useState(false);
  const data = result.results_data as any;
  const providersUsed = data?.providers_used as string[] | undefined;

  return (
    <div className="border border-foreground/5 rounded-lg p-3">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center justify-between w-full text-left">
        <div className="flex items-center gap-2 flex-wrap">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(result.created_at), { addSuffix: true, locale: ptBR })}
          </span>
          {providersUsed && providersUsed.length > 0 && (
            <div className="flex gap-1">
              {providersUsed.map(p => (
                <span key={p} className="text-[9px] px-1.5 py-0 rounded-full bg-foreground/5 text-muted-foreground">
                  {p === "perplexity" ? "✨ AI" : "🔍 Google"}
                </span>
              ))}
            </div>
          )}
          {result.diff_summary && !result.diff_summary.includes("Sem mudanças") && !result.diff_summary.includes("Primeira") && (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary">
              Mudanças
            </Badge>
          )}
        </div>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2">
              {result.diff_summary && (
                <div className="text-xs text-foreground/70 bg-foreground/[0.03] rounded-lg p-2.5 whitespace-pre-line">
                  {result.diff_summary}
                </div>
              )}
              {data?.summary && (
                <div className="text-xs text-foreground/80 prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{data.summary}</ReactMarkdown>
                </div>
              )}
              {data?.key_facts?.length > 0 && (
                <ul className="space-y-1">
                  {data.key_facts.map((fact: string, i: number) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/70">
                      <span className="text-primary font-bold mt-0.5">{i + 1}.</span>
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* SerpAPI organic results in monitor */}
              {data?.organic_results?.length > 0 && (
                <div className="pt-2 border-t border-foreground/5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Resultados Google
                  </p>
                  <div className="space-y-1">
                    {(data.organic_results as any[]).slice(0, 5).map((r: any, i: number) => (
                      <a
                        key={i}
                        href={r.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2 text-xs py-1 hover:bg-foreground/5 rounded px-1.5 transition-colors group"
                      >
                        <span className="text-primary/50 font-mono text-[10px] mt-0.5 shrink-0">{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-foreground/80 line-clamp-1 group-hover:text-primary transition-colors">{r.title}</p>
                          <p className="text-muted-foreground/50 line-clamp-1 text-[10px]">{r.snippet}</p>
                        </div>
                        <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 mt-0.5" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* SerpAPI news in monitor */}
              {data?.news_results?.length > 0 && (
                <div className="pt-2 border-t border-foreground/5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">📰 Notícias</p>
                  <div className="space-y-1">
                    {(data.news_results as any[]).slice(0, 3).map((n: any, i: number) => (
                      <a key={i} href={n.link} target="_blank" rel="noopener noreferrer"
                        className="block text-xs text-foreground/70 hover:text-primary py-0.5 transition-colors">
                        {n.title} <span className="text-muted-foreground/50">— {n.source}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {data?.citations?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(data.citations as string[]).slice(0, 5).map((url: string, i: number) => {
                    let domain = "";
                    try { domain = new URL(url).hostname.replace("www.", ""); } catch { domain = url; }
                    return (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] px-2 py-0.5 rounded-full bg-foreground/5 text-primary hover:bg-primary/10 transition-colors truncate max-w-[150px]"
                      >
                        {domain}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MonitorCard = ({
  monitor,
  onToggle,
  onDelete,
  onViewResults,
  onForceCheck,
  results,
  loadingResults,
  isExpanded,
  isChecking,
}: {
  monitor: SearchMonitor;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  onViewResults: (id: string) => void;
  onForceCheck: (id: string) => void;
  results: MonitorResult[];
  loadingResults: boolean;
  isExpanded: boolean;
  isChecking: boolean;
}) => {
  return (
    <GlassCard size="auto" className="!p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Search className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">{monitor.name}</span>
            {monitor.enabled ? (
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-emerald-500/10 text-emerald-500 shrink-0">Ativo</Badge>
            ) : (
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0">Pausado</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate ml-5.5">{monitor.query}</p>
          <div className="flex items-center gap-3 mt-1.5 ml-5.5 flex-wrap">
            <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {FREQUENCY_LABELS[monitor.frequency] || monitor.frequency}
            </span>
            {(() => {
              const prov = (monitor.params as any)?.provider || "perplexity";
              const provLabel = prov === "both" ? "⚡ Ambos" : prov === "serpapi" ? "🔍 SerpAPI" : "✨ Perplexity";
              return (
                <span className="text-[10px] text-muted-foreground/60">{provLabel}</span>
              );
            })()}
            {monitor.notify_on_change ? (
              <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                <Bell className="w-3 h-3" /> Notificações
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                <BellOff className="w-3 h-3" /> Sem notificações
              </span>
            )}
            {monitor.last_checked_at && (
              <span className="text-[10px] text-muted-foreground/60">
                Última: {formatDistanceToNow(new Date(monitor.last_checked_at), { addSuffix: true, locale: ptBR })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onForceCheck(monitor.id)}
            disabled={isChecking}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-50"
            title="Verificar agora"
          >
            {isChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onViewResults(monitor.id)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all"
            title="Ver resultados"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onToggle(monitor.id, !monitor.enabled)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all"
            title={monitor.enabled ? "Pausar" : "Ativar"}
          >
            {monitor.enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onDelete(monitor.id)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
            title="Excluir"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-foreground/5 space-y-2">
              {loadingResults ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                </div>
              ) : results.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">Nenhum resultado ainda. A primeira verificação ocorrerá em breve.</p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
                  {results.map(r => (
                    <MonitorResultCard key={r.id} result={r} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
};

export default function SearchMonitorDashboard({ onSearchQuery }: { onSearchQuery?: (q: string) => void }) {
  const {
    monitors,
    loading,
    createMonitor,
    toggleMonitor,
    deleteMonitor,
    fetchResults,
    selectedResults,
    loadingResults,
    refresh,
  } = useSearchMonitors();

  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const handleViewResults = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      fetchResults(id);
    }
  };

  const handleForceCheck = async (monitorId: string) => {
    setCheckingId(monitorId);
    try {
      const { data, error } = await supabase.functions.invoke("serp-proxy", {
        body: { action: "monitor-check", monitor_id: monitorId },
      });
      if (error) throw error;
      toast.success("Verificação concluída!");
      // Refresh results and monitor list
      await refresh();
      if (expandedId === monitorId) {
        fetchResults(monitorId);
      }
    } catch (err: any) {
      console.error("Force check error:", err);
      toast.error("Erro ao verificar monitor");
    } finally {
      setCheckingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Monitores de Busca</h2>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{monitors.length}</Badge>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Novo
        </button>
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <CreateMonitorForm
              onSubmit={async (data) => {
                await createMonitor(data);
                setShowCreate(false);
              }}
              onCancel={() => setShowCreate(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : monitors.length === 0 && !showCreate ? (
        <GlassCard size="auto">
          <div className="text-center py-6">
            <Eye className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-foreground/70 mb-1">Nenhum monitor ativo</p>
            <p className="text-xs text-muted-foreground mb-4">
              Crie monitores para rastrear mudanças em resultados de busca automaticamente.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Criar primeiro monitor
            </button>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {monitors.map(m => (
            <MonitorCard
              key={m.id}
              monitor={m}
              onToggle={toggleMonitor}
              onDelete={deleteMonitor}
              onViewResults={handleViewResults}
              onForceCheck={handleForceCheck}
              results={expandedId === m.id ? selectedResults : []}
              loadingResults={expandedId === m.id && loadingResults}
              isExpanded={expandedId === m.id}
              isChecking={checkingId === m.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

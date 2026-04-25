import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Clock, CreditCard, Wrench, MessageSquare, Mic, RefreshCw, ChevronDown, ChevronUp, Search, AlertCircle, Copy, Activity } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

interface PandoraLog {
  id: string;
  user_id: string;
  contact_phone: string;
  conversation_id: string | null;
  message_type: string;
  input_text: string;
  output_text: string | null;
  credits_consumed: number;
  tools_used: string[];
  response_time_ms: number | null;
  error: string | null;
  created_at: string;
}

const PER_PAGE = 20;

const PandoraLogsTab = () => {
  const [logs, setLogs] = useState<PandoraLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | "text" | "audio">("");
  const [errorFilter, setErrorFilter] = useState<"" | "errors" | "success">("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("pandora_interaction_logs" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (typeFilter) query = query.eq("message_type", typeFilter);
    if (errorFilter === "errors") query = query.not("error", "is", null);
    if (errorFilter === "success") query = query.is("error", null);

    const { data, error } = await query;
    if (!error && data) setLogs(data as unknown as PandoraLog[]);
    setLoading(false);
  }, [typeFilter, errorFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = useMemo(() => {
    if (!searchTerm) return logs;
    const s = searchTerm.toLowerCase();
    return logs.filter(l =>
      l.input_text?.toLowerCase().includes(s) ||
      l.output_text?.toLowerCase().includes(s) ||
      l.contact_phone?.toLowerCase().includes(s) ||
      l.tools_used?.some(t => t.toLowerCase().includes(s))
    );
  }, [logs, searchTerm]);

  const stats = useMemo(() => {
    const totalCredits = logs.reduce((sum, l) => sum + (l.credits_consumed || 0), 0);
    const avgResponseTime = logs.length
      ? Math.round(logs.reduce((sum, l) => sum + (l.response_time_ms || 0), 0) / logs.length)
      : 0;
    const audioCount = logs.filter(l => l.message_type === "audio").length;
    const toolUsageCount = logs.filter(l => l.tools_used?.length > 0).length;
    const errorCount = logs.filter(l => l.error).length;
    const uniqueUsers = new Set(logs.map(l => l.user_id)).size;
    return { totalCredits, avgResponseTime, audioCount, toolUsageCount, errorCount, uniqueUsers, total: logs.length };
  }, [logs]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const formatDate = (d: string) => {
    try { return format(new Date(d), "dd MMM HH:mm:ss", { locale: ptBR }); }
    catch { return d; }
  };

  const relativeTime = (d: string) => {
    try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: ptBR }); }
    catch { return ""; }
  };

  const maskPhone = (phone: string) => {
    if (!phone || phone.length < 6) return phone;
    return phone.slice(0, 4) + "****" + phone.slice(-4);
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado", description: "Texto copiado para a área de transferência." });
  };

  const getResponseTimeColor = (ms: number | null) => {
    if (!ms) return "text-muted-foreground";
    if (ms < 2000) return "text-green-500";
    if (ms < 5000) return "text-amber-500";
    return "text-destructive";
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: MessageSquare, label: "Interações", value: stats.total, color: "text-primary" },
          { icon: CreditCard, label: "Créditos", value: stats.totalCredits.toFixed(1), color: "text-amber-500" },
          { icon: Clock, label: "Tempo médio", value: `${(stats.avgResponseTime / 1000).toFixed(1)}s`, color: "text-cyan-500" },
          { icon: Wrench, label: "Com tools", value: stats.toolUsageCount, color: "text-green-500" },
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

      {/* Secondary stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-3 flex items-center gap-3">
          <Mic className="w-4 h-4 text-violet-500" />
          <div>
            <p className="text-[10px] text-muted-foreground">Áudios</p>
            <p className="text-sm font-bold text-foreground">{stats.audioCount}</p>
          </div>
        </div>
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-3 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-destructive" />
          <div>
            <p className="text-[10px] text-muted-foreground">Erros</p>
            <p className="text-sm font-bold text-foreground">{stats.errorCount}</p>
          </div>
        </div>
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-3 flex items-center gap-3">
          <Activity className="w-4 h-4 text-primary" />
          <div>
            <p className="text-[10px] text-muted-foreground">Usuários únicos</p>
            <p className="text-sm font-bold text-foreground">{stats.uniqueUsers}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value as any); setPage(1); }}
            className="bg-background rounded-lg px-3 py-1.5 text-xs text-foreground border border-border outline-none focus:ring-1 focus:ring-primary/30"
          >
            <option value="">Todos tipos</option>
            <option value="text">Texto</option>
            <option value="audio">Áudio</option>
          </select>
          <select
            value={errorFilter}
            onChange={e => { setErrorFilter(e.target.value as any); setPage(1); }}
            className="bg-background rounded-lg px-3 py-1.5 text-xs text-foreground border border-border outline-none focus:ring-1 focus:ring-primary/30"
          >
            <option value="">Todos status</option>
            <option value="success">Sucesso</option>
            <option value="errors">Com erro</option>
          </select>
          <div className="relative ml-auto">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
              placeholder="Buscar mensagens, telefone, tools..."
              className="pl-8 pr-3 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground w-56 outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Logs table */}
      <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50 bg-foreground/[0.02]">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Data</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tipo</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Telefone</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Mensagem</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Créditos</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tempo</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tools</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground w-10"></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(log => (
                <Fragment key={log.id}>
                  <tr
                    className={`border-b border-border/30 hover:bg-foreground/[0.02] transition-colors cursor-pointer ${
                      log.error ? "bg-destructive/[0.03]" : ""
                    }`}
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="text-muted-foreground">{formatDate(log.created_at)}</div>
                      <div className="text-[10px] text-muted-foreground/60">{relativeTime(log.created_at)}</div>
                    </td>
                    <td className="py-3 px-4">
                      {log.message_type === "audio" ? (
                        <span className="flex items-center gap-1 text-violet-500 text-[10px] font-medium">
                          <Mic className="w-3 h-3" /> Áudio
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground text-[10px] font-medium">
                          <MessageSquare className="w-3 h-3" /> Texto
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-foreground/70 font-mono text-[11px]">{maskPhone(log.contact_phone)}</td>
                    <td className="py-3 px-4 text-foreground/80 max-w-[200px] truncate">{log.input_text}</td>
                    <td className="py-3 px-4">
                      <span className="text-amber-500 font-mono font-medium">{log.credits_consumed}</span>
                    </td>
                    <td className={`py-3 px-4 font-mono ${getResponseTimeColor(log.response_time_ms)}`}>
                      {log.response_time_ms ? `${(log.response_time_ms / 1000).toFixed(1)}s` : "—"}
                    </td>
                    <td className="py-3 px-4">
                      {log.tools_used?.length > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-green-500/15 text-green-500 text-[10px] font-medium">
                          {log.tools_used.length} tool{log.tools_used.length > 1 ? "s" : ""}
                        </span>
                      ) : log.error ? (
                        <span className="px-2 py-0.5 rounded-full bg-destructive/15 text-destructive text-[10px] font-medium">
                          Erro
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-muted-foreground hover:text-foreground transition-colors">
                        {expandedId === log.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </span>
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr className="border-b border-border/30 bg-foreground/[0.01]">
                      <td colSpan={8} className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <h4 className="text-[10px] text-muted-foreground uppercase font-medium">Entrada</h4>
                              <button onClick={(e) => { e.stopPropagation(); copyText(log.input_text); }}
                                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                                <Copy className="w-3 h-3" /> Copiar
                              </button>
                            </div>
                            <p className="text-xs text-foreground/80 bg-background rounded-lg p-3 whitespace-pre-wrap break-words border border-border/50">
                              {log.input_text}
                            </p>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <h4 className="text-[10px] text-muted-foreground uppercase font-medium">Resposta da Pandora</h4>
                              {log.output_text && (
                                <button onClick={(e) => { e.stopPropagation(); copyText(log.output_text!); }}
                                  className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                                  <Copy className="w-3 h-3" /> Copiar
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-foreground/80 bg-background rounded-lg p-3 whitespace-pre-wrap break-words border border-border/50">
                              {log.output_text || "—"}
                            </p>
                          </div>
                          {log.tools_used?.length > 0 && (
                            <div>
                              <h4 className="text-[10px] text-muted-foreground uppercase font-medium mb-1.5">Tools utilizadas</h4>
                              <div className="flex flex-wrap gap-1">
                                {log.tools_used.map((t, i) => (
                                  <span key={i} className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-[10px] font-medium">{t}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {log.error && (
                            <div>
                              <h4 className="text-[10px] text-destructive uppercase font-medium mb-1.5">Erro</h4>
                              <p className="text-xs text-destructive bg-destructive/10 rounded-lg p-3 border border-destructive/20">{log.error}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-4 mt-3 text-[10px] text-muted-foreground border-t border-border/50 pt-2">
                          <span>ID: <code className="text-foreground/60">{log.id.slice(0, 12)}…</code></span>
                          <span>User: <code className="text-foreground/60">{log.user_id.slice(0, 8)}…</code></span>
                          {log.conversation_id && <span>Conv: <code className="text-foreground/60">{log.conversation_id.slice(0, 8)}…</code></span>}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    {loading ? (
                      <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin opacity-40" />
                    ) : (
                      <Bot className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    )}
                    {loading ? "Carregando..." : searchTerm ? "Nenhuma interação encontrada." : "Nenhuma interação registrada ainda."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
            <span className="text-[10px] text-muted-foreground">
              {filtered.length} interação{filtered.length !== 1 ? "ões" : ""} · Página {safePage} de {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-foreground/5 text-foreground hover:bg-foreground/10 transition-colors disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-foreground/5 text-foreground hover:bg-foreground/10 transition-colors disabled:opacity-40"
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

export default PandoraLogsTab;

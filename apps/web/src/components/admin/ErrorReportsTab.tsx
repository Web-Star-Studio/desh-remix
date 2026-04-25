import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Bug, CheckCircle2, Clock, Filter, RefreshCw, Search, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ErrorReport {
  id: string;
  user_id: string | null;
  severity: string;
  module: string | null;
  message: string;
  stack: string | null;
  metadata: Record<string, unknown>;
  user_agent: string | null;
  url: string | null;
  resolved: boolean;
  created_at: string;
}

const ITEMS_PER_PAGE = 20;

const severityStyles: Record<string, string> = {
  warning: "bg-amber-500/20 text-amber-400",
  error: "bg-destructive/20 text-destructive",
  critical: "bg-red-600/30 text-red-400",
};

const ErrorReportsTab = () => {
  const [reports, setReports] = useState<ErrorReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [moduleFilter, setModuleFilter] = useState<string>("");
  const [resolvedFilter, setResolvedFilter] = useState<"all" | "open" | "resolved">("open");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await (supabase.from("error_reports") as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      setReports((data || []) as ErrorReport[]);
    } catch (err) {
      console.error("Fetch error reports failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const toggleResolved = async (id: string, current: boolean) => {
    await (supabase.from("error_reports") as any)
      .update({ resolved: !current })
      .eq("id", id);
    setReports(prev => prev.map(r => r.id === id ? { ...r, resolved: !current } : r));
  };

  const modules = [...new Set(reports.map(r => r.module).filter(Boolean))] as string[];

  const filtered = reports.filter(r => {
    if (severityFilter && r.severity !== severityFilter) return false;
    if (moduleFilter && r.module !== moduleFilter) return false;
    if (resolvedFilter === "open" && r.resolved) return false;
    if (resolvedFilter === "resolved" && !r.resolved) return false;
    if (search) {
      const term = search.toLowerCase();
      if (!r.message.toLowerCase().includes(term) && !(r.module || "").toLowerCase().includes(term) && !(r.url || "").toLowerCase().includes(term)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const stats = {
    total: reports.length,
    open: reports.filter(r => !r.resolved).length,
    critical: reports.filter(r => r.severity === "critical" && !r.resolved).length,
    today: reports.filter(r => {
      const d = new Date(r.created_at);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length,
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Bug className="w-4 h-4 text-primary" />
            <span className="text-[10px] text-white/50 uppercase tracking-wider">Total</span>
          </div>
          <p className="text-xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] text-white/50 uppercase tracking-wider">Em aberto</span>
          </div>
          <p className="text-xl font-bold text-amber-400">{stats.open}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-[10px] text-white/50 uppercase tracking-wider">Críticos</span>
          </div>
          <p className="text-xl font-bold text-red-400">{stats.critical}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] text-white/50 uppercase tracking-wider">Hoje</span>
          </div>
          <p className="text-xl font-bold text-white">{stats.today}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar erros..."
            className="w-full bg-white/[0.06] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-primary/30 border border-white/10"
          />
        </div>
        <select
          value={severityFilter}
          onChange={e => { setSeverityFilter(e.target.value); setPage(1); }}
          className="bg-white/[0.06] rounded-xl px-3 py-2 text-xs text-white border border-white/10 outline-none"
        >
          <option value="">Severidade</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
          <option value="critical">Critical</option>
        </select>
        <select
          value={moduleFilter}
          onChange={e => { setModuleFilter(e.target.value); setPage(1); }}
          className="bg-white/[0.06] rounded-xl px-3 py-2 text-xs text-white border border-white/10 outline-none"
        >
          <option value="">Módulo</option>
          {modules.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          value={resolvedFilter}
          onChange={e => { setResolvedFilter(e.target.value as any); setPage(1); }}
          className="bg-white/[0.06] rounded-xl px-3 py-2 text-xs text-white border border-white/10 outline-none"
        >
          <option value="all">Todos</option>
          <option value="open">Em aberto</option>
          <option value="resolved">Resolvidos</option>
        </select>
        <button
          onClick={fetchReports}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors ml-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="text-left py-3 px-4 font-medium text-white/50">Data</th>
                <th className="text-left py-3 px-4 font-medium text-white/50">Severidade</th>
                <th className="text-left py-3 px-4 font-medium text-white/50">Módulo</th>
                <th className="text-left py-3 px-4 font-medium text-white/50">Mensagem</th>
                <th className="text-left py-3 px-4 font-medium text-white/50">Status</th>
                <th className="text-left py-3 px-4 font-medium text-white/50 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(report => (
                <React.Fragment key={report.id}>
                  <tr
                    className="border-b border-white/5 hover:bg-white/[0.03] transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
                  >
                    <td className="py-3 px-4 text-white/40 whitespace-nowrap">
                      {format(new Date(report.created_at), "dd MMM HH:mm", { locale: ptBR })}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] ${severityStyles[report.severity] || "bg-white/10 text-white/60"}`}>
                        {report.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-white/70 font-mono text-[10px]">{report.module || "—"}</td>
                    <td className="py-3 px-4 text-white/80 max-w-[300px] truncate">{report.message}</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={e => { e.stopPropagation(); toggleResolved(report.id, report.resolved); }}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                          report.resolved
                            ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                            : "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                        }`}
                      >
                        {report.resolved ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {report.resolved ? "Resolvido" : "Aberto"}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      {expandedId === report.id ? <ChevronUp className="w-3.5 h-3.5 text-white/40" /> : <ChevronDown className="w-3.5 h-3.5 text-white/40" />}
                    </td>
                  </tr>
                  {expandedId === report.id && (
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <td colSpan={6} className="p-4 space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <span className="text-[10px] text-white/40 font-medium">User ID</span>
                            <p className="text-xs text-white/70 font-mono break-all">{report.user_id || "—"}</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-white/40 font-medium">URL</span>
                            <p className="text-xs text-white/70 break-all">{report.url || "—"}</p>
                          </div>
                        </div>
                        {report.stack && (
                          <div>
                            <span className="text-[10px] text-white/40 font-medium">Stack Trace</span>
                            <pre className="text-[10px] text-white/50 bg-black/30 rounded-lg p-3 mt-1 overflow-x-auto max-h-40 whitespace-pre-wrap break-all">
                              {report.stack}
                            </pre>
                          </div>
                        )}
                        {report.metadata && Object.keys(report.metadata).length > 0 && (
                          <div>
                            <span className="text-[10px] text-white/40 font-medium">Metadata</span>
                            <pre className="text-[10px] text-white/50 bg-black/30 rounded-lg p-3 mt-1 overflow-x-auto">
                              {JSON.stringify(report.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                        <div>
                          <span className="text-[10px] text-white/40 font-medium">User Agent</span>
                          <p className="text-[10px] text-white/40 break-all">{report.user_agent || "—"}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-white/40">
                    <Bug className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    {reports.length === 0 ? "Nenhum erro registrado" : "Nenhum erro com esses filtros"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
            <span className="text-[10px] text-white/40">
              {filtered.length} erro{filtered.length !== 1 ? "s" : ""} · Página {safePage} de {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white/10 text-white/60 hover:bg-white/15 transition-colors disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white/10 text-white/60 hover:bg-white/15 transition-colors disabled:opacity-40"
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

export default ErrorReportsTab;

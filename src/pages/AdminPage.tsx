import { useState, lazy, Suspense } from "react";
import { useAdminData } from "@/hooks/admin/useAdminData";
import { useAdminRole } from "@/hooks/admin/useAdminRole";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import {
  Users, BarChart3, ScrollText, RefreshCw, Shield,
  Database, Plug, CalendarDays,
  TrendingUp, Clock, Download, Filter, Megaphone, CreditCard, Webhook, Bot, Mail,
  Search, ChevronDown, ChevronUp, Activity, FileText, Bug, MessageSquare
} from "lucide-react";
import { format, subDays, subMonths, isAfter, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import UserGrowthChart from "@/components/admin/UserGrowthChart";
import { exportToCsv } from "@/lib/exportCsv";
import PageLayout from "@/components/dashboard/PageLayout";
import PageHeader from "@/components/dashboard/PageHeader";

// Lazy-loaded tab components
const UsersTab = lazy(() => import("@/components/admin/UsersTab"));
const BroadcastsTab = lazy(() => import("@/components/admin/BroadcastsTab"));
const BillingTab = lazy(() => import("@/components/admin/BillingTab"));
const IntegrationsTab = lazy(() => import("@/components/admin/IntegrationsTab"));
const WebhooksTab = lazy(() => import("@/components/admin/WebhooksTab"));
const FinancialWebhooksTab = lazy(() => import("@/components/admin/FinancialWebhooksTab"));
const PandoraLogsTab = lazy(() => import("@/components/admin/PandoraLogsTab"));
const EmailNotificationsTab = lazy(() => import("@/components/admin/EmailNotificationsTab"));

const ComposioActionsTab = lazy(() => import("@/components/admin/ComposioActionsTab"));
const ErrorReportsTab = lazy(() => import("@/components/admin/ErrorReportsTab"));
const SystemDocsTab = lazy(() => import("@/components/admin/SystemDocsTab"));
const WhatsAppProxyLogsTab = lazy(() => import("@/components/admin/WhatsAppProxyLogsTab"));

const TabFallback = () => (
  <div className="flex items-center justify-center py-12">
    <div className="animate-pulse text-muted-foreground text-sm">Carregando...</div>
  </div>
);

type Tab = "dashboard" | "users" | "logs" | "broadcasts" | "billing" | "integrations" | "webhooks" | "pandora" | "email" | "composio-docs" | "errors" | "system-docs" | "wa-proxy";

const AdminPage = () => {
  const { isAdmin, loading: roleLoading } = useAdminRole();
  const { user } = useAuth();
  const { stats, users, logs, loading, refresh, setUserRole, logAction } = useAdminData();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [logActionFilter, setLogActionFilter] = useState("");
  const [logAdminFilter, setLogAdminFilter] = useState("");
  const [logPeriodFilter, setLogPeriodFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [logsPage, setLogsPage] = useState(1);
  const LOGS_PER_PAGE = 15;
  const [logSearchTerm, setLogSearchTerm] = useState("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-sm">Verificando permissões...</div>
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/" replace />;

  const thirtyDaysAgo = subDays(new Date(), 30);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "dashboard", label: "Métricas", icon: BarChart3 },
    { id: "users", label: "Usuários", icon: Users },
    { id: "logs", label: "Logs", icon: ScrollText },
    { id: "broadcasts", label: "Avisos", icon: Megaphone },
    { id: "billing", label: "Faturamento", icon: CreditCard },
    { id: "integrations", label: "Integrações", icon: Plug },
    { id: "webhooks", label: "Webhooks", icon: Webhook },
    { id: "pandora", label: "Pandora IA", icon: Bot },
    { id: "email", label: "E-mail", icon: Mail },
    { id: "wa-proxy", label: "WA Proxy", icon: MessageSquare },

    { id: "composio-docs", label: "Composio Docs", icon: Activity },
    { id: "errors", label: "Erros", icon: Bug },
    { id: "system-docs", label: "Docs Sistema", icon: FileText },
  ];

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try { return format(new Date(d), "dd MMM yyyy, HH:mm", { locale: ptBR }); }
    catch { return d; }
  };

  const uniqueActions = [...new Set(logs.map(l => l.action))];
  const uniqueAdmins = [...new Set(logs.map(l => l.user_email).filter(Boolean))] as string[];

  const periodCutoff = logPeriodFilter === "today" ? subDays(new Date(), 1)
    : logPeriodFilter === "week" ? subDays(new Date(), 7)
    : logPeriodFilter === "month" ? subMonths(new Date(), 1)
    : null;

  const filteredLogs = logs.filter(l => {
    if (logActionFilter && l.action !== logActionFilter) return false;
    if (logAdminFilter && l.user_email !== logAdminFilter) return false;
    if (periodCutoff && !isAfter(parseISO(l.created_at), periodCutoff)) return false;
    if (logSearchTerm) {
      const term = logSearchTerm.toLowerCase();
      const matchAction = l.action.toLowerCase().includes(term);
      const matchEmail = (l.user_email || "").toLowerCase().includes(term);
      const matchDetails = JSON.stringify(l.details).toLowerCase().includes(term);
      if (!matchAction && !matchEmail && !matchDetails) return false;
    }
    return true;
  });

  const actionColors: Record<string, string> = {
    role_change: "bg-amber-500/20 text-amber-400",
    login: "bg-emerald-500/20 text-emerald-400",
    grant_credits: "bg-cyan-500/20 text-cyan-400",
    delete_user: "bg-destructive/20 text-destructive",
    broadcast_create: "bg-violet-500/20 text-violet-400",
    coupon_create: "bg-pink-500/20 text-pink-400",
  };

  const getActionColor = (action: string) => {
    if (actionColors[action]) return actionColors[action];
    if (action.includes("delete") || action.includes("remove")) return "bg-destructive/20 text-destructive";
    if (action.includes("create") || action.includes("add")) return "bg-emerald-500/20 text-emerald-400";
    if (action.includes("update") || action.includes("change")) return "bg-amber-500/20 text-amber-400";
    return "bg-primary/20 text-primary";
  };

  const renderDetails = (details: Record<string, any>) => {
    if (!details || Object.keys(details).length === 0) return <span className="text-white/30">—</span>;
    const entries = Object.entries(details).filter(([, v]) => v !== null && v !== undefined && v !== "");
    if (entries.length === 0) return <span className="text-white/30">—</span>;
    return (
      <div className="space-y-1">
        {entries.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <span className="text-white/40 font-mono text-[10px] min-w-[80px]">{k}:</span>
            <span className="text-white/70 text-[10px] break-all">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
          </div>
        ))}
      </div>
    );
  };

  const logsToday = logs.filter(l => isAfter(parseISO(l.created_at), subDays(new Date(), 1))).length;
  const mostActiveAdmin = uniqueAdmins.length > 0
    ? uniqueAdmins.reduce((best, admin) => {
        const count = logs.filter(l => l.user_email === admin).length;
        return count > best.count ? { email: admin, count } : best;
      }, { email: "", count: 0 })
    : null;

  const exportLogs = () => {
    exportToCsv("logs",
      ["Data", "Admin", "Ação", "Detalhes"],
      filteredLogs.map(l => [
        l.created_at, l.user_email || "", l.action, JSON.stringify(l.details),
      ])
    );
    toast({ title: "Exportado", description: `${filteredLogs.length} logs exportados em CSV` });
  };

  return (
    <PageLayout maxWidth="7xl">
      <PageHeader
        title="Painel Admin"
        subtitle="Gerenciamento do sistema"
        icon={<Shield className="w-6 h-6 text-white drop-shadow" />}
        actions={
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card text-white/90 text-xs font-medium hover:brightness-110 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 glass-card p-1 rounded-xl w-fit mb-6 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-white/15 text-white shadow-sm"
                : "text-white/60 hover:text-white/90"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === "dashboard" && stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard icon={Users} label="Total Usuários" value={stats.total_users} />
            <StatCard icon={TrendingUp} label="Hoje" value={stats.users_today} accent />
            <StatCard icon={CalendarDays} label="Semana" value={stats.users_this_week} />
            <StatCard icon={Clock} label="Mês" value={stats.users_this_month} />
            <StatCard icon={Database} label="Dados" value={stats.total_data_rows} />
            <StatCard icon={Plug} label="Conexões" value={stats.total_connections} />
          </div>

          <UserGrowthChart users={users} />

          {/* Recent users */}
          <div className="glass-card rounded-2xl p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Últimos Cadastros</h3>
            <div className="space-y-2">
              {[...users].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5).map(u => (
                <div key={u.id} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-colors">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                    {(u.display_name || u.email || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{u.display_name || "Sem nome"}</p>
                    <p className="text-[10px] text-white/50 truncate">{u.email}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    u.role === "admin" ? "bg-primary/20 text-primary" : "bg-white/10 text-white/60"
                  }`}>
                    {u.role}
                  </span>
                  <span className="text-[10px] text-white/40 whitespace-nowrap">{formatDate(u.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <Suspense fallback={<TabFallback />}>
          <UsersTab
            users={users as any}
            loading={loading}
            onRefresh={refresh}
            onSetUserRole={setUserRole}
            onLogAction={logAction}
          />
        </Suspense>
      )}

      {/* Logs Tab */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <ScrollText className="w-4 h-4 text-primary" />
                <span className="text-[10px] text-white/50 uppercase tracking-wider">Total</span>
              </div>
              <p className="text-xl font-bold text-white">{logs.length}</p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] text-white/50 uppercase tracking-wider">Hoje</span>
              </div>
              <p className="text-xl font-bold text-white">{logsToday}</p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Filter className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] text-white/50 uppercase tracking-wider">Tipos</span>
              </div>
              <p className="text-xl font-bold text-white">{uniqueActions.length}</p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] text-white/50 uppercase tracking-wider">Mais ativo</span>
              </div>
              <p className="text-sm font-bold text-white truncate">{mostActiveAdmin?.email || "—"}</p>
              {mostActiveAdmin && <p className="text-[10px] text-white/40">{mostActiveAdmin.count} ações</p>}
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
              <input
                value={logSearchTerm}
                onChange={e => { setLogSearchTerm(e.target.value); setLogsPage(1); }}
                placeholder="Buscar em logs..."
                className="w-full bg-white/[0.06] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-primary/30 border border-white/10"
              />
            </div>
            <select
              value={logActionFilter}
              onChange={e => { setLogActionFilter(e.target.value); setLogsPage(1); }}
              className="bg-white/[0.06] rounded-xl px-3 py-2 text-xs text-white border border-white/10 outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Todas as ações</option>
              {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select
              value={logAdminFilter}
              onChange={e => { setLogAdminFilter(e.target.value); setLogsPage(1); }}
              className="bg-white/[0.06] rounded-xl px-3 py-2 text-xs text-white border border-white/10 outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Todos os admins</option>
              {uniqueAdmins.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select
              value={logPeriodFilter}
              onChange={e => { setLogPeriodFilter(e.target.value as any); setLogsPage(1); }}
              className="bg-white/[0.06] rounded-xl px-3 py-2 text-xs text-white border border-white/10 outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">Todo período</option>
              <option value="today">Hoje</option>
              <option value="week">Última semana</option>
              <option value="month">Último mês</option>
            </select>
            <button onClick={exportLogs} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors ml-auto">
              <Download className="w-3.5 h-3.5" /> Exportar CSV
            </button>
          </div>

          {(() => {
            const totalLogPages = Math.max(1, Math.ceil(filteredLogs.length / LOGS_PER_PAGE));
            const safeLogsPage = Math.min(logsPage, totalLogPages);
            const paginatedLogs = filteredLogs.slice((safeLogsPage - 1) * LOGS_PER_PAGE, safeLogsPage * LOGS_PER_PAGE);
            return (
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.02]">
                        <th className="text-left py-3 px-4 font-medium text-white/50">Data</th>
                        <th className="text-left py-3 px-4 font-medium text-white/50">Admin</th>
                        <th className="text-left py-3 px-4 font-medium text-white/50">Ação</th>
                        <th className="text-left py-3 px-4 font-medium text-white/50">Resumo</th>
                        <th className="text-left py-3 px-4 font-medium text-white/50 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLogs.map(log => (
                        <>
                          <tr
                            key={log.id}
                            className="border-b border-white/5 hover:bg-white/[0.03] transition-colors cursor-pointer"
                            onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                          >
                            <td className="py-3 px-4 text-white/40 whitespace-nowrap">{formatDate(log.created_at)}</td>
                            <td className="py-3 px-4 text-white">{log.user_email || "—"}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] ${getActionColor(log.action)}`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-white/40 max-w-[250px] truncate">
                              {log.details && Object.keys(log.details).length > 0
                                ? Object.entries(log.details).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(" · ")
                                : "—"}
                            </td>
                            <td className="py-3 px-4">
                              {expandedLogId === log.id ? <ChevronUp className="w-3.5 h-3.5 text-white/40" /> : <ChevronDown className="w-3.5 h-3.5 text-white/40" />}
                            </td>
                          </tr>
                          {expandedLogId === log.id && (
                            <tr key={`${log.id}-detail`} className="border-b border-white/5 bg-white/[0.02]">
                              <td colSpan={5} className="p-4">
                                {renderDetails(log.details)}
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                      {filteredLogs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-white/40">
                            <ScrollText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            {logs.length === 0 ? "Nenhum log registrado ainda" : "Nenhum log com esses filtros"}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {totalLogPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
                    <span className="text-[10px] text-white/40">
                      {filteredLogs.length} log{filteredLogs.length !== 1 ? "s" : ""} · Página {safeLogsPage} de {totalLogPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                        disabled={safeLogsPage <= 1}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white/10 text-white/60 hover:bg-white/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Anterior
                      </button>
                      {Array.from({ length: totalLogPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalLogPages || Math.abs(p - safeLogsPage) <= 1)
                        .reduce<(number | "...")[]>((acc, p, i, arr) => {
                          if (i > 0 && p - (arr[i - 1]) > 1) acc.push("...");
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, i) =>
                          p === "..." ? (
                            <span key={`e${i}`} className="px-1 text-[10px] text-white/40">…</span>
                          ) : (
                            <button
                              key={p}
                              onClick={() => setLogsPage(p)}
                              className={`w-7 h-7 rounded-lg text-[10px] font-medium transition-colors ${
                                p === safeLogsPage
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-white/10 text-white/60 hover:bg-white/15"
                              }`}
                            >
                              {p}
                            </button>
                          )
                        )}
                      <button
                        onClick={() => setLogsPage(p => Math.min(totalLogPages, p + 1))}
                        disabled={safeLogsPage >= totalLogPages}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white/10 text-white/60 hover:bg-white/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Próxima
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Broadcasts Tab */}
      {activeTab === "broadcasts" && <Suspense fallback={<TabFallback />}><BroadcastsTab /></Suspense>}

      {activeTab === "billing" && <Suspense fallback={<TabFallback />}><BillingTab /></Suspense>}

      {activeTab === "integrations" && <Suspense fallback={<TabFallback />}><IntegrationsTab /></Suspense>}

      {activeTab === "webhooks" && (
        <Suspense fallback={<TabFallback />}>
          <div className="space-y-6">
            <WebhooksTab />
            <div className="border-t border-white/10 pt-6">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Webhook className="w-4 h-4 text-primary" />
                Pluggy Webhooks
              </h3>
              <FinancialWebhooksTab />
            </div>
          </div>
        </Suspense>
      )}

      {activeTab === "pandora" && <Suspense fallback={<TabFallback />}><PandoraLogsTab /></Suspense>}

      {activeTab === "email" && <Suspense fallback={<TabFallback />}><EmailNotificationsTab /></Suspense>}

      

      {activeTab === "composio-docs" && <Suspense fallback={<TabFallback />}><ComposioActionsTab /></Suspense>}

      {activeTab === "errors" && <Suspense fallback={<TabFallback />}><ErrorReportsTab /></Suspense>}

      {activeTab === "system-docs" && <Suspense fallback={<TabFallback />}><SystemDocsTab /></Suspense>}

      {activeTab === "wa-proxy" && <Suspense fallback={<TabFallback />}><WhatsAppProxyLogsTab /></Suspense>}

    </PageLayout>
  );
};

const StatCard = ({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: number; accent?: boolean }) => (
  <div className={`glass-card rounded-2xl p-4 transition-colors ${accent ? "ring-1 ring-primary/30" : ""}`}>
    <div className="flex items-center gap-2 mb-2">
      <Icon className={`w-3.5 h-3.5 ${accent ? "text-primary" : "text-white/50"}`} />
      <span className="text-[10px] text-white/50 font-medium">{label}</span>
    </div>
    <p className={`text-xl font-bold ${accent ? "text-primary" : "text-white"}`}>{value}</p>
  </div>
);

export default AdminPage;

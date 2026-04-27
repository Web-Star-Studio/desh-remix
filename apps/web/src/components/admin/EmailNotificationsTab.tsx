import { useState, useEffect, useMemo, Fragment } from "react";
import DeshTooltip from "@/components/ui/DeshTooltip";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import {
  Mail,
  BarChart3,
  FileText,
  Zap,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  Pencil,
  Trash2,
  Eye,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  Copy,
  AlertTriangle,
  Users,
  Activity,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import EmailTemplateEditor from "./EmailTemplateEditor";
import EmailAutomationForm from "./EmailAutomationForm";

type SubTab = "dashboard" | "templates" | "automations";

interface EmailStats {
  sent_today: number;
  sent_week: number;
  sent_month: number;
  failed_total: number;
  skipped_total: number;
  by_type: { email_type: string; status: string; count: number }[];
  daily_volume: { day: string; total: number; sent: number; failed: number }[];
  recent_logs: any[];
}

interface EmailTemplate {
  id: string;
  slug: string;
  name: string;
  subject_template: string;
  body_html: string;
  type: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface EmailAutomation {
  id: string;
  name: string;
  trigger_type: string;
  trigger_config: any;
  template_slug: string | null;
  target_audience: string;
  active: boolean;
  last_run_at: string | null;
  created_at: string;
}

interface ApiEmailTemplate {
  id: string;
  slug: string;
  name: string;
  subjectTemplate: string;
  bodyHtml: string;
  bodyText: string;
  type: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ApiEmailAutomation {
  id: string;
  name: string;
  triggerType: string;
  triggerConfig: any;
  templateSlug: string | null;
  targetAudience: string;
  active: boolean;
  lastRunAt: string | null;
  createdAt: string;
}

const COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(263, 70%, 50%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(187, 85%, 43%)",
  "hsl(330, 81%, 60%)",
];

const LOGS_PER_PAGE = 15;

const fromApiTemplate = (tpl: ApiEmailTemplate): EmailTemplate => ({
  id: tpl.id,
  slug: tpl.slug,
  name: tpl.name,
  subject_template: tpl.subjectTemplate,
  body_html: tpl.bodyHtml,
  type: tpl.type,
  active: tpl.active,
  created_at: tpl.createdAt,
  updated_at: tpl.updatedAt,
});

const toApiTemplate = (tpl: Partial<EmailTemplate>) => ({
  ...(tpl.slug !== undefined ? { slug: tpl.slug } : {}),
  ...(tpl.name !== undefined ? { name: tpl.name } : {}),
  ...(tpl.subject_template !== undefined ? { subjectTemplate: tpl.subject_template } : {}),
  ...(tpl.body_html !== undefined ? { bodyHtml: tpl.body_html } : {}),
  ...(tpl.type !== undefined ? { type: tpl.type } : {}),
  ...(tpl.active !== undefined ? { active: tpl.active } : {}),
});

const fromApiAutomation = (automation: ApiEmailAutomation): EmailAutomation => ({
  id: automation.id,
  name: automation.name,
  trigger_type: automation.triggerType,
  trigger_config: automation.triggerConfig,
  template_slug: automation.templateSlug,
  target_audience: automation.targetAudience,
  active: automation.active,
  last_run_at: automation.lastRunAt,
  created_at: automation.createdAt,
});

const toApiAutomation = (automation: Partial<EmailAutomation>) => ({
  ...(automation.name !== undefined ? { name: automation.name } : {}),
  ...(automation.trigger_type !== undefined ? { triggerType: automation.trigger_type } : {}),
  ...(automation.trigger_config !== undefined ? { triggerConfig: automation.trigger_config } : {}),
  ...(automation.template_slug !== undefined ? { templateSlug: automation.template_slug } : {}),
  ...(automation.target_audience !== undefined
    ? { targetAudience: automation.target_audience }
    : {}),
  ...(automation.active !== undefined ? { active: automation.active } : {}),
});

const EmailNotificationsTab = () => {
  const [subTab, setSubTab] = useState<SubTab>("dashboard");
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [automations, setAutomations] = useState<EmailAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [editingAutomation, setEditingAutomation] = useState<EmailAutomation | null>(null);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [showNewAutomation, setShowNewAutomation] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);

  // Filters & search
  const [logSearch, setLogSearch] = useState("");
  const [logStatusFilter, setLogStatusFilter] = useState<"" | "sent" | "failed" | "skipped">("");
  const [logPage, setLogPage] = useState(1);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [templateSearch, setTemplateSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, templatesRes, automationsRes] = await Promise.all([
        apiFetch<EmailStats>("/admin/email-stats"),
        apiFetch<ApiEmailTemplate[]>("/admin/email-templates"),
        apiFetch<ApiEmailAutomation[]>("/admin/email-automations"),
      ]);

      setStats(statsRes);
      setTemplates(templatesRes.map(fromApiTemplate));
      setAutomations(automationsRes.map(fromApiAutomation));
    } catch (e) {
      console.error("Load email data error:", e);
      toast({ title: "Erro ao carregar e-mails admin", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadData();
  }, []);

  const toggleTemplate = async (id: string, active: boolean) => {
    try {
      const updated = await apiFetch<ApiEmailTemplate>(`/admin/email-templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !active }),
      });
      setTemplates((prev) => prev.map((t) => (t.id === id ? fromApiTemplate(updated) : t)));
      toast({ title: !active ? "Template ativado" : "Template desativado" });
    } catch (err: any) {
      toast({
        title: "Erro ao alterar template",
        description: err?.message,
        variant: "destructive",
      });
    }
  };

  const deleteTemplate = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    try {
      await apiFetch<void>(`/admin/email-templates/${id}`, { method: "DELETE" });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setConfirmDeleteId(null);
      toast({ title: "Template excluído" });
    } catch (err: any) {
      toast({
        title: "Erro ao excluir template",
        description: err?.message,
        variant: "destructive",
      });
    }
  };

  const toggleAutomation = async (id: string, active: boolean) => {
    try {
      const updated = await apiFetch<ApiEmailAutomation>(`/admin/email-automations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !active }),
      });
      setAutomations((prev) => prev.map((a) => (a.id === id ? fromApiAutomation(updated) : a)));
      toast({ title: !active ? "Automação ativada" : "Automação desativada" });
    } catch (err: any) {
      toast({
        title: "Erro ao alterar automação",
        description: err?.message,
        variant: "destructive",
      });
    }
  };

  const deleteAutomation = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    try {
      await apiFetch<void>(`/admin/email-automations/${id}`, { method: "DELETE" });
      setAutomations((prev) => prev.filter((a) => a.id !== id));
      setConfirmDeleteId(null);
      toast({ title: "Automação excluída" });
    } catch (err: any) {
      toast({
        title: "Erro ao excluir automação",
        description: err?.message,
        variant: "destructive",
      });
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try {
      return format(new Date(d), "dd MMM yyyy, HH:mm", { locale: ptBR });
    } catch {
      return d;
    }
  };

  const relativeTime = (d: string | null) => {
    if (!d) return "";
    try {
      return formatDistanceToNow(new Date(d), { addSuffix: true, locale: ptBR });
    } catch {
      return "";
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado" });
  };

  // ── Aggregate type stats for pie chart ──
  const typeStats =
    stats?.by_type?.reduce(
      (acc, item) => {
        const existing = acc.find((a) => a.name === item.email_type);
        if (existing) {
          existing.value += item.count;
        } else {
          acc.push({ name: item.email_type, value: item.count });
        }
        return acc;
      },
      [] as { name: string; value: number }[],
    ) || [];

  // ── Filtered logs ──
  const filteredLogs = useMemo(() => {
    const logs = stats?.recent_logs || [];
    let result = logs;
    if (logStatusFilter) result = result.filter((l: any) => l.status === logStatusFilter);
    if (logSearch) {
      const s = logSearch.toLowerCase();
      result = result.filter(
        (l: any) =>
          l.recipient_email?.toLowerCase().includes(s) ||
          l.subject?.toLowerCase().includes(s) ||
          l.email_type?.toLowerCase().includes(s),
      );
    }
    return result;
  }, [stats?.recent_logs, logStatusFilter, logSearch]);

  const logTotalPages = Math.max(1, Math.ceil(filteredLogs.length / LOGS_PER_PAGE));
  const safeLogPage = Math.min(logPage, logTotalPages);
  const paginatedLogs = filteredLogs.slice(
    (safeLogPage - 1) * LOGS_PER_PAGE,
    safeLogPage * LOGS_PER_PAGE,
  );

  // ── Filtered templates ──
  const filteredTemplates = useMemo(() => {
    if (!templateSearch) return templates;
    const s = templateSearch.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(s) ||
        t.slug.toLowerCase().includes(s) ||
        t.subject_template?.toLowerCase().includes(s),
    );
  }, [templates, templateSearch]);

  // ── Dashboard extra stats ──
  const dashboardExtra = useMemo(() => {
    const logs = stats?.recent_logs || [];
    const uniqueRecipients = new Set(logs.map((l: any) => l.recipient_email)).size;
    const failRate = stats?.sent_month
      ? ((stats.failed_total / (stats.sent_month + stats.failed_total)) * 100).toFixed(1)
      : "0";
    return { uniqueRecipients, failRate };
  }, [stats]);

  const subTabs: { id: SubTab; label: string; icon: React.ElementType }[] = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "templates", label: "Templates", icon: FileText },
    { id: "automations", label: "Automações", icon: Zap },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-foreground/[0.04] p-1 rounded-xl w-fit">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              subTab === tab.id
                ? "bg-foreground/15 text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
        <button
          onClick={loadData}
          disabled={loading}
          className="ml-2 p-2 rounded-lg text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* ── Dashboard ── */}
      {subTab === "dashboard" && stats && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <KPICard
              icon={Send}
              label="Enviados hoje"
              value={stats.sent_today}
              color="text-primary"
            />
            <KPICard icon={Send} label="Semana" value={stats.sent_week} color="text-violet-500" />
            <KPICard icon={Send} label="Mês" value={stats.sent_month} color="text-green-500" />
            <KPICard
              icon={XCircle}
              label="Falhas"
              value={stats.failed_total}
              color="text-destructive"
            />
            <KPICard
              icon={Clock}
              label="Ignorados"
              value={stats.skipped_total}
              color="text-amber-500"
            />
            <KPICard
              icon={Users}
              label="Destinatários"
              value={dashboardExtra.uniqueRecipients}
              color="text-cyan-500"
            />
            <KPICard
              icon={AlertTriangle}
              label="Taxa falha"
              value={`${dashboardExtra.failRate}%`}
              color="text-destructive"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Daily volume */}
            <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Volume diário (30 dias)
              </h3>
              {stats.daily_volume.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.daily_volume}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                    <XAxis
                      dataKey="day"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                      tickFormatter={(v) => format(new Date(v), "dd/MM")}
                    />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 12,
                        fontSize: 12,
                        color: "hsl(var(--foreground))",
                      }}
                    />
                    <Bar
                      dataKey="sent"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                      name="Enviados"
                    />
                    <Bar
                      dataKey="failed"
                      fill="hsl(var(--destructive))"
                      radius={[4, 4, 0, 0]}
                      name="Falhas"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhum dado ainda</p>
              )}
            </div>

            {/* By type pie */}
            <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Por tipo</h3>
              {typeStats.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={180}>
                    <PieChart>
                      <Pie
                        data={typeStats}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        innerRadius={40}
                      >
                        {typeStats.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 12,
                          fontSize: 12,
                          color: "hsl(var(--foreground))",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1">
                    {typeStats.map((item, i) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ background: COLORS[i % COLORS.length] }}
                        />
                        <span className="text-[10px] text-muted-foreground">{item.name}</span>
                        <span className="text-[10px] text-foreground font-medium">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhum dado ainda</p>
              )}
            </div>
          </div>

          {/* Recent logs */}
          <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-foreground">Envios recentes</h3>
              <div className="flex items-center gap-2">
                <select
                  value={logStatusFilter}
                  onChange={(e) => {
                    setLogStatusFilter(e.target.value as any);
                    setLogPage(1);
                  }}
                  className="bg-background rounded-lg px-3 py-1.5 text-xs text-foreground border border-border outline-none focus:ring-1 focus:ring-primary/30"
                >
                  <option value="">Todos status</option>
                  <option value="sent">Enviados</option>
                  <option value="failed">Falhas</option>
                  <option value="skipped">Ignorados</option>
                </select>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={logSearch}
                    onChange={(e) => {
                      setLogSearch(e.target.value);
                      setLogPage(1);
                    }}
                    placeholder="Buscar e-mail, assunto, tipo..."
                    className="pl-8 pr-3 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground w-52 outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 bg-foreground/[0.02]">
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Data</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Tipo</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                      Destinatário
                    </th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                      Assunto
                    </th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.map((log: any) => (
                    <Fragment key={log.id}>
                      <tr
                        className={`border-b border-border/30 hover:bg-foreground/[0.02] transition-colors cursor-pointer ${
                          log.status === "failed" ? "bg-destructive/[0.03]" : ""
                        }`}
                        onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                      >
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="text-muted-foreground">{formatDate(log.created_at)}</div>
                          <div className="text-[10px] text-muted-foreground/60">
                            {relativeTime(log.created_at)}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-foreground/[0.06] text-foreground/70 text-[10px]">
                            {log.email_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-foreground/60 truncate max-w-[150px]">
                          {log.recipient_email}
                        </td>
                        <td className="py-2.5 px-3 text-foreground/60 truncate max-w-[200px]">
                          {log.subject}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`flex items-center gap-1 text-[10px] font-medium ${
                              log.status === "sent"
                                ? "text-green-500"
                                : log.status === "failed"
                                  ? "text-destructive"
                                  : "text-amber-500"
                            }`}
                          >
                            {log.status === "sent" ? (
                              <CheckCircle className="w-3 h-3" />
                            ) : log.status === "failed" ? (
                              <XCircle className="w-3 h-3" />
                            ) : (
                              <Clock className="w-3 h-3" />
                            )}
                            {log.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-muted-foreground hover:text-foreground">
                            {expandedLogId === log.id ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </span>
                        </td>
                      </tr>
                      {expandedLogId === log.id && (
                        <tr className="border-b border-border/30 bg-foreground/[0.01]">
                          <td colSpan={6} className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              <div>
                                <span className="text-[10px] text-muted-foreground uppercase">
                                  ID
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <code className="text-foreground/60">{log.id}</code>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyText(log.id);
                                    }}
                                    className="text-muted-foreground hover:text-foreground"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              <div>
                                <span className="text-[10px] text-muted-foreground uppercase">
                                  Template
                                </span>
                                <p className="text-foreground/70 mt-0.5">
                                  {log.template_slug || "—"}
                                </p>
                              </div>
                              {log.error_message && (
                                <div className="col-span-2">
                                  <span className="text-[10px] text-destructive uppercase">
                                    Erro
                                  </span>
                                  <p className="text-destructive bg-destructive/10 rounded-lg p-2 mt-0.5 border border-destructive/20">
                                    {log.error_message}
                                  </p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                  {paginatedLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        {loading ? (
                          <RefreshCw className="w-4 h-4 mx-auto animate-spin opacity-40" />
                        ) : (
                          "Nenhum envio encontrado"
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {logTotalPages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-border/50 mt-2">
                <span className="text-[10px] text-muted-foreground">
                  {filteredLogs.length} registro{filteredLogs.length !== 1 ? "s" : ""} · Página{" "}
                  {safeLogPage} de {logTotalPages}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                    disabled={safeLogPage <= 1}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-foreground/5 text-foreground hover:bg-foreground/10 disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setLogPage((p) => Math.min(logTotalPages, p + 1))}
                    disabled={safeLogPage >= logTotalPages}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-foreground/5 text-foreground hover:bg-foreground/10 disabled:opacity-40"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Templates ── */}
      {subTab === "templates" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-foreground">Templates de E-mail</h3>
              <span className="text-[10px] text-muted-foreground bg-foreground/5 px-2 py-0.5 rounded-full">
                {templates.length} total
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="Buscar templates..."
                  className="pl-8 pr-3 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground w-44 outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
              <button
                onClick={() => {
                  setShowNewTemplate(true);
                  setEditingTemplate(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Novo Template
              </button>
            </div>
          </div>

          {(showNewTemplate || editingTemplate) && (
            <EmailTemplateEditor
              template={editingTemplate}
              onSave={async (data) => {
                try {
                  if (editingTemplate) {
                    const updated = await apiFetch<ApiEmailTemplate>(
                      `/admin/email-templates/${editingTemplate.id}`,
                      {
                        method: "PATCH",
                        body: JSON.stringify(toApiTemplate(data)),
                      },
                    );
                    setTemplates((prev) =>
                      prev.map((t) => (t.id === editingTemplate.id ? fromApiTemplate(updated) : t)),
                    );
                  } else {
                    const created = await apiFetch<ApiEmailTemplate>("/admin/email-templates", {
                      method: "POST",
                      body: JSON.stringify(toApiTemplate(data)),
                    });
                    setTemplates((prev) => [...prev, fromApiTemplate(created)]);
                  }
                  setEditingTemplate(null);
                  setShowNewTemplate(false);
                  toast({ title: editingTemplate ? "Template atualizado" : "Template criado" });
                } catch (err: any) {
                  toast({
                    title: "Erro ao salvar template",
                    description: err?.message,
                    variant: "destructive",
                  });
                }
              }}
              onCancel={() => {
                setEditingTemplate(null);
                setShowNewTemplate(false);
              }}
            />
          )}

          {/* Preview modal - full email render */}
          {previewTemplate &&
            (() => {
              // Demo data to replace template variables for realistic preview
              const demoVars: Record<string, string> = {
                "{{user_name}}": "João Silva",
                "{{display_name}}": "João Silva",
                "{{name}}": "João Silva",
                "{{email}}": "joao.silva@email.com",
                "{{title}}": previewTemplate.name,
                "{{message}}":
                  "Este é um preview do template com dados de demonstração. O conteúdo real será preenchido dinamicamente quando o e-mail for enviado aos usuários da plataforma.",
                "{{credits_balance}}": "1.250",
                "{{credits_used}}": "380",
                "{{credits_remaining}}": "870",
                "{{date}}": new Date().toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                }),
                "{{time}}": new Date().toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                "{{action_url}}": "#",
                "{{confirmation_url}}": "#",
                "{{reset_url}}": "#",
                "{{login_url}}": "#",
                "{{site_url}}": "https://desh.life",
                "{{token}}": "847291",
                "{{code}}": "847291",
                "{{otp}}": "847291",
                "{{plan_name}}": "Pro",
                "{{amount}}": "R$ 49,90",
                "{{period}}": "Março 2026",
                "{{tasks_completed}}": "12",
                "{{tasks_pending}}": "5",
                "{{events_today}}": "3",
                "{{summary}}":
                  "Você completou 12 tarefas, tem 5 pendentes e 3 eventos agendados para hoje. Continue assim! 🚀",
                "{{ip_address}}": "189.40.xx.xx",
                "{{device}}": "Chrome no macOS",
                "{{location}}": "São Paulo, BR",
                "{{coupon_code}}": "DESH2026",
                "{{discount}}": "20%",
                "{{expiry_date}}": "31/03/2026",
                "{{friend_name}}": "Ana Rodrigues",
                "{{workspace_name}}": "Equipe Marketing",
              };
              let previewHtml = previewTemplate.body_html;
              for (const [key, val] of Object.entries(demoVars)) {
                previewHtml = previewHtml.split(key).join(val);
              }
              // Also replace subject
              let previewSubject = previewTemplate.subject_template || "—";
              for (const [key, val] of Object.entries(demoVars)) {
                previewSubject = previewSubject.split(key).join(val);
              }
              return (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                  onClick={() => setPreviewTemplate(null)}
                >
                  <div
                    className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 bg-card/90 shrink-0">
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-foreground truncate">
                          {previewTemplate.name}
                        </h4>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          Assunto: {previewSubject} · Slug: {previewTemplate.slug}
                        </p>
                      </div>
                      <button
                        onClick={() => setPreviewTemplate(null)}
                        className="ml-3 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Email body rendered in sandboxed iframe */}
                    <div className="flex-1 overflow-hidden bg-[#f4f4f5]">
                      <iframe
                        title="Email Preview"
                        sandbox="allow-same-origin"
                        srcDoc={`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    body { margin: 0; padding: 32px 24px; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; color: #1a1a1a; line-height: 1.6; }
    img { max-width: 100%; height: auto; }
    a { color: #C8956C; text-decoration: none; }
    a:hover { text-decoration: underline; }
    * { box-sizing: border-box; }
    table { border-collapse: collapse; }
    td, th { padding: 0; }
  </style>
</head>
<body>${previewHtml}</body>
</html>`}
                        className="w-full border-0"
                        style={{ height: "70vh", minHeight: 400 }}
                      />
                    </div>

                    {/* Footer info */}
                    <div className="flex items-center justify-between px-5 py-2.5 border-t border-border/50 bg-card/90 shrink-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full ${
                            previewTemplate.type === "transactional"
                              ? "bg-primary/15 text-primary"
                              : previewTemplate.type === "report"
                                ? "bg-violet-500/15 text-violet-500"
                                : "bg-amber-500/15 text-amber-500"
                          }`}
                        >
                          {previewTemplate.type}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">
                          Variáveis substituídas por dados demo
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-medium ${previewTemplate.active ? "text-green-500" : "text-muted-foreground"}`}
                      >
                        {previewTemplate.active ? "● Ativo" : "○ Inativo"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

          <div className="space-y-2">
            {filteredTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-3 flex items-center gap-3"
              >
                <div
                  className={`w-2 h-2 rounded-full ${tpl.active ? "bg-green-500" : "bg-muted-foreground/30"}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-foreground truncate">{tpl.name}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-foreground/[0.06] text-muted-foreground">
                      {tpl.slug}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        tpl.type === "transactional"
                          ? "bg-primary/15 text-primary"
                          : tpl.type === "report"
                            ? "bg-violet-500/15 text-violet-500"
                            : "bg-amber-500/15 text-amber-500"
                      }`}
                    >
                      {tpl.type}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                    {tpl.subject_template}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <DeshTooltip label="Preview">
                    <button
                      onClick={() => setPreviewTemplate(tpl)}
                      className="p-1.5 rounded-lg hover:bg-foreground/10 text-muted-foreground hover:text-foreground"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </DeshTooltip>
                  <DeshTooltip label="Editar">
                    <button
                      onClick={() => {
                        setEditingTemplate(tpl);
                        setShowNewTemplate(false);
                      }}
                      className="p-1.5 rounded-lg hover:bg-foreground/10 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </DeshTooltip>
                  <DeshTooltip label={tpl.active ? "Desativar" : "Ativar"}>
                    <button
                      onClick={() => toggleTemplate(tpl.id, tpl.active)}
                      className="p-1.5 rounded-lg hover:bg-foreground/10 text-muted-foreground hover:text-foreground"
                    >
                      {tpl.active ? (
                        <ToggleRight className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <ToggleLeft className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </DeshTooltip>
                  <button
                    onClick={() => deleteTemplate(tpl.id)}
                    className={`p-1.5 rounded-lg hover:bg-foreground/10 text-muted-foreground ${confirmDeleteId === tpl.id ? "text-destructive bg-destructive/10" : "hover:text-destructive"}`}
                    title={
                      confirmDeleteId === tpl.id ? "Clique novamente para confirmar" : "Excluir"
                    }
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {filteredTemplates.length === 0 && !loading && (
              <p className="text-xs text-muted-foreground text-center py-8">
                {templateSearch ? "Nenhum template encontrado" : "Nenhum template cadastrado"}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Automations ── */}
      {subTab === "automations" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-foreground">Automações de E-mail</h3>
              <span className="text-[10px] text-muted-foreground bg-foreground/5 px-2 py-0.5 rounded-full">
                {automations.filter((a) => a.active).length} ativa
                {automations.filter((a) => a.active).length !== 1 ? "s" : ""}
              </span>
            </div>
            <button
              onClick={() => {
                setShowNewAutomation(true);
                setEditingAutomation(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Nova Automação
            </button>
          </div>

          {(showNewAutomation || editingAutomation) && (
            <EmailAutomationForm
              automation={editingAutomation}
              templates={templates}
              onSave={async (data) => {
                try {
                  if (editingAutomation) {
                    const updated = await apiFetch<ApiEmailAutomation>(
                      `/admin/email-automations/${editingAutomation.id}`,
                      {
                        method: "PATCH",
                        body: JSON.stringify(toApiAutomation(data)),
                      },
                    );
                    setAutomations((prev) =>
                      prev.map((a) =>
                        a.id === editingAutomation.id ? fromApiAutomation(updated) : a,
                      ),
                    );
                  } else {
                    const created = await apiFetch<ApiEmailAutomation>("/admin/email-automations", {
                      method: "POST",
                      body: JSON.stringify(toApiAutomation(data)),
                    });
                    setAutomations((prev) => [fromApiAutomation(created), ...prev]);
                  }
                  setEditingAutomation(null);
                  setShowNewAutomation(false);
                  toast({ title: editingAutomation ? "Automação atualizada" : "Automação criada" });
                } catch (err: any) {
                  toast({
                    title: "Erro ao salvar automação",
                    description: err?.message,
                    variant: "destructive",
                  });
                }
              }}
              onCancel={() => {
                setEditingAutomation(null);
                setShowNewAutomation(false);
              }}
            />
          )}

          <div className="space-y-2">
            {automations.map((aut) => (
              <div
                key={aut.id}
                className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-3 flex items-center gap-3"
              >
                <div
                  className={`w-2 h-2 rounded-full ${aut.active ? "bg-green-500" : "bg-muted-foreground/30"}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-foreground truncate">{aut.name}</p>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        aut.trigger_type === "cron"
                          ? "bg-primary/15 text-primary"
                          : aut.trigger_type === "event"
                            ? "bg-violet-500/15 text-violet-500"
                            : "bg-amber-500/15 text-amber-500"
                      }`}
                    >
                      {aut.trigger_type}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-foreground/[0.06] text-muted-foreground">
                      {aut.target_audience}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                    <span>Template: {aut.template_slug || "—"}</span>
                    <span>
                      Última exec: {aut.last_run_at ? relativeTime(aut.last_run_at) : "—"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingAutomation(aut);
                      setShowNewAutomation(false);
                    }}
                    className="p-1.5 rounded-lg hover:bg-foreground/10 text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => toggleAutomation(aut.id, aut.active)}
                    className="p-1.5 rounded-lg hover:bg-foreground/10 text-muted-foreground hover:text-foreground"
                  >
                    {aut.active ? (
                      <ToggleRight className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <ToggleLeft className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteAutomation(aut.id)}
                    className={`p-1.5 rounded-lg hover:bg-foreground/10 text-muted-foreground ${confirmDeleteId === aut.id ? "text-destructive bg-destructive/10" : "hover:text-destructive"}`}
                    title={confirmDeleteId === aut.id ? "Confirmar exclusão" : "Excluir"}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {automations.length === 0 && !loading && (
              <p className="text-xs text-muted-foreground text-center py-8">
                Nenhuma automação criada
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const KPICard = ({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
}) => (
  <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-3 text-center">
    <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
    <p className="text-lg font-bold text-foreground">{value}</p>
    <p className="text-[10px] text-muted-foreground">{label}</p>
  </div>
);

export default EmailNotificationsTab;

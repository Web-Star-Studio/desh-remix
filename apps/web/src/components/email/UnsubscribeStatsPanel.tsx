import { useState, useEffect, useMemo } from "react";
import { X, BarChart3, TrendingUp, TrendingDown, MailMinus, ShieldCheck, Loader2 } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { apiFetch } from "@/lib/api-client";
import { useWorkspaceFilter } from "@/hooks/workspace/useWorkspaceFilter";
import GlassCard from "@/components/dashboard/GlassCard";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import { Badge } from "@/components/ui/badge";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UnsubscribeStatsPanelProps {
  show: boolean;
  onClose: () => void;
}

interface HistoryRow {
  id: string;
  sender_name: string;
  sender_email: string;
  category: string;
  safety_score: number;
  method: string;
  success: boolean;
  trashed: boolean;
  emails_affected: number;
  created_at: string;
}

// apps/api returns camelCase + ISO timestamps; this panel was written against
// the legacy snake_case shape so we adapt at the boundary.
interface ApiHistoryRow {
  id: string;
  senderName: string;
  senderEmail: string;
  category: string;
  safetyScore: number;
  method: string;
  success: boolean;
  trashed: boolean;
  emailsAffected: number;
  createdAt: string;
}

function fromApi(row: ApiHistoryRow): HistoryRow {
  return {
    id: row.id,
    sender_name: row.senderName,
    sender_email: row.senderEmail,
    category: row.category,
    safety_score: row.safetyScore,
    method: row.method,
    success: row.success,
    trashed: row.trashed,
    emails_affected: row.emailsAffected,
    created_at: row.createdAt,
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  newsletter: "hsl(var(--primary))",
  marketing: "hsl(210, 80%, 60%)",
  social: "hsl(280, 70%, 60%)",
  promotional: "hsl(30, 90%, 55%)",
  notification: "hsl(170, 70%, 50%)",
  transactional: "hsl(0, 60%, 55%)",
  outro: "hsl(var(--muted-foreground))",
};

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(210, 80%, 60%)",
  "hsl(280, 70%, 60%)",
  "hsl(30, 90%, 55%)",
  "hsl(170, 70%, 50%)",
  "hsl(0, 60%, 55%)",
  "hsl(var(--muted-foreground))",
];

const UnsubscribeStatsPanel = ({ show, onClose }: UnsubscribeStatsPanelProps) => {
  const { activeWorkspaceId } = useWorkspaceFilter();
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7d" | "30d" | "all">("30d");

  useEffect(() => {
    if (!show || !activeWorkspaceId) return;
    let cancelled = false;
    setLoading(true);
    apiFetch<ApiHistoryRow[]>(
      `/workspaces/${activeWorkspaceId}/unsubscribe-history?limit=500`,
    )
      .then((rows) => {
        if (cancelled) return;
        setHistory(rows.map(fromApi));
      })
      .catch((err) => {
        console.warn("[unsubscribe-stats] load failed", err);
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [show, activeWorkspaceId]);

  const filteredHistory = useMemo(() => {
    if (period === "all") return history;
    const days = period === "7d" ? 7 : 30;
    const cutoff = subDays(new Date(), days);
    return history.filter((h) => new Date(h.created_at) >= cutoff);
  }, [history, period]);

  // Stats
  const totalUnsubscribed = filteredHistory.filter((h) => h.success).length;
  const totalFailed = filteredHistory.filter((h) => !h.success).length;
  const totalEmailsAffected = filteredHistory.filter((h) => h.success).reduce((s, h) => s + h.emails_affected, 0);
  const totalTrashed = filteredHistory.filter((h) => h.trashed && h.success).length;
  const successRate = filteredHistory.length > 0 ? Math.round((totalUnsubscribed / filteredHistory.length) * 100) : 0;

  // Trend data (daily)
  const trendData = useMemo(() => {
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 60;
    const interval = eachDayOfInterval({ start: subDays(new Date(), days - 1), end: new Date() });
    const dayMap = new Map<string, { success: number; failed: number; emails: number }>();

    interval.forEach((d) => dayMap.set(format(d, "yyyy-MM-dd"), { success: 0, failed: 0, emails: 0 }));

    filteredHistory.forEach((h) => {
      const key = format(new Date(h.created_at), "yyyy-MM-dd");
      const entry = dayMap.get(key);
      if (entry) {
        if (h.success) {
          entry.success++;
          entry.emails += h.emails_affected;
        } else {
          entry.failed++;
        }
      }
    });

    return Array.from(dayMap.entries()).map(([date, data]) => ({
      date: format(new Date(date), "dd/MM", { locale: ptBR }),
      ...data,
    }));
  }, [filteredHistory, period]);

  // Category breakdown
  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    filteredHistory.filter((h) => h.success).forEach((h) => {
      map.set(h.category, (map.get(h.category) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredHistory]);

  // Top senders
  const topSenders = useMemo(() => {
    const map = new Map<string, { name: string; email: string; count: number; emails: number }>();
    filteredHistory.filter((h) => h.success).forEach((h) => {
      const existing = map.get(h.sender_email) || { name: h.sender_name, email: h.sender_email, count: 0, emails: 0 };
      existing.count++;
      existing.emails += h.emails_affected;
      map.set(h.sender_email, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.emails - a.emails).slice(0, 5);
  }, [filteredHistory]);

  // Method breakdown
  const methodData = useMemo(() => {
    const map = new Map<string, number>();
    filteredHistory.filter((h) => h.success).forEach((h) => {
      const label = h.method === "POST" ? "One-Click (RFC 8058)" : h.method === "mailto" ? "Mailto" : "HTTP Link";
      map.set(label, (map.get(label) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredHistory]);

  if (!show) return null;

  return (
    <AnimatedItem>
      <GlassCard size="auto" className="mb-4 p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-foreground/10">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-sm">Estatísticas de Descadastro</h3>
          </div>
          <div className="flex items-center gap-2">
            {(["7d", "30d", "all"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                  period === p ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-foreground/10"
                }`}
              >
                {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "Tudo"}
              </button>
            ))}
            <button onClick={onClose} className="p-1 hover:bg-foreground/10 rounded-lg transition-colors ml-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center">
            <MailMinus className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground">Nenhum descadastro realizado ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">Use o Smart Unsubscribe para começar.</p>
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto">
            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
              <div className="bg-emerald-500/10 rounded-xl p-3 text-center">
                <ShieldCheck className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <p className="text-xl font-bold text-emerald-400">{totalUnsubscribed}</p>
                <p className="text-[10px] text-muted-foreground">Descadastrados</p>
              </div>
              <div className="bg-primary/10 rounded-xl p-3 text-center">
                <MailMinus className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-xl font-bold text-primary">{totalEmailsAffected}</p>
                <p className="text-[10px] text-muted-foreground">E-mails afetados</p>
              </div>
              <div className="bg-foreground/5 rounded-xl p-3 text-center">
                <TrendingUp className="w-5 h-5 text-foreground/60 mx-auto mb-1" />
                <p className="text-xl font-bold">{successRate}%</p>
                <p className="text-[10px] text-muted-foreground">Taxa de sucesso</p>
              </div>
              <div className="bg-red-500/10 rounded-xl p-3 text-center">
                <TrendingDown className="w-5 h-5 text-red-400 mx-auto mb-1" />
                <p className="text-xl font-bold text-red-400">{totalFailed}</p>
                <p className="text-[10px] text-muted-foreground">Falharam</p>
              </div>
            </div>

            {/* Trend chart */}
            <div className="px-4 pb-4">
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Tendência de Descadastros</h4>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="unsubGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--foreground) / 0.06)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Area type="monotone" dataKey="success" name="Sucesso" stroke="hsl(var(--primary))" fill="url(#unsubGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="failed" name="Falhas" stroke="hsl(0, 60%, 55%)" fill="hsl(0, 60%, 55%)" fillOpacity={0.1} strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Category + Method row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-4 pb-4">
              {/* Category pie */}
              {categoryData.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">Por Categoria</h4>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={3} strokeWidth={0}>
                          {categoryData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {categoryData.map((c, i) => (
                      <Badge key={c.name} variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        {c.name} ({c.value})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Method bar */}
              {methodData.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">Por Método</h4>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={methodData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--foreground) / 0.06)" />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Bar dataKey="value" name="Quantidade" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* Top senders */}
            {topSenders.length > 0 && (
              <div className="px-4 pb-4">
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Top Senders Descadastrados</h4>
                <div className="space-y-2">
                  {topSenders.map((s, i) => (
                    <div key={s.email} className="flex items-center gap-3 text-xs">
                      <span className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{s.name}</p>
                        <p className="text-muted-foreground truncate">{s.email}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{s.emails} e-mails</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </GlassCard>
    </AnimatedItem>
  );
};

export default UnsubscribeStatsPanel;

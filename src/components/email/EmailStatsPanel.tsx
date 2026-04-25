import { memo, useMemo } from "react";
import { X, BarChart3, Clock, Tag, TrendingUp, Mail } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { AI_CATEGORY_STYLES, LABEL_DOT } from "./types";
import type { EmailItem } from "./types";
import type { EmailCategoryMap } from "@/hooks/email/useEmailAI";

interface EmailStatsPanelProps {
  show: boolean;
  onClose: () => void;
  emails: EmailItem[];
  emailCategories: EmailCategoryMap;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(220, 70%, 55%)",
  "hsl(160, 60%, 45%)",
  "hsl(45, 80%, 55%)",
  "hsl(340, 65%, 50%)",
  "hsl(280, 55%, 55%)",
  "hsl(25, 75%, 50%)",
  "hsl(190, 65%, 45%)",
];

const EmailStatsPanel = memo(({ show, onClose, emails, emailCategories }: EmailStatsPanelProps) => {

  // 1. Distribution by AI category
  const categoryDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of emails) {
      const cat = emailCategories[e.id]?.category || "sem categoria";
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([cat, count]) => ({
        name: AI_CATEGORY_STYLES[cat]?.label || cat.charAt(0).toUpperCase() + cat.slice(1),
        value: count,
        category: cat,
      }))
      .sort((a, b) => b.value - a.value);
  }, [emails, emailCategories]);

  // 2. Daily volume (last 14 days)
  const dailyVolume = useMemo(() => {
    const days: Record<string, { received: number; sent: number }> = {};
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      days[key] = { received: 0, sent: 0 };
    }

    for (const e of emails) {
      if (!e.date) continue;
      // Try to parse common date formats
      let parsed: Date | null = null;
      // "23 fev" style
      const match = e.date.match(/^(\d{1,2})\s+(\w+)/);
      if (match) {
        const monthMap: Record<string, number> = { jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11 };
        const month = monthMap[match[2].toLowerCase().slice(0, 3)];
        if (month !== undefined) {
          parsed = new Date(now.getFullYear(), month, parseInt(match[1]));
          if (parsed > now) parsed.setFullYear(now.getFullYear() - 1);
        }
      }
      // "dd/mm" style
      if (!parsed) {
        const slashMatch = e.date.match(/^(\d{1,2})\/(\d{1,2})/);
        if (slashMatch) {
          parsed = new Date(now.getFullYear(), parseInt(slashMatch[2]) - 1, parseInt(slashMatch[1]));
          if (parsed > now) parsed.setFullYear(now.getFullYear() - 1);
        }
      }

      if (parsed) {
        const key = parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        if (days[key]) {
          if (e.folder === "sent") days[key].sent++;
          else days[key].received++;
        }
      }
    }

    return Object.entries(days).map(([date, counts]) => ({ date, ...counts }));
  }, [emails]);

  // 3. Response time estimation (time between received and next sent)
  const responseTimeStats = useMemo(() => {
    const inbox = emails.filter(e => e.folder === "inbox" || e.folder === "archive");
    const sent = emails.filter(e => e.folder === "sent");
    const totalEmails = emails.length;
    const unreadCount = emails.filter(e => e.unread).length;
    const starredCount = emails.filter(e => e.starred).length;
    const categorizedCount = emails.filter(e => emailCategories[e.id]).length;
    const actionRequired = emails.filter(e => emailCategories[e.id]?.requires_action).length;

    return {
      totalEmails,
      inboxCount: inbox.length,
      sentCount: sent.length,
      unreadCount,
      starredCount,
      categorizedCount,
      categorizedPct: totalEmails > 0 ? Math.round((categorizedCount / totalEmails) * 100) : 0,
      actionRequired,
      unreadPct: totalEmails > 0 ? Math.round((unreadCount / totalEmails) * 100) : 0,
    };
  }, [emails, emailCategories]);

  // 4. Top senders
  const topSenders = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of emails) {
      const sender = e.from || "Desconhecido";
      counts[sender] = (counts[sender] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name: name.length > 18 ? name.slice(0, 16) + "…" : name, count }));
  }, [emails]);

  if (!show) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-4 overflow-hidden"
        >
          <div className="bg-background/80 backdrop-blur-xl rounded-xl border border-border/40 p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h3 className="text-base font-semibold text-foreground">Estatísticas de E-mail</h3>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-foreground/10 text-muted-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <KPICard icon={<Mail className="w-4 h-4" />} label="Total" value={responseTimeStats.totalEmails} accent="text-primary" />
              <KPICard icon={<TrendingUp className="w-4 h-4" />} label="Não lidos" value={responseTimeStats.unreadCount} sub={`${responseTimeStats.unreadPct}%`} accent="text-blue-400" />
              <KPICard icon={<Tag className="w-4 h-4" />} label="Categorizados" value={responseTimeStats.categorizedCount} sub={`${responseTimeStats.categorizedPct}%`} accent="text-green-400" />
              <KPICard icon={<Clock className="w-4 h-4" />} label="Ação necessária" value={responseTimeStats.actionRequired} accent="text-amber-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Category distribution */}
              <div className="bg-foreground/[0.03] rounded-lg p-4 border border-foreground/5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Distribuição por Etiqueta</h4>
                {categoryDistribution.length > 0 ? (
                  <div className="flex items-center gap-4">
                    <div className="w-28 h-28 flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={categoryDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={22} outerRadius={48} strokeWidth={1.5} stroke="hsl(var(--background))">
                            {categoryDistribution.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-1.5 max-h-28 overflow-y-auto">
                      {categoryDistribution.map((item, i) => (
                        <div key={item.category} className="flex items-center gap-2 text-xs">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <span className="flex-1 truncate text-foreground/80">{item.name}</span>
                          <span className="tabular-nums text-muted-foreground font-medium">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6">Sem dados de categorização</p>
                )}
              </div>

              {/* Daily volume */}
              <div className="bg-foreground/[0.03] rounded-lg p-4 border border-foreground/5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Volume Diário (14 dias)</h4>
                <div className="h-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyVolume} barGap={1}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval={2} />
                      <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={20} />
                      <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="received" name="Recebidos" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="sent" name="Enviados" fill="hsl(220, 70%, 55%)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top senders */}
              <div className="bg-foreground/[0.03] rounded-lg p-4 border border-foreground/5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Remetentes Frequentes</h4>
                {topSenders.length > 0 ? (
                  <div className="h-28">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topSenders} layout="vertical" barSize={12}>
                        <XAxis type="number" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={80} />
                        <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="count" name="E-mails" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6">Sem dados</p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

const KPICard = ({ icon, label, value, sub, accent = "text-primary" }: { icon: React.ReactNode; label: string; value: number; sub?: string; accent?: string }) => (
  <div className="bg-foreground/[0.03] rounded-lg p-3 border border-foreground/5">
    <div className={`flex items-center gap-1.5 mb-1 ${accent}`}>
      {icon}
      <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">{label}</span>
    </div>
    <div className="flex items-baseline gap-1.5">
      <span className="text-xl font-bold text-foreground tabular-nums">{value.toLocaleString("pt-BR")}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  </div>
);

EmailStatsPanel.displayName = "EmailStatsPanel";

export default EmailStatsPanel;

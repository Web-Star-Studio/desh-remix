import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Activity, Users, TrendingUp, MessageSquare, ChevronDown, Heart } from "lucide-react";
import { subWeeks, startOfWeek, endOfWeek, isWithinInterval, parseISO, format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface InteractionSummary {
  count: number;
  lastDate: string | null;
  typeCounts: Record<string, number>;
}

interface Props {
  contacts: { id: string; name: string }[];
  interactionSummaryMap: Record<string, InteractionSummary>;
  allInteractions: { contact_id: string; interaction_date: string; type: string }[];
}

const computeScore = (s: InteractionSummary): number => {
  const freq = Math.min(s.count * 2, 40);
  let rec = 0;
  if (s.lastDate) {
    const d = Math.floor((Date.now() - new Date(s.lastDate).getTime()) / 86400000);
    if (d <= 7) rec = 40; else if (d <= 14) rec = 32; else if (d <= 30) rec = 20;
    else if (d <= 60) rec = 10; else if (d <= 90) rec = 4;
  }
  const tw: Record<string, number> = { meeting: 4, call: 3, email: 2, note: 1 };
  const type = Math.min(Object.entries(s.typeCounts).reduce((a, [t, c]) => a + (tw[t] || 1) * Math.min(c, 3), 0), 20);
  return Math.min(Math.round(freq + rec + type), 100);
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card/95 backdrop-blur-sm border border-border/50 rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <p className="text-primary">Score médio: <span className="font-bold tabular-nums">{payload[0]?.value ?? 0}</span></p>
      <p className="text-muted-foreground">Interações: <span className="font-semibold tabular-nums">{payload[1]?.value ?? 0}</span></p>
    </div>
  );
};

export default function CRMHealthPanel({ contacts, interactionSummaryMap, allInteractions }: Props) {
  const [open, setOpen] = useState(true);

  // ── Core metrics ──────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const total = contacts.length;
    if (total === 0) return { avgScore: 0, activePct: 0, monthInteractions: 0, totalWithData: 0 };

    const scores = contacts.map(c => computeScore(interactionSummaryMap[c.id] ?? { count: 0, lastDate: null, typeCounts: {} }));
    const avgScore = total > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / total) : 0;

    // Active = interacted in last 30 days
    const cutoff = Date.now() - 30 * 86400000;
    const active = contacts.filter(c => {
      const last = interactionSummaryMap[c.id]?.lastDate;
      return last && new Date(last).getTime() >= cutoff;
    }).length;
    const activePct = total > 0 ? Math.round((active / total) * 100) : 0;

    // Interactions in last 30 days
    const monthCutoff = subMonths(new Date(), 1);
    const monthInteractions = allInteractions.filter(i => {
      try { return parseISO(i.interaction_date) >= monthCutoff; } catch { return false; }
    }).length;

    const totalWithData = contacts.filter(c => (interactionSummaryMap[c.id]?.count ?? 0) > 0).length;

    return { avgScore, activePct, monthInteractions, totalWithData };
  }, [contacts, interactionSummaryMap, allInteractions]);

  // ── Weekly evolution chart (last 8 weeks) ─────────────────────────────────
  const weeklyData = useMemo(() => {
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const ref = subWeeks(new Date(), 7 - i);
      return {
        week: format(startOfWeek(ref, { locale: ptBR }), "dd/MM", { locale: ptBR }),
        start: startOfWeek(ref, { locale: ptBR }),
        end: endOfWeek(ref, { locale: ptBR }),
      };
    });

    return weeks.map(({ week, start, end }) => {
      // Interactions in this week
      const weekInts = allInteractions.filter(i => {
        try {
          return isWithinInterval(parseISO(i.interaction_date), { start, end });
        } catch { return false; }
      });

      // Average score of contacts that had interactions in this week (or use overall avg)
      const activeContactIds = [...new Set(weekInts.map(i => i.contact_id))];
      let avgScore = 0;
      if (activeContactIds.length > 0) {
        const weekScores = activeContactIds.map(id =>
          computeScore(interactionSummaryMap[id] ?? { count: 0, lastDate: null, typeCounts: {} })
        );
        avgScore = Math.round(weekScores.reduce((a, b) => a + b, 0) / weekScores.length);
      }

      return { week, score: avgScore, interacoes: weekInts.length };
    });
  }, [allInteractions, interactionSummaryMap]);

  const scoreColor = metrics.avgScore >= 70 ? "text-green-400" : metrics.avgScore >= 40 ? "text-primary" : "text-amber-400";
  const activeColor = metrics.activePct >= 60 ? "text-green-400" : metrics.activePct >= 30 ? "text-primary" : "text-amber-400";

  if (contacts.length === 0) return null;

  return (
    <div className="mb-4 rounded-2xl glass-card overflow-hidden">
      {/* Header toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between p-4"
      >
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Saúde do CRM</span>
          <span className="text-[10px] text-muted-foreground bg-foreground/5 px-2 py-0.5 rounded-full">
            {contacts.length} contatos · {metrics.totalWithData} com dados
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 space-y-4 border-t border-foreground/5">
              {/* ── Metric cards ──────────────────────────────────────────── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
                {/* Score médio */}
                <div className="rounded-xl bg-foreground/5 p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Score Médio</span>
                  </div>
                  <span className={`text-2xl font-bold tabular-nums ${scoreColor}`}>{metrics.avgScore}</span>
                  <div className="w-full h-1.5 bg-foreground/10 rounded-full overflow-hidden mt-0.5">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${metrics.avgScore}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground">de 100 pontos possíveis</span>
                </div>

                {/* Contatos ativos */}
                <div className="rounded-xl bg-foreground/5 p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Ativos (30d)</span>
                  </div>
                  <span className={`text-2xl font-bold tabular-nums ${activeColor}`}>{metrics.activePct}%</span>
                  <div className="w-full h-1.5 bg-foreground/10 rounded-full overflow-hidden mt-0.5">
                    <motion.div
                      className="h-full rounded-full bg-green-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${metrics.activePct}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground">com interação recente</span>
                </div>

                {/* Interações no mês */}
                <div className="rounded-xl bg-foreground/5 p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Interações / mês</span>
                  </div>
                  <span className="text-2xl font-bold tabular-nums text-amber-400">{metrics.monthInteractions}</span>
                  <div className="w-full h-1.5 bg-foreground/10 rounded-full overflow-hidden mt-0.5">
                    <motion.div
                      className="h-full rounded-full bg-amber-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((metrics.monthInteractions / Math.max(contacts.length, 1)) * 20, 100)}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground">últimos 30 dias</span>
                </div>

                {/* Com dados */}
                <div className="rounded-xl bg-foreground/5 p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Com Histórico</span>
                  </div>
                  <span className="text-2xl font-bold tabular-nums text-foreground">{metrics.totalWithData}</span>
                  <div className="w-full h-1.5 bg-foreground/10 rounded-full overflow-hidden mt-0.5">
                    <motion.div
                      className="h-full rounded-full bg-foreground/40"
                      initial={{ width: 0 }}
                      animate={{ width: contacts.length > 0 ? `${(metrics.totalWithData / contacts.length) * 100}%` : "0%" }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground">de {contacts.length} contatos</span>
                </div>
              </div>

              {/* ── Weekly chart ──────────────────────────────────────────── */}
              <div className="rounded-xl bg-foreground/5 p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold text-foreground">Evolução semanal</span>
                  <span className="text-[9px] text-muted-foreground ml-auto">últimas 8 semanas</span>
                </div>

                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-primary/70" />
                    <span className="text-[10px] text-muted-foreground">Score médio (contatos ativos)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-amber-400/70" />
                    <span className="text-[10px] text-muted-foreground">Interações registradas</span>
                  </div>
                </div>

                {allInteractions.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-xs text-muted-foreground italic">
                    Registre interações para ver a evolução semanal.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={140}>
                    <AreaChart data={weeklyData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                      <defs>
                        <linearGradient id="crm-score-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="crm-int-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(38 92% 50%)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="hsl(38 92% 50%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--foreground)/0.06)" />
                      <XAxis
                        dataKey="week"
                        tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={30} stroke="hsl(var(--destructive))" strokeDasharray="4 3" strokeWidth={1} label={{ value: "Risco", fontSize: 8, fill: "hsl(var(--destructive))", position: "right" }} />
                      <ReferenceLine y={70} stroke="hsl(var(--primary))" strokeDasharray="4 3" strokeWidth={1} label={{ value: "Meta", fontSize: 8, fill: "hsl(var(--primary))", position: "right" }} />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#crm-score-grad)"
                        dot={{ r: 3, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="interacoes"
                        stroke="hsl(38 92% 50%)"
                        strokeWidth={2}
                        fill="url(#crm-int-grad)"
                        dot={{ r: 3, fill: "hsl(38 92% 50%)", strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

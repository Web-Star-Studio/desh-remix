import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Loader2, CalendarDays, Clock, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2, Zap, Target, Info, ListTodo
} from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { useDbTasks } from "@/hooks/tasks/useDbTasks";
import { toast } from "@/hooks/use-toast";
import type { WeekTimeEvent } from "@/components/dashboard/calendar/WeekTimeGrid";

interface Suggestion {
  taskId: string;
  taskTitle: string;
  day: number;
  dayLabel: string;
  date: string;
  startTime: string;
  endTime: string;
  priority: "high" | "medium" | "low";
  reason: string;
}

interface Unscheduled {
  taskId: string;
  taskTitle: string;
  reason: string;
}

interface PlanResult {
  suggestions: Suggestion[];
  unscheduled: Unscheduled[];
  weekInsight: string;
}

interface WeekPlannerPanelProps {
  weekDays: Date[];
  weekEvents: WeekTimeEvent[];
}

const PRIORITY_CONFIG = {
  high: { label: "Alta", color: "bg-destructive/10 text-destructive border-destructive/20", dot: "bg-destructive", icon: "🔥" },
  medium: { label: "Média", color: "bg-warning/10 text-warning border-warning/20", dot: "bg-warning", icon: "⚡" },
  low: { label: "Baixa", color: "bg-accent/20 text-accent-foreground border-accent/30", dot: "bg-accent", icon: "🌱" },
};

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function WeekPlannerPanel({ weekDays, weekEvents }: WeekPlannerPanelProps) {
  const { invoke } = useEdgeFn();
  const { tasks } = useDbTasks();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [showInsight, setShowInsight] = useState(true);

  const pendingTasks = useMemo(
    () => tasks.filter(t => t.status !== "done"),
    [tasks]
  );

  const weekEventsForPrompt = useMemo(() => {
    return weekEvents.map(ev => {
      const d = weekDays.find(
        d => d.getDate() === ev.day && d.getMonth() === ev.month && d.getFullYear() === ev.year
      );
      const dayIndex = d ? weekDays.indexOf(d) : -1;
      return {
        title: ev.title,
        dayIndex,
        dayLabel: dayIndex >= 0 ? DAY_NAMES[dayIndex] : "?",
        startTime: ev.startTime,
        endTime: ev.endTime,
      };
    }).filter(e => e.dayIndex >= 0);
  }, [weekEvents, weekDays]);

  const weekDayLabels = useMemo(
    () => weekDays.map(d => d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })),
    [weekDays]
  );

  const handleGenerate = async () => {
    if (pendingTasks.length === 0) {
      toast({ title: "Nenhuma tarefa pendente", description: "Crie tarefas primeiro para planejar a semana." });
      return;
    }
    setLoading(true);
    setResult(null);

    const { data, error } = await invoke<{ result: PlanResult }>({
      fn: "ai-router",
      body: {
        module: "week-planner",
        pendingTasks: pendingTasks.slice(0, 20).map(t => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
          due_date: t.due_date,
          project: t.project,
        })),
        weekEvents: weekEventsForPrompt,
        weekDays: weekDayLabels,
      },
    });

    setLoading(false);

    if (error || !data?.result) {
      toast({ title: "Erro ao planejar", description: error || "Tente novamente.", variant: "destructive" });
      return;
    }

    setResult(data.result);
    setExpandedIdx(null);
    setShowInsight(true);
  };

  // Group suggestions by day
  const byDay = useMemo(() => {
    if (!result) return [];
    const map = new Map<number, Suggestion[]>();
    result.suggestions.forEach(s => {
      if (!map.has(s.day)) map.set(s.day, []);
      map.get(s.day)!.push(s);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [result]);

  return (
    <GlassCard size="auto" className="flex flex-col gap-3 sm:gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Planejamento da Semana</h3>
            <p className="text-[10px] text-muted-foreground">
              {pendingTasks.length} tarefa{pendingTasks.length !== 1 ? "s" : ""} pendente{pendingTasks.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading || pendingTasks.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          {loading ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analisando...</>
          ) : (
            <><Sparkles className="w-3.5 h-3.5" /> {result ? "Replanejar" : "Planejar semana"}</>
          )}
        </button>
      </div>

      {/* Pending task chips (preview) */}
      {!result && !loading && pendingTasks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pendingTasks.slice(0, 8).map(t => {
            const cfg = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.medium;
            return (
              <div key={t.id} className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${cfg.color}`}>
                <span>{cfg.icon}</span>
                <span className="truncate max-w-[120px]">{t.title}</span>
              </div>
            );
          })}
          {pendingTasks.length > 8 && (
            <div className="px-2 py-0.5 rounded-full bg-foreground/5 border border-foreground/10 text-[10px] text-muted-foreground">
              +{pendingTasks.length - 8} mais
            </div>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-3 py-8"
        >
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-primary/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            </div>
            <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">IA analisando sua semana...</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Verificando eventos e prioridades</p>
          </div>
        </motion.div>
      )}

      {/* Results */}
      <AnimatePresence>
        {result && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3"
          >
            {/* Week insight */}
            {result.weekInsight && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl bg-primary/8 border border-primary/15 p-3"
              >
                <button
                  onClick={() => setShowInsight(v => !v)}
                  className="flex items-center justify-between w-full gap-2"
                >
                  <div className="flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-xs font-medium text-primary">Visão da semana</span>
                  </div>
                  {showInsight ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />}
                </button>
                <AnimatePresence>
                  {showInsight && (
                    <motion.p
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="text-[11px] text-foreground/80 mt-2 leading-relaxed overflow-hidden"
                    >
                      {result.weekInsight}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-secondary/50 border border-secondary p-2 text-center">
                <p className="text-lg font-bold text-primary">{result.suggestions.length}</p>
                <p className="text-[9px] text-muted-foreground">agendadas</p>
              </div>
              <div className="rounded-lg bg-muted/50 border border-muted p-2 text-center">
                <p className="text-lg font-bold text-foreground/70">{result.unscheduled?.length || 0}</p>
                <p className="text-[9px] text-muted-foreground">sem espaço</p>
              </div>
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-2 text-center">
                <p className="text-lg font-bold text-primary">{byDay.length}</p>
                <p className="text-[9px] text-muted-foreground">dias usados</p>
              </div>
            </div>

            {/* Suggestions by day */}
            {byDay.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold text-foreground">Distribuição sugerida</p>
                </div>
                {byDay.map(([dayIdx, suggestions]) => {
                  const dayDate = weekDays[dayIdx];
                  const isExpanded = expandedIdx === dayIdx;
                  return (
                    <div key={dayIdx} className="rounded-xl border border-foreground/8 overflow-hidden">
                      <button
                        onClick={() => setExpandedIdx(isExpanded ? null : dayIdx)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-foreground/[0.02] hover:bg-foreground/5 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-primary">{dayDate?.getDate()}</span>
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-semibold text-foreground">
                              {dayDate?.toLocaleDateString("pt-BR", { weekday: "long" })}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {suggestions.length} tarefa{suggestions.length !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {suggestions.map((s, i) => (
                              <div key={i} className={`w-2 h-2 rounded-full ${PRIORITY_CONFIG[s.priority]?.dot || "bg-muted"}`} />
                            ))}
                          </div>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                        </div>
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: "auto" }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="flex flex-col divide-y divide-foreground/5">
                              {suggestions.map((s, i) => {
                                const cfg = PRIORITY_CONFIG[s.priority] || PRIORITY_CONFIG.medium;
                                return (
                                  <div key={i} className="px-3 py-2.5 flex items-start gap-2.5 bg-background/50">
                                    <div className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <p className="text-xs font-medium text-foreground truncate">{s.taskTitle}</p>
                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                                          <Clock className="w-3 h-3" />
                                          {s.startTime}–{s.endTime}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${cfg.color}`}>
                                          {cfg.label}
                                        </span>
                                        <p className="text-[10px] text-muted-foreground/70 leading-relaxed truncate">{s.reason}</p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Unscheduled tasks */}
            {result.unscheduled && result.unscheduled.length > 0 && (
              <div className="rounded-xl bg-muted/40 border border-muted p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold text-foreground/70">Não couberam esta semana</p>
                </div>
                <div className="flex flex-col gap-1">
                  {result.unscheduled.map((u, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <ListTodo className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] font-medium text-foreground">{u.taskTitle}</p>
                        <p className="text-[10px] text-muted-foreground">{u.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Success footer */}
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
              <CheckCircle2 className="w-3 h-3 text-primary" />
              Planejamento gerado por IA · Arraste eventos para ajustar na grade semanal
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

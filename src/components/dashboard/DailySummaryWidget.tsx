// DailySummaryWidget - polished with score bar, micro-progress, countdowns, richer details
import React, { useState, useEffect, useCallback, useMemo } from "react";
import DeshTooltip from "@/components/ui/DeshTooltip";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sparkles, RefreshCw, CheckCircle2, Target, Mail,
  CalendarDays, Wallet, MessageSquare, TrendingUp, TrendingDown,
  AlertTriangle, Zap, Trophy, Sun, Moon, Sunrise, ChevronRight,
  Clock, Flame, ArrowUpRight
} from "lucide-react";
import { useGoogleServiceData } from "@/hooks/integrations/useGoogleServiceData";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { usePersistedWidget } from "@/hooks/ui/usePersistedWidget";

interface DayStats {
  tasksDone: number;
  tasksPending: number;
  tasksHighPriority: number;
  habitsCompleted: number;
  habitsTotal: number;
  topStreak: { name: string; days: number } | null;
  monthBalance: number;
  totalIncome: number;
  totalExpense: number;
  unreadMessages: number;
}

interface SummaryData {
  day: string;
  stats: DayStats | null;
}

const SUMMARY_TTL_MS = 60 * 60 * 1000;

function formatTimeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 10) return "agora mesmo";
  if (diff < 60) return `${diff}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

interface LocalSummaryCache {
  key: string;
  stats: DayStats;
  cachedAt: number;
}

function getLsKey(workspaceId: string | null) {
  return workspaceId ? `daily_summary_cache_${workspaceId}` : "daily_summary_cache";
}

function readLocalCache(workspaceId: string | null): LocalSummaryCache | null {
  try {
    const raw = localStorage.getItem(getLsKey(workspaceId));
    if (!raw) return null;
    const parsed: LocalSummaryCache = JSON.parse(raw);
    if (Date.now() - parsed.cachedAt > SUMMARY_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocalCache(workspaceId: string | null, key: string, stats: DayStats) {
  try {
    const payload: LocalSummaryCache = { key, stats, cachedAt: Date.now() };
    localStorage.setItem(getLsKey(workspaceId), JSON.stringify(payload));
  } catch {}
}

function getTodayKey(workspaceId: string | null) {
  const d = new Date();
  const base = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  return workspaceId ? `${base}-${workspaceId}` : base;
}

function formatCurrency(value: number): string {
  if (value === 0) return "R$ 0";
  const abs = Math.abs(value);
  if (abs >= 1000) return `${value < 0 ? "-" : ""}R$ ${(abs / 1000).toFixed(1)}k`;
  return `${value < 0 ? "-" : ""}R$ ${abs.toFixed(0)}`;
}

// ── Progress Ring ──
const ProgressRing = ({ progress, size = 32, stroke = 3, color }: { progress: number; size?: number; stroke?: number; color: string }) => {
  const radius = (size - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(progress, 1) * circumference);

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="currentColor" strokeWidth={stroke}
        className="text-foreground/[0.06]"
      />
      <motion.circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
      />
    </svg>
  );
};

// ── Micro Progress Bar ──
const MicroBar = ({ ratio, colorClass }: { ratio: number; colorClass: string }) => (
  <div className="w-full h-1 rounded-full bg-foreground/[0.06] overflow-hidden mt-1">
    <motion.div
      className={`h-full rounded-full ${colorClass}`}
      initial={{ width: 0 }}
      animate={{ width: `${Math.min(ratio * 100, 100)}%` }}
      transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
    />
  </div>
);

// ── Status helpers ──
type StatusLevel = "good" | "warning" | "danger" | "neutral";

function getStatusColors(status: StatusLevel) {
  switch (status) {
    case "good": return { color: "text-emerald-400", bgColor: "bg-emerald-500/10", barColor: "bg-emerald-400", ringColor: "hsl(160, 84%, 39%)" };
    case "warning": return { color: "text-amber-400", bgColor: "bg-amber-500/10", barColor: "bg-amber-400", ringColor: "hsl(38, 92%, 50%)" };
    case "danger": return { color: "text-red-400", bgColor: "bg-red-500/10", barColor: "bg-red-400", ringColor: "hsl(0, 84%, 60%)" };
    default: return { color: "text-muted-foreground", bgColor: "bg-foreground/[0.05]", barColor: "bg-muted-foreground/40", ringColor: "hsl(0, 0%, 50%)" };
  }
}

// ── Smart Insight Generator with more variety ──
function generateInsight(
  stats: DayStats | null,
  emailCount: number,
  eventCount: number,
  nextEventMinutes: number | null
): { text: string; icon: React.ElementType; level: StatusLevel } {
  if (!stats) return { text: "Carregando dados do seu dia…", icon: Sparkles, level: "neutral" };

  const h = new Date().getHours();

  // Upcoming event urgency
  if (nextEventMinutes !== null && nextEventMinutes > 0 && nextEventMinutes <= 15) {
    return { text: `Próximo evento em ${nextEventMinutes} min — prepare-se!`, icon: Clock, level: "warning" };
  }

  // High priority tasks urgency
  if (stats.tasksHighPriority >= 3) {
    return { text: `${stats.tasksHighPriority} tarefas de alta prioridade precisam de atenção`, icon: AlertTriangle, level: "danger" };
  }

  // All tasks done + all habits done = perfect day
  if (stats.tasksPending === 0 && stats.tasksDone > 0 && stats.habitsTotal > 0 && stats.habitsCompleted === stats.habitsTotal) {
    return { text: "Dia perfeito! Tarefas e hábitos 100% concluídos 🏆", icon: Trophy, level: "good" };
  }

  // All tasks done
  if (stats.tasksPending === 0 && stats.tasksDone > 0) {
    return { text: "Todas as tarefas concluídas! Dia produtivo 🎉", icon: Trophy, level: "good" };
  }

  // Habits all done
  if (stats.habitsTotal > 0 && stats.habitsCompleted === stats.habitsTotal) {
    return { text: "Hábitos do dia completados! Consistência é poder 💪", icon: Zap, level: "good" };
  }

  // Spending warning
  if (stats.totalExpense > 0 && stats.totalIncome > 0 && stats.totalExpense > stats.totalIncome * 1.2) {
    return { text: "Despesas 20% acima da receita — revise o orçamento", icon: TrendingDown, level: "danger" };
  }

  // Busy calendar
  if (eventCount >= 5) {
    return { text: `Dia cheio com ${eventCount} eventos — foque no essencial`, icon: CalendarDays, level: "warning" };
  }

  // Afternoon and pending high-priority
  if (h >= 14 && stats.tasksHighPriority > 0) {
    return { text: `Ainda ${stats.tasksHighPriority} tarefa${stats.tasksHighPriority > 1 ? "s" : ""} urgente${stats.tasksHighPriority > 1 ? "s" : ""} — foque nela${stats.tasksHighPriority > 1 ? "s" : ""}`, icon: Flame, level: "warning" };
  }

  // Unread messages
  if (stats.unreadMessages >= 5) {
    return { text: `${stats.unreadMessages} mensagens não lidas aguardando resposta`, icon: MessageSquare, level: "warning" };
  }

  // High priority task
  if (stats.tasksHighPriority > 0) {
    return { text: `${stats.tasksHighPriority} tarefa${stats.tasksHighPriority > 1 ? "s" : ""} de alta prioridade pendente${stats.tasksHighPriority > 1 ? "s" : ""}`, icon: AlertTriangle, level: "warning" };
  }

  // Good financial standing
  if (stats.monthBalance > 0 && stats.totalIncome > 0) {
    return { text: `Saldo positivo: ${formatCurrency(stats.monthBalance)} este mês`, icon: TrendingUp, level: "good" };
  }

  // Default by time
  if (h < 12) return { text: "Bom dia! Comece pelas tarefas mais importantes", icon: Sunrise, level: "neutral" };
  if (h < 18) return { text: "Continue focado — você está indo bem hoje", icon: Sun, level: "neutral" };
  return { text: "Revise o que conquistou e planeje o amanhã", icon: Moon, level: "neutral" };
}

// ── Mini-card component ──
interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  details: string[];
  color: string;
  bgColor: string;
  ringColor: string;
  barColor: string;
  progress: number | null;
  barProgress: number | null;
  status: StatusLevel;
  href?: string;
  index: number;
  badge?: string;
}

const StatCard = ({ icon: Icon, label, value, details, color, bgColor, ringColor, barColor, progress, barProgress, href, index, badge }: StatCardProps) => {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.1 + index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      onClick={href ? () => navigate(href) : undefined}
      className={`group relative flex flex-col justify-between p-3 sm:p-3.5 rounded-xl bg-foreground/[0.02] border border-border/15 transition-all duration-200 overflow-hidden h-[130px] sm:h-[140px] ${
        href ? "cursor-pointer hover:bg-foreground/[0.05] hover:border-border/30 hover:shadow-sm active:scale-[0.97]" : ""
      }`}
    >
      {/* Top: Icon + right accessories */}
      <div className="flex items-center justify-between">
        <div className={`w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {badge && (
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${bgColor} ${color} leading-none`}>
              {badge}
            </span>
          )}
          {progress !== null && (
            <div className="relative">
              <ProgressRing progress={progress} size={28} stroke={2.5} color={ringColor} />
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-foreground/70">
                {Math.round(progress * 100)}
              </span>
            </div>
          )}
          {href && (
            <ChevronRight className="w-3 h-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </div>

      {/* Center: Value + Details */}
      <div className="flex flex-col gap-0.5 flex-1 justify-center min-h-0 mt-1">
        <span className="text-sm sm:text-base font-bold text-foreground leading-tight truncate">{value}</span>
        {details.length > 0 && (
          <div className="flex flex-col">
            {details.map((d, i) => (
              <span key={i} className="text-[10px] sm:text-[11px] text-muted-foreground leading-snug truncate">{d}</span>
            ))}
          </div>
        )}
      </div>

      {/* Bottom: Label + optional bar */}
      <div className="mt-auto pt-1">
        {barProgress !== null && (
          <MicroBar ratio={barProgress} colorClass={barColor} />
        )}
        <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-medium block mt-1">{label}</span>
      </div>
    </motion.div>
  );
};

// ── Score Bar ──
const ScoreBar = ({ score }: { score: number }) => {
  const scoreColor = score >= 80 ? "bg-emerald-400" : score >= 50 ? "bg-amber-400" : "bg-red-400";
  const scoreTextColor = score >= 80 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400";
  const scoreLabel = score >= 80 ? "Ótimo" : score >= 60 ? "Bom" : score >= 40 ? "Regular" : "Atenção";

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${scoreColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
        />
      </div>
      <div className="flex items-center gap-1">
        <span className={`text-[11px] font-bold ${scoreTextColor}`}>{score}</span>
        <span className="text-[9px] text-muted-foreground/50 font-medium">{scoreLabel}</span>
      </div>
    </div>
  );
};

// ── Main widget ──
const DailySummaryWidget = () => {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();

  const { data: persisted, save } = usePersistedWidget<SummaryData>({
    key: "daily_summary_v2",
    defaultValue: { day: "", stats: null },
  });

  const todayKey = getTodayKey(activeWorkspaceId);
  const localCache = readLocalCache(activeWorkspaceId);
  const localHit = localCache?.key === todayKey ? localCache : null;
  const dbCachedStats = persisted.day === todayKey ? persisted.stats : null;
  const cachedStats = localHit?.stats ?? dbCachedStats;

  const [stats, setStats] = useState<DayStats | null>(cachedStats);
  const [loading, setLoading] = useState(!cachedStats);
  const [error, setError] = useState(false);
  const [cachedAt, setCachedAt] = useState<number | null>(localHit?.cachedAt ?? null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!cachedAt) return;
    const t = setInterval(() => setTick(n => n + 1), 30_000);
    return () => clearInterval(t);
  }, [cachedAt]);

  // Google data hooks
  const { data: gmailMessages, isConnected: gmailConnected } = useGoogleServiceData<any[]>({
    service: "gmail",
    path: "/gmail/v1/users/me/messages",
    params: { maxResults: "10", format: "metadata", labelIds: "INBOX", q: "is:unread" },
    enabled: true,
  });

  const todayCalendarParams = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
    return { timeMin: startOfDay, timeMax: endOfDay, singleEvents: "true", orderBy: "startTime", maxResults: "10" };
  }, [Math.floor(Date.now() / 60_000)]);

  const { data: googleEvents, isConnected: calendarConnected } = useGoogleServiceData<any[]>({
    service: "calendar",
    path: "/calendars/primary/events",
    params: todayCalendarParams,
    enabled: true,
  });

  useEffect(() => {
    if (persisted.day === todayKey && persisted.stats) {
      setStats(persisted.stats);
      setLoading(false);
    }
  }, [persisted, todayKey]);

  const gatherStats = useCallback(async (): Promise<DayStats> => {
    let tasksQuery = supabase
      .from("tasks")
      .select("status, priority")
      .eq("user_id", user?.id ?? "");
    if (activeWorkspaceId) tasksQuery = tasksQuery.eq("workspace_id", activeWorkspaceId);
    const { data: tasks } = await tasksQuery;

    const tasksDone = (tasks || []).filter((t: any) => t.status === "done").length;
    const tasksPending = (tasks || []).filter((t: any) => t.status !== "done").length;
    const tasksHighPriority = (tasks || []).filter((t: any) => t.priority === "high" && t.status !== "done").length;

    const habitsKey = activeWorkspaceId ? `dashfy-${activeWorkspaceId}-habits` : "dashfy-habits";
    let habitsCompleted = 0;
    let habitsTotal = 0;
    try {
      const raw = localStorage.getItem(habitsKey);
      if (raw) {
        const habitsData = JSON.parse(raw);
        const today = new Date().toDateString();
        const habits = habitsData.date === today ? habitsData.habits : habitsData.habits?.map((h: any) => ({ ...h, completedToday: false }));
        habitsTotal = habits?.length || 0;
        habitsCompleted = habits?.filter((h: any) => h.completedToday).length || 0;
      }
    } catch {}

    let monthBalance = 0;
    let totalIncome = 0;
    let totalExpense = 0;
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      let finQuery = supabase
        .from("finance_transactions")
        .select("amount, type")
        .eq("user_id", user?.id ?? "")
        .gte("date", monthStart);
      if (activeWorkspaceId) finQuery = finQuery.eq("workspace_id", activeWorkspaceId);
      const { data: txns } = await finQuery;
      if (txns) {
        totalIncome = txns.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
        totalExpense = txns.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
        monthBalance = totalIncome - totalExpense;
      }
    } catch {}

    let unreadMessages = 0;
    try {
      const { count } = await supabase
        .from("whatsapp_conversations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user?.id ?? "")
        .gt("unread_count", 0);
      unreadMessages = count || 0;
    } catch {}

    return {
      tasksDone, tasksPending, tasksHighPriority,
      habitsCompleted, habitsTotal, topStreak: null,
      monthBalance, totalIncome, totalExpense, unreadMessages,
    };
  }, [user, activeWorkspaceId]);

  const fetchSummary = useCallback(async (force = false) => {
    if (!force && cachedStats) {
      setStats(cachedStats);
      setLoading(false);
      return;
    }

    if (force) {
      try { localStorage.removeItem(getLsKey(activeWorkspaceId)); } catch {}
      save({ day: "", stats: null });
      setStats(null);
      setCachedAt(null);
    }

    setLoading(true);
    setError(false);

    try {
      const dayStats = await gatherStats();
      setStats(dayStats);
      writeLocalCache(activeWorkspaceId, todayKey, dayStats);
      setCachedAt(Date.now());
      save({ day: todayKey, stats: dayStats });
    } catch (e) {
      console.error("Summary fetch error:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [cachedStats, gatherStats, save, todayKey, activeWorkspaceId]);

  useEffect(() => {
    if (user) fetchSummary();
  }, [user]);

  // Derive latest email sender
  const latestEmailSender = useMemo(() => {
    if (!gmailConnected || !gmailMessages?.length) return null;
    const from = (gmailMessages[0]?.payload?.headers || []).find((h: any) => h.name === "From")?.value || "";
    const name = from.replace(/<.*>/, "").trim();
    return name.length > 20 ? name.slice(0, 18) + "…" : name || null;
  }, [gmailConnected, gmailMessages]);

  // Derive next event + minutes until
  const { nextEvent, nextEventMinutes } = useMemo(() => {
    if (!calendarConnected || !googleEvents?.length) return { nextEvent: null, nextEventMinutes: null };
    const now = new Date();
    const upcoming = googleEvents.find((e: any) => {
      const start = e.start?.dateTime ? new Date(e.start.dateTime) : null;
      return start && start > now;
    });
    if (!upcoming) {
      const first = googleEvents[0];
      return first ? { nextEvent: { title: first.summary || "Evento", time: null }, nextEventMinutes: null } : { nextEvent: null, nextEventMinutes: null };
    }
    const startDate = new Date(upcoming.start.dateTime);
    const mins = Math.round((startDate.getTime() - now.getTime()) / 60000);
    return {
      nextEvent: {
        title: upcoming.summary || "Evento",
        time: startDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      },
      nextEventMinutes: mins,
    };
  }, [calendarConnected, googleEvents]);

  const emailCount = gmailConnected ? gmailMessages?.length || 0 : 0;
  const eventCount = calendarConnected ? googleEvents?.length || 0 : 0;

  // Smart insight
  const insight = useMemo(
    () => generateInsight(stats, emailCount, eventCount, nextEventMinutes),
    [stats, emailCount, eventCount, nextEventMinutes]
  );

  // Build enriched mini-cards
  const miniCards = useMemo(() => {
    const s = stats;

    // Tasks
    const totalTasks = s ? s.tasksDone + s.tasksPending : 0;
    const tasksProgress = s && totalTasks > 0 ? s.tasksDone / totalTasks : null;
    const tasksStatus: StatusLevel = !s ? "neutral" : s.tasksHighPriority >= 3 ? "danger" : s.tasksHighPriority > 0 ? "warning" : s.tasksPending === 0 && s.tasksDone > 0 ? "good" : "neutral";
    const tasksValue = s ? `${s.tasksDone}/${totalTasks}` : "--";
    const tasksDetails: string[] = [];
    if (s) {
      tasksDetails.push(s.tasksPending === 0 && s.tasksDone > 0 ? "✓ Tudo em dia!" : `${s.tasksPending} pendente${s.tasksPending > 1 ? "s" : ""}`);
      if (s.tasksHighPriority > 0) tasksDetails.push(`⚡ ${s.tasksHighPriority} urgente${s.tasksHighPriority > 1 ? "s" : ""}`);
    }
    const tasksBadge = s && s.tasksHighPriority > 0 ? `${s.tasksHighPriority}!` : undefined;

    // Habits
    const habitsProgress = s && s.habitsTotal > 0 ? s.habitsCompleted / s.habitsTotal : null;
    const habitsStatus: StatusLevel = !s ? "neutral" : s.habitsTotal === 0 ? "neutral" : s.habitsCompleted === s.habitsTotal ? "good" : s.habitsCompleted === 0 ? "warning" : "neutral";
    const habitsValue = s ? (s.habitsTotal === 0 ? "—" : `${s.habitsCompleted}/${s.habitsTotal}`) : "--";
    const habitsDetails: string[] = [];
    if (s) {
      if (s.habitsTotal === 0) {
        habitsDetails.push("Nenhum cadastrado");
      } else {
        const pct = Math.round((s.habitsCompleted / s.habitsTotal) * 100);
        habitsDetails.push(pct === 100 ? "✓ Todos concluídos!" : `${pct}% concluído`);
      }
      if (s.topStreak) habitsDetails.push(`🔥 ${s.topStreak.days}d ${s.topStreak.name}`);
    }

    // Emails
    const emailsStatus: StatusLevel = !gmailConnected ? "neutral" : emailCount > 5 ? "warning" : emailCount === 0 ? "good" : "neutral";
    const emailsValue = !gmailConnected ? "--" : emailCount > 0 ? `${emailCount} novos` : "Caixa limpa ✓";
    const emailsDetails: string[] = [];
    if (gmailConnected) {
      if (latestEmailSender) emailsDetails.push(`De: ${latestEmailSender}`);
    } else {
      emailsDetails.push("Conecte o Gmail");
    }

    // Events  
    const eventsStatus: StatusLevel = !calendarConnected ? "neutral" : eventCount >= 5 ? "warning" : eventCount === 0 ? "good" : "neutral";
    const eventsValue = !calendarConnected ? "--" : eventCount > 0 ? `${eventCount} hoje` : "Dia livre ✓";
    const eventsDetails: string[] = [];
    if (calendarConnected && nextEvent) {
      const timePart = nextEvent.time ? ` · ${nextEvent.time}` : "";
      const title = nextEvent.title.length > 20 ? nextEvent.title.slice(0, 18) + "…" : nextEvent.title;
      eventsDetails.push(`${title}${timePart}`);
      if (nextEventMinutes !== null && nextEventMinutes > 0) {
        eventsDetails.push(nextEventMinutes <= 60 ? `Em ${nextEventMinutes} min` : `Em ${Math.round(nextEventMinutes / 60)}h`);
      }
    } else if (!calendarConnected) {
      eventsDetails.push("Conecte o Calendar");
    }
    const eventBadge = nextEventMinutes !== null && nextEventMinutes <= 30 && nextEventMinutes > 0 ? `${nextEventMinutes}m` : undefined;

    // Finance
    const finStatus: StatusLevel = !s ? "neutral" : s.monthBalance > 0 ? "good" : s.monthBalance < 0 ? "danger" : "neutral";
    const finValue = s ? formatCurrency(s.monthBalance) : "--";
    const finDetails: string[] = [];
    const finBarProgress = s && (s.totalIncome + s.totalExpense) > 0 
      ? s.totalIncome / (s.totalIncome + s.totalExpense) 
      : null;
    if (s) {
      if (s.totalIncome === 0 && s.totalExpense === 0) {
        finDetails.push("Sem movimentação");
      } else {
        finDetails.push(`↑ ${formatCurrency(s.totalIncome)} · ↓ ${formatCurrency(s.totalExpense)}`);
      }
    }

    // Messages
    const msgStatus: StatusLevel = !s ? "neutral" : s.unreadMessages >= 5 ? "warning" : s.unreadMessages === 0 ? "good" : "neutral";
    const msgValue = s ? (s.unreadMessages > 0 ? `${s.unreadMessages} não lidas` : "Tudo lido ✓") : "--";
    const msgDetails: string[] = [];
    if (s && s.unreadMessages > 0) msgDetails.push("Aguardando resposta");
    const msgBadge = s && s.unreadMessages > 0 ? `${s.unreadMessages}` : undefined;

    const tc = getStatusColors(tasksStatus);
    const hc = getStatusColors(habitsStatus);
    const ec = getStatusColors(emailsStatus);
    const vc = getStatusColors(eventsStatus);
    const fc = getStatusColors(finStatus);
    const mc = getStatusColors(msgStatus);

    return [
      { icon: CheckCircle2, label: "Tarefas", value: tasksValue, details: tasksDetails, ...tc, progress: tasksProgress, barProgress: tasksProgress, status: tasksStatus, href: "/tasks", badge: tasksBadge },
      { icon: Target, label: "Hábitos", value: habitsValue, details: habitsDetails, ...hc, progress: habitsProgress, barProgress: null, status: habitsStatus, badge: undefined },
      { icon: Mail, label: "E-mails", value: emailsValue, details: emailsDetails, ...ec, progress: null, barProgress: null, status: emailsStatus, href: "/email", badge: undefined },
      { icon: CalendarDays, label: "Eventos", value: eventsValue, details: eventsDetails, ...vc, progress: null, barProgress: null, status: eventsStatus, href: "/calendar", badge: eventBadge },
      { icon: Wallet, label: "Finanças", value: finValue, details: finDetails, ...fc, progress: null, barProgress: finBarProgress, status: finStatus, href: "/finances", badge: undefined },
      { icon: MessageSquare, label: "Mensagens", value: msgValue, details: msgDetails, ...mc, progress: null, barProgress: null, status: msgStatus, href: "/messages", badge: msgBadge },
    ];
  }, [stats, gmailConnected, gmailMessages, calendarConnected, googleEvents, latestEmailSender, nextEvent, nextEventMinutes, emailCount, eventCount]);

  // Overall day score
  const dayScore = useMemo(() => {
    if (!stats) return null;
    let score = 40;
    const totalTasks = stats.tasksDone + stats.tasksPending;
    if (totalTasks > 0) score += (stats.tasksDone / totalTasks) * 25;
    if (stats.habitsTotal > 0) score += (stats.habitsCompleted / stats.habitsTotal) * 20;
    if (stats.monthBalance >= 0) score += 8;
    if (stats.tasksHighPriority === 0) score += 5;
    if (stats.unreadMessages === 0) score += 2;
    return Math.min(Math.round(score), 100);
  }, [stats]);

  const InsightIcon = insight.icon;
  const insightColors = getStatusColors(insight.level);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="mt-3 md:mt-4"
    >
      <div className="glass-card p-4">
        {/* Header with score bar */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">Resumo do Dia</span>
          </div>
          <DeshTooltip label="Atualizar resumo">
            <button
              onClick={() => fetchSummary(true)}
              disabled={loading}
              className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 p-1 rounded-lg hover:bg-foreground/5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </DeshTooltip>
        </div>

        {/* Score bar */}
        {dayScore !== null && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-3"
          >
            <ScoreBar score={dayScore} />
          </motion.div>
        )}

        {/* Smart Insight Banner */}
        <AnimatePresence mode="wait">
          {!loading && stats && (
            <motion.div
              key={insight.text}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3 }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${insightColors.bgColor} mb-3 border border-transparent ${
                insight.level === "danger" ? "border-red-500/10" : insight.level === "warning" ? "border-amber-500/10" : ""
              }`}
            >
              <InsightIcon className={`w-3.5 h-3.5 flex-shrink-0 ${insightColors.color}`} />
              <span className={`text-[11px] font-medium ${insightColors.color} leading-snug`}>{insight.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mini-cards grid */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5">
            {miniCards.map((card, i) => (
              <StatCard key={card.label} {...card} index={i} />
            ))}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full rounded-full" />
            <Skeleton className="h-8 w-full rounded-lg" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-3 sm:p-3.5 rounded-xl bg-foreground/[0.02] border border-border/15 h-[130px] sm:h-[140px]">
                  <div className="flex items-center justify-between mb-2">
                    <Skeleton className="w-8 h-8 rounded-lg" />
                    <Skeleton className="w-7 h-7 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-14 mb-1.5" />
                  <Skeleton className="h-2.5 w-20 mb-1" />
                  <Skeleton className="h-2.5 w-12" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <p className="text-xs text-muted-foreground mt-2">
            Não foi possível carregar os dados.{" "}
            <button onClick={() => fetchSummary(true)} className="underline hover:text-foreground transition-colors">
              Tentar novamente
            </button>
          </p>
        )}

        {/* Cache timestamp */}
        {!loading && !error && cachedAt && (
          <p className="mt-2.5 text-[10px] text-muted-foreground/40 text-right">
            Atualizado {formatTimeAgo(cachedAt)}
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default React.memo(DailySummaryWidget);

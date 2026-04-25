// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ── Module-level cache ──
const ANALYTICS_STALE_MS = 10 * 60 * 1000;
const analyticsCache: { key: string; data: any | null; ts: number } = { key: "", data: null, ts: 0 };

export interface WeeklyTaskStats {
  week: string;
  weekStart: string;
  completed: number;
  created: number;
}

export interface CategoryTime {
  category: string;
  count: number;
  percentage: number;
}

export interface FinanceSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  transactionCount: number;
  topCategories: { category: string; amount: number; type: string }[];
  monthlyTrend: { month: string; income: number; expense: number }[];
}

export interface ProductivityInsights {
  totalCompleted: number;
  totalCreated: number;
  completionRate: number;
  avgPerWeek: number;
  bestWeek: WeeklyTaskStats | null;
  streakDays: number;
  tasksByPriority: { priority: string; count: number }[];
  tasksByProject: { project: string; count: number }[];
  tasksByCategory: CategoryTime[];
  totalNotes: number;
  totalEvents: number;
  totalContacts: number;
  eventsByCategory: { category: string; count: number }[];
  dailyActivity: { date: string; tasks: number; notes: number; events: number }[];
  finance: FinanceSummary;
  productivityScore: number;
}

const WEEK_LABELS = ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6", "Sem 7", "Sem 8", "Sem 9", "Sem 10", "Sem 11", "Sem 12"];

export function useAnalytics(period: "month" | "quarter" | "year" = "quarter", workspaceId?: string | null) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [contactCount, setContactCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const dateRange = useMemo(() => {
    const now = new Date();
    const end = now.toISOString();
    let start: Date;
    if (period === "month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === "quarter") {
      start = new Date(now);
      start.setMonth(start.getMonth() - 3);
    } else {
      start = new Date(now.getFullYear(), 0, 1);
    }
    return { start: start.toISOString(), end };
  }, [period]);

  const fetchData = useCallback(async () => {
    if (!user) return;

    const cacheKey = `${user.id}|${period}|${dateRange.start}|${workspaceId || "all"}`;
    if (analyticsCache.key === cacheKey && analyticsCache.data && Date.now() - analyticsCache.ts < ANALYTICS_STALE_MS) {
      setTasks(analyticsCache.data.tasks);
      setNotes(analyticsCache.data.notes);
      setEvents(analyticsCache.data.events);
      setTransactions(analyticsCache.data.transactions);
      setContactCount(analyticsCache.data.contactCount);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Build queries with optional workspace filter
    let tasksQ = supabase
      .from("tasks")
      .select("id, title, status, priority, project, created_at, completed_at")
      .eq("user_id", user.id)
      .gte("created_at", dateRange.start)
      .order("created_at", { ascending: true })
      .limit(1000);

    let notesQ = supabase
      .from("user_data")
      .select("id, data_type, created_at")
      .eq("user_id", user.id)
      .eq("data_type", "notes")
      .gte("created_at", dateRange.start)
      .limit(1000);

    let eventsQ = supabase
      .from("user_data")
      .select("id, data_type, data, created_at")
      .eq("user_id", user.id)
      .eq("data_type", "calendar")
      .gte("created_at", dateRange.start)
      .limit(1000);

    let txQ = supabase
      .from("finance_transactions")
      .select("id, amount, type, category, date, description")
      .eq("user_id", user.id)
      .gte("date", dateRange.start.slice(0, 10))
      .order("date", { ascending: true })
      .limit(1000);

    let contactsQ = supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (workspaceId) {
      tasksQ = tasksQ.eq("workspace_id", workspaceId);
      notesQ = notesQ.eq("workspace_id", workspaceId);
      eventsQ = eventsQ.eq("workspace_id", workspaceId);
      txQ = txQ.eq("workspace_id", workspaceId);
      contactsQ = contactsQ.eq("workspace_id", workspaceId);
    }

    const [tasksRes, notesRes, eventsRes, txRes, contactsRes] = await Promise.all([
      tasksQ, notesQ, eventsQ, txQ, contactsQ,
    ]);

    const t = tasksRes.data || [];
    const n = notesRes.data || [];
    const e = eventsRes.data || [];
    const tx = txRes.data || [];
    const cc = contactsRes.count || 0;

    setTasks(t);
    setNotes(n);
    setEvents(e);
    setTransactions(tx);
    setContactCount(cc);

    analyticsCache.key = cacheKey;
    analyticsCache.data = { tasks: t, notes: n, events: e, transactions: tx, contactCount: cc };
    analyticsCache.ts = Date.now();

    setIsLoading(false);
  }, [user, dateRange, period, workspaceId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Weekly task stats
  const weeklyStats = useMemo<WeeklyTaskStats[]>(() => {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    const weeks: WeeklyTaskStats[] = [];
    let weekStart = new Date(start);
    let weekNum = 0;

    while (weekStart < end && weekNum < 12) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const created = tasks.filter(t => {
        const d = new Date(t.created_at);
        return d >= weekStart && d < weekEnd;
      }).length;

      const completed = tasks.filter(t => {
        if (!t.completed_at) return false;
        const d = new Date(t.completed_at);
        return d >= weekStart && d < weekEnd;
      }).length;

      weeks.push({
        week: WEEK_LABELS[weekNum] || `Sem ${weekNum + 1}`,
        weekStart: weekStart.toISOString().slice(0, 10),
        completed,
        created,
      });

      weekStart = weekEnd;
      weekNum++;
    }
    return weeks;
  }, [tasks, dateRange]);

  // Finance summary
  const financeSummary = useMemo<FinanceSummary>(() => {
    const totalIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalExpense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
    const balance = totalIncome - totalExpense;

    // Top expense categories
    const catMap: Record<string, { amount: number; type: string }> = {};
    transactions.forEach(tx => {
      const cat = tx.category || "Outros";
      if (!catMap[cat]) catMap[cat] = { amount: 0, type: tx.type };
      catMap[cat].amount += Math.abs(tx.amount);
    });
    const topCategories = Object.entries(catMap)
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);

    // Monthly trend
    const monthMap: Record<string, { income: number; expense: number }> = {};
    transactions.forEach(tx => {
      const month = tx.date?.slice(0, 7) || "unknown";
      if (!monthMap[month]) monthMap[month] = { income: 0, expense: 0 };
      if (tx.type === "income") monthMap[month].income += Math.abs(tx.amount);
      else monthMap[month].expense += Math.abs(tx.amount);
    });
    const monthlyTrend = Object.entries(monthMap)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return { totalIncome, totalExpense, balance, transactionCount: transactions.length, topCategories, monthlyTrend };
  }, [transactions]);

  // Insights
  const insights = useMemo<ProductivityInsights>(() => {
    const totalCompleted = tasks.filter(t => t.status === "done").length;
    const totalCreated = tasks.length;
    const completionRate = totalCreated > 0 ? (totalCompleted / totalCreated) * 100 : 0;
    const weeksWithData = weeklyStats.filter(w => w.completed > 0 || w.created > 0);
    const avgPerWeek = weeksWithData.length > 0 ? totalCompleted / weeksWithData.length : 0;
    const bestWeek = weeklyStats.length > 0 ? [...weeklyStats].sort((a, b) => b.completed - a.completed)[0] : null;

    // Streak
    const completedDates = new Set(
      tasks.filter(t => t.completed_at).map(t => new Date(t.completed_at).toISOString().slice(0, 10))
    );
    let streakDays = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (completedDates.has(d.toISOString().slice(0, 10))) {
        streakDays++;
      } else if (i > 0) break;
    }

    // By priority
    const priorityMap: Record<string, number> = {};
    tasks.forEach(t => { priorityMap[t.priority] = (priorityMap[t.priority] || 0) + 1; });
    const tasksByPriority = Object.entries(priorityMap).map(([priority, count]) => ({ priority, count }));

    // By project
    const projectMap: Record<string, number> = {};
    tasks.forEach(t => {
      const proj = t.project || "Sem projeto";
      projectMap[proj] = (projectMap[proj] || 0) + 1;
    });
    const tasksByProject = Object.entries(projectMap)
      .map(([project, count]) => ({ project, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // By status
    const statusMap: Record<string, number> = {};
    tasks.forEach(t => { statusMap[t.status] = (statusMap[t.status] || 0) + 1; });
    const tasksByCategory = Object.entries(statusMap).map(([category, count]) => ({
      category, count, percentage: totalCreated > 0 ? (count / totalCreated) * 100 : 0,
    }));

    // Notes & events
    const totalNotes = notes.length;
    const totalEvents = events.length;
    const eventCatMap: Record<string, number> = {};
    events.forEach(ev => {
      try {
        const data = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
        const cat = data?.category || "outro";
        eventCatMap[cat] = (eventCatMap[cat] || 0) + 1;
      } catch { /* skip */ }
    });
    const eventsByCategory = Object.entries(eventCatMap)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    // Daily activity (last 30 days)
    const dailyMap: Record<string, { tasks: number; notes: number; events: number }> = {};
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = { tasks: 0, notes: 0, events: 0 };
    }
    tasks.forEach(t => {
      const key = new Date(t.created_at).toISOString().slice(0, 10);
      if (dailyMap[key]) dailyMap[key].tasks++;
    });
    notes.forEach(n => {
      const key = new Date(n.created_at).toISOString().slice(0, 10);
      if (dailyMap[key]) dailyMap[key].notes++;
    });
    events.forEach(ev => {
      const key = new Date(ev.created_at).toISOString().slice(0, 10);
      if (dailyMap[key]) dailyMap[key].events++;
    });
    const dailyActivity = Object.entries(dailyMap)
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Productivity score (0-100): weighted composite
    const completionScore = Math.min(completionRate, 100);
    const streakScore = Math.min(streakDays * 5, 100);
    const activityScore = Math.min((totalCreated + totalNotes + totalEvents) / (period === "month" ? 30 : period === "quarter" ? 90 : 365) * 100, 100);
    const productivityScore = Math.round(completionScore * 0.4 + streakScore * 0.3 + activityScore * 0.3);

    return {
      totalCompleted, totalCreated, completionRate, avgPerWeek, bestWeek,
      streakDays, tasksByPriority, tasksByProject, tasksByCategory,
      totalNotes, totalEvents, totalContacts: contactCount, eventsByCategory, dailyActivity,
      finance: financeSummary,
      productivityScore,
    };
  }, [tasks, notes, events, weeklyStats, contactCount, financeSummary, period]);

  return {
    weeklyStats, insights, isLoading,
    refetch: fetchData,
  };
}

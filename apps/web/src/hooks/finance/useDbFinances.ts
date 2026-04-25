// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { translatePluggyCategory, mapPluggyCategoryToInternal } from "@/lib/finance/pluggyCategories";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useWorkspaceFilter } from "@/hooks/workspace/useWorkspaceFilter";

// Types — canonical definitions live in /src/types/finance.ts
export type { FinanceGoal, FinanceTransaction, FinanceRecurring, FinanceBudget, YearlyMonthSummary } from "@/types/finance";
import type { FinanceGoal, FinanceTransaction, FinanceRecurring, FinanceBudget, YearlyMonthSummary } from "@/types/finance";

// ── Module-level in-memory cache ──
const FINANCE_STALE_MS = 10 * 60 * 1000;
const financeCache: { key: string; data: { goals: FinanceGoal[]; transactions: FinanceTransaction[]; recurring: FinanceRecurring[]; budgets: FinanceBudget[] } | null; ts: number } = { key: "", data: null, ts: 0 };

const GOAL_COLORS = [
  "hsl(220, 10%, 35%)",
  "hsl(220, 60%, 55%)",
  "hsl(140, 50%, 50%)",
  "hsl(0, 70%, 55%)",
  "hsl(280, 50%, 55%)",
];

export function useDbFinances() {
  const { user } = useAuth();
  const { activeWorkspaceId, getInsertWorkspaceId } = useWorkspaceFilter();
  const [goals, setGoals] = useState<FinanceGoal[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [recurring, setRecurring] = useState<FinanceRecurring[]>([]);
  const [budgets, setBudgets] = useState<FinanceBudget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [yearlyTransactions, setYearlyTransactions] = useState<FinanceTransaction[]>([]);
  const [isLoadingYearly, setIsLoadingYearly] = useState(false);

  const fetchAll = useCallback(async (force = false) => {
    if (!user) return;

    const cacheKey = `${user.id}|${activeWorkspaceId ?? ""}|${selectedMonth}`;
    if (!force && financeCache.key === cacheKey && financeCache.data && Date.now() - financeCache.ts < FINANCE_STALE_MS) {
      setGoals(financeCache.data.goals);
      setTransactions(financeCache.data.transactions);
      setRecurring(financeCache.data.recurring);
      setBudgets(financeCache.data.budgets);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const [year, month] = selectedMonth.split("-").map(Number);
    const startDate = new Date(year, month - 1, 1).toISOString().split("T")[0];
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];

    let goalsQuery = supabase.from("finance_goals").select("id, name, target, current, color").eq("user_id", user.id).order("created_at", { ascending: false });
    let txQuery = supabase.from("finance_transactions").select("id, description, amount, type, category, date, source, external_id, account_name").eq("user_id", user.id).gte("date", startDate).lte("date", endDate).order("date", { ascending: false }).limit(200);
    let recQuery = supabase.from("finance_recurring").select("id, description, amount, type, category, day_of_month, active").eq("user_id", user.id).order("created_at", { ascending: false });
    let budgetQuery = (supabase as any).from("finance_budgets").select("id, category, monthly_limit, workspace_id").eq("user_id", user.id);

    // Also fetch from unified Open Banking table
    let unifiedQuery = (supabase as any)
      .from("financial_transactions_unified")
      .select("id, description, amount, type, category, date, provider_transaction_id, account_id, merchant_name")
      .eq("user_id", user.id)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false })
      .limit(500);

    if (activeWorkspaceId) {
      goalsQuery = goalsQuery.eq("workspace_id", activeWorkspaceId);
      txQuery = txQuery.eq("workspace_id", activeWorkspaceId);
      recQuery = recQuery.eq("workspace_id", activeWorkspaceId);
      budgetQuery = budgetQuery.eq("workspace_id", activeWorkspaceId);
      // Filter unified transactions by workspace via their linked accounts
      const { data: wsAccounts } = await supabase
        .from("financial_accounts")
        .select("id")
        .eq("user_id", user.id)
        .eq("workspace_id", activeWorkspaceId);
      if (wsAccounts && wsAccounts.length > 0) {
        unifiedQuery = unifiedQuery.in("account_id", wsAccounts.map((a: any) => a.id));
      } else {
        // No accounts in this workspace — return empty unified
        unifiedQuery = unifiedQuery.eq("account_id", "00000000-0000-0000-0000-000000000000");
      }
    }

    const [goalsRes, txRes, recRes, unifiedRes, budgetRes] = await Promise.all([goalsQuery, txQuery, recQuery, unifiedQuery, budgetQuery]);

    if (!goalsRes.error) setGoals((goalsRes.data || []) as FinanceGoal[]);
    if (!recRes.error) setRecurring((recRes.data || []) as FinanceRecurring[]);
    if (!budgetRes.error) setBudgets((budgetRes.data || []) as FinanceBudget[]);

    // Merge manual + unified transactions
    const manualTxs = (txRes.data || []) as FinanceTransaction[];
    const unifiedTxs = ((unifiedRes.data || []) as any[]).map((t: any) => ({
      id: t.id,
      description: t.description || t.merchant_name || "Transação",
      amount: Math.abs(Number(t.amount)),
      type: (t.type === "inflow" ? "income" : "expense") as "income" | "expense",
      category: mapPluggyCategoryToInternal(t.category) || "Outros",
      date: t.date,
      source: "openbanking",
      external_id: t.provider_transaction_id,
      account_name: null,
    } as FinanceTransaction));

    // Deduplicate: skip unified txs whose provider_transaction_id matches a manual tx external_id
    const manualExternalIds = new Set(manualTxs.filter(t => t.external_id).map(t => t.external_id));
    const dedupedUnified = unifiedTxs.filter(t => !manualExternalIds.has(t.external_id));

    const merged = [...manualTxs, ...dedupedUnified].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    setTransactions(merged);

    // Update module cache
    const cacheKey2 = `${user.id}|${activeWorkspaceId ?? ""}|${selectedMonth}`;
    financeCache.key = cacheKey2;
    financeCache.data = { goals: (goalsRes.data || []) as FinanceGoal[], transactions: merged, recurring: (recRes.data || []) as FinanceRecurring[], budgets: (budgetRes.data || []) as FinanceBudget[] };
    financeCache.ts = Date.now();

    setIsLoading(false);
  }, [user, selectedMonth, activeWorkspaceId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Visibility-aware refresh: re-fetch when user returns to tab after 5+ minutes
  useEffect(() => {
    let lastFetch = Date.now();
    const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFetch > STALE_THRESHOLD) {
        lastFetch = Date.now();
        fetchAll();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchAll]);

  // Use refs for generateRecurring to avoid stale closures on recurring/transactions
  const recurringRef = useRef(recurring);
  recurringRef.current = recurring;

  const generateRecurring = useCallback(async () => {
    if (!user || recurringRef.current.length === 0) return;

    const [year, month] = selectedMonth.split("-").map(Number);
    const now = new Date();
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
    if (!isCurrentMonth) return;

    const activeRecurring = recurringRef.current.filter(r => r.active);
    const existingDescs = new Set(transactionsRef.current.map(t => `${t.description}|${t.date}`));

    const toCreate: Array<{
      description: string; amount: number; type: string;
      category: string; user_id: string; date: string;
    }> = [];

    for (const r of activeRecurring) {
      const day = Math.min(r.day_of_month, new Date(year, month, 0).getDate());
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const key = `${r.description}|${dateStr}`;
      if (!existingDescs.has(key)) {
        toCreate.push({
          description: r.description,
          amount: r.amount,
          type: r.type,
          category: r.category,
          user_id: user.id,
          date: dateStr,
        });
      }
    }

    if (toCreate.length > 0) {
      const { data, error } = await supabase
        .from("finance_transactions")
        .insert(toCreate)
        .select("id, description, amount, type, category, date");

      if (!error && data) {
        setTransactions(prev => [...(data as FinanceTransaction[]), ...prev]);
        const total = data.reduce((s: number, t: any) => s + Number(t.amount), 0);
        const msg = `${data.length} transação(ões) • R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
        toast({ title: "Recorrentes geradas", description: msg });

        if ("Notification" in window) {
          if (Notification.permission === "granted") {
            new Notification("💰 Transações recorrentes", { body: msg, icon: "/pwa-192x192.png" });
          } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(perm => {
              if (perm === "granted") {
                new Notification("💰 Transações recorrentes", { body: msg, icon: "/pwa-192x192.png" });
              }
            });
          }
        }
      }
    }
  }, [user, selectedMonth]);

  // Auto-run on first load when data is ready (respects settings)
  const hasAutoGenerated = useRef(false);
  useEffect(() => {
    if (!isLoading && recurring.length > 0 && !hasAutoGenerated.current) {
      hasAutoGenerated.current = true;
      try {
        const saved = localStorage.getItem("dashfy-notifs");
        const settings = saved ? JSON.parse(saved) : {};
        if (settings.autoRecurring === false) return;
      } catch {}
      generateRecurring();
    }
  }, [isLoading, recurring.length, generateRecurring]);

  // Goals
  const addGoal = useCallback(async (name: string, target: number, current: number = 0) => {
    if (!user) return;
    const color = GOAL_COLORS[goals.length % GOAL_COLORS.length];
    const wsId = getInsertWorkspaceId();
    const { data, error } = await supabase
      .from("finance_goals")
      .insert({ name, target, current, color, user_id: user.id, ...(wsId ? { workspace_id: wsId } : {}) } as any)
      .select("id, name, target, current, color")
      .single();

    if (error) {
      toast({ title: "Erro", description: "Falha ao criar meta.", variant: "destructive" });
    } else if (data) {
      setGoals(prev => [data as FinanceGoal, ...prev]);
    }
  }, [user, goals.length]);

  const updateGoalAmount = useCallback(async (id: string, amount: number) => {
    setGoals(prev => {
      const goal = prev.find(g => g.id === id);
      if (!goal) return prev;
      const newCurrent = Math.max(0, Math.min(goal.target, goal.current + amount));
      Promise.resolve(supabase.from("finance_goals").update({ current: newCurrent }).eq("id", id)).catch((err) => console.error("Goal update error:", err));
      return prev.map(g => g.id === id ? { ...g, current: newCurrent } : g);
    });
  }, []);

  const deleteGoal = useCallback(async (id: string) => {
    const { error } = await supabase.from("finance_goals").delete().eq("id", id);
    if (!error) setGoals(prev => prev.filter(g => g.id !== id));
  }, []);

  // Transactions
  const addTransaction = useCallback(async (description: string, amount: number, type: "income" | "expense", category: string, date?: string) => {
    if (!user) return;
    const wsId = getInsertWorkspaceId();
    const { data, error } = await supabase
      .from("finance_transactions")
      .insert({ description, amount: Math.abs(amount), type, category, user_id: user.id, ...(date ? { date } : {}), ...(wsId ? { workspace_id: wsId } : {}) } as any)
      .select("id, description, amount, type, category, date, source, external_id")
      .single();

    if (error) {
      toast({ title: "Erro", description: "Falha ao criar transação.", variant: "destructive" });
    } else if (data) {
      setTransactions(prev => [data as FinanceTransaction, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }
  }, [user]);

  // Use ref for transactions to avoid stale closures in update/delete
  const transactionsRef = useRef(transactions);
  transactionsRef.current = transactions;

  const updateTransaction = useCallback(async (id: string, updates: { description?: string; amount?: number; category?: string }) => {
    const tx = transactionsRef.current.find(t => t.id === id);
    const table = tx?.source === "openbanking" ? "financial_transactions_unified" : "finance_transactions";
    const { error } = await (supabase as any).from(table).update(updates).eq("id", id);

    if (error) {
      toast({ title: "Erro", description: "Falha ao atualizar transação.", variant: "destructive" });
    } else {
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } as FinanceTransaction : t));
    }
  }, []);

  const deleteTransaction = useCallback(async (id: string) => {
    const tx = transactionsRef.current.find(t => t.id === id);
    const table = tx?.source === "openbanking" ? "financial_transactions_unified" : "finance_transactions";
    const { error } = await (supabase as any).from(table).delete().eq("id", id);
    if (!error) setTransactions(prev => prev.filter(t => t.id !== id));
  }, []);

  // Recurring
  const addRecurring = useCallback(async (description: string, amount: number, type: "income" | "expense", category: string, dayOfMonth: number) => {
    if (!user) return;
    const wsId = getInsertWorkspaceId();
    const { data, error } = await supabase
      .from("finance_recurring")
      .insert({ description, amount: Math.abs(amount), type, category, day_of_month: dayOfMonth, user_id: user.id, ...(wsId ? { workspace_id: wsId } : {}) } as any)
      .select("id, description, amount, type, category, day_of_month, active")
      .single();

    if (error) {
      toast({ title: "Erro", description: "Falha ao criar recorrente.", variant: "destructive" });
    } else if (data) {
      setRecurring(prev => [data as FinanceRecurring, ...prev]);
    }
  }, [user]);

  const toggleRecurring = useCallback(async (id: string) => {
    setRecurring(prev => {
      const rec = prev.find(r => r.id === id);
      if (!rec) return prev;
      Promise.resolve(supabase.from("finance_recurring").update({ active: !rec.active }).eq("id", id)).catch((err) => console.error("Recurring toggle error:", err));
      return prev.map(r => r.id === id ? { ...r, active: !r.active } : r);
    });
  }, []);

  const deleteRecurring = useCallback(async (id: string) => {
    const { error } = await supabase.from("finance_recurring").delete().eq("id", id);
    if (!error) setRecurring(prev => prev.filter(r => r.id !== id));
  }, []);

  // Computed — memoized to avoid recalculation on every render
  const { totalIncome, totalExpense, balance } = useMemo(() => {
    const inc = transactions.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const exp = transactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    return { totalIncome: inc, totalExpense: exp, balance: inc - exp };
  }, [transactions]);

  const categoryBreakdown = useMemo(() =>
    transactions
      .filter(t => t.type === "expense")
      .reduce<Record<string, number>>((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
        return acc;
      }, {}),
    [transactions]
  );

  const dailyTrend = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const days: { day: string; receita: number; despesa: number }[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayTxs = transactions.filter(t => t.date === dateStr);
      days.push({
        day: String(d),
        receita: dayTxs.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0),
        despesa: dayTxs.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0),
      });
    }
    return days;
  }, [transactions, selectedMonth]);

  // Previous month data for MoM comparison
  const prevMonthTotals = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    // We'll use yearly transactions if available, otherwise return null
    const prevStart = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-01`;
    const prevEnd = new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0).toISOString().split("T")[0];
    const prevTxs = yearlyTransactions.filter(t => t.date >= prevStart && t.date <= prevEnd);
    if (prevTxs.length === 0) return null;
    const prevIncome = prevTxs.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const prevExpense = prevTxs.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    return { income: prevIncome, expense: prevExpense, balance: prevIncome - prevExpense };
  }, [yearlyTransactions, selectedMonth]);

  const insights = useMemo(() => {
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
    const topCategory = Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1])[0];
    const avgDailyExpense = transactions.filter(t => t.type === "expense").length > 0
      ? totalExpense / new Set(transactions.filter(t => t.type === "expense").map(t => t.date)).size
      : 0;

    // Month-over-month change
    const expenseChange = prevMonthTotals && prevMonthTotals.expense > 0
      ? ((totalExpense - prevMonthTotals.expense) / prevMonthTotals.expense) * 100
      : null;
    const incomeChange = prevMonthTotals && prevMonthTotals.income > 0
      ? ((totalIncome - prevMonthTotals.income) / prevMonthTotals.income) * 100
      : null;

    return { savingsRate, topCategory, avgDailyExpense, expenseChange, incomeChange, prevMonthTotals };
  }, [totalIncome, totalExpense, categoryBreakdown, transactions, prevMonthTotals]);

  // Yearly summary (includes Open Banking unified transactions)
  const fetchYearlySummary = useCallback(async () => {
    if (!user) return;
    setIsLoadingYearly(true);
    const startDate = `${selectedYear}-01-01`;
    const endDate = `${selectedYear}-12-31`;

    let yearlyManualQuery = supabase
        .from("finance_transactions")
        .select("id, description, amount, type, category, date, source, external_id")
        .eq("user_id", user.id)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true })
        .limit(1000);

    let yearlyUnifiedQuery = (supabase as any)
        .from("financial_transactions_unified")
        .select("id, description, amount, type, category, date, provider_transaction_id, merchant_name")
        .eq("user_id", user.id)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true })
        .limit(1000);

    if (activeWorkspaceId) {
      yearlyManualQuery = yearlyManualQuery.eq("workspace_id", activeWorkspaceId);
      const { data: wsAccounts } = await supabase
        .from("financial_accounts")
        .select("id")
        .eq("user_id", user.id)
        .eq("workspace_id", activeWorkspaceId);
      if (wsAccounts && wsAccounts.length > 0) {
        yearlyUnifiedQuery = yearlyUnifiedQuery.in("account_id", wsAccounts.map((a: any) => a.id));
      } else {
        yearlyUnifiedQuery = yearlyUnifiedQuery.eq("account_id", "00000000-0000-0000-0000-000000000000");
      }
    }

    const [manualRes, unifiedRes] = await Promise.all([yearlyManualQuery, yearlyUnifiedQuery]);

    const manualTxs = (manualRes.data || []) as FinanceTransaction[];
    const unifiedTxs = ((unifiedRes.data || []) as any[]).map((t: any) => ({
      id: t.id,
      description: t.description || t.merchant_name || "Transação",
      amount: Math.abs(Number(t.amount)),
      type: (t.type === "inflow" ? "income" : "expense") as "income" | "expense",
      category: mapPluggyCategoryToInternal(t.category) || "Outros",
      date: t.date,
      source: "openbanking",
      external_id: t.provider_transaction_id,
    } as FinanceTransaction));

    const manualExternalIds = new Set(manualTxs.filter(t => t.external_id).map(t => t.external_id));
    const dedupedUnified = unifiedTxs.filter(t => !manualExternalIds.has(t.external_id));
    const merged = [...manualTxs, ...dedupedUnified].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    setYearlyTransactions(merged);
    setIsLoadingYearly(false);
  }, [user, selectedYear]);

  useEffect(() => {
    fetchYearlySummary();
  }, [fetchYearlySummary]);

  const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  const yearlySummary = useMemo<YearlyMonthSummary[]>(() => {
    const months: YearlyMonthSummary[] = MONTH_LABELS.map((label, i) => ({
      month: i + 1, label, income: 0, expense: 0, balance: 0,
    }));

    for (const tx of yearlyTransactions) {
      const m = parseInt(tx.date.split("-")[1], 10);
      if (m >= 1 && m <= 12) {
        const amt = Number(tx.amount);
        if (tx.type === "income") months[m - 1].income += amt;
        else months[m - 1].expense += amt;
      }
    }

    months.forEach(m => { m.balance = m.income - m.expense; });
    return months;
  }, [yearlyTransactions]);

  const yearlyTotals = useMemo(() => {
    const totalIncome = yearlySummary.reduce((s, m) => s + m.income, 0);
    const totalExpense = yearlySummary.reduce((s, m) => s + m.expense, 0);
    const balance = totalIncome - totalExpense;
    const avgMonthly = totalExpense / 12;
    const bestMonth = [...yearlySummary].sort((a, b) => b.balance - a.balance)[0];
    const worstMonth = [...yearlySummary].sort((a, b) => a.balance - b.balance)[0];
    return { totalIncome, totalExpense, balance, avgMonthly, bestMonth, worstMonth };
  }, [yearlySummary]);

  const budgetsRef = useRef(budgets);
  budgetsRef.current = budgets;

  const setBudgetLimit = useCallback(async (category: string, limit: number) => {
    if (!user) return;
    const wsId = getInsertWorkspaceId();
    const existing = budgetsRef.current.find(b => b.category === category && (b.workspace_id || null) === (wsId || null));
    if (existing) {
      if (limit <= 0) {
        await (supabase as any).from("finance_budgets").delete().eq("id", existing.id);
        setBudgets(prev => prev.filter(b => b.id !== existing.id));
      } else {
        await (supabase as any).from("finance_budgets").update({ monthly_limit: limit }).eq("id", existing.id);
        setBudgets(prev => prev.map(b => b.id === existing.id ? { ...b, monthly_limit: limit } : b));
      }
    } else if (limit > 0) {
      const { data } = await (supabase as any).from("finance_budgets")
        .insert({ user_id: user.id, category, monthly_limit: limit, ...(wsId ? { workspace_id: wsId } : {}) })
        .select("id, category, monthly_limit, workspace_id")
        .single();
      if (data) setBudgets(prev => [...prev, data as FinanceBudget]);
    }
  }, [user, getInsertWorkspaceId]);

  return {
    goals, transactions, recurring, budgets, isLoading,
    addGoal, updateGoalAmount, deleteGoal,
    addTransaction, updateTransaction, deleteTransaction,
    addRecurring, toggleRecurring, deleteRecurring, generateRecurring,
    setBudgetLimit,
    totalIncome, totalExpense, balance, categoryBreakdown,
    dailyTrend, insights,
    selectedMonth, setSelectedMonth,
    selectedYear, setSelectedYear,
    yearlySummary, yearlyTotals, isLoadingYearly,
    refetch: fetchAll,
  };
}

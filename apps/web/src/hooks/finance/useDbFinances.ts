/**
 * useDbFinances — combined manual + Pluggy finance data plane.
 *
 * Backed by apps/api `/workspaces/:id/finance/*` (manual: goals, transactions,
 * recurring, budgets) and `/workspaces/:id/finance/pluggy/transactions`
 * (unified Pluggy rows). The two streams are merged on the client and
 * deduplicated where a manual entry shares an `external_id` with a Pluggy
 * row — the manual one wins so the user's category/description edits don't
 * get clobbered on the next sync.
 *
 * Snake-case shapes are preserved at the hook boundary so existing
 * consumer components don't need rewiring.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";

// Types — canonical definitions live in /src/types/finance.ts
export type {
  FinanceGoal,
  FinanceTransaction,
  FinanceRecurring,
  FinanceBudget,
  YearlyMonthSummary,
} from "@/types/finance";
import type {
  FinanceGoal,
  FinanceTransaction,
  FinanceRecurring,
  FinanceBudget,
  YearlyMonthSummary,
} from "@/types/finance";

// ── Module-level in-memory cache (preserved from legacy) ──
const FINANCE_STALE_MS = 10 * 60 * 1000;
const financeCache: {
  key: string;
  data: {
    goals: FinanceGoal[];
    transactions: FinanceTransaction[];
    recurring: FinanceRecurring[];
    budgets: FinanceBudget[];
  } | null;
  ts: number;
} = { key: "", data: null, ts: 0 };

const GOAL_COLORS = [
  "hsl(220, 10%, 35%)",
  "hsl(220, 60%, 55%)",
  "hsl(140, 50%, 50%)",
  "hsl(0, 70%, 55%)",
  "hsl(280, 50%, 55%)",
];

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// ── Pluggy unified-transaction merge ──
// Manual rows (Wave A) and Pluggy rows (Wave B) live in distinct tables but
// the SPA renders them as a single list. Merge rules:
//
//  1. Manual rows always survive — the user may have edited their category
//     or description, and we don't want to clobber that on the next sync.
//  2. Pluggy rows that share `external_id` with a manual row are dropped.
//     This handles the future case where a user marks a Pluggy row as
//     "imported" by creating a manual one with `external_id` set.
//  3. Pluggy `inflow`/`outflow` is mapped to the manual `income`/`expense`
//     vocabulary so downstream computations don't need to branch.

interface UnifiedApiTransaction {
  id: string;
  date: string;
  description: string | null;
  amount: string;
  type: "inflow" | "outflow";
  category: string | null;
  merchantName: string | null;
  accountId: string;
  providerTransactionId: string;
}

function unifiedToManualShape(t: UnifiedApiTransaction): FinanceTransaction {
  return {
    id: t.id,
    description: t.description ?? t.merchantName ?? "",
    amount: Number(t.amount),
    type: t.type === "inflow" ? "income" : "expense",
    category: t.category ?? "Outros",
    date: t.date,
    source: "pluggy",
    external_id: t.providerTransactionId,
    account_name: null,
  };
}

function mergeManualAndUnified(
  manual: FinanceTransaction[],
  unified: UnifiedApiTransaction[],
): FinanceTransaction[] {
  const manualExternalIds = new Set(
    manual.map((t) => t.external_id).filter((v): v is string => Boolean(v)),
  );
  const fromUnified = unified
    .filter((u) => !manualExternalIds.has(u.providerTransactionId))
    .map(unifiedToManualShape);
  const out = [...manual, ...fromUnified];
  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return out;
}

function reportError(action: string, err: unknown) {
  const msg = err instanceof ApiError ? `${action} (${err.status})` : `${action}`;
  console.error(`[finance] ${action} failed`, err);
  toast({ title: "Erro", description: msg, variant: "destructive" });
}

export function useDbFinances() {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
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

  const fetchAll = useCallback(
    async (force = false) => {
      if (!user || !activeWorkspaceId) return;

      const cacheKey = `${user.id}|${activeWorkspaceId}|${selectedMonth}`;
      if (
        !force &&
        financeCache.key === cacheKey &&
        financeCache.data &&
        Date.now() - financeCache.ts < FINANCE_STALE_MS
      ) {
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

      try {
        const root = `/workspaces/${activeWorkspaceId}/finance`;
        const [goalsRes, txRes, recRes, budgetRes, unifiedRes] = await Promise.all([
          apiFetch<{ goals: FinanceGoal[] }>(`${root}/goals`),
          apiFetch<{ transactions: FinanceTransaction[] }>(
            `${root}/transactions?startDate=${startDate}&endDate=${endDate}&limit=500`,
          ),
          apiFetch<{ recurring: FinanceRecurring[] }>(`${root}/recurring`),
          apiFetch<{ budgets: FinanceBudget[] }>(`${root}/budgets`),
          apiFetch<{ transactions: UnifiedApiTransaction[] }>(
            `${root}/pluggy/transactions?from=${startDate}&to=${endDate}&limit=500`,
          ).catch(() => ({ transactions: [] })),
        ]);

        const merged = mergeManualAndUnified(txRes.transactions, unifiedRes.transactions);

        setGoals(goalsRes.goals);
        setRecurring(recRes.recurring);
        setBudgets(budgetRes.budgets);
        setTransactions(merged);

        financeCache.key = cacheKey;
        financeCache.data = {
          goals: goalsRes.goals,
          transactions: merged,
          recurring: recRes.recurring,
          budgets: budgetRes.budgets,
        };
        financeCache.ts = Date.now();
      } catch (err) {
        reportError("fetchAll", err);
      } finally {
        setIsLoading(false);
      }
    },
    [user, selectedMonth, activeWorkspaceId],
  );

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Visibility-aware refresh: re-fetch when user returns to tab after 5+ minutes.
  useEffect(() => {
    let lastFetch = Date.now();
    const STALE_THRESHOLD = 5 * 60 * 1000;
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFetch > STALE_THRESHOLD) {
        lastFetch = Date.now();
        fetchAll();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchAll]);

  // Refs to avoid stale closures inside generateRecurring/update/delete.
  const recurringRef = useRef(recurring);
  recurringRef.current = recurring;
  const transactionsRef = useRef(transactions);
  transactionsRef.current = transactions;
  const budgetsRef = useRef(budgets);
  budgetsRef.current = budgets;

  // ── Recurring materialisation ──
  // Materialise active recurring rules as actual transactions for the
  // current month, idempotent on (description, date). The legacy hook
  // hit Supabase directly with a bulk insert; the new path POSTs each
  // missing one through /finance/transactions so the server enforces
  // workspace + check constraints. Fan-out instead of bulk because the
  // API has no bulk endpoint yet — fine, ~12 inserts per month max.
  const generateRecurring = useCallback(async () => {
    if (!user || !activeWorkspaceId || recurringRef.current.length === 0) return;
    const [year, month] = selectedMonth.split("-").map(Number);
    const now = new Date();
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
    if (!isCurrentMonth) return;

    const activeRecurring = recurringRef.current.filter((r) => r.active);
    const existing = new Set(transactionsRef.current.map((t) => `${t.description}|${t.date}`));

    const toCreate: Array<{
      description: string;
      amount: number;
      type: "income" | "expense";
      category: string;
      date: string;
    }> = [];

    for (const r of activeRecurring) {
      const day = Math.min(r.day_of_month, new Date(year, month, 0).getDate());
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const key = `${r.description}|${dateStr}`;
      if (!existing.has(key)) {
        toCreate.push({
          description: r.description,
          amount: r.amount,
          type: r.type,
          category: r.category,
          date: dateStr,
        });
      }
    }

    if (toCreate.length === 0) return;

    try {
      const created: FinanceTransaction[] = [];
      for (const tx of toCreate) {
        const res = await apiFetch<{ transaction: FinanceTransaction }>(
          `/workspaces/${activeWorkspaceId}/finance/transactions`,
          { method: "POST", body: JSON.stringify(tx) },
        );
        created.push(res.transaction);
      }
      setTransactions((prev) => [...created, ...prev]);
      const total = created.reduce((s, t) => s + Number(t.amount), 0);
      const msg = `${created.length} transação(ões) • R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
      toast({ title: "Recorrentes geradas", description: msg });
      if ("Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification("💰 Transações recorrentes", { body: msg, icon: "/pwa-192x192.png" });
        } else if (Notification.permission !== "denied") {
          Notification.requestPermission().then((perm) => {
            if (perm === "granted") {
              new Notification("💰 Transações recorrentes", { body: msg, icon: "/pwa-192x192.png" });
            }
          });
        }
      }
    } catch (err) {
      reportError("generateRecurring", err);
    }
  }, [user, activeWorkspaceId, selectedMonth]);

  const hasAutoGenerated = useRef(false);
  useEffect(() => {
    if (!isLoading && recurring.length > 0 && !hasAutoGenerated.current) {
      hasAutoGenerated.current = true;
      try {
        const saved = localStorage.getItem("dashfy-notifs");
        const settings = saved ? JSON.parse(saved) : {};
        if (settings.autoRecurring === false) return;
      } catch {
        /* noop */
      }
      generateRecurring();
    }
  }, [isLoading, recurring.length, generateRecurring]);

  // ── Goals ──
  const addGoal = useCallback(
    async (name: string, target: number, current = 0) => {
      if (!user || !activeWorkspaceId) return;
      const color = GOAL_COLORS[goals.length % GOAL_COLORS.length];
      try {
        const res = await apiFetch<{ goal: FinanceGoal }>(
          `/workspaces/${activeWorkspaceId}/finance/goals`,
          { method: "POST", body: JSON.stringify({ name, target, current, color }) },
        );
        setGoals((prev) => [res.goal, ...prev]);
      } catch (err) {
        reportError("addGoal", err);
      }
    },
    [user, activeWorkspaceId, goals.length],
  );

  const updateGoalAmount = useCallback(
    async (id: string, amount: number) => {
      if (!activeWorkspaceId) return;
      // Optimistic — patch local state, then persist. On error, refetch to
      // reconcile (the simpler alternative to rolling back).
      let nextCurrent: number | null = null;
      setGoals((prev) =>
        prev.map((g) => {
          if (g.id !== id) return g;
          nextCurrent = Math.max(0, Math.min(g.target, g.current + amount));
          return { ...g, current: nextCurrent };
        }),
      );
      if (nextCurrent === null) return;
      try {
        await apiFetch(`/workspaces/${activeWorkspaceId}/finance/goals/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ current: nextCurrent }),
        });
      } catch (err) {
        reportError("updateGoalAmount", err);
        fetchAll(true);
      }
    },
    [activeWorkspaceId, fetchAll],
  );

  const deleteGoal = useCallback(
    async (id: string) => {
      if (!activeWorkspaceId) return;
      try {
        await apiFetch(`/workspaces/${activeWorkspaceId}/finance/goals/${id}`, {
          method: "DELETE",
        });
        setGoals((prev) => prev.filter((g) => g.id !== id));
      } catch (err) {
        reportError("deleteGoal", err);
      }
    },
    [activeWorkspaceId],
  );

  // ── Transactions ──
  const addTransaction = useCallback(
    async (
      description: string,
      amount: number,
      type: "income" | "expense",
      category: string,
      date?: string,
    ) => {
      if (!user || !activeWorkspaceId) return;
      const today = new Date().toISOString().split("T")[0];
      try {
        const res = await apiFetch<{ transaction: FinanceTransaction }>(
          `/workspaces/${activeWorkspaceId}/finance/transactions`,
          {
            method: "POST",
            body: JSON.stringify({
              description,
              amount: Math.abs(amount),
              type,
              category,
              date: date ?? today,
            }),
          },
        );
        setTransactions((prev) =>
          [res.transaction, ...prev].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          ),
        );
      } catch (err) {
        reportError("addTransaction", err);
      }
    },
    [user, activeWorkspaceId],
  );

  const updateTransaction = useCallback(
    async (
      id: string,
      updates: { description?: string; amount?: number; category?: string },
    ) => {
      if (!activeWorkspaceId) return;
      try {
        await apiFetch(`/workspaces/${activeWorkspaceId}/finance/transactions/${id}`, {
          method: "PATCH",
          body: JSON.stringify(updates),
        });
        setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
      } catch (err) {
        reportError("updateTransaction", err);
      }
    },
    [activeWorkspaceId],
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      if (!activeWorkspaceId) return;
      try {
        await apiFetch(`/workspaces/${activeWorkspaceId}/finance/transactions/${id}`, {
          method: "DELETE",
        });
        setTransactions((prev) => prev.filter((t) => t.id !== id));
      } catch (err) {
        reportError("deleteTransaction", err);
      }
    },
    [activeWorkspaceId],
  );

  // ── Recurring ──
  const addRecurring = useCallback(
    async (
      description: string,
      amount: number,
      type: "income" | "expense",
      category: string,
      dayOfMonth: number,
    ) => {
      if (!user || !activeWorkspaceId) return;
      try {
        const res = await apiFetch<{ recurring: FinanceRecurring }>(
          `/workspaces/${activeWorkspaceId}/finance/recurring`,
          {
            method: "POST",
            body: JSON.stringify({
              description,
              amount: Math.abs(amount),
              type,
              category,
              dayOfMonth,
            }),
          },
        );
        setRecurring((prev) => [res.recurring, ...prev]);
      } catch (err) {
        reportError("addRecurring", err);
      }
    },
    [user, activeWorkspaceId],
  );

  const toggleRecurring = useCallback(
    async (id: string) => {
      if (!activeWorkspaceId) return;
      const target = recurringRef.current.find((r) => r.id === id);
      if (!target) return;
      const nextActive = !target.active;
      setRecurring((prev) => prev.map((r) => (r.id === id ? { ...r, active: nextActive } : r)));
      try {
        await apiFetch(`/workspaces/${activeWorkspaceId}/finance/recurring/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ active: nextActive }),
        });
      } catch (err) {
        reportError("toggleRecurring", err);
        fetchAll(true);
      }
    },
    [activeWorkspaceId, fetchAll],
  );

  const deleteRecurring = useCallback(
    async (id: string) => {
      if (!activeWorkspaceId) return;
      try {
        await apiFetch(`/workspaces/${activeWorkspaceId}/finance/recurring/${id}`, {
          method: "DELETE",
        });
        setRecurring((prev) => prev.filter((r) => r.id !== id));
      } catch (err) {
        reportError("deleteRecurring", err);
      }
    },
    [activeWorkspaceId],
  );

  // ── Budgets ──
  const setBudgetLimit = useCallback(
    async (category: string, limit: number) => {
      if (!user || !activeWorkspaceId) return;
      const existing = budgetsRef.current.find((b) => b.category === category);
      try {
        if (existing) {
          if (limit <= 0) {
            await apiFetch(`/workspaces/${activeWorkspaceId}/finance/budgets/${existing.id}`, {
              method: "DELETE",
            });
            setBudgets((prev) => prev.filter((b) => b.id !== existing.id));
          } else {
            const res = await apiFetch<{ budget: FinanceBudget }>(
              `/workspaces/${activeWorkspaceId}/finance/budgets/${existing.id}`,
              { method: "PATCH", body: JSON.stringify({ monthlyLimit: limit }) },
            );
            setBudgets((prev) => prev.map((b) => (b.id === existing.id ? res.budget : b)));
          }
        } else if (limit > 0) {
          const res = await apiFetch<{ budget: FinanceBudget }>(
            `/workspaces/${activeWorkspaceId}/finance/budgets`,
            { method: "POST", body: JSON.stringify({ category, monthlyLimit: limit }) },
          );
          setBudgets((prev) => [...prev, res.budget]);
        }
      } catch (err) {
        reportError("setBudgetLimit", err);
      }
    },
    [user, activeWorkspaceId],
  );

  // ── Computed (memoised) ──
  const { totalIncome, totalExpense, balance } = useMemo(() => {
    const inc = transactions.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const exp = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    return { totalIncome: inc, totalExpense: exp, balance: inc - exp };
  }, [transactions]);

  const categoryBreakdown = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "expense")
        .reduce<Record<string, number>>((acc, t) => {
          acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
          return acc;
        }, {}),
    [transactions],
  );

  const dailyTrend = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const days: { day: string; receita: number; despesa: number }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayTxs = transactions.filter((t) => t.date === dateStr);
      days.push({
        day: String(d),
        receita: dayTxs.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0),
        despesa: dayTxs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0),
      });
    }
    return days;
  }, [transactions, selectedMonth]);

  // ── Yearly summary ──
  const fetchYearlySummary = useCallback(async () => {
    if (!user || !activeWorkspaceId) return;
    setIsLoadingYearly(true);
    try {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      const res = await apiFetch<{ transactions: FinanceTransaction[] }>(
        `/workspaces/${activeWorkspaceId}/finance/transactions?startDate=${startDate}&endDate=${endDate}&limit=2000`,
      );
      setYearlyTransactions(res.transactions);
    } catch (err) {
      reportError("fetchYearlySummary", err);
    } finally {
      setIsLoadingYearly(false);
    }
  }, [user, activeWorkspaceId, selectedYear]);

  useEffect(() => {
    fetchYearlySummary();
  }, [fetchYearlySummary]);

  const prevMonthTotals = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevStart = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-01`;
    const prevEnd = new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];
    const prevTxs = yearlyTransactions.filter((t) => t.date >= prevStart && t.date <= prevEnd);
    if (prevTxs.length === 0) return null;
    const prevIncome = prevTxs
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + Number(t.amount), 0);
    const prevExpense = prevTxs
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + Number(t.amount), 0);
    return { income: prevIncome, expense: prevExpense, balance: prevIncome - prevExpense };
  }, [yearlyTransactions, selectedMonth]);

  const insights = useMemo(() => {
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
    const topCategory = Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1])[0];
    const expenseDays = new Set(
      transactions.filter((t) => t.type === "expense").map((t) => t.date),
    );
    const avgDailyExpense = expenseDays.size > 0 ? totalExpense / expenseDays.size : 0;
    const expenseChange =
      prevMonthTotals && prevMonthTotals.expense > 0
        ? ((totalExpense - prevMonthTotals.expense) / prevMonthTotals.expense) * 100
        : null;
    const incomeChange =
      prevMonthTotals && prevMonthTotals.income > 0
        ? ((totalIncome - prevMonthTotals.income) / prevMonthTotals.income) * 100
        : null;
    return { savingsRate, topCategory, avgDailyExpense, expenseChange, incomeChange, prevMonthTotals };
  }, [totalIncome, totalExpense, categoryBreakdown, transactions, prevMonthTotals]);

  const yearlySummary = useMemo<YearlyMonthSummary[]>(() => {
    const months: YearlyMonthSummary[] = MONTH_LABELS.map((label, i) => ({
      month: i + 1,
      label,
      income: 0,
      expense: 0,
      balance: 0,
    }));
    for (const tx of yearlyTransactions) {
      const m = parseInt(tx.date.split("-")[1], 10);
      if (m >= 1 && m <= 12) {
        const amt = Number(tx.amount);
        if (tx.type === "income") months[m - 1].income += amt;
        else months[m - 1].expense += amt;
      }
    }
    months.forEach((m) => {
      m.balance = m.income - m.expense;
    });
    return months;
  }, [yearlyTransactions]);

  const yearlyTotals = useMemo(() => {
    const totalIncomeYear = yearlySummary.reduce((s, m) => s + m.income, 0);
    const totalExpenseYear = yearlySummary.reduce((s, m) => s + m.expense, 0);
    const balanceYear = totalIncomeYear - totalExpenseYear;
    const avgMonthly = totalExpenseYear / 12;
    const sortedByBalance = [...yearlySummary].sort((a, b) => b.balance - a.balance);
    return {
      totalIncome: totalIncomeYear,
      totalExpense: totalExpenseYear,
      balance: balanceYear,
      avgMonthly,
      bestMonth: sortedByBalance[0],
      worstMonth: sortedByBalance[sortedByBalance.length - 1],
    };
  }, [yearlySummary]);

  return {
    goals,
    transactions,
    recurring,
    budgets,
    isLoading,
    addGoal,
    updateGoalAmount,
    deleteGoal,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addRecurring,
    toggleRecurring,
    deleteRecurring,
    generateRecurring,
    setBudgetLimit,
    totalIncome,
    totalExpense,
    balance,
    categoryBreakdown,
    dailyTrend,
    insights,
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
    yearlySummary,
    yearlyTotals,
    isLoadingYearly,
    refetch: fetchAll,
  };
}

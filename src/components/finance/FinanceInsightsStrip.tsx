import { memo, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, TrendingUp, TrendingDown, Sparkles,
  Flame, ShieldCheck, PiggyBank, Zap,
} from "lucide-react";

interface InsightsStripProps {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  savingsRate: number;
  expenseChange: number | null;
  incomeChange: number | null;
  budgetAlerts: Array<{ category: string; pct: number }>;
  recurringNet: number;
  daysInMonth: number;
  dayOfMonth: number;
}

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const FinanceInsightsStrip = memo(({
  totalIncome, totalExpense, balance, savingsRate,
  expenseChange, incomeChange, budgetAlerts,
  recurringNet, daysInMonth, dayOfMonth,
}: InsightsStripProps) => {
  const insights = useMemo(() => {
    const items: Array<{
      id: string;
      icon: React.ElementType;
      text: string;
      accent: "green" | "amber" | "red" | "blue";
    }> = [];

    // Balance projection
    if (totalExpense > 0 && dayOfMonth > 5) {
      const projectedExpense = (totalExpense / dayOfMonth) * daysInMonth;
      const projectedBalance = totalIncome - projectedExpense;
      if (projectedBalance < 0) {
        items.push({
          id: "deficit-proj",
          icon: AlertTriangle,
          text: `Projeção: déficit de R$ ${formatCurrency(Math.abs(projectedBalance))} no final do mês`,
          accent: "red",
        });
      } else if (projectedBalance > 0 && totalIncome > 0) {
        const projSavings = (projectedBalance / totalIncome) * 100;
        if (projSavings >= 20) {
          items.push({
            id: "savings-proj",
            icon: PiggyBank,
            text: `Projeção: ${projSavings.toFixed(0)}% de poupança no final do mês`,
            accent: "green",
          });
        }
      }
    }

    // Budget alerts
    const overBudgetCount = budgetAlerts.filter(a => a.pct >= 100).length;
    const nearBudgetCount = budgetAlerts.filter(a => a.pct >= 80 && a.pct < 100).length;
    if (overBudgetCount > 0) {
      items.push({
        id: "over-budget",
        icon: Flame,
        text: `${overBudgetCount} categoria${overBudgetCount > 1 ? "s" : ""} acima do orçamento`,
        accent: "red",
      });
    } else if (nearBudgetCount > 0) {
      items.push({
        id: "near-budget",
        icon: AlertTriangle,
        text: `${nearBudgetCount} categoria${nearBudgetCount > 1 ? "s" : ""} perto do limite (>80%)`,
        accent: "amber",
      });
    }

    // Expense trend
    if (expenseChange !== null) {
      if (expenseChange > 20) {
        items.push({
          id: "expense-up",
          icon: TrendingUp,
          text: `Despesas ${expenseChange.toFixed(0)}% maiores que o mês anterior`,
          accent: "red",
        });
      } else if (expenseChange < -10) {
        items.push({
          id: "expense-down",
          icon: TrendingDown,
          text: `Despesas ${Math.abs(expenseChange).toFixed(0)}% menores que o mês anterior`,
          accent: "green",
        });
      }
    }

    // Income trend
    if (incomeChange !== null && incomeChange > 15) {
      items.push({
        id: "income-up",
        icon: TrendingUp,
        text: `Receita ${incomeChange.toFixed(0)}% acima do mês anterior`,
        accent: "green",
      });
    }

    // Daily burn rate
    if (totalExpense > 0 && dayOfMonth > 3) {
      const dailyRate = totalExpense / dayOfMonth;
      const remainingBudget = totalIncome - totalExpense;
      const daysLeft = daysInMonth - dayOfMonth;
      if (remainingBudget > 0 && daysLeft > 0) {
        const maxDaily = remainingBudget / daysLeft;
        items.push({
          id: "daily-budget",
          icon: Zap,
          text: `Você pode gastar até R$ ${formatCurrency(maxDaily)}/dia nos próximos ${daysLeft} dias`,
          accent: "blue",
        });
      }
    }

    // Health status
    if (savingsRate >= 30 && items.length < 2) {
      items.push({
        id: "healthy",
        icon: ShieldCheck,
        text: `Excelente! Taxa de poupança de ${savingsRate.toFixed(0)}%`,
        accent: "green",
      });
    }

    return items.slice(0, 3); // max 3 insights
  }, [totalIncome, totalExpense, balance, savingsRate, expenseChange, incomeChange, budgetAlerts, recurringNet, daysInMonth, dayOfMonth]);

  if (insights.length === 0) return null;

  const accentStyles = {
    green: "glass-card border-green-500/20 text-green-400",
    amber: "glass-card border-amber-500/20 text-amber-400",
    red: "glass-card border-destructive/20 text-destructive",
    blue: "glass-card border-primary/20 text-primary",
  };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="w-3 h-3 text-amber-400" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Insights inteligentes</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <AnimatePresence>
          {insights.map((insight) => {
            const Icon = insight.icon;
            return (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, scale: 0.95, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium ${accentStyles[insight.accent]}`}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{insight.text}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
});

FinanceInsightsStrip.displayName = "FinanceInsightsStrip";

export default FinanceInsightsStrip;
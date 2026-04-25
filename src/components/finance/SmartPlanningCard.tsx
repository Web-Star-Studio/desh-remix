import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Target, Loader2, Sparkles, TrendingUp, TrendingDown, PiggyBank, AlertTriangle, CheckCircle2 } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import { invokeAI } from "@/lib/ai-router";
import { toast } from "@/hooks/use-toast";
import type { FinanceTransaction, FinanceBudget } from "@/hooks/finance/useDbFinances";
import { formatCurrency } from "@/components/finance/financeConstants";

interface SmartPlanningCardProps {
  transactions: FinanceTransaction[];
  budgets: FinanceBudget[];
  categoryBreakdown: Record<string, number>;
  totalIncome: number;
  totalExpense: number;
  selectedMonth: string;
  savingsRate: number;
  recurring: any[];
  index?: number;
}

interface PlanningResult {
  health_summary: string;
  health_score: number;
  savings_goal: { target: number; achievable: boolean; tip: string };
  budget_suggestions: { category: string; current_spend: number; suggested_limit: number; reason: string }[];
  alerts: { type: "warning" | "danger" | "success"; message: string }[];
  monthly_projection: { end_of_month_balance: number; trend: "positive" | "negative" | "stable" };
}
const SmartPlanningCard = ({
  transactions, budgets, categoryBreakdown, totalIncome, totalExpense,
  selectedMonth, savingsRate, recurring, index = 3.6,
}: SmartPlanningCardProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [plan, setPlan] = useState<PlanningResult | null>(null);

  const generatePlan = useCallback(async () => {
    setIsLoading(true);
    try {
      const recurringInfo = recurring.filter(r => r.active).map(r => ({
        description: r.description, amount: r.amount, type: r.type, day: r.day_of_month,
      }));

      const data = await invokeAI("finance", {
        action: "plan",
        transactions: transactions.map(t => ({ description: t.description, amount: t.amount, type: t.type, category: t.category, date: t.date })),
        category_breakdown: categoryBreakdown,
        budgets: budgets.map(b => ({ category: b.category, monthly_limit: b.monthly_limit })),
        month: selectedMonth,
        total_income: totalIncome,
        total_expense: totalExpense,
        savings_rate: savingsRate,
        recurring: recurringInfo,
      });

      if (data?.error) {
        if (data.error.includes("Rate limit")) toast({ title: "Limite de requisições", variant: "destructive" });
        else if (data.error.includes("Credits")) toast({ title: "Créditos insuficientes", variant: "destructive" });
        else throw new Error(data.error);
        return;
      }
      setPlan(data);
    } catch (err: any) {
      console.error("Planning error:", err);
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [transactions, budgets, categoryBreakdown, totalIncome, totalExpense, selectedMonth, savingsRate, recurring]);

  const scoreColor = plan ? plan.health_score >= 70 ? "text-green-400" : plan.health_score >= 40 ? "text-amber-400" : "text-destructive" : "";
  const scoreBg = plan ? plan.health_score >= 70 ? "bg-green-500/15" : plan.health_score >= 40 ? "bg-amber-500/15" : "bg-destructive/15" : "";

  return (
    <AnimatedItem index={index}>
      <GlassCard size="auto" className="mb-4 max-h-[500px] overflow-y-auto scrollbar-thin">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Target className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <p className="widget-title">Planejamento Inteligente</p>
          </div>
          <button
            onClick={generatePlan}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium bg-blue-500/15 text-blue-400 border border-blue-400/20 hover:bg-blue-500/25 transition-all disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {plan ? "Atualizar plano" : "Gerar plano"}
          </button>
        </div>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400 mb-2" />
            <p className="text-xs text-muted-foreground">Criando seu plano financeiro...</p>
          </div>
        )}

        {!plan && !isLoading && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Target className="w-8 h-8 text-muted-foreground/20 mb-2" />
            <p className="text-xs text-muted-foreground">A IA vai analisar seus dados e criar um plano personalizado com metas, sugestões de orçamento e projeções.</p>
          </div>
        )}

        {plan && !isLoading && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Health Score + Summary */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-foreground/5 border border-foreground/8">
              <div className={`w-12 h-12 rounded-2xl ${scoreBg} flex items-center justify-center flex-shrink-0`}>
                <span className={`text-lg font-bold ${scoreColor}`}>{plan.health_score}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">Saúde Financeira</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{plan.health_summary}</p>
              </div>
            </div>

            {/* Savings Goal */}
            {plan.savings_goal && (
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-400/15">
                <div className="flex items-center gap-2 mb-1.5">
                  <PiggyBank className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Meta de Economia</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-emerald-400">R$ {formatCurrency(plan.savings_goal.target)}</span>
                  {plan.savings_goal.achievable ? (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400">Atingível</span>
                  ) : (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">Desafiador</span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{plan.savings_goal.tip}</p>
              </div>
            )}

            {/* Budget Suggestions */}
            {plan.budget_suggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Target className="w-3 h-3" /> Sugestões de Orçamento
                </p>
                <div className="space-y-1.5">
                  {plan.budget_suggestions.map((sug, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="p-2.5 rounded-xl bg-foreground/5 border border-foreground/8"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-foreground">{sug.category}</span>
                        <div className="flex items-center gap-2 text-[10px] tabular-nums">
                          <span className="text-muted-foreground">R$ {formatCurrency(sug.current_spend)}</span>
                          <span className="text-muted-foreground/40">→</span>
                          <span className="text-blue-400 font-semibold">R$ {formatCurrency(sug.suggested_limit)}</span>
                        </div>
                      </div>
                      <p className="text-[9px] text-muted-foreground">{sug.reason}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Alerts */}
            {plan.alerts.length > 0 && (
              <div className="space-y-1.5">
                {plan.alerts.map((alert, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded-xl flex items-start gap-2 text-[10px] ${
                      alert.type === "danger" ? "bg-destructive/10 border border-destructive/20 text-destructive"
                        : alert.type === "warning" ? "bg-amber-500/10 border border-amber-400/20 text-amber-400"
                        : "bg-green-500/10 border border-green-500/20 text-green-400"
                    }`}
                  >
                    {alert.type === "danger" ? <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> :
                     alert.type === "success" ? <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" /> :
                     <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />}
                    <span>{alert.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Monthly Projection */}
            {plan.monthly_projection && (
              <div className="p-2.5 rounded-xl bg-foreground/5 border border-foreground/8 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Projeção fim do mês</span>
                <div className="flex items-center gap-1.5">
                  {plan.monthly_projection.trend === "positive" ? (
                    <TrendingUp className="w-3 h-3 text-green-400" />
                  ) : plan.monthly_projection.trend === "negative" ? (
                    <TrendingDown className="w-3 h-3 text-destructive" />
                  ) : null}
                  <span className={`text-xs font-bold tabular-nums ${
                    plan.monthly_projection.end_of_month_balance >= 0 ? "text-green-400" : "text-destructive"
                  }`}>
                    R$ {formatCurrency(plan.monthly_projection.end_of_month_balance)}
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </GlassCard>
    </AnimatedItem>
  );
};

export default SmartPlanningCard;

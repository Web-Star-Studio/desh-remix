import { useState, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { invokeAI } from "@/lib/ai-router";
import type { FinanceTransaction, FinanceBudget } from "@/hooks/finance/useDbFinances";

export interface ForecastCategory {
  name: string;
  current: number;
  projected: number;
  trend: "up" | "down" | "stable";
}

export interface Forecast {
  projected_total: number;
  categories: ForecastCategory[];
  daily_budget_remaining: number;
  summary: string;
}

export interface Anomaly {
  category: string;
  severity: "info" | "warning" | "critical";
  message: string;
  change_pct: number;
}

export interface FinanceTip {
  icon: string;
  text: string;
}

export interface AnalysisResult {
  forecast: Forecast | null;
  anomalies: Anomaly[];
  tips: FinanceTip[];
}

const CACHE_KEY = "desh-finance-ai-cache";
const CACHE_TTL = 30 * 60 * 1000; // 30 min

function getCached(month: string): AnalysisResult | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { month: m, data, ts } = JSON.parse(raw);
    if (m === month && Date.now() - ts < CACHE_TTL) return data;
  } catch { /* ignore */ }
  return null;
}

function setCache(month: string, data: AnalysisResult) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ month, data, ts: Date.now() }));
  } catch { /* ignore */ }
}

export function useFinanceAI() {
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const categorize = useCallback(async (transactions: FinanceTransaction[]): Promise<number> => {
    const uncategorized = transactions.filter(t => !t.category || t.category === "Outros");
    if (uncategorized.length === 0) {
      toast({ title: "Tudo categorizado", description: "Nenhuma transação precisa de categorização." });
      return 0;
    }

    setIsCategorizing(true);
    try {
      const data = await invokeAI("finance", {
        action: "categorize",
        transactions: uncategorized.map(t => ({ id: t.id, description: t.description, amount: t.amount, type: t.type })),
      });

      if (data?.error) {
        if (data.error.includes("Rate limit")) toast({ title: "Limite de requisições", description: "Tente novamente em alguns instantes.", variant: "destructive" });
        else if (data.error.includes("Credits")) toast({ title: "Créditos insuficientes", description: "Adicione créditos para usar IA.", variant: "destructive" });
        else throw new Error(data.error);
        return 0;
      }

      const count = data?.total || 0;
      if (count > 0) {
        toast({ title: "Transações categorizadas!", description: `${count} transação(ões) atualizadas pela IA.` });
      }
      return count;
    } catch (err: any) {
      console.error("Categorize error:", err);
      toast({ title: "Erro", description: err.message || "Falha na categorização", variant: "destructive" });
      return 0;
    } finally {
      setIsCategorizing(false);
    }
  }, []);

  const analyze = useCallback(async (
    transactions: FinanceTransaction[],
    categoryBreakdown: Record<string, number>,
    budgets: FinanceBudget[],
    month: string,
    previousMonthExpenses: Record<string, number>,
  ): Promise<AnalysisResult | null> => {
    // Check cache
    const cached = getCached(month);
    if (cached) {
      setAnalysis(cached);
      return cached;
    }

    setIsAnalyzing(true);
    try {
      const data = await invokeAI("finance", {
        action: "analyze",
        transactions: transactions.map(t => ({ id: t.id, description: t.description, amount: t.amount, type: t.type, category: t.category })),
        category_breakdown: categoryBreakdown,
        budgets: budgets.map(b => ({ category: b.category, monthly_limit: b.monthly_limit })),
        month,
        previous_month_expenses: previousMonthExpenses,
      });

      if (data?.error) {
        if (data.error.includes("Rate limit")) toast({ title: "Limite de requisições", variant: "destructive" });
        else if (data.error.includes("Credits")) toast({ title: "Créditos insuficientes", variant: "destructive" });
        return null;
      }

      const result: AnalysisResult = {
        forecast: data.forecast || null,
        anomalies: data.anomalies || [],
        tips: data.tips || [],
      };
      setAnalysis(result);
      setCache(month, result);
      return result;
    } catch (err: any) {
      console.error("Analyze error:", err);
      toast({ title: "Erro na análise", description: err.message, variant: "destructive" });
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  return { categorize, analyze, isCategorizing, isAnalyzing, analysis };
}

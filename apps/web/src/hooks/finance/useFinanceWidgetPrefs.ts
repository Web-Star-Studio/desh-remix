// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FinanceWidgetConfig {
  id: string;
  label: string;
  description: string;
  tab: "overview" | "transactions" | "investments" | "openbanking";
  enabled: boolean;
  order: number;
}

const DEFAULT_WIDGETS: FinanceWidgetConfig[] = [
  // Overview tab
  { id: "insights_strip", label: "Faixa de Insights", description: "Alertas e métricas rápidas no topo", tab: "overview", enabled: true, order: 0 },
  { id: "kpi_cards", label: "Cards de KPI", description: "Saldo, receitas, despesas e taxa de poupança", tab: "overview", enabled: true, order: 1 },
  { id: "net_worth", label: "Patrimônio Líquido", description: "Visão consolidada de contas e investimentos", tab: "overview", enabled: true, order: 2 },
  { id: "cashflow_chart", label: "Gráfico de Fluxo de Caixa", description: "Comparação receitas vs despesas com tendência diária", tab: "overview", enabled: true, order: 3 },
  { id: "health_score", label: "Score de Saúde Financeira", description: "Indicador de saúde com base em orçamentos e poupança", tab: "overview", enabled: true, order: 4 },
  { id: "expense_projection", label: "Projeção de Gastos", description: "Estimativa de gastos para o mês", tab: "overview", enabled: true, order: 5 },
  { id: "ai_analysis", label: "Análise com IA", description: "Análise inteligente de padrões financeiros", tab: "overview", enabled: true, order: 6 },
  { id: "smart_planning", label: "Planejamento Inteligente", description: "Sugestões de economia e plano de ação", tab: "overview", enabled: true, order: 7 },
  { id: "ai_chat", label: "Chat Financeiro IA", description: "Converse com a IA sobre suas finanças", tab: "overview", enabled: true, order: 8 },

  // Transactions tab
  { id: "tx_daily_chart", label: "Gráfico Diário", description: "Gráfico de gastos diários", tab: "transactions", enabled: true, order: 0 },
  { id: "tx_category_breakdown", label: "Categorias", description: "Breakdown por categoria de gasto", tab: "transactions", enabled: true, order: 1 },
  { id: "tx_budget_alerts", label: "Alertas de Orçamento", description: "Avisos quando orçamento está próximo do limite", tab: "transactions", enabled: true, order: 2 },
  { id: "tx_recurring", label: "Recorrentes", description: "Despesas e receitas fixas mensais", tab: "transactions", enabled: true, order: 3 },
  { id: "tx_list", label: "Lista de Transações", description: "Tabela com todas as transações do mês", tab: "transactions", enabled: true, order: 4 },

  // Investments tab
  { id: "inv_portfolio", label: "Portfólio", description: "Visão geral dos investimentos", tab: "investments", enabled: true, order: 0 },
  { id: "inv_loans", label: "Empréstimos", description: "Empréstimos e financiamentos ativos", tab: "investments", enabled: true, order: 1 },
  { id: "inv_goals", label: "Metas Financeiras", description: "Progresso das metas de poupança", tab: "investments", enabled: true, order: 2 },

  // Open Banking tab
  { id: "ob_kpis", label: "KPIs Open Banking", description: "Métricas avançadas via Open Finance", tab: "openbanking", enabled: true, order: 0 },
  { id: "ob_behavior", label: "Análise Comportamental", description: "Padrões de comportamento financeiro", tab: "openbanking", enabled: true, order: 1 },
  { id: "ob_recurring", label: "Recorrentes Detectados", description: "Pagamentos recorrentes detectados automaticamente", tab: "openbanking", enabled: true, order: 2 },
  { id: "ob_categories", label: "Categorias & Regras", description: "Gestão de categorias e regras automáticas", tab: "openbanking", enabled: true, order: 3 },
  { id: "ob_consents", label: "Consentimentos", description: "Gerenciar consentimentos Open Finance", tab: "openbanking", enabled: true, order: 4 },
  { id: "ob_item_status", label: "Status das Conexões", description: "Monitorar saúde das conexões bancárias", tab: "openbanking", enabled: true, order: 5 },
];

const DATA_TYPE = "finance_widget_prefs";

export function useFinanceWidgetPrefs() {
  const [widgets, setWidgets] = useState<FinanceWidgetConfig[]>(DEFAULT_WIDGETS);
  const [loading, setLoading] = useState(true);
  const [rowId, setRowId] = useState<string | null>(null);

  useEffect(() => {
    loadPrefs();
  }, []);

  async function loadPrefs() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await (supabase as any)
      .from("user_data")
      .select("id, data")
      .eq("user_id", user.id)
      .eq("data_type", DATA_TYPE)
      .maybeSingle();

    if (data?.data) {
      setRowId(data.id);
      // Merge saved prefs with defaults (to handle new widgets added later)
      const saved = data.data as Record<string, { enabled: boolean; order: number }>;
      const merged = DEFAULT_WIDGETS.map(w => ({
        ...w,
        enabled: saved[w.id]?.enabled ?? w.enabled,
        order: saved[w.id]?.order ?? w.order,
      }));
      merged.sort((a, b) => a.order - b.order);
      setWidgets(merged);
    }
    setLoading(false);
  }

  const persist = useCallback(async (updated: FinanceWidgetConfig[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const prefs: Record<string, { enabled: boolean; order: number }> = {};
    updated.forEach(w => { prefs[w.id] = { enabled: w.enabled, order: w.order }; });

    if (rowId) {
      await (supabase as any).from("user_data").update({ data: prefs }).eq("id", rowId);
    } else {
      const { data } = await (supabase as any)
        .from("user_data")
        .insert({ user_id: user.id, data_type: DATA_TYPE, data: prefs })
        .select("id")
        .single();
      if (data) setRowId(data.id);
    }
  }, [rowId]);

  const toggleWidget = useCallback((widgetId: string) => {
    setWidgets(prev => {
      const updated = prev.map(w => w.id === widgetId ? { ...w, enabled: !w.enabled } : w);
      persist(updated);
      return updated;
    });
  }, [persist]);

  const moveWidget = useCallback((widgetId: string, direction: "up" | "down") => {
    setWidgets(prev => {
      const idx = prev.findIndex(w => w.id === widgetId);
      if (idx < 0) return prev;
      const widget = prev[idx];
      // Find adjacent widget in same tab
      const sameTab = prev.filter(w => w.tab === widget.tab);
      const tabIdx = sameTab.findIndex(w => w.id === widgetId);
      const swapIdx = direction === "up" ? tabIdx - 1 : tabIdx + 1;
      if (swapIdx < 0 || swapIdx >= sameTab.length) return prev;

      const swapWidget = sameTab[swapIdx];
      const updated = prev.map(w => {
        if (w.id === widgetId) return { ...w, order: swapWidget.order };
        if (w.id === swapWidget.id) return { ...w, order: widget.order };
        return w;
      });
      updated.sort((a, b) => a.order - b.order);
      persist(updated);
      return updated;
    });
  }, [persist]);

  const resetDefaults = useCallback(() => {
    setWidgets(DEFAULT_WIDGETS);
    persist(DEFAULT_WIDGETS);
  }, [persist]);

  const isWidgetEnabled = useCallback((widgetId: string) => {
    return widgets.find(w => w.id === widgetId)?.enabled ?? true;
  }, [widgets]);

  const getTabWidgets = useCallback((tab: string) => {
    return widgets.filter(w => w.tab === tab).sort((a, b) => a.order - b.order);
  }, [widgets]);

  return {
    widgets,
    loading,
    toggleWidget,
    moveWidget,
    resetDefaults,
    isWidgetEnabled,
    getTabWidgets,
  };
}

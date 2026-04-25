import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceSafe } from '@/contexts/WorkspaceContext';
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { toast } from '@/hooks/use-toast';

export interface KpiMonth {
  net_amount: number | null;
  credit_count: number;
  debit_count: number;
  credit_sum: number;
  debit_sum: number;
  credit_debit_ratio: number | null;
  inflow_commitment: number | null;
  avg_credit: number | null;
  avg_debit: number | null;
  min_balance: number | null;
  max_balance: number | null;
  avg_credit_balance: number | null;
  avg_debit_balance: number | null;
  max_debit_period: string | null;
  max_credit_period: string | null;
  dateRanges?: Record<string, any>;
  amountRanges?: Record<string, any>;
}

export interface RecurringPayment {
  description: string;
  average_amount: number;
  occurrences_count: number;
  regularity_score: number;
  type: 'expense' | 'income';
  occurrences?: string[];
}

export interface BehaviorCategory {
  category: string;
  totalAmount: number;
  transactionCount: number;
  percentage: number;
  avgAmount?: number;
}

export interface BehaviorAnalysis {
  categories: BehaviorCategory[];
  summary: any;
  monthlyPatterns: any[];
  topMerchants: any[];
  fetchedAt: string;
  raw: any;
}

export interface PluggyConsent {
  id: string;
  itemId: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  permissions: string[];
}

export interface PluggyCategory {
  id: string;
  description: string;
  descriptionTranslated?: string;
  parentId?: string | null;
  parentDescription?: string | null;
}

export interface PluggyItemStatus {
  id: string;
  status: string;
  executionStatus: string;
  lastUpdatedAt: string;
  connector: any;
  statusDetail: any;
  error: any;
  warnings: any[];
}

export interface FinancialInsight {
  id: string;
  connection_id: string;
  insight_type: string;
  data: any;
  fetched_at: string;
}

export function usePluggyInsights() {
  const [kpis, setKpis] = useState<Record<string, any> | null>(null);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [behaviorAnalysis, setBehaviorAnalysis] = useState<BehaviorAnalysis | null>(null);
  const [categories, setCategories] = useState<PluggyCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const wsCtx = useWorkspaceSafe();
  const { invoke: edgeInvoke } = useEdgeFn();

  const loadInsights = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('financial_insights')
      .select('*')
      .order('fetched_at', { ascending: false });

    if (data) {
      const kpiRow = data.find((d: any) => d.insight_type === 'kpi');
      const recRow = data.find((d: any) => d.insight_type === 'recurring_payments');
      const behaviorRow = data.find((d: any) => d.insight_type === 'behavior_analysis');
      if (kpiRow) setKpis(kpiRow.data);
      if (recRow) setRecurringPayments(recRow.data?.payments || []);
      if (behaviorRow) setBehaviorAnalysis(behaviorRow.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadInsights(); }, [loadInsights]);

  /** Standardized invoke via useEdgeFn — auto session refresh + structured errors */
  const invokePluggy = useCallback(async (body: any) => {
    const { data, error, code } = await edgeInvoke<any>({
      fn: 'pluggy-proxy',
      body,
    });
    if (error) {
      const err = new Error(error);
      (err as any).code = code;
      throw err;
    }
    return data;
  }, [edgeInvoke]);

  const fetchKpis = useCallback(async (connectionId: string, itemId: string) => {
    setFetching(true);
    try {
      const data = await invokePluggy({
        action: 'kpis', connection_id: connectionId, item_id: itemId,
        workspace_id: wsCtx?.activeWorkspaceId || null,
      });
      if (data?.kpis) setKpis(data.kpis);
      toast({ title: 'KPIs atualizados', description: 'Indicadores financeiros carregados.' });
      return data?.kpis;
    } catch (err: any) {
      console.error('fetchKpis error:', err);
      toast({ title: 'Erro ao buscar KPIs', description: err.message, variant: 'destructive' });
      return null;
    } finally { setFetching(false); }
  }, [wsCtx?.activeWorkspaceId, invokePluggy]);

  const fetchRecurring = useCallback(async (connectionId: string, itemId: string) => {
    setFetching(true);
    try {
      const data = await invokePluggy({
        action: 'recurring', connection_id: connectionId, item_id: itemId,
        workspace_id: wsCtx?.activeWorkspaceId || null,
      });
      if (data?.payments) setRecurringPayments(data.payments);
      toast({ title: 'Pagamentos recorrentes', description: `${data?.payments?.length || 0} padrões detectados.` });
      return data?.payments;
    } catch (err: any) {
      console.error('fetchRecurring error:', err);
      toast({ title: 'Erro ao buscar recorrentes', description: err.message, variant: 'destructive' });
      return null;
    } finally { setFetching(false); }
  }, [wsCtx?.activeWorkspaceId, invokePluggy]);

  const fetchBehaviorAnalysis = useCallback(async (connectionId: string, itemId: string) => {
    setFetching(true);
    try {
      const data = await invokePluggy({
        action: 'behavior_analysis', connection_id: connectionId, item_id: itemId,
        workspace_id: wsCtx?.activeWorkspaceId || null,
      });
      if (data?.analysis) setBehaviorAnalysis(data.analysis);
      toast({ title: 'Análise comportamental', description: 'Padrões de gastos por categoria carregados.' });
      return data?.analysis;
    } catch (err: any) {
      console.error('fetchBehaviorAnalysis error:', err);
      toast({ title: 'Erro na análise comportamental', description: err.message, variant: 'destructive' });
      return null;
    } finally { setFetching(false); }
  }, [wsCtx?.activeWorkspaceId, invokePluggy]);

  const fetchConsents = useCallback(async (itemId: string) => {
    setFetching(true);
    try {
      const data = await invokePluggy({ action: 'list_consents', item_id: itemId });
      return data?.results || [];
    } catch (err: any) {
      console.error('fetchConsents error:', err);
      toast({ title: 'Erro ao buscar consentimentos', description: err.message, variant: 'destructive' });
      return [];
    } finally { setFetching(false); }
  }, [invokePluggy]);

  const revokeConsent = useCallback(async (itemId: string) => {
    setFetching(true);
    try {
      const data = await invokePluggy({ action: 'revoke_consent', item_id: itemId });
      toast({ title: 'Consentimento revogado', description: 'A conexão foi removida com sucesso.' });
      return data;
    } catch (err: any) {
      console.error('revokeConsent error:', err);
      toast({ title: 'Erro ao revogar', description: err.message, variant: 'destructive' });
      return null;
    } finally { setFetching(false); }
  }, [invokePluggy]);

  const updateTransactionCategory = useCallback(async (transactionId: string, categoryId: string) => {
    try {
      const data = await invokePluggy({
        action: 'update_category', transaction_id: transactionId, category_id: categoryId,
      });
      toast({ title: 'Categoria atualizada', description: 'Transação recategorizada com sucesso.' });
      return data?.transaction;
    } catch (err: any) {
      console.error('updateTransactionCategory error:', err);
      toast({ title: 'Erro ao atualizar categoria', description: err.message, variant: 'destructive' });
      return null;
    }
  }, [invokePluggy]);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await invokePluggy({ action: 'list_categories' });
      const cats = data?.results || [];
      setCategories(cats);
      return cats;
    } catch (err: any) {
      console.error('fetchCategories error:', err);
      return [];
    }
  }, [invokePluggy]);

  const fetchCategoryRules = useCallback(async () => {
    try {
      const data = await invokePluggy({ action: 'category_rules', rule_action: 'list' });
      return data?.results || [];
    } catch (err: any) {
      console.error('fetchCategoryRules error:', err);
      return [];
    }
  }, [invokePluggy]);

  const createCategoryRule = useCallback(async (ruleData: { description: string; categoryId: string }) => {
    try {
      const data = await invokePluggy({
        action: 'category_rules', rule_action: 'create', rule_data: ruleData,
      });
      toast({ title: 'Regra criada', description: 'Regra de categorização criada com sucesso.' });
      return data;
    } catch (err: any) {
      console.error('createCategoryRule error:', err);
      toast({ title: 'Erro ao criar regra', description: err.message, variant: 'destructive' });
      return null;
    }
  }, [invokePluggy]);

  const fetchItemStatus = useCallback(async (itemId: string): Promise<PluggyItemStatus | null> => {
    try {
      const data = await invokePluggy({ action: 'item_status', item_id: itemId });
      return data?.item || null;
    } catch (err: any) {
      console.error('fetchItemStatus error:', err);
      return null;
    }
  }, [invokePluggy]);

  const fetchConnectorsCatalog = useCallback(async () => {
    try {
      const data = await invokePluggy({ action: 'connectors_catalog' });
      return data?.results || [];
    } catch (err: any) {
      console.error('fetchConnectorsCatalog error:', err);
      return [];
    }
  }, [invokePluggy]);

  const enrichTransactions = useCallback(async (accountId: string, accountType: string) => {
    setFetching(true);
    try {
      const data = await invokePluggy({
        action: 'enrich', account_id: accountId, account_type: accountType,
      });
      const enriched = data?.enriched || 0;
      toast({
        title: 'Transações enriquecidas',
        description: enriched > 0
          ? `${enriched} transações categorizadas e enriquecidas.`
          : 'Todas as transações já estão categorizadas.',
      });
      return data;
    } catch (err: any) {
      console.error('enrichTransactions error:', err);
      toast({ title: 'Erro no enriquecimento', description: err.message, variant: 'destructive' });
      return null;
    } finally { setFetching(false); }
  }, [invokePluggy]);

  return {
    kpis,
    recurringPayments,
    behaviorAnalysis,
    categories,
    loading,
    fetching,
    fetchKpis,
    fetchRecurring,
    fetchBehaviorAnalysis,
    fetchConsents,
    revokeConsent,
    updateTransactionCategory,
    fetchCategories,
    fetchCategoryRules,
    createCategoryRule,
    fetchItemStatus,
    fetchConnectorsCatalog,
    enrichTransactions,
    refresh: loadInsights,
  };
}

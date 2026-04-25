import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceSafe } from '@/contexts/WorkspaceContext';

// ─── Loans ────────────────────────────────────────────────────

export interface FinancialLoan {
  id: string;
  connection_id: string | null;
  user_id: string;
  provider_loan_id: string;
  contract_number: string | null;
  product_name: string | null;
  loan_type: string | null;
  contract_date: string | null;
  contract_amount: number | null;
  outstanding_balance: number | null;
  currency: string;
  due_date: string | null;
  cet: number | null;
  installment_periodicity: string | null;
  total_installments: number | null;
  paid_installments: number | null;
  due_installments: number | null;
  status: string;
  raw_data: any;
  workspace_id: string | null;
  last_synced_at: string | null;
}

export function useFinancialLoans() {
  const [loans, setLoans] = useState<FinancialLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const wsCtx = useWorkspaceSafe();
  const activeWorkspaceId = wsCtx?.activeWorkspaceId ?? null;

  useEffect(() => { loadLoans(); }, [activeWorkspaceId]);

  async function loadLoans() {
    let query = (supabase as any)
      .from('financial_loans')
      .select('*')
      .order('due_date', { ascending: true });
    
    if (activeWorkspaceId) {
      query = query.eq('workspace_id', activeWorkspaceId);
    }
    
    const { data } = await query;
    setLoans(data || []);
    setLoading(false);
  }

  return { loans, loading, refresh: loadLoans };
}

// ─── Investment Transactions ──────────────────────────────────

export interface InvestmentTransaction {
  id: string;
  investment_id: string | null;
  user_id: string;
  provider_transaction_id: string;
  trade_date: string | null;
  date: string;
  type: string; // BUY, SELL, TAX, TRANSFER
  description: string | null;
  quantity: number | null;
  value: number | null;
  amount: number;
  net_amount: number | null;
  brokerage_number: string | null;
  raw_data: any;
}

export function useInvestmentTransactions(investmentId?: string, limit = 50) {
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTransactions(); }, [investmentId]);

  async function loadTransactions() {
    let query = (supabase as any)
      .from('financial_investment_transactions')
      .select('*')
      .order('date', { ascending: false })
      .limit(limit);

    if (investmentId) query = query.eq('investment_id', investmentId);
    const { data } = await query;
    setTransactions(data || []);
    setLoading(false);
  }

  return { transactions, loading, refresh: loadTransactions };
}

// ─── Real-time Balance ────────────────────────────────────────

export function useRealTimeBalance() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchBalance(accountId: string): Promise<any | null> {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('pluggy-proxy', {
        body: { action: 'realtime-balance', account_id: accountId },
      });
      if (fnError) throw fnError;
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { loading, error, fetchBalance };
}

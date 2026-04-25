import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceSafe } from '@/contexts/WorkspaceContext';
import type {
  FinanceProvider,
  ProviderSettings,
  FinancialConnection,
  FinancialAccount,
  FinancialTransaction,
  FinancialInvestment,
  FinancialSummary,
  FinancialSyncLog,
  ConnectTokenResponse,
} from '@/types/finance';

export function useProviderSettings() {
  const [settings, setSettings] = useState<ProviderSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    let { data } = await (supabase as any)
      .from('provider_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!data) {
      const { data: newSettings } = await (supabase as any)
        .from('provider_settings')
        .insert({ user_id: user.id, active_provider: 'pluggy' })
        .select()
        .single();
      data = newSettings;
    }

    setSettings(data);
    setLoading(false);
  }

  async function switchProvider(provider: FinanceProvider) {
    if (!settings) return;
    const { data } = await (supabase as any)
      .from('provider_settings')
      .update({ active_provider: provider, updated_at: new Date().toISOString() })
      .eq('id', settings.id)
      .select()
      .single();
    if (data) setSettings(data);
  }

  return { settings, loading, switchProvider, refresh: loadSettings };
}

export function useConnectToken() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchToken(itemId?: string): Promise<{ tokenData: ConnectTokenResponse | null; error: string | null }> {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('finance-sync', {
        body: { action: 'get-token', ...(itemId ? { itemId } : {}) },
      });
      if (fnError) throw fnError;

      if (data?.error) {
        const errorCode = String(data.error);
        setError(errorCode);
        return { tokenData: null, error: errorCode };
      }

      return { tokenData: data as ConnectTokenResponse, error: null };
    } catch (err: any) {
      const message = err?.message || 'Unknown error';
      setError(message);
      return { tokenData: null, error: message };
    } finally {
      setLoading(false);
    }
  }

  return { loading, error, fetchToken };
}

export function useFinancialConnections() {
  const [connections, setConnections] = useState<FinancialConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const wsCtx = useWorkspaceSafe();
  const activeWorkspaceId = wsCtx?.activeWorkspaceId ?? null;
  const defaultWorkspaceId = wsCtx?.workspaces?.find(w => w.is_default)?.id ?? null;
  const effectiveWorkspaceId = activeWorkspaceId ?? defaultWorkspaceId;

  useEffect(() => { loadConnections(); }, [activeWorkspaceId]);

  async function loadConnections() {
    let query = (supabase as any)
      .from('financial_connections')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (activeWorkspaceId) {
      query = query.eq('workspace_id', activeWorkspaceId);
    }
    // In "view all" mode, show all connections
    
    const { data } = await query;
    setConnections(data || []);
    setLoading(false);
  }

  async function saveConnection(provider: FinanceProvider, providerConnectionId: string, institutionName?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await (supabase as any)
      .from('financial_connections')
      .insert({
        user_id: user.id,
        provider,
        provider_connection_id: providerConnectionId,
        institution_name: institutionName || null,
        status: 'syncing',
        workspace_id: effectiveWorkspaceId,
      })
      .select()
      .single();

    if (data) {
      setConnections(prev => [data, ...prev]);
      await supabase.functions.invoke('finance-sync', {
        body: {
          action: 'sync',
          provider,
          connection_id: data.id,
          provider_connection_id: providerConnectionId,
          user_id: user.id,
          workspace_id: effectiveWorkspaceId,
        },
      });
    }
    return data;
  }

  async function removeConnection(connectionId: string) {
    await (supabase as any).from('financial_connections').delete().eq('id', connectionId);
    setConnections(prev => prev.filter(c => c.id !== connectionId));
  }

  async function syncConnection(conn: FinancialConnection): Promise<{ success: boolean; error?: string }> {
    // Rate-limit guard: prevent sync if last synced < 5 min ago (API limit is 1hr but widget has no limit)
    if (conn.last_synced_at) {
      const elapsed = Date.now() - new Date(conn.last_synced_at).getTime();
      if (elapsed < 5 * 60 * 1000) {
        return { success: true }; // silently skip, data is fresh enough
      }
    }

    await (supabase as any)
      .from('financial_connections')
      .update({ status: 'syncing' })
      .eq('id', conn.id);
    setConnections(prev => prev.map(c => c.id === conn.id ? { ...c, status: 'syncing' as const } : c));

    // Use AbortController for 60s timeout (Pluggy sync can be slow)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    let data: any = null;
    let error: any = null;
    try {
      const result = await supabase.functions.invoke('finance-sync', {
        body: {
          action: 'sync',
          provider: conn.provider,
          connection_id: conn.id,
          provider_connection_id: conn.provider_connection_id,
          user_id: conn.user_id,
          workspace_id: (conn as any).workspace_id ?? effectiveWorkspaceId,
        },
      });
      data = result.data;
      error = result.error;
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        error = { message: 'Timeout: sync took too long' };
      } else {
        error = e;
      }
    } finally {
      clearTimeout(timeoutId);
    }

    // Handle known status errors returned as 200 with { success: false, error: "..." }
    const knownError = data?.error || '';
    if (error || (data && data.success === false)) {
      const errMsg = knownError || error?.message || '';
      if (errMsg.includes('INVALID_CREDENTIALS')) {
        setConnections(prev => prev.map(c => c.id === conn.id ? { ...c, status: 'credentials_error' as any } : c));
        return { success: false, error: 'INVALID_CREDENTIALS' };
      }
      if (errMsg.includes('WAITING_USER_INPUT') || errMsg.includes('LOGIN_ERROR')) {
        setConnections(prev => prev.map(c => c.id === conn.id ? { ...c, status: 'awaiting_input' as any } : c));
        return { success: false, error: 'WAITING_USER_INPUT' };
      }
      if (errMsg.includes('ITEM_NOT_FOUND') || data?.itemNotFound) {
        setConnections(prev => prev.map(c => c.id === conn.id ? { ...c, status: 'error' as any } : c));
        return { success: false, error: 'ITEM_NOT_FOUND' };
      }
      // Generic error
      setConnections(prev => prev.map(c => c.id === conn.id ? { ...c, status: 'error' as any } : c));
      return { success: false, error: errMsg || 'Unknown error' };
    }

    await loadConnections();
    return { success: true };
  }

  return { connections, loading, saveConnection, removeConnection, syncConnection, refresh: loadConnections };
}

export function useFinancialAccounts() {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const wsCtx = useWorkspaceSafe();
  const activeWorkspaceId = wsCtx?.activeWorkspaceId ?? null;

  useEffect(() => { loadAccounts(); }, [activeWorkspaceId]);

  async function loadAccounts() {
    let query = (supabase as any)
      .from('financial_accounts')
      .select('*')
      .order('type', { ascending: true });
    
    if (activeWorkspaceId) {
      query = query.eq('workspace_id', activeWorkspaceId);
    }
    
    const { data } = await query;
    setAccounts(data || []);
    setLoading(false);
  }

  return { accounts, loading, refresh: loadAccounts };
}

export function useFinancialTransactions(accountId?: string, limit = 50) {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTransactions(); }, [accountId]);

  async function loadTransactions() {
    let query = (supabase as any)
      .from('financial_transactions_unified')
      .select('*')
      .order('date', { ascending: false })
      .limit(limit);

    if (accountId) query = query.eq('account_id', accountId);
    const { data } = await query;
    setTransactions(data || []);
    setLoading(false);
  }

  return { transactions, loading, refresh: loadTransactions };
}

export function useFinancialInvestments() {
  const [investments, setInvestments] = useState<FinancialInvestment[]>([]);
  const [loading, setLoading] = useState(true);
  const wsCtx = useWorkspaceSafe();
  const activeWorkspaceId = wsCtx?.activeWorkspaceId ?? null;

  useEffect(() => {
    (async () => {
      let query = (supabase as any).from('financial_investments').select('*');
      if (activeWorkspaceId) {
        query = query.eq('workspace_id', activeWorkspaceId);
      }
      const { data } = await query;
      setInvestments(data || []);
      setLoading(false);
    })();
  }, [activeWorkspaceId]);

  return { investments, loading };
}

export function useFinancialSummary() {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const wsCtx = useWorkspaceSafe();
  const activeWorkspaceId = wsCtx?.activeWorkspaceId ?? null;

  useEffect(() => { loadSummary(); }, [activeWorkspaceId]);

  async function loadSummary() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    let accountsQuery = (supabase as any).from('financial_accounts').select('current_balance, type').eq('user_id', user.id);
    let connQuery = (supabase as any).from('financial_connections').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
    let invQuery = (supabase as any).from('financial_investments').select('current_value').eq('user_id', user.id);
    
    if (activeWorkspaceId) {
      accountsQuery = accountsQuery.eq('workspace_id', activeWorkspaceId);
      connQuery = connQuery.eq('workspace_id', activeWorkspaceId);
      invQuery = invQuery.eq('workspace_id', activeWorkspaceId);
    }

    const d = new Date(); d.setDate(1);
    const txQuery = (supabase as any).from('financial_transactions_unified').select('amount, type').eq('user_id', user.id).gte('date', d.toISOString().split('T')[0]);

    const [accountsRes, txRes, connRes, invRes] = await Promise.all([
      accountsQuery,
      txQuery,
      connQuery,
      invQuery,
    ]);

    const accounts = accountsRes.data || [];
    const transactions = txRes.data || [];
    const investments = invRes.data || [];

    setSummary({
      total_balance: accounts.filter((a: any) => ['checking', 'savings'].includes(a.type)).reduce((s: number, a: any) => s + (a.current_balance || 0), 0),
      total_income_month: transactions.filter((t: any) => t.type === 'inflow').reduce((s: number, t: any) => s + t.amount, 0),
      total_expenses_month: transactions.filter((t: any) => t.type === 'outflow').reduce((s: number, t: any) => s + t.amount, 0),
      accounts_count: accounts.length,
      connections_count: connRes.count || 0,
      investments_total: investments.reduce((s: number, i: any) => s + (i.current_value || 0), 0),
    });
    setLoading(false);
  }

  return { summary, loading, refresh: loadSummary };
}

export function useFinancialSyncLogs(connectionId?: string) {
  const [logs, setLogs] = useState<FinancialSyncLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLogs(); }, [connectionId]);

  async function loadLogs() {
    let query = (supabase as any)
      .from('financial_sync_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (connectionId) query = query.eq('connection_id', connectionId);
    const { data } = await query;
    setLogs(data || []);
    setLoading(false);
  }

  return { logs, loading, refresh: loadLogs };
}

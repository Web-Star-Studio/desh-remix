/**
 * Pluggy/open-banking data plane (Finance Wave B).
 *
 * Backed by apps/api `/workspaces/:id/finance/pluggy/*` typed routes. The
 * legacy hook talked to Supabase tables + the `finance-sync` edge function;
 * this module preserves the same hook surface (function names, return
 * shapes) so existing components don't need rewiring. Snake-case shapes
 * are reconstituted from the new camelCase payloads inside the hooks.
 */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspaceSafe } from "@/contexts/WorkspaceContext";
import { apiFetch } from "@/lib/api-client";
import type {
  FinanceProvider,
  ProviderSettings,
  FinancialConnection,
  FinancialAccount,
  FinancialTransaction,
  FinancialInvestment,
  FinancialLoan,
  FinancialSummary,
  FinancialSyncLog,
  ConnectTokenResponse,
} from "@/types/finance";

// ── Helpers ────────────────────────────────────────────────────────────────
// The new routes return camelCase payloads (Drizzle's default). Components
// elsewhere in the SPA still use the legacy snake_case shapes, so we map at
// the hook boundary instead of touching every consumer.

interface ApiConnection {
  id: string;
  workspaceId: string;
  userId: string | null;
  provider: string;
  providerConnectionId: string;
  institutionName: string | null;
  institutionLogoUrl: string | null;
  status: string;
  lastSyncedAt: string | null;
  rawMetadata: unknown;
  createdAt: string;
  updatedAt: string;
}

function toConnection(c: ApiConnection): FinancialConnection {
  return {
    id: c.id,
    user_id: c.userId ?? "",
    provider: c.provider as FinanceProvider,
    provider_connection_id: c.providerConnectionId,
    institution_name: c.institutionName,
    institution_logo_url: c.institutionLogoUrl,
    status: c.status as FinancialConnection["status"],
    last_synced_at: c.lastSyncedAt,
    created_at: c.createdAt,
  };
}

interface ApiAccount {
  id: string;
  workspaceId: string;
  userId: string | null;
  connectionId: string;
  providerAccountId: string;
  name: string | null;
  type: string;
  currency: string;
  currentBalance: string | null;
  availableBalance: string | null;
  creditLimit: string | null;
  institutionName: string | null;
  lastSyncedAt: string | null;
}

function toAccount(a: ApiAccount): FinancialAccount {
  return {
    id: a.id,
    connection_id: a.connectionId,
    user_id: a.userId ?? "",
    provider_account_id: a.providerAccountId,
    name: a.name,
    type: a.type as FinancialAccount["type"],
    currency: a.currency,
    current_balance: numOrNull(a.currentBalance),
    available_balance: numOrNull(a.availableBalance),
    credit_limit: numOrNull(a.creditLimit),
    institution_name: a.institutionName,
    last_synced_at: a.lastSyncedAt,
  };
}

interface ApiTransaction {
  id: string;
  workspaceId: string;
  accountId: string;
  providerTransactionId: string;
  date: string;
  description: string | null;
  amount: string;
  type: "inflow" | "outflow";
  category: string | null;
  subcategory: string | null;
  merchantName: string | null;
  currency: string;
  status: "pending" | "posted";
}

function toTransaction(t: ApiTransaction): FinancialTransaction {
  return {
    id: t.id,
    account_id: t.accountId,
    user_id: "",
    provider_transaction_id: t.providerTransactionId,
    date: t.date,
    description: t.description,
    amount: Number(t.amount),
    type: t.type,
    category: t.category,
    subcategory: t.subcategory,
    merchant_name: t.merchantName,
    currency: t.currency,
    status: t.status,
  };
}

interface ApiInvestment {
  id: string;
  workspaceId: string;
  userId: string | null;
  connectionId: string;
  providerInvestmentId: string;
  name: string | null;
  type: string | null;
  ticker: string | null;
  quantity: string | null;
  currentValue: string | null;
  costBasis: string | null;
  currency: string;
}

function toInvestment(i: ApiInvestment): FinancialInvestment {
  return {
    id: i.id,
    connection_id: i.connectionId,
    user_id: i.userId ?? "",
    name: i.name,
    type: i.type,
    ticker: i.ticker,
    quantity: numOrNull(i.quantity),
    current_value: numOrNull(i.currentValue),
    cost_basis: numOrNull(i.costBasis),
    currency: i.currency,
  };
}

interface ApiLoan {
  id: string;
  workspaceId: string;
  userId: string | null;
  connectionId: string;
  providerLoanId: string;
  contractNumber: string | null;
  productName: string | null;
  loanType: string | null;
  contractDate: string | null;
  contractAmount: string | null;
  outstandingBalance: string | null;
  currency: string;
  dueDate: string | null;
  cet: string | null;
  installmentPeriodicity: string | null;
  totalInstallments: number | null;
  paidInstallments: number | null;
  dueInstallments: number | null;
  status: string;
  rawData: unknown;
}

function toLoan(l: ApiLoan): FinancialLoan {
  return {
    id: l.id,
    connection_id: l.connectionId,
    user_id: l.userId ?? "",
    provider_loan_id: l.providerLoanId,
    contract_number: l.contractNumber,
    product_name: l.productName,
    loan_type: l.loanType,
    contract_date: l.contractDate,
    contract_amount: numOrNull(l.contractAmount),
    outstanding_balance: numOrNull(l.outstandingBalance),
    currency: l.currency,
    due_date: l.dueDate,
    cet: numOrNull(l.cet),
    installment_periodicity: l.installmentPeriodicity,
    total_installments: l.totalInstallments,
    paid_installments: l.paidInstallments,
    due_installments: l.dueInstallments,
    status: l.status,
    raw_data: l.rawData,
    workspace_id: l.workspaceId,
  };
}

interface ApiSyncLog {
  id: string;
  workspaceId: string;
  userId: string | null;
  connectionId: string;
  provider: string;
  status: string;
  accountsSynced: number;
  transactionsSynced: number;
  investmentsSynced: number;
  loansSynced: number;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
}

function toSyncLog(s: ApiSyncLog): FinancialSyncLog {
  return {
    id: s.id,
    connection_id: s.connectionId,
    user_id: s.userId ?? "",
    provider: s.provider,
    status: s.status,
    accounts_synced: s.accountsSynced,
    transactions_synced: s.transactionsSynced,
    investments_synced: s.investmentsSynced,
    error_message: s.errorMessage,
    duration_ms: s.durationMs,
    created_at: s.createdAt,
  };
}

function numOrNull(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function activeWorkspaceFrom(ws: ReturnType<typeof useWorkspaceSafe>): string | null {
  return ws?.activeWorkspaceId ?? ws?.workspaces?.find((w) => w.is_default)?.id ?? null;
}

// ── Provider settings ─────────────────────────────────────────────────────
// Pluggy is the only provider supported on the new stack. The legacy
// `provider_settings` table is gone; this hook now returns a static value so
// existing callers keep compiling without an extra round-trip.

export function useProviderSettings() {
  const { user } = useAuth();
  const settings: ProviderSettings | null = user
    ? {
        id: "static",
        user_id: user.id,
        active_provider: "pluggy",
        pluggy_enabled: true,
      }
    : null;
  return {
    settings,
    loading: false,
    switchProvider: async (_p: FinanceProvider) => undefined,
    refresh: async () => undefined,
  };
}

// ── Connect token ─────────────────────────────────────────────────────────

export function useConnectToken() {
  const ws = useWorkspaceSafe();
  const workspaceId = activeWorkspaceFrom(ws);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchToken = useCallback(
    async (
      itemIdOrConnectionId?: string,
    ): Promise<{ tokenData: ConnectTokenResponse | null; error: string | null }> => {
      if (!workspaceId) return { tokenData: null, error: "no_workspace" };
      setLoading(true);
      setError(null);
      try {
        const body = itemIdOrConnectionId ? { connectionId: itemIdOrConnectionId } : {};
        const res = await apiFetch<{ accessToken: string }>(
          `/workspaces/${workspaceId}/finance/pluggy/connect-token`,
          { method: "POST", body: JSON.stringify(body) },
        );
        return {
          tokenData: { provider: "pluggy", token: res.accessToken },
          error: null,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "unknown_error";
        setError(msg);
        return { tokenData: null, error: msg };
      } finally {
        setLoading(false);
      }
    },
    [workspaceId],
  );

  return { loading, error, fetchToken };
}

// ── Connections ───────────────────────────────────────────────────────────

export function useFinancialConnections() {
  const ws = useWorkspaceSafe();
  const workspaceId = activeWorkspaceFrom(ws);
  const [connections, setConnections] = useState<FinancialConnection[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setConnections([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{ connections: ApiConnection[] }>(
        `/workspaces/${workspaceId}/finance/pluggy/connections`,
      );
      setConnections(res.connections.map(toConnection));
    } catch {
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveConnection = useCallback(
    async (
      _provider: FinanceProvider,
      providerConnectionId: string,
      _institutionName?: string,
    ) => {
      if (!workspaceId) return null;
      try {
        const res = await apiFetch<{ connection: ApiConnection }>(
          `/workspaces/${workspaceId}/finance/pluggy/connections`,
          { method: "POST", body: JSON.stringify({ itemId: providerConnectionId }) },
        );
        const created = toConnection(res.connection);
        setConnections((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
        return created;
      } catch (err) {
        console.error("[finance] saveConnection failed", err);
        return null;
      }
    },
    [workspaceId],
  );

  const removeConnection = useCallback(
    async (connectionId: string) => {
      if (!workspaceId) return;
      try {
        await apiFetch(
          `/workspaces/${workspaceId}/finance/pluggy/connections/${connectionId}`,
          { method: "DELETE" },
        );
        setConnections((prev) => prev.filter((c) => c.id !== connectionId));
      } catch (err) {
        console.error("[finance] removeConnection failed", err);
      }
    },
    [workspaceId],
  );

  // syncConnection: legacy contract returned `{ success, error? }` with
  // status-bucketed error codes. The new route enqueues a job and returns
  // 202 — we keep the same contract by mapping queue acceptance to success
  // and letting the SPA poll `useFinancialSyncLogs` for outcome details.
  const syncConnection = useCallback(
    async (
      conn: FinancialConnection,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!workspaceId) return { success: false, error: "no_workspace" };
      // Rate-limit guard mirrors the legacy 5-min freshness window.
      if (conn.last_synced_at) {
        const elapsed = Date.now() - new Date(conn.last_synced_at).getTime();
        if (elapsed < 5 * 60 * 1000) return { success: true };
      }
      setConnections((prev) =>
        prev.map((c) => (c.id === conn.id ? { ...c, status: "syncing" } : c)),
      );
      try {
        await apiFetch(
          `/workspaces/${workspaceId}/finance/pluggy/connections/${conn.id}/sync`,
          { method: "POST", body: JSON.stringify({}) },
        );
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "unknown_error";
        setConnections((prev) =>
          prev.map((c) => (c.id === conn.id ? { ...c, status: "error" } : c)),
        );
        return { success: false, error: msg };
      }
    },
    [workspaceId],
  );

  return { connections, loading, saveConnection, removeConnection, syncConnection, refresh };
}

// ── Accounts ──────────────────────────────────────────────────────────────

export function useFinancialAccounts() {
  const ws = useWorkspaceSafe();
  const workspaceId = activeWorkspaceFrom(ws);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{ accounts: ApiAccount[] }>(
        `/workspaces/${workspaceId}/finance/pluggy/accounts`,
      );
      setAccounts(res.accounts.map(toAccount));
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { accounts, loading, refresh };
}

// ── Transactions (unified) ────────────────────────────────────────────────

export function useFinancialTransactions(accountId?: string, limit = 50) {
  const ws = useWorkspaceSafe();
  const workspaceId = activeWorkspaceFrom(ws);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setTransactions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: String(limit) });
      if (accountId) qs.set("accountId", accountId);
      const res = await apiFetch<{ transactions: ApiTransaction[] }>(
        `/workspaces/${workspaceId}/finance/pluggy/transactions?${qs.toString()}`,
      );
      setTransactions(res.transactions.map(toTransaction));
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, accountId, limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { transactions, loading, refresh };
}

// ── Investments ───────────────────────────────────────────────────────────

export function useFinancialInvestments() {
  const ws = useWorkspaceSafe();
  const workspaceId = activeWorkspaceFrom(ws);
  const [investments, setInvestments] = useState<FinancialInvestment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!workspaceId) {
      setInvestments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    apiFetch<{ investments: ApiInvestment[] }>(
      `/workspaces/${workspaceId}/finance/pluggy/investments`,
    )
      .then((res) => {
        if (!cancelled) setInvestments(res.investments.map(toInvestment));
      })
      .catch(() => {
        if (!cancelled) setInvestments([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return { investments, loading };
}

// ── Loans ─────────────────────────────────────────────────────────────────

export function useFinancialLoans() {
  const ws = useWorkspaceSafe();
  const workspaceId = activeWorkspaceFrom(ws);
  const [loans, setLoans] = useState<FinancialLoan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!workspaceId) {
      setLoans([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    apiFetch<{ loans: ApiLoan[] }>(`/workspaces/${workspaceId}/finance/pluggy/loans`)
      .then((res) => {
        if (!cancelled) setLoans(res.loans.map(toLoan));
      })
      .catch(() => {
        if (!cancelled) setLoans([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return { loans, loading };
}

// ── Summary (derived) ─────────────────────────────────────────────────────
// Derived client-side from accounts + this-month tx + investments. Saves a
// new server endpoint; the underlying lists are already cached by their
// own hooks if pages render them in parallel.

export function useFinancialSummary() {
  const ws = useWorkspaceSafe();
  const workspaceId = activeWorkspaceFrom(ws);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setSummary(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const monthStart = new Date();
      monthStart.setDate(1);
      const fromDate = monthStart.toISOString().split("T")[0];

      const [accountsRes, txRes, connRes, invRes] = await Promise.all([
        apiFetch<{ accounts: ApiAccount[] }>(
          `/workspaces/${workspaceId}/finance/pluggy/accounts`,
        ),
        apiFetch<{ transactions: ApiTransaction[] }>(
          `/workspaces/${workspaceId}/finance/pluggy/transactions?from=${fromDate}&limit=500`,
        ),
        apiFetch<{ connections: ApiConnection[] }>(
          `/workspaces/${workspaceId}/finance/pluggy/connections`,
        ),
        apiFetch<{ investments: ApiInvestment[] }>(
          `/workspaces/${workspaceId}/finance/pluggy/investments`,
        ),
      ]);

      const accounts = accountsRes.accounts.map(toAccount);
      const transactions = txRes.transactions.map(toTransaction);
      const investments = invRes.investments.map(toInvestment);

      setSummary({
        total_balance: accounts
          .filter((a) => a.type === "checking" || a.type === "savings")
          .reduce((s, a) => s + (a.current_balance ?? 0), 0),
        total_income_month: transactions
          .filter((t) => t.type === "inflow")
          .reduce((s, t) => s + t.amount, 0),
        total_expenses_month: transactions
          .filter((t) => t.type === "outflow")
          .reduce((s, t) => s + t.amount, 0),
        accounts_count: accounts.length,
        connections_count: connRes.connections.length,
        investments_total: investments.reduce(
          (s, i) => s + (i.current_value ?? 0),
          0,
        ),
      });
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { summary, loading, refresh };
}

// ── Sync logs ─────────────────────────────────────────────────────────────

export function useFinancialSyncLogs(connectionId?: string) {
  const ws = useWorkspaceSafe();
  const workspaceId = activeWorkspaceFrom(ws);
  const [logs, setLogs] = useState<FinancialSyncLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setLogs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: "20" });
      if (connectionId) qs.set("connectionId", connectionId);
      const res = await apiFetch<{ syncLogs: ApiSyncLog[] }>(
        `/workspaces/${workspaceId}/finance/pluggy/sync-logs?${qs.toString()}`,
      );
      setLogs(res.syncLogs.map(toSyncLog));
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, connectionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Light polling so the SPA "Last sync" badge advances when a queued sync
  // finishes. 15s is a reasonable balance between freshness and request
  // pressure; the sync itself usually takes 5-30s.
  useEffect(() => {
    if (!workspaceId) return;
    const id = window.setInterval(() => {
      refresh();
    }, 15_000);
    return () => window.clearInterval(id);
  }, [workspaceId, refresh]);

  return { logs, loading, refresh };
}


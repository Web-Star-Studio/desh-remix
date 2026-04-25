export type FinanceProvider = 'pluggy';

export type AccountType = 'checking' | 'savings' | 'credit_card' | 'investment' | 'loan' | 'other';
export type TransactionType = 'inflow' | 'outflow';
export type TransactionStatus = 'pending' | 'posted';
export type ConnectionStatus = 'active' | 'error' | 'expired' | 'syncing' | 'awaiting_input';

export interface ProviderSettings {
  id: string;
  user_id: string;
  active_provider: FinanceProvider;
  pluggy_enabled: boolean;
}

export interface FinancialConnection {
  id: string;
  user_id: string;
  provider: FinanceProvider;
  provider_connection_id: string;
  institution_name: string | null;
  institution_logo_url: string | null;
  status: ConnectionStatus;
  last_synced_at: string | null;
  created_at: string;
}

export interface FinancialAccount {
  id: string;
  connection_id: string;
  user_id: string;
  provider_account_id: string;
  name: string | null;
  type: AccountType;
  currency: string;
  current_balance: number | null;
  available_balance: number | null;
  credit_limit: number | null;
  institution_name: string | null;
  last_synced_at: string | null;
}

export interface FinancialTransaction {
  id: string;
  account_id: string;
  user_id: string;
  provider_transaction_id: string;
  date: string;
  description: string | null;
  amount: number;
  type: TransactionType;
  category: string | null;
  subcategory: string | null;
  merchant_name: string | null;
  currency: string;
  status: TransactionStatus;
}

export interface FinancialInvestment {
  id: string;
  connection_id: string;
  user_id: string;
  name: string | null;
  type: string | null;
  ticker: string | null;
  quantity: number | null;
  current_value: number | null;
  cost_basis: number | null;
  currency: string;
}

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
}

export interface FinancialInvestmentTransaction {
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

export interface ConnectTokenResponse {
  provider: FinanceProvider;
  token: string;
}

export interface FinancialSummary {
  total_balance: number;
  total_income_month: number;
  total_expenses_month: number;
  accounts_count: number;
  connections_count: number;
  investments_total: number;
}

export interface FinancialSyncLog {
  id: string;
  connection_id: string;
  user_id: string;
  provider: string;
  status: string;
  accounts_synced: number;
  transactions_synced: number;
  investments_synced: number;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

// ─── Local finance types (used by useDbFinances) ──────────────────────────

export interface FinanceGoal {
  id: string;
  name: string;
  target: number;
  current: number;
  color: string;
  workspace_id?: string | null;
}

export interface FinanceTransaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  workspace_id?: string | null;
  source?: string;
  external_id?: string | null;
  account_name?: string | null;
}

export interface FinanceRecurring {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  day_of_month: number;
  active: boolean;
  workspace_id?: string | null;
}

export interface FinanceBudget {
  id: string;
  category: string;
  monthly_limit: number;
  workspace_id?: string | null;
}

export interface YearlyMonthSummary {
  month: number;
  label: string;
  income: number;
  expense: number;
  balance: number;
}

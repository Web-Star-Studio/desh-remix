
-- 1. Financial Loans table
CREATE TABLE public.financial_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES public.financial_connections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  provider_loan_id text NOT NULL,
  contract_number text,
  product_name text,
  loan_type text,
  contract_date date,
  contract_amount numeric,
  outstanding_balance numeric,
  currency text DEFAULT 'BRL',
  due_date date,
  cet numeric,
  installment_periodicity text,
  total_installments integer,
  paid_installments integer,
  due_installments integer,
  status text DEFAULT 'active',
  raw_data jsonb,
  workspace_id uuid REFERENCES public.workspaces(id),
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider_loan_id)
);

ALTER TABLE public.financial_loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own loans" ON public.financial_loans
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own loans" ON public.financial_loans
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own loans" ON public.financial_loans
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 2. Financial Investment Transactions table
CREATE TABLE public.financial_investment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id uuid REFERENCES public.financial_investments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  provider_transaction_id text NOT NULL,
  trade_date date,
  date date NOT NULL,
  type text NOT NULL, -- BUY, SELL, TAX, TRANSFER
  description text,
  quantity numeric,
  value numeric,
  amount numeric NOT NULL,
  net_amount numeric,
  brokerage_number text,
  raw_data jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider_transaction_id)
);

ALTER TABLE public.financial_investment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own inv txns" ON public.financial_investment_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own inv txns" ON public.financial_investment_transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own inv txns" ON public.financial_investment_transactions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Service role bypass for edge functions
CREATE POLICY "Service role full access loans" ON public.financial_loans
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access inv txns" ON public.financial_investment_transactions
  FOR ALL USING (true) WITH CHECK (true);


-- 1. Provider Settings
CREATE TABLE IF NOT EXISTS public.provider_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  active_provider TEXT NOT NULL DEFAULT 'pluggy' CHECK (active_provider IN ('pluggy', 'belvo')),
  pluggy_enabled BOOLEAN DEFAULT true,
  belvo_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.provider_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own provider settings" ON public.provider_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Financial Connections
CREATE TABLE IF NOT EXISTS public.financial_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('pluggy', 'belvo')),
  provider_connection_id TEXT NOT NULL,
  institution_name TEXT,
  institution_logo_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'error', 'expired', 'syncing')),
  last_synced_at TIMESTAMPTZ,
  raw_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.financial_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own financial connections" ON public.financial_connections FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_fin_connections_user ON public.financial_connections(user_id);
CREATE INDEX idx_fin_connections_provider ON public.financial_connections(provider);

-- 3. Financial Accounts
CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES public.financial_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  provider_account_id TEXT NOT NULL,
  name TEXT,
  type TEXT CHECK (type IN ('checking', 'savings', 'credit_card', 'investment', 'loan', 'other')),
  currency TEXT DEFAULT 'BRL',
  current_balance NUMERIC(15,2),
  available_balance NUMERIC(15,2),
  credit_limit NUMERIC(15,2),
  institution_name TEXT,
  last_synced_at TIMESTAMPTZ,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own financial accounts" ON public.financial_accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_fin_accounts_user ON public.financial_accounts(user_id);
CREATE INDEX idx_fin_accounts_connection ON public.financial_accounts(connection_id);
CREATE UNIQUE INDEX idx_fin_accounts_provider_unique ON public.financial_accounts(user_id, provider_account_id);

-- 4. Financial Transactions Unified
CREATE TABLE IF NOT EXISTS public.financial_transactions_unified (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  provider_transaction_id TEXT NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  amount NUMERIC(15,2) NOT NULL,
  type TEXT CHECK (type IN ('inflow', 'outflow')),
  category TEXT,
  subcategory TEXT,
  merchant_name TEXT,
  currency TEXT DEFAULT 'BRL',
  status TEXT CHECK (status IN ('pending', 'posted')),
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.financial_transactions_unified ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own unified transactions" ON public.financial_transactions_unified FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_fin_tx_user ON public.financial_transactions_unified(user_id);
CREATE INDEX idx_fin_tx_account ON public.financial_transactions_unified(account_id);
CREATE INDEX idx_fin_tx_date ON public.financial_transactions_unified(date DESC);
CREATE UNIQUE INDEX idx_fin_tx_provider_unique ON public.financial_transactions_unified(user_id, provider_transaction_id);

-- 5. Financial Investments
CREATE TABLE IF NOT EXISTS public.financial_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES public.financial_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  provider_investment_id TEXT,
  name TEXT,
  type TEXT CHECK (type IN ('stock', 'fund', 'fixed_income', 'crypto', 'other')),
  ticker TEXT,
  quantity NUMERIC(15,6),
  current_value NUMERIC(15,2),
  cost_basis NUMERIC(15,2),
  currency TEXT DEFAULT 'BRL',
  last_synced_at TIMESTAMPTZ,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.financial_investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own financial investments" ON public.financial_investments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

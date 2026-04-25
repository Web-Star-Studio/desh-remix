
-- Payment recipients (bank accounts that receive payments)
CREATE TABLE public.financial_payment_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_recipient_id text NOT NULL,
  name text NOT NULL,
  tax_number text,
  institution_name text,
  account_type text,
  account_branch text,
  account_number text,
  pix_key text,
  is_default boolean DEFAULT false,
  workspace_id uuid REFERENCES public.workspaces(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider_recipient_id)
);

-- Payment requests (payment links / invoices)
CREATE TABLE public.financial_payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_request_id text NOT NULL,
  recipient_id uuid REFERENCES public.financial_payment_recipients(id),
  amount numeric NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'CREATED',
  payment_url text,
  payment_type text NOT NULL DEFAULT 'instant', -- instant, scheduled, pix_automatico
  schedule_type text, -- SINGLE, DAILY, WEEKLY, MONTHLY, CUSTOM
  schedule_start_date date,
  schedule_occurrences integer,
  schedule_dates jsonb, -- for CUSTOM type
  pix_auto_interval text, -- WEEKLY, MONTHLY, QUARTERLY, SEMIANNUAL, ANNUAL
  pix_auto_fixed_amount numeric,
  pix_auto_min_variable numeric,
  pix_auto_max_variable numeric,
  callback_urls jsonb,
  raw_data jsonb,
  workspace_id uuid REFERENCES public.workspaces(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider_request_id)
);

-- Payment intents (actual payment attempts)
CREATE TABLE public.financial_payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.financial_payment_requests(id) ON DELETE CASCADE,
  provider_intent_id text NOT NULL,
  status text NOT NULL DEFAULT 'CREATED',
  error_code text,
  error_detail text,
  end_to_end_id text,
  raw_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider_intent_id)
);

-- Scheduled payment entries (individual scheduled payment occurrences)
CREATE TABLE public.financial_scheduled_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.financial_payment_requests(id) ON DELETE CASCADE,
  provider_scheduled_id text NOT NULL,
  status text NOT NULL DEFAULT 'CREATED',
  scheduled_date date,
  amount numeric,
  error_code text,
  end_to_end_id text,
  raw_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider_scheduled_id)
);

-- RLS
ALTER TABLE public.financial_payment_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_scheduled_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own payment recipients"
  ON public.financial_payment_recipients FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own payment requests"
  ON public.financial_payment_requests FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own payment intents"
  ON public.financial_payment_intents FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own scheduled payments"
  ON public.financial_scheduled_payments FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

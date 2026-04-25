
-- Enum types
DO $$ BEGIN
  CREATE TYPE subscription_plan AS ENUM ('trial', 'pro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'canceled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Table: user_subscriptions
CREATE TABLE public.user_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan subscription_plan NOT NULL DEFAULT 'trial',
  status subscription_status NOT NULL DEFAULT 'active',
  trial_ends_at timestamp with time zone,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_subscriptions_user_id_unique UNIQUE (user_id)
);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own subscription"
  ON public.user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions"
  ON public.user_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Table: user_credits
CREATE TABLE public.user_credits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  balance integer NOT NULL DEFAULT 0,
  total_earned integer NOT NULL DEFAULT 0,
  total_spent integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_credits_user_id_unique UNIQUE (user_id)
);

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own credits"
  ON public.user_credits FOR SELECT
  USING (auth.uid() = user_id);

-- Table: credit_transactions
CREATE TABLE public.credit_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  action text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own transactions"
  ON public.credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Table: credit_packages
CREATE TABLE public.credit_packages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  credits integer NOT NULL,
  price_brl numeric NOT NULL,
  stripe_price_id text,
  active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active packages"
  ON public.credit_packages FOR SELECT
  USING (active = true);

-- Enable realtime for credits
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_credits;

-- SECURITY DEFINER function to consume credits (called from edge functions via service role)
CREATE OR REPLACE FUNCTION public.consume_credits(
  _user_id uuid,
  _amount integer,
  _action text,
  _description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_balance integer;
  sub_status subscription_status;
  sub_plan subscription_plan;
  trial_end timestamp with time zone;
BEGIN
  -- Check subscription
  SELECT status, plan, trial_ends_at INTO sub_status, sub_plan, trial_end
  FROM public.user_subscriptions WHERE user_id = _user_id;

  IF sub_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_subscription');
  END IF;

  IF sub_status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'subscription_inactive');
  END IF;

  -- Check trial expiration
  IF sub_plan = 'trial' AND trial_end IS NOT NULL AND trial_end < now() THEN
    UPDATE public.user_subscriptions SET status = 'expired', updated_at = now() WHERE user_id = _user_id;
    RETURN jsonb_build_object('success', false, 'error', 'trial_expired');
  END IF;

  -- Check balance
  SELECT balance INTO current_balance FROM public.user_credits WHERE user_id = _user_id;
  
  IF current_balance IS NULL OR current_balance < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits', 'balance', COALESCE(current_balance, 0));
  END IF;

  -- Deduct
  UPDATE public.user_credits 
  SET balance = balance - _amount, total_spent = total_spent + _amount, updated_at = now()
  WHERE user_id = _user_id;

  -- Log transaction
  INSERT INTO public.credit_transactions (user_id, amount, action, description)
  VALUES (_user_id, -_amount, _action, COALESCE(_description, _action));

  RETURN jsonb_build_object('success', true, 'balance', current_balance - _amount);
END;
$$;

-- SECURITY DEFINER function to add credits
CREATE OR REPLACE FUNCTION public.add_credits(
  _user_id uuid,
  _amount integer,
  _action text,
  _description text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance, total_earned)
  VALUES (_user_id, _amount, _amount)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = user_credits.balance + _amount, total_earned = user_credits.total_earned + _amount, updated_at = now();

  INSERT INTO public.credit_transactions (user_id, amount, action, description)
  VALUES (_user_id, _amount, _action, COALESCE(_description, _action));
END;
$$;

-- Trigger: auto-create trial subscription + credits on new user
CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Create trial subscription
  INSERT INTO public.user_subscriptions (user_id, plan, status, trial_ends_at)
  VALUES (NEW.id, 'trial', 'active', now() + interval '15 days');

  -- Credit 8990 credits
  PERFORM public.add_credits(NEW.id, 8990, 'trial_signup', 'Créditos iniciais do Trial');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_trial
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_trial();

-- Insert default credit packages
INSERT INTO public.credit_packages (name, credits, price_brl) VALUES
  ('5.000 Créditos', 5000, 49.90),
  ('15.000 Créditos', 15000, 129.90),
  ('50.000 Créditos', 50000, 399.90);

-- Updated_at trigger for user_subscriptions
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

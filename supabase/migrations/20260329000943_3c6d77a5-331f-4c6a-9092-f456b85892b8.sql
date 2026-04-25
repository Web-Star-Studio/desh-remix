
-- Social Subscriptions (add-on pago por workspace)
CREATE TABLE public.social_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  workspace_id text NOT NULL,
  
  -- Stripe
  stripe_subscription_id text UNIQUE,
  stripe_customer_id text,
  stripe_price_id text,
  
  -- Status
  status text NOT NULL DEFAULT 'inactive' CHECK (
    status IN ('active', 'grace', 'inactive', 'cancelled')
  ),
  
  -- Zernio
  zernio_profile_id text UNIQUE,
  zernio_profile_created_at timestamptz,
  
  -- Datas
  activated_at timestamptz,
  grace_started_at timestamptz,
  grace_ends_at timestamptz,
  cancelled_at timestamptz,
  deleted_zernio_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, workspace_id)
);

ALTER TABLE public.social_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own social subscriptions"
ON public.social_subscriptions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_social_subs_user ON social_subscriptions(user_id, workspace_id);
CREATE INDEX idx_social_subs_status ON social_subscriptions(status);
CREATE INDEX idx_social_subs_grace ON social_subscriptions(grace_ends_at) WHERE status = 'grace';

CREATE TRIGGER set_social_subscriptions_updated_at
  BEFORE UPDATE ON public.social_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

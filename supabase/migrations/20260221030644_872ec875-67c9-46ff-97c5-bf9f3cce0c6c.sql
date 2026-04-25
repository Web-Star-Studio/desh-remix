CREATE TABLE public.billing_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  alert_enabled boolean NOT NULL DEFAULT false,
  alert_threshold integer NOT NULL DEFAULT 50,
  auto_purchase_enabled boolean NOT NULL DEFAULT false,
  auto_purchase_threshold integer NOT NULL DEFAULT 30,
  auto_purchase_package_id uuid REFERENCES public.credit_packages(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own billing prefs" ON public.billing_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own billing prefs" ON public.billing_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own billing prefs" ON public.billing_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_billing_preferences_updated_at
  BEFORE UPDATE ON public.billing_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
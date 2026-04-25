
-- 1. Replace the trial trigger: now grants 100 free credits on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Create subscription record (active, no trial)
  INSERT INTO public.user_subscriptions (user_id, plan, status, trial_ends_at)
  VALUES (NEW.id, 'credits', 'active', NULL);

  -- Grant 100 welcome credits
  INSERT INTO public.user_credits (user_id, balance, total_earned)
  VALUES (NEW.id, 100, 100)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = user_credits.balance + 100, total_earned = user_credits.total_earned + 100, updated_at = now();

  INSERT INTO public.credit_transactions (user_id, amount, action, description)
  VALUES (NEW.id, 100, 'welcome_credits', 'Boas-vindas — 100 créditos grátis');

  RETURN NEW;
END;
$function$;

-- 2. Disable trial_eligible on all credit packages
UPDATE public.credit_packages SET trial_eligible = false WHERE trial_eligible = true;


-- Change credit columns from integer to numeric to support decimal values
ALTER TABLE public.user_credits ALTER COLUMN balance TYPE numeric USING balance::numeric;
ALTER TABLE public.user_credits ALTER COLUMN total_earned TYPE numeric USING total_earned::numeric;
ALTER TABLE public.user_credits ALTER COLUMN total_spent TYPE numeric USING total_spent::numeric;

ALTER TABLE public.credit_transactions ALTER COLUMN amount TYPE numeric USING amount::numeric;

-- Update consume_credits to use numeric instead of integer
CREATE OR REPLACE FUNCTION public.consume_credits(_user_id uuid, _amount numeric, _action text, _description text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_balance numeric;
  sub_status subscription_status;
  sub_plan subscription_plan;
  trial_end timestamp with time zone;
BEGIN
  SELECT status, plan, trial_ends_at INTO sub_status, sub_plan, trial_end
  FROM public.user_subscriptions WHERE user_id = _user_id;

  IF sub_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_subscription');
  END IF;

  IF sub_status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'subscription_inactive');
  END IF;

  IF sub_plan = 'trial' AND trial_end IS NOT NULL AND trial_end < now() THEN
    UPDATE public.user_subscriptions SET status = 'expired', updated_at = now() WHERE user_id = _user_id;
    RETURN jsonb_build_object('success', false, 'error', 'trial_expired');
  END IF;

  SELECT balance INTO current_balance FROM public.user_credits WHERE user_id = _user_id;
  
  IF current_balance IS NULL OR current_balance < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits', 'balance', COALESCE(current_balance, 0));
  END IF;

  UPDATE public.user_credits 
  SET balance = balance - _amount, total_spent = total_spent + _amount, updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO public.credit_transactions (user_id, amount, action, description)
  VALUES (_user_id, -_amount, _action, COALESCE(_description, _action));

  RETURN jsonb_build_object('success', true, 'balance', current_balance - _amount);
END;
$function$;

-- Update add_credits to use numeric
CREATE OR REPLACE FUNCTION public.add_credits(_user_id uuid, _amount numeric, _action text, _description text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_credits (user_id, balance, total_earned)
  VALUES (_user_id, _amount, _amount)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = user_credits.balance + _amount, total_earned = user_credits.total_earned + _amount, updated_at = now();

  INSERT INTO public.credit_transactions (user_id, amount, action, description)
  VALUES (_user_id, _amount, _action, COALESCE(_description, _action));
END;
$function$;

-- Update trial trigger to give 250 credits instead of 8990
CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, plan, status, trial_ends_at)
  VALUES (NEW.id, 'trial', 'active', now() + interval '15 days');

  PERFORM public.add_credits(NEW.id, 250, 'trial_signup', 'Créditos iniciais do Trial');

  RETURN NEW;
END;
$function$;

-- Update admin billing stats to use 500 for MRR
CREATE OR REPLACE FUNCTION public.admin_get_billing_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT json_build_object(
    'total_subscriptions', (SELECT COUNT(*) FROM public.user_subscriptions),
    'active_trials', (SELECT COUNT(*) FROM public.user_subscriptions WHERE plan = 'trial' AND status = 'active' AND (trial_ends_at IS NULL OR trial_ends_at >= now())),
    'expired_trials', (SELECT COUNT(*) FROM public.user_subscriptions WHERE plan = 'trial' AND (status = 'expired' OR (trial_ends_at IS NOT NULL AND trial_ends_at < now()))),
    'active_pro', (SELECT COUNT(*) FROM public.user_subscriptions WHERE plan = 'pro' AND status = 'active'),
    'canceled_pro', (SELECT COUNT(*) FROM public.user_subscriptions WHERE plan = 'pro' AND status = 'canceled'),
    'total_credits_in_circulation', (SELECT COALESCE(SUM(balance), 0) FROM public.user_credits),
    'total_credits_earned', (SELECT COALESCE(SUM(total_earned), 0) FROM public.user_credits),
    'total_credits_spent', (SELECT COALESCE(SUM(total_spent), 0) FROM public.user_credits),
    'mrr_estimate', (SELECT COUNT(*) * 500 FROM public.user_subscriptions WHERE plan = 'pro' AND status = 'active'),
    'credit_purchases_count', (SELECT COUNT(*) FROM public.credit_transactions WHERE action = 'credit_purchase'),
    'arpu', (
      SELECT CASE WHEN COUNT(*) > 0 THEN ROUND(COALESCE(SUM(total_spent), 0)::numeric / COUNT(*)::numeric, 2) ELSE 0 END
      FROM public.user_credits WHERE total_spent > 0
    ),
    'churn_rate', (
      SELECT CASE 
        WHEN (SELECT COUNT(*) FROM public.user_subscriptions WHERE plan = 'pro') > 0 
        THEN ROUND(
          (SELECT COUNT(*) FROM public.user_subscriptions WHERE plan = 'pro' AND status = 'canceled')::numeric * 100.0 /
          (SELECT COUNT(*) FROM public.user_subscriptions WHERE plan = 'pro')::numeric, 1
        )
        ELSE 0 
      END
    ),
    'credits_consumed_today', (
      SELECT COALESCE(SUM(ABS(amount)), 0) FROM public.credit_transactions
      WHERE amount < 0 AND created_at >= CURRENT_DATE
    ),
    'credits_consumed_week', (
      SELECT COALESCE(SUM(ABS(amount)), 0) FROM public.credit_transactions
      WHERE amount < 0 AND created_at >= CURRENT_DATE - INTERVAL '7 days'
    ),
    'daily_revenue_trend', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT date_trunc('day', created_at)::date as day, SUM(ABS(amount)) as credits_consumed
        FROM public.credit_transactions
        WHERE amount < 0 AND created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY date_trunc('day', created_at)::date
        ORDER BY day ASC
      ) t
    ),
    'top_actions', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT action, COUNT(*) as count, SUM(ABS(amount)) as total_credits
        FROM public.credit_transactions
        WHERE amount < 0
        GROUP BY action
        ORDER BY count DESC
        LIMIT 10
      ) t
    ),
    'recent_transactions', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT ct.action, ct.amount, ct.description, ct.created_at,
               p.display_name as user_name
        FROM public.credit_transactions ct
        LEFT JOIN public.profiles p ON p.user_id = ct.user_id
        ORDER BY ct.created_at DESC
        LIMIT 30
      ) t
    ),
    'subscriptions_by_status', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT plan, status, COUNT(*) as count
        FROM public.user_subscriptions
        GROUP BY plan, status
        ORDER BY count DESC
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$function$;

-- Update credit_packages data (change column type first)
ALTER TABLE public.credit_packages ALTER COLUMN credits TYPE numeric USING credits::numeric;

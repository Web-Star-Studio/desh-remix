
-- Migrate existing users from trial/pro to credits
UPDATE public.user_subscriptions
SET plan = 'credits', status = 'active', trial_ends_at = NULL, updated_at = now()
WHERE plan IN ('trial', 'pro');

-- Replace handle_new_user_trial
CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, plan, status, trial_ends_at)
  VALUES (NEW.id, 'credits', 'active', NULL);
  RETURN NEW;
END;
$function$;

-- Simplify consume_credits
CREATE OR REPLACE FUNCTION public.consume_credits(_user_id uuid, _amount numeric, _action text, _description text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_balance numeric;
  sub_status subscription_status;
BEGIN
  SELECT status INTO sub_status
  FROM public.user_subscriptions WHERE user_id = _user_id;

  IF sub_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_subscription');
  END IF;

  IF sub_status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'subscription_inactive');
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

-- Update admin_get_billing_stats
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
    'active_users', (SELECT COUNT(*) FROM public.user_subscriptions WHERE status = 'active'),
    'total_credits_in_circulation', (SELECT COALESCE(SUM(balance), 0) FROM public.user_credits),
    'total_credits_earned', (SELECT COALESCE(SUM(total_earned), 0) FROM public.user_credits),
    'total_credits_spent', (SELECT COALESCE(SUM(total_spent), 0) FROM public.user_credits),
    'credit_purchases_count', (SELECT COUNT(*) FROM public.credit_transactions WHERE action = 'credit_purchase'),
    'arpu', (
      SELECT CASE WHEN COUNT(*) > 0 THEN ROUND(COALESCE(SUM(total_spent), 0)::numeric / COUNT(*)::numeric, 2) ELSE 0 END
      FROM public.user_credits WHERE total_spent > 0
    ),
    'credits_consumed_today', (
      SELECT COALESCE(SUM(ABS(amount)), 0) FROM public.credit_transactions
      WHERE amount < 0 AND created_at >= CURRENT_DATE
    ),
    'credits_consumed_week', (
      SELECT COALESCE(SUM(ABS(amount)), 0) FROM public.credit_transactions
      WHERE amount < 0 AND created_at >= CURRENT_DATE - INTERVAL '7 days'
    ),
    'credits_consumed_month', (
      SELECT COALESCE(SUM(ABS(amount)), 0) FROM public.credit_transactions
      WHERE amount < 0 AND created_at >= date_trunc('month', CURRENT_DATE)
    ),
    'daily_revenue_trend', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT date_trunc('day', created_at)::date as day, SUM(ABS(amount)) as credits_consumed
        FROM public.credit_transactions
        WHERE amount < 0 AND created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY date_trunc('day', created_at)::date ORDER BY day ASC
      ) t
    ),
    'top_actions', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT action, COUNT(*) as count, SUM(ABS(amount)) as total_credits
        FROM public.credit_transactions WHERE amount < 0
        GROUP BY action ORDER BY count DESC LIMIT 10
      ) t
    ),
    'recent_transactions', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT ct.action, ct.amount, ct.description, ct.created_at, p.display_name as user_name
        FROM public.credit_transactions ct
        LEFT JOIN public.profiles p ON p.user_id = ct.user_id
        ORDER BY ct.created_at DESC LIMIT 50
      ) t
    ),
    'avg_ltv', (
      SELECT ROUND(COALESCE(AVG(total_spent), 0)::numeric, 2) FROM public.user_credits WHERE total_spent > 0
    ),
    'total_credit_purchase_revenue', (
      SELECT COALESCE(SUM(cp.price_brl), 0)
      FROM public.credit_transactions ct
      JOIN public.credit_packages cp ON ct.amount = cp.credits
      WHERE ct.action = 'credit_purchase'
    ),
    'top_users_by_consumption', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT uc.user_id, p.display_name, uc.total_spent, uc.balance
        FROM public.user_credits uc
        LEFT JOIN public.profiles p ON p.user_id = uc.user_id
        WHERE uc.total_spent > 0 ORDER BY uc.total_spent DESC LIMIT 10
      ) t
    ),
    'weekly_signups', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT date_trunc('week', created_at)::date as week, COUNT(*) as signups
        FROM public.user_subscriptions
        WHERE created_at >= CURRENT_DATE - INTERVAL '8 weeks'
        GROUP BY date_trunc('week', created_at)::date ORDER BY week ASC
      ) t
    ),
    'credit_packages', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT id, name, credits, price_brl, active, stripe_price_id, trial_eligible, unit_price
        FROM public.credit_packages ORDER BY price_brl ASC
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$function$;

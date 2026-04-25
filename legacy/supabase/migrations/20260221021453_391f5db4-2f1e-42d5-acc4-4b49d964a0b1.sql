
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
    'mrr_estimate', (SELECT COUNT(*) * 8990 FROM public.user_subscriptions WHERE plan = 'pro' AND status = 'active'),
    'credit_purchases_count', (SELECT COUNT(*) FROM public.credit_transactions WHERE action = 'credit_purchase'),
    'arpu', (
      SELECT CASE WHEN COUNT(*) > 0 THEN ROUND(COALESCE(SUM(total_spent), 0)::numeric / COUNT(*)::numeric, 0) ELSE 0 END
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

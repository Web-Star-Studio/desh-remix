
-- Allow admins to manage credit packages
CREATE POLICY "Admins can insert credit packages"
  ON public.credit_packages FOR INSERT
  TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update credit packages"
  ON public.credit_packages FOR UPDATE
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete credit packages"
  ON public.credit_packages FOR DELETE
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Enhanced billing stats RPC with LTV, projections, cohort metrics
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
    'mrr_estimate', (SELECT COUNT(*) * 7990 FROM public.user_subscriptions WHERE plan = 'pro' AND status = 'active'),
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
        LIMIT 50
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
    ),
    -- NEW: Average LTV (total spent per user)
    'avg_ltv', (
      SELECT ROUND(COALESCE(AVG(total_spent), 0)::numeric, 2) FROM public.user_credits WHERE total_spent > 0
    ),
    -- NEW: Trials expiring in next 3 days
    'trials_expiring_soon', (
      SELECT COUNT(*) FROM public.user_subscriptions
      WHERE plan = 'trial' AND status = 'active'
      AND trial_ends_at IS NOT NULL
      AND trial_ends_at BETWEEN now() AND now() + INTERVAL '3 days'
    ),
    -- NEW: Credits consumed this month
    'credits_consumed_month', (
      SELECT COALESCE(SUM(ABS(amount)), 0) FROM public.credit_transactions
      WHERE amount < 0 AND created_at >= date_trunc('month', CURRENT_DATE)
    ),
    -- NEW: Revenue from credit purchases (total BRL)
    'total_credit_purchase_revenue', (
      SELECT COALESCE(SUM(cp.price_brl), 0)
      FROM public.credit_transactions ct
      JOIN public.credit_packages cp ON ct.amount = cp.credits
      WHERE ct.action = 'credit_purchase'
    ),
    -- NEW: Top users by credits consumed
    'top_users_by_consumption', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT uc.user_id, p.display_name, uc.total_spent, uc.balance,
               us.plan, us.status
        FROM public.user_credits uc
        LEFT JOIN public.profiles p ON p.user_id = uc.user_id
        LEFT JOIN public.user_subscriptions us ON us.user_id = uc.user_id
        WHERE uc.total_spent > 0
        ORDER BY uc.total_spent DESC
        LIMIT 10
      ) t
    ),
    -- NEW: Weekly signup cohort (last 8 weeks)
    'weekly_signups', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT date_trunc('week', created_at)::date as week,
               COUNT(*) as signups,
               COUNT(*) FILTER (WHERE plan = 'pro') as converted_pro
        FROM public.user_subscriptions
        WHERE created_at >= CURRENT_DATE - INTERVAL '8 weeks'
        GROUP BY date_trunc('week', created_at)::date
        ORDER BY week ASC
      ) t
    ),
    -- NEW: Avg days from trial signup to pro conversion
    'avg_trial_to_pro_days', (
      SELECT ROUND(COALESCE(AVG(EXTRACT(EPOCH FROM (us2.updated_at - us2.created_at)) / 86400), 0)::numeric, 1)
      FROM public.user_subscriptions us2
      WHERE us2.plan = 'pro' AND us2.status = 'active'
    ),
    -- NEW: Credit packages list for admin management
    'credit_packages', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT id, name, credits, price_brl, active, stripe_price_id
        FROM public.credit_packages
        ORDER BY price_brl ASC
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$function$;

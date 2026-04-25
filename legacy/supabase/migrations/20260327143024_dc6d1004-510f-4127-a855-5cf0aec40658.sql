-- Remove google_connections reference from admin_get_user_details function
CREATE OR REPLACE FUNCTION public.admin_get_user_details(_target_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN json_build_object(
    'data_by_type', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (SELECT data_type, COUNT(*) as count FROM user_data WHERE user_id = _target_user_id GROUP BY data_type ORDER BY count DESC) t
    ),
    'connections', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (SELECT name, category, platform, status, created_at FROM connections WHERE user_id = _target_user_id ORDER BY created_at DESC) t
    ),
    'related_logs', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (SELECT action, user_email, created_at, details FROM admin_logs WHERE details->>'target_user_id' = _target_user_id::text ORDER BY created_at DESC LIMIT 20) t
    ),
    'credits', (
      SELECT json_build_object(
        'balance', COALESCE(uc.balance, 0),
        'total_earned', COALESCE(uc.total_earned, 0),
        'total_spent', COALESCE(uc.total_spent, 0)
      )
      FROM (SELECT 1) x
      LEFT JOIN user_credits uc ON uc.user_id = _target_user_id
    ),
    'credit_history', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (SELECT action, amount, description, created_at FROM credit_transactions WHERE user_id = _target_user_id ORDER BY created_at DESC LIMIT 30) t
    ),
    'subscription', (
      SELECT row_to_json(t)
      FROM (SELECT plan, status::text as status, trial_ends_at, created_at FROM user_subscriptions WHERE user_id = _target_user_id LIMIT 1) t
    ),
    'workspaces', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (SELECT id, name, icon, color, is_default, created_at FROM workspaces WHERE user_id = _target_user_id ORDER BY sort_order ASC) t
    ),
    'tasks_summary', (
      SELECT json_build_object(
        'total', COUNT(*),
        'done', COUNT(*) FILTER (WHERE status = 'done'),
        'in_progress', COUNT(*) FILTER (WHERE status = 'in_progress'),
        'pending', COUNT(*) FILTER (WHERE status = 'pending')
      )
      FROM tasks WHERE user_id = _target_user_id
    ),
    'activity_logs', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (SELECT action, metadata, created_at FROM user_activity_logs WHERE user_id = _target_user_id ORDER BY created_at DESC LIMIT 30) t
    ),
    'gamification', (
      SELECT row_to_json(t)
      FROM (SELECT level, total_xp, streaks, badges FROM gamification_state WHERE user_id = _target_user_id LIMIT 1) t
    )
  );
END;
$function$;

-- Archive google_connections table (rename to preserve data)
ALTER TABLE IF EXISTS public.google_connections RENAME TO _archived_google_connections;
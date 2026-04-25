
-- Enhanced admin_list_users: add credits, subscription, workspaces, tasks count
CREATE OR REPLACE FUNCTION public.admin_list_users()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT json_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT
      u.id,
      u.email,
      u.created_at,
      u.last_sign_in_at,
      u.email_confirmed_at,
      p.display_name,
      p.avatar_url,
      p.suspended_at,
      p.suspended_reason,
      p.banned_at,
      p.banned_reason,
      p.archived_at,
      p.archived_reason,
      p.archive_expires_at,
      COALESCE((SELECT r.role::text FROM user_roles r WHERE r.user_id = u.id AND r.role = 'admin'), 'user') AS role,
      (
        SELECT COUNT(*)::int
        FROM (
          SELECT id FROM finance_transactions WHERE user_id = u.id
          UNION ALL SELECT id FROM contacts WHERE user_id = u.id
          UNION ALL SELECT id FROM ai_conversations WHERE user_id = u.id
        ) sub
      ) AS data_count,
      COALESCE((SELECT balance FROM user_credits WHERE user_id = u.id), 0)::numeric AS credits_balance,
      COALESCE((SELECT total_spent FROM user_credits WHERE user_id = u.id), 0)::numeric AS credits_spent,
      (SELECT status::text FROM user_subscriptions WHERE user_id = u.id LIMIT 1) AS subscription_status,
      (SELECT plan FROM user_subscriptions WHERE user_id = u.id LIMIT 1) AS subscription_plan,
      (SELECT COUNT(*)::int FROM workspaces WHERE user_id = u.id) AS workspaces_count,
      (SELECT COUNT(*)::int FROM tasks WHERE user_id = u.id) AS tasks_count,
      (SELECT COUNT(*)::int FROM user_data WHERE user_id = u.id AND data_type = 'note') AS notes_count,
      (SELECT COUNT(*)::int FROM connections WHERE user_id = u.id) AS connections_count
    FROM auth.users u
    LEFT JOIN profiles p ON p.user_id = u.id
    ORDER BY u.created_at DESC
  ) t;

  RETURN COALESCE(result, '[]'::json);
END;
$function$;

-- Enhanced admin_get_user_details: add credits history, subscription, workspaces, tasks, activity logs
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
    ),
    'google_connections', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (SELECT email, display_name, scopes, created_at FROM google_connections WHERE user_id = _target_user_id ORDER BY created_at DESC) t
    )
  );
END;
$function$;

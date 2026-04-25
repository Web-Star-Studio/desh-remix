-- DESH v3 Cleanup: Remover tabelas e funções de módulos desativados
-- Data: 2026-03-31

-- 1. Drop DB functions that reference dead tables
DROP FUNCTION IF EXISTS public.accept_mission_invite(uuid);

-- 2. Update admin_get_user_details to remove gamification reference
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
    )
  );
END;
$function$;

-- 3. Drop Coop/Gamificação tables (módulo removido)
DROP TABLE IF EXISTS coop_mission_invites CASCADE;
DROP TABLE IF EXISTS coop_mission_members CASCADE;
DROP TABLE IF EXISTS coop_missions CASCADE;
DROP TABLE IF EXISTS gamification_state CASCADE;
DROP TABLE IF EXISTS xp_log CASCADE;

-- 4. Drop Blog CMS table (módulo removido)
DROP TABLE IF EXISTS blog_posts CASCADE;

-- 5. Drop Changelogs table (módulo removido, ChangelogPage deletada)
DROP TABLE IF EXISTS changelogs CASCADE;

-- 6. Drop archived/legacy table (zero referências)
DROP TABLE IF EXISTS _archived_google_connections CASCADE;
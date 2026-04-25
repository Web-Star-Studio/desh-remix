
-- Add archive columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_reason text,
  ADD COLUMN IF NOT EXISTS archive_expires_at timestamptz;

-- RPC: admin_archive_user
CREATE OR REPLACE FUNCTION public.admin_archive_user(_target_user_id uuid, _reason text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot archive yourself';
  END IF;

  UPDATE profiles
  SET archived_at = now(),
      archived_reason = _reason,
      archive_expires_at = now() + interval '30 days',
      updated_at = now()
  WHERE user_id = _target_user_id;

  -- Log the action
  INSERT INTO admin_logs (user_id, user_email, action, details)
  VALUES (
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    'archive_user',
    jsonb_build_object(
      'target_user_id', _target_user_id,
      'reason', _reason,
      'expires_at', (now() + interval '30 days')::text
    )
  );
END;
$$;

-- RPC: admin_unarchive_user
CREATE OR REPLACE FUNCTION public.admin_unarchive_user(_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE profiles
  SET archived_at = NULL,
      archived_reason = NULL,
      archive_expires_at = NULL,
      updated_at = now()
  WHERE user_id = _target_user_id;

  INSERT INTO admin_logs (user_id, user_email, action, details)
  VALUES (
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    'unarchive_user',
    jsonb_build_object('target_user_id', _target_user_id)
  );
END;
$$;

-- RPC: admin_get_pending_deletions (for cron job)
CREATE OR REPLACE FUNCTION public.admin_get_pending_deletions()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result json;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT
      p.user_id,
      u.email,
      p.display_name,
      p.archived_at,
      p.archived_reason,
      p.archive_expires_at,
      EXTRACT(DAY FROM (p.archive_expires_at - now()))::int as days_remaining
    FROM profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.archive_expires_at IS NOT NULL
    ORDER BY p.archive_expires_at ASC
  ) t;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Update admin_list_users to include archive fields
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
      ) AS data_count
    FROM auth.users u
    LEFT JOIN profiles p ON p.user_id = u.id
    ORDER BY u.created_at DESC
  ) t;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

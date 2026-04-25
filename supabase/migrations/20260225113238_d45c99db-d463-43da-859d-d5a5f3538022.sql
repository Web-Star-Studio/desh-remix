
-- Add suspension/ban columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS suspended_reason text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS banned_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS banned_reason text DEFAULT NULL;

-- Admin RPC: Suspend user
CREATE OR REPLACE FUNCTION public.admin_suspend_user(
  _target_user_id uuid,
  _reason text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot suspend yourself';
  END IF;
  UPDATE profiles
    SET suspended_at = now(), suspended_reason = _reason, updated_at = now()
    WHERE user_id = _target_user_id;
END;
$$;

-- Admin RPC: Unsuspend user
CREATE OR REPLACE FUNCTION public.admin_unsuspend_user(
  _target_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE profiles
    SET suspended_at = NULL, suspended_reason = NULL, updated_at = now()
    WHERE user_id = _target_user_id;
END;
$$;

-- Admin RPC: Ban user
CREATE OR REPLACE FUNCTION public.admin_ban_user(
  _target_user_id uuid,
  _reason text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot ban yourself';
  END IF;
  UPDATE profiles
    SET banned_at = now(), banned_reason = _reason, updated_at = now()
    WHERE user_id = _target_user_id;
END;
$$;

-- Admin RPC: Unban user
CREATE OR REPLACE FUNCTION public.admin_unban_user(
  _target_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE profiles
    SET banned_at = NULL, banned_reason = NULL, updated_at = now()
    WHERE user_id = _target_user_id;
END;
$$;

-- Admin RPC: List active sessions (from auth.sessions)
CREATE OR REPLACE FUNCTION public.admin_get_user_sessions(
  _target_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT json_agg(json_build_object(
    'id', s.id,
    'created_at', s.created_at,
    'updated_at', s.updated_at,
    'user_agent', s.user_agent,
    'ip', s.ip
  ))
  INTO result
  FROM auth.sessions s
  WHERE s.user_id = _target_user_id
  ORDER BY s.updated_at DESC;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Update admin_list_users to include suspended/banned status
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Admin RPC: Bulk set role
CREATE OR REPLACE FUNCTION public.admin_bulk_set_role(
  _user_ids uuid[],
  _new_role app_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  FOREACH uid IN ARRAY _user_ids LOOP
    IF uid = auth.uid() THEN
      CONTINUE; -- skip self
    END IF;
    
    IF _new_role = 'admin' THEN
      INSERT INTO user_roles (user_id, role)
      VALUES (uid, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    ELSE
      DELETE FROM user_roles WHERE user_id = uid AND role = 'admin';
    END IF;
  END LOOP;
END;
$$;

-- Admin RPC: Bulk suspend
CREATE OR REPLACE FUNCTION public.admin_bulk_suspend(
  _user_ids uuid[],
  _reason text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  UPDATE profiles
    SET suspended_at = now(), suspended_reason = _reason, updated_at = now()
    WHERE user_id = ANY(_user_ids)
    AND user_id != auth.uid();
END;
$$;

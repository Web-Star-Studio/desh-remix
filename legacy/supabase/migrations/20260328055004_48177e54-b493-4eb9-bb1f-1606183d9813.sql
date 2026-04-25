
-- Secure RPC: send_friend_request (replaces direct insert)
CREATE OR REPLACE FUNCTION public.send_friend_request(_to_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF caller = _to_user_id THEN
    RAISE EXCEPTION 'Cannot send request to yourself';
  END IF;
  -- Check not already friends
  IF EXISTS (SELECT 1 FROM friendships WHERE user_id = caller AND friend_id = _to_user_id) THEN
    RAISE EXCEPTION 'Already friends';
  END IF;
  INSERT INTO friend_requests (from_user_id, to_user_id)
  VALUES (caller, _to_user_id);
END;
$$;

-- Secure RPC: reject_friend_request (replaces direct update)
CREATE OR REPLACE FUNCTION public.reject_friend_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE friend_requests
  SET status = 'rejected', updated_at = now()
  WHERE id = _request_id
    AND to_user_id = auth.uid()
    AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or not authorized';
  END IF;
END;
$$;

-- Secure RPC: cancel_friend_request (owner can cancel sent requests)
CREATE OR REPLACE FUNCTION public.cancel_friend_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM friend_requests
  WHERE id = _request_id
    AND from_user_id = auth.uid()
    AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or not authorized';
  END IF;
END;
$$;

-- Secure RPC: remove_friend (replaces direct delete, removes both directions)
CREATE OR REPLACE FUNCTION public.remove_friend(_friend_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM friendships
  WHERE (user_id = caller AND friend_id = _friend_user_id)
     OR (user_id = _friend_user_id AND friend_id = caller);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friendship not found';
  END IF;
END;
$$;

-- Secure RPC: find_user_by_friend_code (if not exists)
CREATE OR REPLACE FUNCTION public.find_user_by_friend_code(_code text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'user_id', p.user_id,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url
  ) INTO result
  FROM profiles p
  WHERE upper(p.friend_code) = upper(_code)
    AND p.user_id != auth.uid();
  RETURN result;
END;
$$;

-- Secure RPC: find_user_by_email
CREATE OR REPLACE FUNCTION public.find_user_by_email(_email text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'user_id', p.user_id,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url
  ) INTO result
  FROM profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE lower(u.email) = lower(_email)
    AND p.user_id != auth.uid();
  RETURN result;
END;
$$;

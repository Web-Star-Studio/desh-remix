-- Update find_user_by_friend_code to include email
CREATE OR REPLACE FUNCTION public.find_user_by_friend_code(_code text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'user_id', p.user_id,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url,
    'email', u.email
  ) INTO result
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE p.friend_code = upper(_code) AND p.user_id != auth.uid();
  RETURN result;
END;
$$;

-- Update find_user_by_email to include email
CREATE OR REPLACE FUNCTION public.find_user_by_email(_email text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE result json; found_user_id uuid;
BEGIN
  SELECT id INTO found_user_id FROM auth.users WHERE email = lower(_email) AND id != auth.uid();
  IF found_user_id IS NULL THEN RETURN NULL; END IF;
  SELECT json_build_object(
    'user_id', p.user_id,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url,
    'email', lower(_email)
  ) INTO result
  FROM public.profiles p WHERE p.user_id = found_user_id;
  RETURN result;
END;
$$;

-- Create a helper to get user profiles with emails (for friend lists)
CREATE OR REPLACE FUNCTION public.get_profiles_with_email(_user_ids uuid[])
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE result json;
BEGIN
  SELECT json_agg(json_build_object(
    'user_id', p.user_id,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url,
    'email', u.email
  ))
  INTO result
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id = ANY(_user_ids);
  RETURN COALESCE(result, '[]'::json);
END;
$$;
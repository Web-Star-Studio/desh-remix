
CREATE OR REPLACE FUNCTION public.admin_get_user_sessions(_target_user_id uuid)
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
    SELECT s.id, s.created_at, s.updated_at, s.user_agent, s.ip
    FROM auth.sessions s
    WHERE s.user_id = _target_user_id
    ORDER BY s.updated_at DESC
  ) t;
  
  RETURN COALESCE(result, '[]'::json);
END;
$function$;

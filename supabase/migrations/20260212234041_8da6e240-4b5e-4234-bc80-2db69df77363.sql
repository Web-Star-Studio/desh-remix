CREATE OR REPLACE FUNCTION public.admin_get_user_details(_target_user_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
    )
  );
END;
$$;
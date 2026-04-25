
-- Improve maintenance function: shorter Composio retention + clean expired api_cache
CREATE OR REPLACE FUNCTION public.run_db_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  cnt int;
BEGIN
  DELETE FROM public.pandora_processing_locks
  WHERE locked_at < now() - interval '60 seconds';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('pandora_locks_cleaned', cnt);

  DELETE FROM public.email_rate_limits
  WHERE sent_at < now() - interval '24 hours';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('email_rate_limits_cleaned', cnt);

  DELETE FROM public.webhook_events
  WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('webhook_events_cleaned', cnt);

  DELETE FROM public.whatsapp_web_session_logs
  WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('wa_session_logs_cleaned', cnt);

  DELETE FROM public.whatsapp_session_logs
  WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('wa_legacy_session_logs_cleaned', cnt);

  DELETE FROM public.search_history
  WHERE created_at < now() - interval '90 days' AND favorited = false;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('search_history_cleaned', cnt);

  -- Reduced from 30 to 14 days (high-volume logs)
  DELETE FROM public.composio_action_logs
  WHERE created_at < now() - interval '14 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('composio_action_logs_cleaned', cnt);

  DELETE FROM public.user_activity_logs
  WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('activity_logs_cleaned', cnt);

  DELETE FROM public.pandora_interaction_logs
  WHERE created_at < now() - interval '60 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('pandora_logs_cleaned', cnt);

  DELETE FROM public.email_snoozes
  WHERE restored = true AND created_at < now() - interval '30 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('email_snoozes_cleaned', cnt);

  -- NEW: clean expired api_cache rows
  DELETE FROM public.api_cache WHERE expires_at < now();
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('api_cache_expired_cleaned', cnt);

  -- NEW: clean processed automation events older than 7 days
  DELETE FROM public.automation_events
  WHERE processed = true AND created_at < now() - interval '7 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('automation_events_cleaned', cnt);

  -- NEW: clean resolved error_reports older than 30 days
  DELETE FROM public.error_reports
  WHERE resolved = true AND created_at < now() - interval '30 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('error_reports_cleaned', cnt);

  RETURN result;
END;
$$;

-- Run maintenance immediately to reclaim space
SELECT public.run_db_maintenance();

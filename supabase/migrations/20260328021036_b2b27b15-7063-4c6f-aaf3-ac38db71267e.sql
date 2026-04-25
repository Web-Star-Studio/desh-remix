
CREATE OR REPLACE FUNCTION public.run_db_maintenance()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  WHERE created_at < now() - interval '90 days'
  AND favorited = false;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('search_history_cleaned', cnt);

  DELETE FROM public.composio_action_logs
  WHERE created_at < now() - interval '30 days';
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
  WHERE restored = true
  AND snooze_until < now() - interval '7 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('email_snoozes_cleaned', cnt);

  DELETE FROM public.financial_webhook_logs
  WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('financial_webhook_logs_cleaned', cnt);

  DELETE FROM public.financial_sync_logs
  WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('financial_sync_logs_cleaned', cnt);

  -- Clean resolved error reports older than 30 days
  DELETE FROM public.error_reports
  WHERE resolved = true AND created_at < now() - interval '30 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('error_reports_resolved_cleaned', cnt);

  -- Clean unresolved error reports older than 90 days
  DELETE FROM public.error_reports
  WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('error_reports_old_cleaned', cnt);

  RETURN result;
END;
$function$;

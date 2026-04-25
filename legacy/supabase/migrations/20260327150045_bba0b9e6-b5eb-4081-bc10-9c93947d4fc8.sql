
-- =====================================================
-- DESH Database Maintenance: Cleanup function + indexes
-- =====================================================

-- 1. Add missing indexes for email_snoozes (cleanup queries)
CREATE INDEX IF NOT EXISTS idx_email_snoozes_user_until 
ON public.email_snoozes (user_id, snooze_until);

-- 2. Add index on webhook_events for cleanup by created_at
CREATE INDEX IF NOT EXISTS idx_webhook_events_created 
ON public.webhook_events (created_at);

-- 3. Add index on whatsapp_web_session_logs for cleanup
CREATE INDEX IF NOT EXISTS idx_wa_session_logs_created 
ON public.whatsapp_web_session_logs (created_at);

-- 4. Add index on email_rate_limits for cleanup
CREATE INDEX IF NOT EXISTS idx_email_rate_limits_sent 
ON public.email_rate_limits (sent_at);

-- 5. Add index on pandora_processing_locks for cleanup
CREATE INDEX IF NOT EXISTS idx_pandora_locks_locked 
ON public.pandora_processing_locks (locked_at);

-- 6. Create maintenance cleanup function (called by edge function or cron)
CREATE OR REPLACE FUNCTION public.run_db_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  cnt int;
BEGIN
  -- Clean expired pandora locks (>60s)
  DELETE FROM public.pandora_processing_locks
  WHERE locked_at < now() - interval '60 seconds';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('pandora_locks_cleaned', cnt);

  -- Clean old email rate limits (>24h)
  DELETE FROM public.email_rate_limits
  WHERE sent_at < now() - interval '24 hours';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('email_rate_limits_cleaned', cnt);

  -- Clean old webhook events (>7 days)
  DELETE FROM public.webhook_events
  WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('webhook_events_cleaned', cnt);

  -- Clean old WA session logs (>30 days)
  DELETE FROM public.whatsapp_web_session_logs
  WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('wa_session_logs_cleaned', cnt);

  -- Clean old WA session logs (legacy table, >30 days)
  DELETE FROM public.whatsapp_session_logs
  WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('wa_legacy_session_logs_cleaned', cnt);

  -- Clean old search history (>90 days, non-favorited)
  DELETE FROM public.search_history
  WHERE created_at < now() - interval '90 days'
  AND favorited = false;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('search_history_cleaned', cnt);

  -- Clean old composio action logs (>30 days)
  DELETE FROM public.composio_action_logs
  WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('composio_action_logs_cleaned', cnt);

  -- Clean old user activity logs (>90 days)
  DELETE FROM public.user_activity_logs
  WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('activity_logs_cleaned', cnt);

  -- Clean old pandora interaction logs (>60 days)
  DELETE FROM public.pandora_interaction_logs
  WHERE created_at < now() - interval '60 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('pandora_logs_cleaned', cnt);

  -- Clean expired email snoozes that were restored (>7 days past snooze)
  DELETE FROM public.email_snoozes
  WHERE restored = true
  AND snooze_until < now() - interval '7 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('email_snoozes_cleaned', cnt);

  -- Clean old financial webhook logs (>30 days)
  DELETE FROM public.financial_webhook_logs
  WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('financial_webhook_logs_cleaned', cnt);

  -- Clean old financial sync logs (>30 days)
  DELETE FROM public.financial_sync_logs
  WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('financial_sync_logs_cleaned', cnt);

  RETURN result;
END;
$$;

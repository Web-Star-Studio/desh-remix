
-- automation_events table for Event Bus
CREATE TABLE automation_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ DEFAULT NULL,
  matched_rules JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_automation_events_unprocessed ON automation_events(user_id, processed, created_at DESC) WHERE processed = false;
CREATE INDEX idx_automation_events_type ON automation_events(event_type, user_id);

-- RLS
ALTER TABLE automation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own events" ON automation_events FOR ALL USING (auth.uid() = user_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE automation_events;

-- Add trigger_event column to automation_rules if not exists
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS trigger_event TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger_event ON automation_rules(user_id, trigger_event) WHERE enabled = true;

-- Add event_id column to automation_logs for traceability
ALTER TABLE automation_logs ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES automation_events(id) ON DELETE SET NULL;

-- Add cleanup for automation_events to db-maintenance
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

  DELETE FROM public.error_reports
  WHERE resolved = true AND created_at < now() - interval '30 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('error_reports_resolved_cleaned', cnt);

  DELETE FROM public.error_reports
  WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('error_reports_old_cleaned', cnt);

  -- Clean processed automation_events older than 30 days
  DELETE FROM public.automation_events
  WHERE processed = true AND created_at < now() - interval '30 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('automation_events_cleaned', cnt);

  -- Clean unprocessed automation_events older than 7 days (stuck)
  DELETE FROM public.automation_events
  WHERE processed = false AND created_at < now() - interval '7 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('automation_events_stuck_cleaned', cnt);

  RETURN result;
END;
$function$;

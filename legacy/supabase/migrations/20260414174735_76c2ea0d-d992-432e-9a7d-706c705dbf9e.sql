
-- Remove duplicate index on whatsapp_messages
DROP INDEX IF EXISTS idx_whatsapp_messages_conversation_id;

-- Index for wamid lookup in webhook status updates (content_raw->>wamid)
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wamid 
  ON public.whatsapp_messages USING btree (((content_raw->>'wamid')))
  WHERE content_raw->>'wamid' IS NOT NULL;

-- Partial index for automation_events cleanup (processed old events)
CREATE INDEX IF NOT EXISTS idx_automation_events_cleanup
  ON public.automation_events USING btree (created_at)
  WHERE processed = true;

-- Index for session logs lookup
CREATE INDEX IF NOT EXISTS idx_wa_session_logs_session
  ON public.whatsapp_web_session_logs USING btree (session_id, created_at DESC);

-- Index for pandora audit log cleanup
CREATE INDEX IF NOT EXISTS idx_pandora_wa_audit_created
  ON public.pandora_wa_audit_log USING btree (created_at);

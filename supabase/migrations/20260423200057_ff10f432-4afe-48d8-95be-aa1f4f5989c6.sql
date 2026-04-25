
-- Drop redundant indexes
DROP INDEX IF EXISTS public.idx_gmail_messages_cache_folder;
DROP INDEX IF EXISTS public.idx_whatsapp_messages_conversation;
DROP INDEX IF EXISTS public.idx_pandora_sessions_user;

-- Add high-value indexes
CREATE INDEX IF NOT EXISTS idx_error_reports_unresolved_created
  ON public.error_reports (resolved, created_at DESC)
  WHERE resolved = false OR resolved IS NULL;

CREATE INDEX IF NOT EXISTS idx_error_reports_user_created
  ON public.error_reports (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pandora_sessions_user_channel
  ON public.pandora_sessions (user_id, active_channel, last_activity_at DESC);

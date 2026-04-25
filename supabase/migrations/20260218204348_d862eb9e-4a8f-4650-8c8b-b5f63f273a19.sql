
CREATE INDEX IF NOT EXISTS idx_whatsapp_web_sessions_session_id
  ON public.whatsapp_web_sessions (session_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_web_sessions_user_status
  ON public.whatsapp_web_sessions (user_id, status);

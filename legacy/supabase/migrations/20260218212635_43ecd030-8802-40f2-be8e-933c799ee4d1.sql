
-- Audit log table for WhatsApp session events emitted by edge functions
CREATE TABLE public.whatsapp_session_logs (
  id            uuid                     NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid                     NOT NULL,
  session_id    text                     NOT NULL,
  event         text                     NOT NULL,
  source        text                     NOT NULL DEFAULT 'proxy',
  meta          jsonb                    NOT NULL DEFAULT '{}',
  created_at    timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_audit_logs_user_session
  ON public.whatsapp_session_logs (user_id, session_id, created_at DESC);

ALTER TABLE public.whatsapp_session_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own whatsapp session logs"
  ON public.whatsapp_session_logs
  FOR SELECT
  USING (auth.uid() = user_id);

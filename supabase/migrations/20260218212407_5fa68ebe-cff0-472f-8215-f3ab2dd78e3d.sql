
-- Create status change log table for WhatsApp Web sessions
CREATE TABLE public.whatsapp_web_session_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id text NOT NULL,
  old_status text,
  new_status text NOT NULL,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_web_session_logs ENABLE ROW LEVEL SECURITY;

-- Users can only read their own logs
CREATE POLICY "Users can read their own session logs"
  ON public.whatsapp_web_session_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert (done via trigger with SECURITY DEFINER)
-- We allow authenticated users to also insert for direct client writes if needed
CREATE POLICY "Service can insert session logs"
  ON public.whatsapp_web_session_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_wa_session_logs_user_session ON public.whatsapp_web_session_logs (user_id, session_id, created_at DESC);

-- Trigger function: auto-log status changes on whatsapp_web_sessions
CREATE OR REPLACE FUNCTION public.log_whatsapp_web_session_status_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- Only log when status actually changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.whatsapp_web_session_logs (user_id, session_id, old_status, new_status, error_message)
    VALUES (NEW.user_id, NEW.session_id, OLD.status, NEW.status, NEW.last_error);
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to whatsapp_web_sessions
CREATE TRIGGER trg_wa_web_session_status_log
  AFTER UPDATE ON public.whatsapp_web_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_whatsapp_web_session_status_change();

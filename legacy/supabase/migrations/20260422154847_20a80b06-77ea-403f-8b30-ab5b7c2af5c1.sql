CREATE TABLE public.whatsapp_proxy_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID,
  route_path TEXT NOT NULL,
  external_url TEXT NOT NULL,
  method TEXT NOT NULL,
  request_body JSONB,
  response_status INTEGER,
  response_body JSONB,
  response_text TEXT,
  duration_ms INTEGER,
  error_code TEXT,
  action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_proxy_logs_user_created
  ON public.whatsapp_proxy_logs (user_id, created_at DESC);

CREATE INDEX idx_wa_proxy_logs_status
  ON public.whatsapp_proxy_logs (response_status)
  WHERE response_status >= 400;

ALTER TABLE public.whatsapp_proxy_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own WA proxy logs"
  ON public.whatsapp_proxy_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Inserts come exclusively from the edge function with service role,
-- which bypasses RLS, so no INSERT policy is needed for end users.

-- Auto-cleanup older than 30d (run via existing run_db_maintenance)
CREATE OR REPLACE FUNCTION public.cleanup_whatsapp_proxy_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.whatsapp_proxy_logs
  WHERE created_at < now() - INTERVAL '30 days';
END;
$$;
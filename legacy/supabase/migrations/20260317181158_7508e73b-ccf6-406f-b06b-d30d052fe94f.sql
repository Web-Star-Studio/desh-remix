
-- Table to log all incoming Pluggy webhook events
CREATE TABLE public.financial_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  item_id text,
  connection_id uuid,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processing_time_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for common queries
CREATE INDEX idx_financial_webhook_logs_created ON public.financial_webhook_logs (created_at DESC);
CREATE INDEX idx_financial_webhook_logs_event ON public.financial_webhook_logs (event);
CREATE INDEX idx_financial_webhook_logs_status ON public.financial_webhook_logs (status);

-- Enable RLS
ALTER TABLE public.financial_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Admin-only read access
CREATE POLICY "Admins can view webhook logs"
ON public.financial_webhook_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Service role can insert (edge function uses service role key)
-- No INSERT policy needed since edge function uses service_role_key which bypasses RLS

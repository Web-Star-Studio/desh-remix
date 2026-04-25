
CREATE TABLE public.data_reset_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  module TEXT NOT NULL,
  records_deleted INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.data_reset_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reset logs"
  ON public.data_reset_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only service role inserts (from edge function)
CREATE POLICY "Service role inserts reset logs"
  ON public.data_reset_log FOR INSERT
  TO service_role
  WITH CHECK (true);

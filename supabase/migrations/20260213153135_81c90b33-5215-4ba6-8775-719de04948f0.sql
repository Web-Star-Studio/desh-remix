
-- Create webhook_events table
CREATE TABLE public.webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id text NOT NULL,
  user_id uuid NOT NULL,
  category text NOT NULL,
  event_type text NOT NULL,
  object_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Users can only read their own events
CREATE POLICY "Users can read their own webhook events"
  ON public.webhook_events FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update (mark as processed) their own events
CREATE POLICY "Users can update their own webhook events"
  ON public.webhook_events FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own webhook events
CREATE POLICY "Users can delete their own webhook events"
  ON public.webhook_events FOR DELETE
  USING (auth.uid() = user_id);

-- Service role inserts (from edge function) - allow insert for service role only
-- The edge function uses service role key, so no user-level insert policy needed

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.webhook_events;

-- Index for faster queries
CREATE INDEX idx_webhook_events_user_category ON public.webhook_events (user_id, category, processed);
CREATE INDEX idx_webhook_events_connection ON public.webhook_events (connection_id);


-- Create ai_insights table
CREATE TABLE public.ai_insights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'info',
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text NOT NULL,
  action_url text,
  icon text DEFAULT 'lightbulb',
  dismissed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Enable RLS
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can read their own insights"
  ON public.ai_insights FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own insights"
  ON public.ai_insights FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own insights"
  ON public.ai_insights FOR DELETE
  USING (auth.uid() = user_id);

-- Service role insert (edge function inserts via service role)
CREATE POLICY "Service can insert insights"
  ON public.ai_insights FOR INSERT
  WITH CHECK (true);

-- Index for quick lookups
CREATE INDEX idx_ai_insights_user_active ON public.ai_insights (user_id, dismissed, expires_at);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_insights;

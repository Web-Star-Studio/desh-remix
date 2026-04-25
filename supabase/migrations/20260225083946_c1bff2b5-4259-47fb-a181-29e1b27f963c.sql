
-- User activity logs table
CREATE TABLE public.user_activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  action text NOT NULL,
  category text NOT NULL DEFAULT 'geral',
  details jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast user+time queries
CREATE INDEX idx_user_activity_logs_user_created ON public.user_activity_logs (user_id, created_at DESC);
CREATE INDEX idx_user_activity_logs_category ON public.user_activity_logs (user_id, category);

-- Enable RLS
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- Users can only read their own logs
CREATE POLICY "Users can read their own activity logs"
ON public.user_activity_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own logs
CREATE POLICY "Users can insert their own activity logs"
ON public.user_activity_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own logs (clear history)
CREATE POLICY "Users can delete their own activity logs"
ON public.user_activity_logs
FOR DELETE
USING (auth.uid() = user_id);

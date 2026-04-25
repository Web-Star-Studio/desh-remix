
CREATE TABLE public.email_cleanup_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  scanned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  scan_mode TEXT NOT NULL DEFAULT 'current',
  emails_scanned INTEGER NOT NULL DEFAULT 0,
  groups_found INTEGER NOT NULL DEFAULT 0,
  emails_cleaned INTEGER NOT NULL DEFAULT 0,
  groups_detail JSONB NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE public.email_cleanup_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own cleanup sessions"
  ON public.email_cleanup_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their own cleanup sessions"
  ON public.email_cleanup_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cleanup sessions"
  ON public.email_cleanup_sessions FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_email_cleanup_sessions_user_id ON public.email_cleanup_sessions(user_id, scanned_at DESC);


-- Table to store unsubscribe history for stats/trends
CREATE TABLE public.unsubscribe_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sender_name text NOT NULL,
  sender_email text NOT NULL,
  category text NOT NULL DEFAULT 'outro',
  safety_score integer NOT NULL DEFAULT 50,
  method text NOT NULL DEFAULT 'GET',
  success boolean NOT NULL DEFAULT false,
  trashed boolean NOT NULL DEFAULT false,
  emails_affected integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.unsubscribe_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own unsubscribe history"
  ON public.unsubscribe_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own unsubscribe history"
  ON public.unsubscribe_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own unsubscribe history"
  ON public.unsubscribe_history FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_unsubscribe_history_user_date ON public.unsubscribe_history (user_id, created_at DESC);

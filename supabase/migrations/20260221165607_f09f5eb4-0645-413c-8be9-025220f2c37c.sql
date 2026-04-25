
CREATE TABLE public.email_snoozes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  gmail_id TEXT NOT NULL,
  subject TEXT,
  from_name TEXT,
  snooze_until TIMESTAMPTZ NOT NULL,
  original_labels TEXT[] DEFAULT '{}',
  restored BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, gmail_id)
);

ALTER TABLE public.email_snoozes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own snoozes"
  ON public.email_snoozes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

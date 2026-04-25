CREATE TABLE public.composio_user_emails (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  toolkit text NOT NULL DEFAULT 'gmail',
  created_at timestamptz DEFAULT now(),
  UNIQUE(email, toolkit)
);

ALTER TABLE public.composio_user_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own emails"
  ON public.composio_user_emails FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access"
  ON public.composio_user_emails FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
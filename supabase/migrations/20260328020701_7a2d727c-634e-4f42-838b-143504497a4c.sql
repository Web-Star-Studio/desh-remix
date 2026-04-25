
CREATE TABLE public.error_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  severity text NOT NULL DEFAULT 'error',
  module text,
  message text NOT NULL,
  stack text,
  metadata jsonb DEFAULT '{}',
  user_agent text,
  url text,
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own errors"
  ON public.error_reports FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can read all errors"
  ON public.error_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update errors"
  ON public.error_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

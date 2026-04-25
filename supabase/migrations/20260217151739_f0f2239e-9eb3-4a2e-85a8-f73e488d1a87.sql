
CREATE TABLE public.google_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  google_user_id text NOT NULL,
  email text,
  display_name text,
  avatar_url text,
  access_token text NOT NULL,
  refresh_token text,
  token_expiry timestamptz,
  scopes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, google_user_id)
);

ALTER TABLE public.google_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own google connections"
  ON public.google_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own google connections"
  ON public.google_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own google connections"
  ON public.google_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own google connections"
  ON public.google_connections FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_google_connections_updated_at
  BEFORE UPDATE ON public.google_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

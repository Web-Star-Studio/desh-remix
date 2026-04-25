
-- File share links table
CREATE TABLE public.file_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_id uuid REFERENCES public.files(id) ON DELETE CASCADE NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  password_hash text,
  expires_at timestamptz,
  max_downloads integer,
  download_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.file_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own share links" ON public.file_share_links
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow anon access for public share resolution
CREATE POLICY "Anyone can read active share links by token" ON public.file_share_links
  FOR SELECT TO anon
  USING (is_active = true);

CREATE INDEX idx_file_share_token ON public.file_share_links(token);
CREATE INDEX idx_file_share_file ON public.file_share_links(file_id);

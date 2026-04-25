
CREATE TABLE public.file_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  source text NOT NULL DEFAULT 'other',
  source_label text,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  imported_file_id uuid REFERENCES public.files(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.file_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own inbox" ON public.file_inbox
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_file_inbox_user_status ON public.file_inbox(user_id, status);

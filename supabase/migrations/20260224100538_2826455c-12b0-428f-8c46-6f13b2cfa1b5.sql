CREATE TABLE public.profile_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  doc_type text NOT NULL DEFAULT 'other',
  label text NOT NULL DEFAULT '',
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own docs" ON public.profile_documents
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own docs" ON public.profile_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own docs" ON public.profile_documents
  FOR DELETE USING (auth.uid() = user_id);
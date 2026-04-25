
-- Enable pg_trgm
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- FILE FOLDERS
CREATE TABLE public.file_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  name text NOT NULL,
  parent_id uuid REFERENCES public.file_folders(id) ON DELETE CASCADE,
  color text DEFAULT '#6366f1',
  icon text DEFAULT '📁',
  is_smart boolean DEFAULT false,
  smart_rules jsonb,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.file_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own folders" ON public.file_folders
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_file_folders_user_ws ON public.file_folders(user_id, workspace_id);
CREATE INDEX idx_file_folders_parent ON public.file_folders(parent_id);

-- FILES
CREATE TABLE public.files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  folder_id uuid REFERENCES public.file_folders(id) ON DELETE SET NULL,
  name text NOT NULL,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  storage_path text NOT NULL,
  source text NOT NULL DEFAULT 'upload',
  source_id text,
  content_hash text,
  thumbnail_url text,
  ocr_text text,
  ocr_status text DEFAULT 'pending',
  ai_category text,
  ai_summary text,
  ai_tags text[] DEFAULT '{}',
  is_favorite boolean DEFAULT false,
  is_trashed boolean DEFAULT false,
  trashed_at timestamptz,
  parent_file_id uuid REFERENCES public.files(id) ON DELETE SET NULL,
  version integer DEFAULT 1,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own files" ON public.files
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_files_user_ws_folder ON public.files(user_id, workspace_id, folder_id);
CREATE INDEX idx_files_user_trashed ON public.files(user_id, is_trashed);
CREATE INDEX idx_files_user_favorite ON public.files(user_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX idx_files_content_hash ON public.files(user_id, content_hash) WHERE content_hash IS NOT NULL;
CREATE INDEX idx_files_source ON public.files(user_id, source);
CREATE INDEX idx_files_name_trgm ON public.files USING gin (name public.gin_trgm_ops);

-- FILE LINKS
CREATE TABLE public.file_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.file_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own file links" ON public.file_links
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_file_links_file ON public.file_links(file_id);
CREATE INDEX idx_file_links_entity ON public.file_links(entity_type, entity_id);

-- Storage stats function
CREATE OR REPLACE FUNCTION public.get_file_storage_stats(_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'total_files', COUNT(*) FILTER (WHERE NOT is_trashed),
    'total_size', COALESCE(SUM(size_bytes) FILTER (WHERE NOT is_trashed), 0),
    'trashed_files', COUNT(*) FILTER (WHERE is_trashed),
    'trashed_size', COALESCE(SUM(size_bytes) FILTER (WHERE is_trashed), 0),
    'by_category', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('category', ai_category, 'count', cnt, 'size', sz)), '[]'::jsonb)
      FROM (SELECT ai_category, COUNT(*) as cnt, SUM(size_bytes) as sz FROM files WHERE user_id = _user_id AND NOT is_trashed AND ai_category IS NOT NULL GROUP BY ai_category ORDER BY cnt DESC) sub
    ),
    'duplicates', (
      SELECT COUNT(*) FROM (SELECT content_hash FROM files WHERE user_id = _user_id AND NOT is_trashed AND content_hash IS NOT NULL GROUP BY content_hash HAVING COUNT(*) > 1) dup
    )
  ) FROM files WHERE user_id = _user_id;
$$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.files;

-- Triggers
CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON public.files FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_file_folders_updated_at BEFORE UPDATE ON public.file_folders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

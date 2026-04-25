
-- Create search_projects table
CREATE TABLE public.search_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'hsl(220, 80%, 50%)',
  icon TEXT NOT NULL DEFAULT '📁',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.search_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own search projects"
  ON public.search_projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own search projects"
  ON public.search_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own search projects"
  ON public.search_projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own search projects"
  ON public.search_projects FOR DELETE
  USING (auth.uid() = user_id);

-- Add columns to search_history
ALTER TABLE public.search_history
  ADD COLUMN IF NOT EXISTS filter TEXT NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS answer TEXT,
  ADD COLUMN IF NOT EXISTS tldr TEXT,
  ADD COLUMN IF NOT EXISTS citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS favorited BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.search_projects(id) ON DELETE SET NULL;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_search_history_user_favorited ON public.search_history(user_id, favorited);
CREATE INDEX IF NOT EXISTS idx_search_history_user_project ON public.search_history(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_search_history_user_created ON public.search_history(user_id, created_at DESC);

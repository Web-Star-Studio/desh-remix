
-- Community shared themes
CREATE TABLE public.shared_themes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  mode TEXT NOT NULL DEFAULT 'light',
  primary_hsl TEXT NOT NULL,
  accent_hsl TEXT NOT NULL,
  background_hsl TEXT,
  foreground_hsl TEXT,
  wallpaper_id TEXT,
  tags TEXT[] DEFAULT '{}',
  likes INTEGER NOT NULL DEFAULT 0,
  downloads INTEGER NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shared_themes ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read public themes
CREATE POLICY "Anyone can read public themes"
  ON public.shared_themes FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);

-- Users can insert their own themes
CREATE POLICY "Users can insert their own themes"
  ON public.shared_themes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own themes
CREATE POLICY "Users can update their own themes"
  ON public.shared_themes FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own themes
CREATE POLICY "Users can delete their own themes"
  ON public.shared_themes FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_shared_themes_updated_at
  BEFORE UPDATE ON public.shared_themes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

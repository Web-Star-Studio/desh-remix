
-- Enable realtime for social_posts
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_posts;

-- Create social_competitors table
CREATE TABLE public.social_competitors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id),
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  display_name TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.social_competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own competitors"
  ON public.social_competitors
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- Table to track note sharing permissions
CREATE TABLE public.note_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id TEXT NOT NULL,
  owner_id UUID NOT NULL,
  shared_with_id UUID NOT NULL,
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (note_id, shared_with_id)
);

ALTER TABLE public.note_shares ENABLE ROW LEVEL SECURITY;

-- Owner can manage shares
CREATE POLICY "Owner can manage shares"
  ON public.note_shares FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Shared user can view their share record
CREATE POLICY "Shared user can view share"
  ON public.note_shares FOR SELECT
  USING (auth.uid() = shared_with_id);

-- Table to track real-time presence on a note (who is viewing/editing)
CREATE TABLE public.note_presence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  user_email TEXT,
  user_name TEXT,
  is_editing BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (note_id, user_id)
);

ALTER TABLE public.note_presence ENABLE ROW LEVEL SECURITY;

-- Anyone involved (owner or shared) can see presence
CREATE POLICY "Users can view note presence"
  ON public.note_presence FOR SELECT
  USING (true);

-- Users can manage their own presence
CREATE POLICY "Users can manage own presence"
  ON public.note_presence FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own presence"
  ON public.note_presence FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own presence"
  ON public.note_presence FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-cleanup stale presence (older than 5 minutes)
CREATE OR REPLACE FUNCTION public.cleanup_stale_note_presence()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.note_presence
  WHERE last_seen_at < now() - interval '5 minutes';
$$;

-- Enable realtime for presence table
ALTER PUBLICATION supabase_realtime ADD TABLE public.note_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.note_shares;

-- Index for fast lookups
CREATE INDEX idx_note_shares_note_id ON public.note_shares(note_id);
CREATE INDEX idx_note_shares_shared_with ON public.note_shares(shared_with_id);
CREATE INDEX idx_note_presence_note_id ON public.note_presence(note_id);

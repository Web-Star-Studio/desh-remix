
-- Table 1: Gmail messages cache
CREATE TABLE public.gmail_messages_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  gmail_id text NOT NULL,
  connection_id uuid,
  from_name text,
  from_email text,
  subject text,
  snippet text,
  date timestamptz,
  is_unread boolean DEFAULT true,
  is_starred boolean DEFAULT false,
  has_attachment boolean DEFAULT false,
  label_ids text[] DEFAULT '{}',
  folder text DEFAULT 'inbox',
  synced_at timestamptz DEFAULT now(),
  UNIQUE(user_id, gmail_id)
);

ALTER TABLE public.gmail_messages_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own cached emails"
  ON public.gmail_messages_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cached emails"
  ON public.gmail_messages_cache FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cached emails"
  ON public.gmail_messages_cache FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cached emails"
  ON public.gmail_messages_cache FOR DELETE
  USING (auth.uid() = user_id);

-- Table 2: Gmail sync state tracker
CREATE TABLE public.gmail_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  folder text DEFAULT 'inbox',
  next_page_token text,
  total_synced integer DEFAULT 0,
  sync_completed boolean DEFAULT false,
  last_synced_at timestamptz DEFAULT now()
);

ALTER TABLE public.gmail_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own sync state"
  ON public.gmail_sync_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sync state"
  ON public.gmail_sync_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sync state"
  ON public.gmail_sync_state FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sync state"
  ON public.gmail_sync_state FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast lookup by user + folder
CREATE INDEX idx_gmail_messages_cache_user_folder ON public.gmail_messages_cache(user_id, folder, date DESC);

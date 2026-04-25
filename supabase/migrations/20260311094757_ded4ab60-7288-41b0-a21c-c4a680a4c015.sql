
-- Gmail labels cache table - stores user labels per connection for fast access
CREATE TABLE public.gmail_labels_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connection_id uuid NOT NULL,
  gmail_label_id text NOT NULL,
  name text NOT NULL,
  label_type text DEFAULT 'user',
  color_bg text,
  color_text text,
  messages_total integer DEFAULT 0,
  messages_unread integer DEFAULT 0,
  synced_at timestamptz DEFAULT now(),
  UNIQUE (user_id, connection_id, gmail_label_id)
);

ALTER TABLE public.gmail_labels_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own labels cache"
  ON public.gmail_labels_cache
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Add indexes for fast lookups
CREATE INDEX idx_gmail_labels_cache_user ON public.gmail_labels_cache(user_id);
CREATE INDEX idx_gmail_labels_cache_conn ON public.gmail_labels_cache(user_id, connection_id);

-- Add to_email and cc columns to gmail_messages_cache for sent mail visibility
ALTER TABLE public.gmail_messages_cache 
  ADD COLUMN IF NOT EXISTS to_email text,
  ADD COLUMN IF NOT EXISTS cc_emails text[];

-- Add index on label_ids for faster label-based queries
CREATE INDEX IF NOT EXISTS idx_gmail_messages_label_ids ON public.gmail_messages_cache USING GIN(label_ids);

-- Add index for faster folder+unread queries
CREATE INDEX IF NOT EXISTS idx_gmail_messages_folder_unread ON public.gmail_messages_cache(user_id, folder, is_unread);

-- Enable realtime for labels cache
ALTER PUBLICATION supabase_realtime ADD TABLE public.gmail_labels_cache;

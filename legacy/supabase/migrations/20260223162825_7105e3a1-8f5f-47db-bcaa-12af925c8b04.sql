
CREATE TABLE public.whatsapp_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','failed','cancelled')),
  chats_total integer DEFAULT 0,
  chats_done integer DEFAULT 0,
  messages_synced integer DEFAULT 0,
  current_chat text,
  pending_chats jsonb DEFAULT '[]'::jsonb,
  error_message text,
  retry_count integer DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.whatsapp_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own sync jobs"
  ON public.whatsapp_sync_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own sync jobs"
  ON public.whatsapp_sync_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_sync_jobs;

ALTER TABLE public.gmail_sync_state 
  ADD COLUMN IF NOT EXISTS history_id bigint,
  ADD COLUMN IF NOT EXISTS watch_expiration timestamptz;
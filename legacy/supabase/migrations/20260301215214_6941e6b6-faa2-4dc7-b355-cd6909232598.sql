-- Add thread_id column to gmail_messages_cache for proper Gmail threading
ALTER TABLE public.gmail_messages_cache ADD COLUMN IF NOT EXISTS thread_id text;
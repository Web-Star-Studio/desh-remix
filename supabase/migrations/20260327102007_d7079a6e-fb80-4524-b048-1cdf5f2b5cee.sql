
ALTER TABLE public.webhook_events 
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS processing_time_ms integer,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS trigger_slug text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

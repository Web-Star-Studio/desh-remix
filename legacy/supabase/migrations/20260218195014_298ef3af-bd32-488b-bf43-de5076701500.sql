ALTER TABLE public.whatsapp_web_sessions
  ADD COLUMN IF NOT EXISTS auto_reconnect boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reconnect_interval_minutes integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_reconnect_attempts integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS reconnect_attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_reconnect_at timestamp with time zone DEFAULT NULL;

-- Emails cache table
CREATE TABLE IF NOT EXISTS public.emails_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_id text NOT NULL,
  subject text,
  from_name text,
  from_email text,
  body_preview text,
  labels jsonb DEFAULT '[]'::jsonb,
  received_at timestamptz,
  is_read boolean DEFAULT false,
  has_attachment boolean DEFAULT false,
  composio_synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, gmail_id)
);

-- Calendar events cache table
CREATE TABLE IF NOT EXISTS public.calendar_events_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  title text,
  start_at timestamptz,
  end_at timestamptz,
  location text,
  description text,
  attendees jsonb DEFAULT '[]'::jsonb,
  composio_synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, event_id)
);

-- RLS
ALTER TABLE public.emails_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events_cache ENABLE ROW LEVEL SECURITY;

-- Emails cache policies
CREATE POLICY "Users can manage own emails cache" ON public.emails_cache
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Calendar events cache policies
CREATE POLICY "Users can manage own calendar events cache" ON public.calendar_events_cache
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_emails_cache_user_received ON public.emails_cache(user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_calendar_events_cache_user_start ON public.calendar_events_cache(user_id, start_at DESC);

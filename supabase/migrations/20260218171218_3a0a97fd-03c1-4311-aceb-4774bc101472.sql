
-- Create whatsapp_web_sessions table
CREATE TABLE public.whatsapp_web_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DISCONNECTED',
  last_qr_code TEXT,
  last_connected_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  gateway_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_web_sessions_status_check CHECK (status IN ('DISCONNECTED', 'QR_PENDING', 'CONNECTED', 'ERROR'))
);

-- Enable RLS
ALTER TABLE public.whatsapp_web_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read their own whatsapp web sessions"
  ON public.whatsapp_web_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own whatsapp web sessions"
  ON public.whatsapp_web_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own whatsapp web sessions"
  ON public.whatsapp_web_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own whatsapp web sessions"
  ON public.whatsapp_web_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_whatsapp_web_sessions_updated_at
  BEFORE UPDATE ON public.whatsapp_web_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_web_sessions;

-- Drop and recreate whatsapp_conversations channel constraint to allow 'whatsapp_web'
-- First check if constraint exists and drop it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name LIKE '%channel%' 
    AND table_name = 'whatsapp_conversations'
  ) THEN
    ALTER TABLE public.whatsapp_conversations 
    DROP CONSTRAINT IF EXISTS whatsapp_conversations_channel_check;
  END IF;
END $$;

-- Add new constraint allowing both channels
ALTER TABLE public.whatsapp_conversations
  ADD CONSTRAINT whatsapp_conversations_channel_check
  CHECK (channel IN ('whatsapp', 'whatsapp_web'));


-- Table for Pandora interaction logs (admin-only visibility)
CREATE TABLE public.pandora_interaction_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  contact_phone text NOT NULL,
  conversation_id uuid,
  message_type text NOT NULL DEFAULT 'text',
  input_text text NOT NULL,
  output_text text,
  credits_consumed numeric DEFAULT 0,
  tools_used text[] DEFAULT '{}',
  response_time_ms integer,
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for admin queries
CREATE INDEX idx_pandora_logs_created_at ON public.pandora_interaction_logs (created_at DESC);
CREATE INDEX idx_pandora_logs_user_id ON public.pandora_interaction_logs (user_id);

-- Enable RLS
ALTER TABLE public.pandora_interaction_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read
CREATE POLICY "Admins can read pandora logs"
ON public.pandora_interaction_logs
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- No direct user access for insert/update/delete (service role only from edge function)

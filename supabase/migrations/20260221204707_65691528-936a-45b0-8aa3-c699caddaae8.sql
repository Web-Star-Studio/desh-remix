
-- Create whatsapp_ai_settings table
CREATE TABLE public.whatsapp_ai_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  allowed_numbers text[] NOT NULL DEFAULT '{}',
  greeting_message text DEFAULT '',
  active_hours_start integer NOT NULL DEFAULT 6,
  active_hours_end integer NOT NULL DEFAULT 23,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_ai_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can read their own ai settings"
ON public.whatsapp_ai_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ai settings"
ON public.whatsapp_ai_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ai settings"
ON public.whatsapp_ai_settings FOR UPDATE
USING (auth.uid() = user_id);

-- Service role needs to read settings in webhook (no RLS bypass needed, service_role bypasses RLS)

-- Trigger for updated_at
CREATE TRIGGER update_whatsapp_ai_settings_updated_at
BEFORE UPDATE ON public.whatsapp_ai_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

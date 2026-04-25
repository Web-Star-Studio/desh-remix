
-- 1. Audit log table
CREATE TABLE IF NOT EXISTS public.pandora_wa_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sender_phone TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  message_preview TEXT,
  credits_used INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_audit_user_ts ON public.pandora_wa_audit_log(user_id, created_at DESC);
CREATE INDEX idx_wa_audit_blocked ON public.pandora_wa_audit_log(action, user_id) WHERE action = 'blocked';
CREATE INDEX idx_wa_audit_rate_limit ON public.pandora_wa_audit_log(user_id, sender_phone, created_at) WHERE action = 'blocked';

ALTER TABLE public.pandora_wa_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit log"
  ON public.pandora_wa_audit_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert audit log"
  ON public.pandora_wa_audit_log FOR INSERT
  WITH CHECK (true);

-- 2. Phone authorization OTPs table
CREATE TABLE IF NOT EXISTS public.phone_authorization_otps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.phone_authorization_otps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own OTPs"
  ON public.phone_authorization_otps FOR ALL
  USING (auth.uid() = user_id);

-- 3. Add verified_numbers column to whatsapp_ai_settings
ALTER TABLE public.whatsapp_ai_settings
  ADD COLUMN IF NOT EXISTS verified_numbers TEXT[] DEFAULT '{}';


-- Table for API key usage logs
CREATE TABLE public.gateway_api_key_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key_id uuid NOT NULL REFERENCES public.user_gateway_api_keys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event text NOT NULL,
  session_id text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_gateway_api_key_logs_key_id ON public.gateway_api_key_logs(key_id);
CREATE INDEX idx_gateway_api_key_logs_user_id ON public.gateway_api_key_logs(user_id);
CREATE INDEX idx_gateway_api_key_logs_created_at ON public.gateway_api_key_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.gateway_api_key_logs ENABLE ROW LEVEL SECURITY;

-- Users can only read their own logs
CREATE POLICY "Users can read their own key logs"
ON public.gateway_api_key_logs FOR SELECT
USING (auth.uid() = user_id);

-- No direct INSERT/UPDATE/DELETE for users — only the edge function (service_role) writes logs

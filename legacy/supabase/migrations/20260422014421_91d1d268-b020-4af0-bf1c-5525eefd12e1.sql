CREATE TABLE public.whatsapp_send_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  account_id TEXT NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  to_phone TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'template')),
  template_name TEXT,
  template_language TEXT,
  message_preview TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  zernio_message_id TEXT,
  error_code TEXT,
  error_message TEXT,
  latency_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_send_logs_user_created ON public.whatsapp_send_logs(user_id, created_at DESC);
CREATE INDEX idx_wa_send_logs_contact ON public.whatsapp_send_logs(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_wa_send_logs_workspace ON public.whatsapp_send_logs(workspace_id) WHERE workspace_id IS NOT NULL;

ALTER TABLE public.whatsapp_send_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own send logs"
ON public.whatsapp_send_logs FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own send logs"
ON public.whatsapp_send_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own send logs"
ON public.whatsapp_send_logs FOR DELETE
USING (auth.uid() = user_id);
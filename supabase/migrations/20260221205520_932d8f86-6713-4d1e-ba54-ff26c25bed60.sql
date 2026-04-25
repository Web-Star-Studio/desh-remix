
CREATE TABLE public.platform_integrations (
  id text PRIMARY KEY,
  label text NOT NULL,
  icon text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.platform_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read integrations"
  ON public.platform_integrations FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can update integrations"
  ON public.platform_integrations FOR UPDATE
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.platform_integrations (id, label, icon, enabled) VALUES
  ('google', 'Google Workspace', '🔗', true),
  ('whatsapp', 'WhatsApp', '💬', true),
  ('belvo', 'Belvo (Open Banking)', '🏦', true),
  ('pluggy', 'Pluggy (Open Banking)', '🏛️', true),
  ('unified_calendar', 'Calendário (Unified)', '📅', true),
  ('unified_messaging', 'E-mail e Mensagens (Unified)', '✉️', true),
  ('unified_storage', 'Arquivos (Unified)', '📁', true),
  ('unified_task', 'Tarefas (Unified)', '✅', true),
  ('unified_genai', 'IA Generativa (Unified)', '✨', true);

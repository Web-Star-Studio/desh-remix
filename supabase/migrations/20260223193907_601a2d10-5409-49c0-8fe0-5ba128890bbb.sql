
-- 1. Expand notification_preferences with new columns
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS email_weekly_report boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_credit_alerts boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_welcome boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_security_alerts boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_inactivity boolean NOT NULL DEFAULT true;

-- 2. Create email_templates table
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  subject_template text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'transactional',
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select email_templates"
  ON public.email_templates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert email_templates"
  ON public.email_templates FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update email_templates"
  ON public.email_templates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete email_templates"
  ON public.email_templates FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Create email_send_log table
CREATE TABLE public.email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email_type text NOT NULL,
  template_slug text,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select email_send_log"
  ON public.email_send_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- No insert/update/delete policies for users - only service role inserts

CREATE INDEX idx_email_send_log_created ON public.email_send_log (created_at DESC);
CREATE INDEX idx_email_send_log_type ON public.email_send_log (email_type);
CREATE INDEX idx_email_send_log_status ON public.email_send_log (status);

-- 4. Create email_automations table
CREATE TABLE public.email_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'cron',
  trigger_config jsonb NOT NULL DEFAULT '{}',
  template_slug text,
  target_audience text NOT NULL DEFAULT 'all',
  active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select email_automations"
  ON public.email_automations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert email_automations"
  ON public.email_automations FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update email_automations"
  ON public.email_automations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete email_automations"
  ON public.email_automations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_email_automations_updated_at
  BEFORE UPDATE ON public.email_automations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Seed default templates
INSERT INTO public.email_templates (slug, name, subject_template, body_html, type) VALUES
  ('task_reminder', 'Lembrete de Tarefa', '⏰ Prazo próximo: {{title}}', '<p>Sua tarefa <strong>{{title}}</strong> está vencendo {{time_label}}.</p>', 'transactional'),
  ('event_reminder', 'Lembrete de Evento', '📅 Evento em {{minutes}} min: {{title}}', '<p>Você tem um evento <strong>{{title}}</strong> começando às {{time_str}} — em {{minutes}} minuto(s).</p>', 'transactional'),
  ('daily_summary', 'Resumo Diário', '☀️ Bom dia, {{display_name}}! Seu resumo do dia', '<p>Olá, {{display_name}}! Hoje você tem <strong>{{tasks_due}}</strong> tarefas pendentes e <strong>{{events_today}}</strong> eventos.</p>', 'report'),
  ('broadcast', 'Broadcast', '📢 {{title}}', '<p>{{message}}</p>', 'marketing'),
  ('weekly_report', 'Relatório Semanal', '📊 Seu relatório semanal, {{display_name}}', '<p>Olá, {{display_name}}! Na última semana você completou <strong>{{tasks_completed}}</strong> tarefas e participou de <strong>{{events_attended}}</strong> eventos.</p>', 'report'),
  ('credit_low', 'Créditos Baixos', '⚠️ Seus créditos estão acabando', '<p>Olá, {{display_name}}! Você tem apenas <strong>{{credits_balance}}</strong> créditos restantes. Recarregue para continuar usando os recursos de IA.</p>', 'transactional'),
  ('credit_purchase', 'Compra de Créditos', '✅ Compra confirmada: {{credits_amount}} créditos', '<p>Olá, {{display_name}}! Sua compra de <strong>{{credits_amount}}</strong> créditos foi confirmada. Seu saldo atual é <strong>{{credits_balance}}</strong>.</p>', 'transactional'),
  ('new_connection', 'Nova Integração', '🔗 Integração conectada: {{connection_name}}', '<p>Olá, {{display_name}}! Sua integração <strong>{{connection_name}}</strong> ({{platform}}) foi conectada com sucesso.</p>', 'transactional'),
  ('inactivity_reminder', 'Lembrete de Inatividade', '👋 Sentimos sua falta, {{display_name}}!', '<p>Olá, {{display_name}}! Faz {{days_inactive}} dias que você não acessa o Desh. Suas tarefas e eventos estão esperando por você!</p>', 'marketing'),
  ('welcome', 'Boas-vindas', '🎉 Bem-vindo ao Desh, {{display_name}}!', '<p>Olá, {{display_name}}! Seja bem-vindo ao Desh, seu hub pessoal de produtividade. Explore seus módulos e comece a organizar sua vida!</p>', 'transactional'),
  ('security_alert', 'Alerta de Segurança', '🔒 Novo login detectado na sua conta', '<p>Olá, {{display_name}}! Detectamos um novo login na sua conta. Se não foi você, altere sua senha imediatamente.</p>', 'transactional')
ON CONFLICT (slug) DO NOTHING;

-- 6. Admin RPC to get email stats
CREATE OR REPLACE FUNCTION public.admin_get_email_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN json_build_object(
    'sent_today', (SELECT COUNT(*) FROM email_send_log WHERE status = 'sent' AND created_at >= CURRENT_DATE),
    'sent_week', (SELECT COUNT(*) FROM email_send_log WHERE status = 'sent' AND created_at >= CURRENT_DATE - INTERVAL '7 days'),
    'sent_month', (SELECT COUNT(*) FROM email_send_log WHERE status = 'sent' AND created_at >= date_trunc('month', CURRENT_DATE)),
    'failed_total', (SELECT COUNT(*) FROM email_send_log WHERE status = 'failed'),
    'skipped_total', (SELECT COUNT(*) FROM email_send_log WHERE status = 'skipped'),
    'by_type', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (SELECT email_type, status, COUNT(*) as count FROM email_send_log GROUP BY email_type, status ORDER BY count DESC) t
    ),
    'daily_volume', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT created_at::date as day, COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'sent') as sent,
          COUNT(*) FILTER (WHERE status = 'failed') as failed
        FROM email_send_log
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY created_at::date ORDER BY day ASC
      ) t
    ),
    'recent_logs', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (SELECT id, email_type, template_slug, recipient_email, subject, status, error_message, created_at FROM email_send_log ORDER BY created_at DESC LIMIT 50) t
    )
  );
END;
$$;

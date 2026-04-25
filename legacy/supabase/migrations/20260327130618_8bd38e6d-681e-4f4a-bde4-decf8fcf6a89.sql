
CREATE TABLE public.composio_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  service text NOT NULL,
  method text NOT NULL,
  path text NOT NULL,
  status text NOT NULL DEFAULT 'ok',
  latency_ms integer,
  error_message text,
  workspace_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.composio_action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all action logs"
ON public.composio_action_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert action logs"
ON public.composio_action_logs
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE INDEX idx_composio_action_logs_action_created ON public.composio_action_logs (action, created_at DESC);
CREATE INDEX idx_composio_action_logs_service_created ON public.composio_action_logs (service, created_at DESC);
CREATE INDEX idx_composio_action_logs_user_created ON public.composio_action_logs (user_id, created_at DESC);


CREATE TABLE public.financial_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES public.financial_connections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  accounts_synced int DEFAULT 0,
  transactions_synced int DEFAULT 0,
  investments_synced int DEFAULT 0,
  error_message text,
  duration_ms int,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.financial_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own sync logs"
  ON public.financial_sync_logs FOR SELECT
  USING (auth.uid() = user_id);


-- Table for Pluggy Item Insights (KPIs) and detected recurring payments
CREATE TABLE public.financial_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES public.financial_connections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  insight_type text NOT NULL, -- 'kpi' or 'recurring_payments'
  data jsonb NOT NULL DEFAULT '{}',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  UNIQUE(user_id, connection_id, insight_type)
);

ALTER TABLE public.financial_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insights"
  ON public.financial_insights FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own insights"
  ON public.financial_insights FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own insights"
  ON public.financial_insights FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own insights"
  ON public.financial_insights FOR DELETE TO authenticated
  USING (user_id = auth.uid());

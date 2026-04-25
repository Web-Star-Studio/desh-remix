
-- Create belvo_links table
CREATE TABLE public.belvo_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  link_id text NOT NULL,
  institution_name text,
  institution_logo text,
  access_mode text NOT NULL DEFAULT 'recurrent',
  status text NOT NULL DEFAULT 'valid',
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.belvo_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own belvo links"
  ON public.belvo_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own belvo links"
  ON public.belvo_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own belvo links"
  ON public.belvo_links FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own belvo links"
  ON public.belvo_links FOR DELETE
  USING (auth.uid() = user_id);

-- Add source and external_id columns to finance_transactions
ALTER TABLE public.finance_transactions
  ADD COLUMN source text NOT NULL DEFAULT 'manual',
  ADD COLUMN external_id text;

CREATE INDEX idx_finance_transactions_external_id ON public.finance_transactions (external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_finance_transactions_source ON public.finance_transactions (source);
CREATE INDEX idx_belvo_links_user_id ON public.belvo_links (user_id);

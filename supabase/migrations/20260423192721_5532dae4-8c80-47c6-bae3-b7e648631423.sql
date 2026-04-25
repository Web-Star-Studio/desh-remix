-- Remove possíveis duplicatas antes de criar a constraint única
DELETE FROM public.financial_investments a
USING public.financial_investments b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.provider_investment_id = b.provider_investment_id
  AND a.provider_investment_id IS NOT NULL;

-- Cria a constraint única necessária para o upsert (onConflict)
ALTER TABLE public.financial_investments
  ADD CONSTRAINT financial_investments_user_id_provider_investment_id_key
  UNIQUE (user_id, provider_investment_id);
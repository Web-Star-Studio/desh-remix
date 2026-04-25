
-- Drop overly permissive policies and replace with service_role scoped ones
DROP POLICY "Service role full access loans" ON public.financial_loans;
DROP POLICY "Service role full access inv txns" ON public.financial_investment_transactions;

-- Service role already bypasses RLS by default, so these aren't needed.
-- The existing user-scoped policies are sufficient.

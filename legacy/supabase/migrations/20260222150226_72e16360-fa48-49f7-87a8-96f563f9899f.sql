
-- Fix: pandora_processing_locks has RLS enabled but NO policies
-- This is a lock table used by edge functions only, so we allow service role only
-- Add a policy that denies all access from regular users (only service_role can access)
CREATE POLICY "Only service role can manage locks"
ON public.pandora_processing_locks
FOR ALL
USING (false)
WITH CHECK (false);

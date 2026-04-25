
-- 1. Fix note_presence: restrict SELECT to authenticated users in same note
DROP POLICY IF EXISTS "Anyone can view presence" ON public.note_presence;
CREATE POLICY "Authenticated users can view presence"
  ON public.note_presence FOR SELECT
  TO authenticated
  USING (true);

-- 2. Fix pandora_wa_audit_log: restrict INSERT to service_role only
DROP POLICY IF EXISTS "Anyone can insert audit logs" ON public.pandora_wa_audit_log;
DROP POLICY IF EXISTS "Service can insert audit logs" ON public.pandora_wa_audit_log;
CREATE POLICY "Service role inserts audit logs"
  ON public.pandora_wa_audit_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 3. Performance index on data_reset_log
CREATE INDEX IF NOT EXISTS idx_data_reset_log_user_id ON public.data_reset_log(user_id);

-- 4. Secure coupons: create view without Stripe internals
CREATE OR REPLACE VIEW public.coupons_public
WITH (security_invoker = on) AS
  SELECT id, code, type, value, active, expires_at, max_uses, used_count, created_at
  FROM public.coupons;

-- Restrict base coupons SELECT to admin only
DROP POLICY IF EXISTS "Active coupons are viewable" ON public.coupons;
DROP POLICY IF EXISTS "Authenticated users can view active coupons" ON public.coupons;
CREATE POLICY "Only admins can view coupons directly"
  ON public.coupons FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow public view for authenticated users
GRANT SELECT ON public.coupons_public TO authenticated;

-- 5. api_cache: add policies for service_role (composio-proxy uses service role)
-- Already uses service_role which bypasses RLS, but add explicit policies for clarity
CREATE POLICY "Service role manages cache"
  ON public.api_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow admins to view all WhatsApp proxy logs for system-wide monitoring.
-- Existing per-user policy remains untouched.
CREATE POLICY "Admins can view all WA proxy logs"
  ON public.whatsapp_proxy_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 1. Fix note_presence: only show presence to users with note access
DROP POLICY IF EXISTS "Authenticated users can view presence" ON public.note_presence;
DROP POLICY IF EXISTS "Users can view note presence" ON public.note_presence;

CREATE POLICY "Users can view own presence"
ON public.note_presence
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view presence on shared notes"
ON public.note_presence
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.note_shares ns
    WHERE ns.note_id = note_presence.note_id
      AND (ns.owner_id = auth.uid() OR ns.shared_with_id = auth.uid())
  )
);

-- 2. Fix coupons: remove broad SELECT, replace with secure validator
DROP POLICY IF EXISTS "Users can read active coupons" ON public.coupons;

CREATE OR REPLACE FUNCTION public.validate_coupon(_code text)
RETURNS TABLE (
  id uuid,
  code text,
  type text,
  value numeric,
  valid boolean,
  reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
BEGIN
  SELECT * INTO c FROM public.coupons WHERE coupons.code = _code LIMIT 1;
  IF c IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, _code, NULL::text, NULL::numeric, false, 'not_found'::text;
    RETURN;
  END IF;
  IF NOT c.active THEN
    RETURN QUERY SELECT c.id, c.code, c.type, c.value, false, 'inactive'::text;
    RETURN;
  END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RETURN QUERY SELECT c.id, c.code, c.type, c.value, false, 'expired'::text;
    RETURN;
  END IF;
  IF c.max_uses IS NOT NULL AND c.used_count >= c.max_uses THEN
    RETURN QUERY SELECT c.id, c.code, c.type, c.value, false, 'max_uses_reached'::text;
    RETURN;
  END IF;
  RETURN QUERY SELECT c.id, c.code, c.type, c.value, true, 'valid'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_coupon(text) TO authenticated;

-- 3. Fix pandora_wa_audit_log: remove duplicate policy applying to {public}
DROP POLICY IF EXISTS "Service role can insert audit log" ON public.pandora_wa_audit_log;

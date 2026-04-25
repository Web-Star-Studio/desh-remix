
-- 1. PROFILES: Trigger to block non-admins from modifying admin columns
CREATE OR REPLACE FUNCTION public.safe_update_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.suspended_at IS DISTINCT FROM NEW.suspended_at
     OR OLD.suspended_reason IS DISTINCT FROM NEW.suspended_reason
     OR OLD.banned_at IS DISTINCT FROM NEW.banned_at
     OR OLD.banned_reason IS DISTINCT FROM NEW.banned_reason
     OR OLD.archived_at IS DISTINCT FROM NEW.archived_at
     OR OLD.archived_reason IS DISTINCT FROM NEW.archived_reason
     OR OLD.archive_expires_at IS DISTINCT FROM NEW.archive_expires_at THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Cannot modify administrative fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_update_restrictions ON public.profiles;
CREATE TRIGGER enforce_profile_update_restrictions
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.safe_update_profile();

-- 2. USER_SUBSCRIPTIONS: Drop ALL policy, keep SELECT only
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.user_subscriptions;

-- 3. COUPONS: Restrict SELECT to active + non-expired
DROP POLICY IF EXISTS "Authenticated users can read coupons" ON public.coupons;
CREATE POLICY "Users can read active coupons" ON public.coupons
  FOR SELECT
  TO authenticated
  USING (
    active = true
    AND (expires_at IS NULL OR expires_at > now())
  );

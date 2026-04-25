
-- =============================================
-- LGPD CLEANUP: Remove orphan & legacy sessions
-- =============================================

-- 1. Delete orphan sessions (no real user)
DELETE FROM public.whatsapp_web_sessions 
WHERE user_id = '00000000-0000-0000-0000-000000000000';

-- 2. Delete all legacy wa-* format sessions
DELETE FROM public.whatsapp_web_sessions 
WHERE session_id LIKE 'wa-%';

-- 3. Delete legacy sessions without proper desh_{prefix}_{suffix} format
DELETE FROM public.whatsapp_web_sessions 
WHERE session_id IN ('desh', 'desh_da987948', 'desh_19561e42', 'desh_23608411');

-- 4. Clean up test account data
DELETE FROM public.whatsapp_web_sessions 
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE email IN ('test@dashfy.app', 'demo@dashfy.app', 'test3@dashfy.app', 'user4@dashfy.app', 'john@doe.com')
  OR email LIKE 'teste-onboard%'
);

-- 5. Create validation trigger to enforce secure session_id format
CREATE OR REPLACE FUNCTION public.validate_wa_session_format()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- session_id must match desh_{at_least_6_chars}_{at_least_4_chars}
  IF NEW.session_id !~ '^desh_[a-z0-9]{6,}_[a-z0-9]{4,}$' THEN
    RAISE EXCEPTION 'Invalid session_id format: %. Must be desh_{userPrefix}_{workspacePrefix}', NEW.session_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop if exists to be idempotent
DROP TRIGGER IF EXISTS enforce_wa_session_format ON public.whatsapp_web_sessions;

CREATE TRIGGER enforce_wa_session_format
  BEFORE INSERT OR UPDATE ON public.whatsapp_web_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_wa_session_format();

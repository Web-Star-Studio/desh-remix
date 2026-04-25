
-- Secure RPC: accept workspace share (validates recipient is auth.uid())
CREATE OR REPLACE FUNCTION public.accept_workspace_share(_share_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE workspace_shares
  SET status = 'accepted', updated_at = now()
  WHERE id = _share_id
    AND shared_with = auth.uid()
    AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Share not found or not authorized';
  END IF;
END;
$$;

-- Secure RPC: reject workspace share (validates recipient is auth.uid())
CREATE OR REPLACE FUNCTION public.reject_workspace_share(_share_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE workspace_shares
  SET status = 'rejected', updated_at = now()
  WHERE id = _share_id
    AND shared_with = auth.uid()
    AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Share not found or not authorized';
  END IF;
END;
$$;

-- Secure RPC: revoke workspace share (validates owner is auth.uid())
CREATE OR REPLACE FUNCTION public.revoke_workspace_share(_share_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE workspace_shares
  SET status = 'revoked', updated_at = now()
  WHERE id = _share_id
    AND owner_id = auth.uid()
    AND status IN ('pending', 'accepted');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Share not found or not authorized';
  END IF;
END;
$$;

-- Secure RPC: delete workspace share (validates owner is auth.uid() AND share is inactive)
CREATE OR REPLACE FUNCTION public.delete_workspace_share(_share_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM workspace_shares
  WHERE id = _share_id
    AND owner_id = auth.uid()
    AND status IN ('revoked', 'rejected');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Share not found, not authorized, or still active';
  END IF;
END;
$$;

-- Secure RPC: update workspace share permission (owner only)
CREATE OR REPLACE FUNCTION public.update_workspace_share_permission(_share_id uuid, _permission text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _permission NOT IN ('view', 'edit') THEN
    RAISE EXCEPTION 'Invalid permission: %', _permission;
  END IF;
  UPDATE workspace_shares
  SET permission = _permission, updated_at = now()
  WHERE id = _share_id
    AND owner_id = auth.uid()
    AND status = 'accepted';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Share not found or not authorized';
  END IF;
END;
$$;

-- Secure RPC: update workspace share modules (owner only)
CREATE OR REPLACE FUNCTION public.update_workspace_share_modules(_share_id uuid, _share_all boolean, _modules text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  valid_modules text[] := ARRAY['tasks','notes','calendar','contacts','habits','financegoals','transactions','recurring','budgets'];
  m text;
BEGIN
  IF NOT _share_all THEN
    IF array_length(_modules, 1) IS NULL OR array_length(_modules, 1) = 0 THEN
      RAISE EXCEPTION 'Select at least one module';
    END IF;
    FOREACH m IN ARRAY _modules LOOP
      IF NOT m = ANY(valid_modules) THEN
        RAISE EXCEPTION 'Invalid module: %', m;
      END IF;
    END LOOP;
  END IF;

  UPDATE workspace_shares
  SET share_all = _share_all,
      modules = CASE WHEN _share_all THEN '{}' ELSE _modules END,
      updated_at = now()
  WHERE id = _share_id
    AND owner_id = auth.uid()
    AND status = 'accepted';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Share not found or not authorized';
  END IF;
END;
$$;

-- Secure RPC: accept widget share (validates recipient)
CREATE OR REPLACE FUNCTION public.accept_widget_share(_share_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE widget_shares
  SET status = 'accepted'
  WHERE id = _share_id
    AND shared_with = auth.uid()
    AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Share not found or not authorized';
  END IF;
END;
$$;

-- Secure RPC: reject widget share (validates recipient)
CREATE OR REPLACE FUNCTION public.reject_widget_share(_share_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE widget_shares
  SET status = 'rejected'
  WHERE id = _share_id
    AND shared_with = auth.uid()
    AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Share not found or not authorized';
  END IF;
END;
$$;

-- Secure RPC: revoke widget share (owner only)
CREATE OR REPLACE FUNCTION public.revoke_widget_share(_share_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE widget_shares
  SET status = 'revoked'
  WHERE id = _share_id
    AND owner_id = auth.uid()
    AND status IN ('pending', 'accepted');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Share not found or not authorized';
  END IF;
END;
$$;

-- Secure RPC: delete widget share (owner only, inactive)
CREATE OR REPLACE FUNCTION public.delete_widget_share(_share_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM widget_shares
  WHERE id = _share_id
    AND owner_id = auth.uid()
    AND status IN ('revoked', 'rejected');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Share not found, not authorized, or still active';
  END IF;
END;
$$;

-- Secure RPC: update widget share permission (owner only)
CREATE OR REPLACE FUNCTION public.update_widget_share_permission(_share_id uuid, _permission text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _permission NOT IN ('view', 'edit') THEN
    RAISE EXCEPTION 'Invalid permission';
  END IF;
  UPDATE widget_shares
  SET permission = _permission
  WHERE id = _share_id
    AND owner_id = auth.uid()
    AND status = 'accepted';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Share not found or not authorized';
  END IF;
END;
$$;

-- Cascade: when a friendship is deleted, revoke all related shares
CREATE OR REPLACE FUNCTION public.cascade_revoke_shares_on_unfriend()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Revoke workspace shares in both directions
  UPDATE workspace_shares
  SET status = 'revoked', updated_at = now()
  WHERE status IN ('pending', 'accepted')
    AND (
      (owner_id = OLD.user_id AND shared_with = OLD.friend_id)
      OR (owner_id = OLD.friend_id AND shared_with = OLD.user_id)
    );

  -- Revoke widget shares in both directions
  UPDATE widget_shares
  SET status = 'revoked'
  WHERE status IN ('pending', 'accepted')
    AND (
      (owner_id = OLD.user_id AND shared_with = OLD.friend_id)
      OR (owner_id = OLD.friend_id AND shared_with = OLD.user_id)
    );

  RETURN OLD;
END;
$$;

-- Attach trigger to friendships table
DROP TRIGGER IF EXISTS trg_cascade_revoke_shares ON friendships;
CREATE TRIGGER trg_cascade_revoke_shares
  BEFORE DELETE ON friendships
  FOR EACH ROW
  EXECUTE FUNCTION cascade_revoke_shares_on_unfriend();

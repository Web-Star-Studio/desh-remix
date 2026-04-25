
-- Update create_workspace_share to accept new modules
CREATE OR REPLACE FUNCTION public.create_workspace_share(
  _shared_with uuid,
  _workspace_id uuid,
  _permission text,
  _share_all boolean,
  _modules text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_friend boolean;
  owns_workspace boolean;
  valid_modules text[] := ARRAY['tasks','notes','calendar','contacts','habits','financegoals','transactions','recurring','budgets'];
  m text;
  new_id uuid;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces WHERE id = _workspace_id AND user_id = auth.uid()
  ) INTO owns_workspace;
  IF NOT owns_workspace THEN
    RAISE EXCEPTION 'You do not own this workspace';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE user_id = auth.uid() AND friend_id = _shared_with
  ) INTO is_friend;
  IF NOT is_friend THEN
    RAISE EXCEPTION 'User is not your friend';
  END IF;

  IF _permission NOT IN ('view', 'edit') THEN
    RAISE EXCEPTION 'Invalid permission';
  END IF;

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

  INSERT INTO public.workspace_shares (owner_id, shared_with, workspace_id, permission, share_all, modules)
  VALUES (auth.uid(), _shared_with, _workspace_id, _permission, _share_all, CASE WHEN _share_all THEN '{}' ELSE _modules END)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- Update get_shared_workspace_data to return new modules
CREATE OR REPLACE FUNCTION public.get_shared_workspace_data(_share_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  share_row RECORD;
  result jsonb := '{}'::jsonb;
  allowed_modules text[];
  mod text;
  mod_data json;
BEGIN
  SELECT * INTO share_row
  FROM public.workspace_shares
  WHERE id = _share_id
    AND shared_with = auth.uid()
    AND status = 'accepted';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Share not found or not accepted';
  END IF;

  IF share_row.share_all THEN
    allowed_modules := ARRAY['tasks','notes','calendar','contacts','habits','financegoals','transactions','recurring','budgets'];
  ELSE
    allowed_modules := share_row.modules;
  END IF;

  FOREACH mod IN ARRAY allowed_modules LOOP
    CASE mod
      WHEN 'tasks' THEN
        SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO mod_data
        FROM (SELECT id, title, status, priority, due_date, project
              FROM tasks WHERE user_id = share_row.owner_id
              AND workspace_id = share_row.workspace_id
              ORDER BY created_at DESC LIMIT 100) t;
      WHEN 'notes' THEN
        SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO mod_data
        FROM (SELECT id, data_type, data, created_at, updated_at
              FROM user_data WHERE user_id = share_row.owner_id
              AND data_type = 'notes'
              AND workspace_id = share_row.workspace_id
              ORDER BY updated_at DESC LIMIT 50) t;
      WHEN 'calendar' THEN
        SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO mod_data
        FROM (SELECT id, data_type, data, created_at
              FROM user_data WHERE user_id = share_row.owner_id
              AND data_type = 'calendar'
              AND workspace_id = share_row.workspace_id
              ORDER BY updated_at DESC LIMIT 100) t;
      WHEN 'contacts' THEN
        SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO mod_data
        FROM (SELECT id, name, email, phone, company, role, tags
              FROM contacts WHERE user_id = share_row.owner_id
              AND workspace_id = share_row.workspace_id
              ORDER BY name ASC LIMIT 200) t;
      WHEN 'habits' THEN
        SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO mod_data
        FROM (SELECT id, data_type, data, created_at
              FROM user_data WHERE user_id = share_row.owner_id
              AND data_type = 'habits'
              AND workspace_id = share_row.workspace_id
              ORDER BY updated_at DESC LIMIT 50) t;
      WHEN 'financegoals' THEN
        SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO mod_data
        FROM (SELECT id, name, target, current, color
              FROM finance_goals WHERE user_id = share_row.owner_id
              AND workspace_id = share_row.workspace_id
              ORDER BY created_at DESC LIMIT 50) t;
      WHEN 'transactions' THEN
        SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO mod_data
        FROM (SELECT id, description, amount, type, category, date
              FROM finance_transactions WHERE user_id = share_row.owner_id
              AND workspace_id = share_row.workspace_id
              ORDER BY date DESC LIMIT 200) t;
      WHEN 'recurring' THEN
        SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO mod_data
        FROM (SELECT id, description, amount, type, category, day_of_month, active
              FROM finance_recurring WHERE user_id = share_row.owner_id
              AND workspace_id = share_row.workspace_id
              ORDER BY created_at DESC LIMIT 100) t;
      WHEN 'budgets' THEN
        SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO mod_data
        FROM (SELECT id, category, monthly_limit
              FROM finance_budgets WHERE user_id = share_row.owner_id
              AND workspace_id = share_row.workspace_id
              ORDER BY category ASC LIMIT 50) t;
      ELSE
        mod_data := '[]'::json;
    END CASE;

    result := result || jsonb_build_object(mod, mod_data);
  END LOOP;

  RETURN result::json;
END;
$$;

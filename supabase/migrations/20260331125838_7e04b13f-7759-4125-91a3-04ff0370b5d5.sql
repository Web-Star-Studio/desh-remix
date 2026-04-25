
CREATE OR REPLACE FUNCTION public.move_financial_connection(
  _connection_id uuid,
  _target_workspace_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  conn_owner uuid;
  caller uuid := auth.uid();
BEGIN
  -- Validate ownership
  SELECT user_id INTO conn_owner
  FROM financial_connections
  WHERE id = _connection_id;

  IF conn_owner IS NULL THEN
    RAISE EXCEPTION 'Connection not found';
  END IF;

  IF conn_owner != caller THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Validate target workspace belongs to user
  IF NOT EXISTS (
    SELECT 1 FROM workspaces
    WHERE id = _target_workspace_id AND user_id = caller
  ) THEN
    RAISE EXCEPTION 'Target workspace not found';
  END IF;

  -- 1. Move the connection itself
  UPDATE financial_connections
  SET workspace_id = _target_workspace_id, updated_at = now()
  WHERE id = _connection_id;

  -- 2. Move all accounts linked to this connection
  UPDATE financial_accounts
  SET workspace_id = _target_workspace_id, updated_at = now()
  WHERE connection_id = _connection_id;

  -- 3. Move investments linked to this connection
  UPDATE financial_investments
  SET workspace_id = _target_workspace_id
  WHERE connection_id = _connection_id;

  -- 4. Move finance_transactions that came from accounts of this connection
  UPDATE finance_transactions
  SET workspace_id = _target_workspace_id
  WHERE user_id = caller
    AND source = 'pluggy'
    AND account_name IN (
      SELECT name FROM financial_accounts WHERE connection_id = _connection_id
    );

  -- 5. Move financial_insights linked to this connection
  UPDATE financial_insights
  SET workspace_id = _target_workspace_id
  WHERE connection_id = _connection_id;
END;
$$;

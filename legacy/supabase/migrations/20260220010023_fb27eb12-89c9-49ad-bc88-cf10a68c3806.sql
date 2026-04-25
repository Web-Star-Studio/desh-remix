
-- Nova tabela widget_shares
CREATE TABLE public.widget_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  shared_with uuid NOT NULL,
  widget_type text NOT NULL,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  permission text NOT NULL DEFAULT 'view',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, shared_with, widget_type, workspace_id)
);

ALTER TABLE public.widget_shares ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Owners can manage their shares"
  ON public.widget_shares FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Recipients can view shares to them"
  ON public.widget_shares FOR SELECT
  USING (auth.uid() = shared_with);

CREATE POLICY "Recipients can update share status"
  ON public.widget_shares FOR UPDATE
  USING (auth.uid() = shared_with);

-- RPC para leitura segura de dados compartilhados
CREATE OR REPLACE FUNCTION public.get_shared_widget_data(
  _share_id uuid,
  _widget_type text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  share_row RECORD;
  result json;
BEGIN
  SELECT * INTO share_row
  FROM public.widget_shares
  WHERE id = _share_id
    AND shared_with = auth.uid()
    AND status = 'accepted';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Share not found or not accepted';
  END IF;

  CASE _widget_type
    WHEN 'tasks' THEN
      SELECT json_agg(row_to_json(t)) INTO result
      FROM (SELECT id, title, status, priority, due_date, project
            FROM tasks WHERE user_id = share_row.owner_id
            AND (share_row.workspace_id IS NULL OR workspace_id = share_row.workspace_id)
            ORDER BY created_at DESC LIMIT 50) t;
    WHEN 'notes' THEN
      SELECT json_agg(row_to_json(t)) INTO result
      FROM (SELECT id, data_type, data, created_at, updated_at
            FROM user_data WHERE user_id = share_row.owner_id
            AND data_type = 'notes'
            AND (share_row.workspace_id IS NULL OR workspace_id = share_row.workspace_id)
            ORDER BY updated_at DESC LIMIT 20) t;
    WHEN 'contacts' THEN
      SELECT json_agg(row_to_json(t)) INTO result
      FROM (SELECT id, name, email, phone, company, role, tags
            FROM contacts WHERE user_id = share_row.owner_id
            AND (share_row.workspace_id IS NULL OR workspace_id = share_row.workspace_id)
            ORDER BY name ASC LIMIT 100) t;
    WHEN 'financegoals' THEN
      SELECT json_agg(row_to_json(t)) INTO result
      FROM (SELECT id, name, target, current, color
            FROM finance_goals WHERE user_id = share_row.owner_id
            AND (share_row.workspace_id IS NULL OR workspace_id = share_row.workspace_id)
            ORDER BY created_at DESC LIMIT 20) t;
    WHEN 'calendar' THEN
      SELECT json_agg(row_to_json(t)) INTO result
      FROM (SELECT id, data_type, data, created_at
            FROM user_data WHERE user_id = share_row.owner_id
            AND data_type = 'calendar'
            AND (share_row.workspace_id IS NULL OR workspace_id = share_row.workspace_id)
            ORDER BY updated_at DESC LIMIT 50) t;
    WHEN 'habits' THEN
      SELECT json_agg(row_to_json(t)) INTO result
      FROM (SELECT id, data_type, data, created_at
            FROM user_data WHERE user_id = share_row.owner_id
            AND data_type = 'habits'
            AND (share_row.workspace_id IS NULL OR workspace_id = share_row.workspace_id)
            ORDER BY updated_at DESC LIMIT 20) t;
    ELSE
      result := '[]'::json;
  END CASE;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Trigger updated_at
CREATE TRIGGER widget_shares_updated_at
  BEFORE UPDATE ON public.widget_shares
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.widget_shares;

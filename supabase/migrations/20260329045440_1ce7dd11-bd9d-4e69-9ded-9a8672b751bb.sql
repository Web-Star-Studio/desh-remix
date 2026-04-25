
-- pandora_sessions: shared state across Chat, MCP, WhatsApp
CREATE TABLE pandora_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  active_channel TEXT NOT NULL DEFAULT 'chat',
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pandora_sessions_user ON pandora_sessions(user_id);
CREATE INDEX idx_pandora_sessions_active ON pandora_sessions(user_id, last_activity_at DESC);

ALTER TABLE pandora_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sessions"
  ON pandora_sessions FOR ALL
  USING (auth.uid() = user_id);

CREATE TRIGGER update_pandora_sessions_updated_at
  BEFORE UPDATE ON pandora_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- pandora_tool_calls: observability for tool executions
CREATE TABLE pandora_tool_calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES pandora_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  tool_category TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  input_params JSONB DEFAULT '{}'::jsonb,
  output_result JSONB DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ DEFAULT NULL,
  completed_at TIMESTAMPTZ DEFAULT NULL,
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3
);

CREATE INDEX idx_tool_calls_session ON pandora_tool_calls(session_id);
CREATE INDEX idx_tool_calls_user_recent ON pandora_tool_calls(user_id, created_at DESC);
CREATE INDEX idx_tool_calls_status ON pandora_tool_calls(status) WHERE status IN ('pending', 'running', 'retry');

ALTER TABLE pandora_tool_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tool calls"
  ON pandora_tool_calls FOR ALL
  USING (auth.uid() = user_id);

-- RPC: get or create active session
CREATE OR REPLACE FUNCTION get_or_create_pandora_session(
  p_user_id UUID,
  p_workspace_id UUID DEFAULT NULL,
  p_channel TEXT DEFAULT 'chat'
)
RETURNS pandora_sessions AS $$
DECLARE
  v_session pandora_sessions;
BEGIN
  SELECT * INTO v_session
  FROM pandora_sessions
  WHERE user_id = p_user_id
    AND (workspace_id = p_workspace_id OR (workspace_id IS NULL AND p_workspace_id IS NULL))
    AND last_activity_at > now() - interval '30 minutes'
  ORDER BY last_activity_at DESC
  LIMIT 1;

  IF v_session IS NULL THEN
    INSERT INTO pandora_sessions (user_id, workspace_id, active_channel)
    VALUES (p_user_id, p_workspace_id, p_channel)
    RETURNING * INTO v_session;
  ELSE
    UPDATE pandora_sessions
    SET active_channel = p_channel,
        last_activity_at = now()
    WHERE id = v_session.id
    RETURNING * INTO v_session;
  END IF;

  RETURN v_session;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- RPC: register tool call with auto-update of session context
CREATE OR REPLACE FUNCTION register_tool_call(
  p_session_id UUID,
  p_user_id UUID,
  p_tool_name TEXT,
  p_tool_category TEXT,
  p_channel TEXT,
  p_input_params JSONB DEFAULT '{}'::jsonb
)
RETURNS pandora_tool_calls AS $$
DECLARE
  v_call pandora_tool_calls;
BEGIN
  INSERT INTO pandora_tool_calls (session_id, user_id, tool_name, tool_category, channel, input_params)
  VALUES (p_session_id, p_user_id, p_tool_name, p_tool_category, p_channel, p_input_params)
  RETURNING * INTO v_call;

  UPDATE pandora_sessions
  SET context_snapshot = jsonb_set(
    jsonb_set(
      context_snapshot,
      '{last_tools_used}',
      (
        SELECT COALESCE(jsonb_agg(tool_name), '[]'::jsonb)
        FROM (
          SELECT tool_name
          FROM pandora_tool_calls
          WHERE session_id = p_session_id
          ORDER BY created_at DESC
          LIMIT 5
        ) sub
      )
    ),
    '{recent_modules}',
    (
      SELECT COALESCE(jsonb_agg(DISTINCT cat), '[]'::jsonb)
      FROM (
        SELECT tool_category as cat
        FROM pandora_tool_calls
        WHERE session_id = p_session_id
        ORDER BY created_at DESC
        LIMIT 10
      ) sub
    )
  ),
  last_activity_at = now()
  WHERE id = p_session_id;

  RETURN v_call;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

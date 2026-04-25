export interface AutomationRule {
  id: string;
  user_id: string;
  name: string;
  enabled: boolean;
  trigger_type: string;
  trigger_config: Record<string, any>;
  action_type: string;
  action_config: Record<string, any>;
  execution_count: number;
  last_executed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationLog {
  id: string;
  rule_id: string;
  user_id: string;
  trigger_data: Record<string, any>;
  action_result: Record<string, any>;
  status: string;
  created_at: string;
}

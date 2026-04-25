export interface AIProject {
  id: string;
  user_id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface AIAgent {
  id: string;
  user_id: string;
  name: string;
  description: string;
  system_prompt: string;
  icon: string;
  color: string;
  model: string;
  temperature: number;
  is_template?: boolean;
  is_active?: boolean;
  template_id?: string | null;
  workspace_id?: string | null;
  category?: string | null;
  skills?: string[] | null;
  tools_enabled?: string[] | null;
  model_override?: string | null;
  temperature_override?: number | null;
  created_at: string;
  updated_at: string;
}

export type AIMessage = { role: "user" | "assistant"; content: string; timestamp?: string };

export interface AIConversation {
  id: string;
  user_id: string;
  title: string;
  agent_id: string | null;
  project_id: string | null;
  messages: AIMessage[];
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

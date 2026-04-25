export interface Workspace {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  // v3 rich context fields
  description?: string | null;
  industry?: string | null;
  context_summary?: string | null;
  system_prompt_override?: string | null;
  default_agent_id?: string | null;
  default_model?: string | null;
  is_personal?: boolean;
  onboarding_completed?: boolean;
  metadata?: Record<string, any>;
}

export interface WorkspacePreferences {
  id: string;
  user_id: string;
  favorite_workspace_id: string | null;
  workspace_order: string[];
  show_all_mode: boolean;
  all_mode_behavior: "read_only" | "favorite_with_confirm";
  created_at: string;
  updated_at: string;
}

export interface WorkspaceDocument {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  content: string;
  doc_type: "context" | "guidelines" | "faq" | "process" | "reference";
  is_active: boolean;
  token_estimate: number | null;
  created_at: string;
  updated_at: string;
}

/** Shape of the workspace context value exposed by WorkspaceProvider */
export interface WorkspaceContextShape {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  activeWorkspaceId: string | null;
  defaultWorkspace: Workspace | null;
  loading: boolean;
  preferences: WorkspacePreferences | null;
  switchWorkspace: (id: string | null) => void;
  setViewAll: () => void;
  createWorkspace: (data: { name: string; icon: string; color: string; description?: string; industry?: string }) => Promise<Workspace | null>;
  updateWorkspace: (id: string, data: Partial<Workspace>) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  setDefaultWorkspace: (id: string) => Promise<void>;
  updatePreferences: (data: Partial<WorkspacePreferences>) => Promise<void>;
}

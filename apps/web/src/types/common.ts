/** Generic API response wrapper */
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status: number;
}

/** Pagination metadata */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Widget share types */
export type WidgetShareType = "tasks" | "notes" | "calendar" | "contacts" | "habits" | "financegoals";
export type SharePermission = "view" | "edit";
export type ShareStatus = "pending" | "accepted" | "rejected" | "revoked";

export interface WidgetShare {
  id: string;
  owner_id: string;
  shared_with: string;
  widget_type: WidgetShareType;
  workspace_id: string | null;
  permission: SharePermission;
  status: ShareStatus;
  created_at: string;
  updated_at: string;
  // Joined data
  owner_name?: string;
  owner_avatar?: string;
  recipient_name?: string;
  recipient_avatar?: string;
}

/** Workspace share types */
export type WorkspaceShareModule = "tasks" | "notes" | "calendar" | "contacts" | "habits" | "financegoals" | "transactions" | "recurring" | "budgets";

export interface WorkspaceShare {
  id: string;
  owner_id: string;
  shared_with: string;
  workspace_id: string;
  permission: SharePermission;
  status: ShareStatus;
  share_all: boolean;
  modules: WorkspaceShareModule[];
  created_at: string;
  updated_at: string;
  // Joined data
  owner_name?: string;
  owner_avatar?: string;
  owner_email?: string;
  recipient_name?: string;
  recipient_avatar?: string;
  recipient_email?: string;
  workspace_name?: string;
  workspace_icon?: string;
  workspace_color?: string;
}

/** Sync queue operation */
export interface QueuedOperation {
  id: string;
  /** Edge function name */
  fn: string;
  /** Request body */
  body: any;
  /** Human-readable label for the indicator */
  label: string;
  /** ISO timestamp when queued */
  queuedAt: string;
  /** Number of retry attempts so far */
  retries: number;
}

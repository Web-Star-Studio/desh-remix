/** Lightweight task model used in DashboardContext */
export interface Task {
  id: string;
  text: string;
  done: boolean;
  priority?: "high" | "medium" | "low";
  created_at?: string;
  workspace_id?: string | null;
}

/** Full task model used in TasksPage / useDbTasks */
export interface DbTask {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  due_date?: string | null;
  project?: string | null;
  description?: string | null;
  recurrence?: string | null;
  completed_at?: string | null;
  subtasks?: DbSubtask[];
  workspace_id?: string | null;
  google_task_id?: string | null;
  google_tasklist_id?: string | null;
}

export interface DbSubtask {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  sort_order: number;
}

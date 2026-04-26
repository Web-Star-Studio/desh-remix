import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useWorkspaceFilter } from "@/hooks/workspace/useWorkspaceFilter";
import { apiFetch } from "@/lib/api-client";

// Types — canonical definitions live in /src/types/tasks.ts
export type { DbTask, DbSubtask } from "@/types/tasks";
import type { DbTask, DbSubtask } from "@/types/tasks";

// Apps/api returns ApiTask in camelCase; the SPA model is snake_case (legacy
// from Supabase). Convert at the boundary so call sites stay unchanged.
interface ApiSubtaskRow {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  sortOrder: number;
}

interface ApiTaskRow {
  id: string;
  workspaceId: string;
  createdBy: string | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string | null;
  project: string | null;
  recurrence: string | null;
  completedAt: string | null;
  googleTaskId: string | null;
  googleTasklistId: string | null;
  createdAt: string;
  updatedAt: string;
  subtasks: ApiSubtaskRow[];
}

function fromApiSubtask(s: ApiSubtaskRow): DbSubtask {
  return {
    id: s.id,
    task_id: s.taskId,
    title: s.title,
    completed: s.completed,
    sort_order: s.sortOrder,
  };
}

function fromApiTask(t: ApiTaskRow): DbTask {
  return {
    id: t.id,
    title: t.title,
    status: t.status as DbTask["status"],
    priority: t.priority as DbTask["priority"],
    due_date: t.dueDate,
    project: t.project,
    description: t.description,
    recurrence: t.recurrence,
    completed_at: t.completedAt,
    workspace_id: t.workspaceId,
    google_task_id: t.googleTaskId,
    google_tasklist_id: t.googleTasklistId,
    subtasks: t.subtasks.map(fromApiSubtask),
  };
}

// PATCH body uses camelCase. Translate the call-site's snake_case partial
// before sending; the helper is generic so caller signatures don't change.
function toApiPatch(updates: Partial<DbTask>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (updates.title !== undefined) out.title = updates.title;
  if (updates.description !== undefined) out.description = updates.description;
  if (updates.status !== undefined) out.status = updates.status;
  if (updates.priority !== undefined) out.priority = updates.priority;
  if (updates.due_date !== undefined) out.dueDate = updates.due_date;
  if (updates.project !== undefined) out.project = updates.project;
  if (updates.recurrence !== undefined) out.recurrence = updates.recurrence;
  if (updates.completed_at !== undefined) out.completedAt = updates.completed_at;
  if (updates.google_task_id !== undefined) out.googleTaskId = updates.google_task_id;
  if (updates.google_tasklist_id !== undefined) out.googleTasklistId = updates.google_tasklist_id;
  return out;
}

export function useDbTasks() {
  const { user } = useAuth();
  const { activeWorkspaceId, getInsertWorkspaceId } = useWorkspaceFilter();
  const [tasks, setTasks] = useState<DbTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const tasksRef = useRef<DbTask[]>([]);
  tasksRef.current = tasks;

  // Resolve a single workspace ID for the read path. activeWorkspaceId can be
  // null (view-all mode); we fall back to the default workspace for that case
  // because /workspaces/:id is workspace-scoped — there's no aggregate
  // endpoint yet. View-all support will require a follow-up route or
  // multi-fetch.
  const readWorkspaceId = activeWorkspaceId ?? getInsertWorkspaceId();

  const fetchTasks = useCallback(async () => {
    if (!user || !readWorkspaceId) {
      setTasks([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const rows = await apiFetch<ApiTaskRow[]>(`/workspaces/${readWorkspaceId}/tasks`);
      setTasks(rows.map(fromApiTask));
    } catch (err) {
      console.error("Error fetching tasks:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user, readWorkspaceId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const addTask = useCallback(async (
    title: string,
    priority: DbTask["priority"] = "medium",
    extra: Partial<Pick<DbTask, "project" | "due_date" | "description" | "recurrence">> = {}
  ) => {
    if (!user) return;
    const wsId = getInsertWorkspaceId();
    if (!wsId) {
      toast({ title: "Erro", description: "Sem workspace ativo.", variant: "destructive" });
      return;
    }
    try {
      const body: Record<string, unknown> = { title, priority };
      if (extra.project !== undefined) body.project = extra.project;
      if (extra.due_date !== undefined) body.dueDate = extra.due_date;
      if (extra.description !== undefined) body.description = extra.description;
      if (extra.recurrence !== undefined) body.recurrence = extra.recurrence;
      const created = await apiFetch<ApiTaskRow>(`/workspaces/${wsId}/tasks`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const dbTask = fromApiTask(created);
      setTasks(prev => [dbTask, ...prev]);
      return dbTask;
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message ?? "Falha ao criar tarefa.", variant: "destructive" });
      return undefined;
    }
  }, [user, getInsertWorkspaceId]);

  const updateTask = useCallback(async (
    id: string,
    updates: Partial<Pick<DbTask, "status" | "priority" | "title" | "project" | "due_date" | "description" | "recurrence" | "completed_at" | "google_task_id" | "google_tasklist_id">>
  ) => {
    const task = tasksRef.current.find(t => t.id === id);
    const wsId = task?.workspace_id ?? readWorkspaceId;
    if (!wsId) return;
    try {
      const updated = await apiFetch<ApiTaskRow>(`/workspaces/${wsId}/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(toApiPatch(updates)),
      });
      const dbTask = fromApiTask(updated);
      setTasks(prev => prev.map(t => t.id === id ? dbTask : t));
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message ?? "Falha ao atualizar tarefa.", variant: "destructive" });
    }
  }, [readWorkspaceId]);

  const deleteTask = useCallback(async (id: string) => {
    const task = tasksRef.current.find(t => t.id === id);
    const wsId = task?.workspace_id ?? readWorkspaceId;
    if (!wsId) return;
    try {
      await apiFetch<void>(`/workspaces/${wsId}/tasks/${id}`, { method: "DELETE" });
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message ?? "Falha ao remover tarefa.", variant: "destructive" });
    }
  }, [readWorkspaceId]);

  const toggleStatus = useCallback(async (id: string) => {
    const task = tasksRef.current.find(t => t.id === id);
    if (!task) return;
    const next: Record<string, DbTask["status"]> = { todo: "in_progress", in_progress: "done", done: "todo" };
    const nextStatus = next[task.status];
    await updateTask(id, {
      status: nextStatus,
      completed_at: nextStatus === "done" ? new Date().toISOString() : null,
    });
  }, [updateTask]);

  // Subtask operations
  const addSubtask = useCallback(async (taskId: string, title: string) => {
    const task = tasksRef.current.find(t => t.id === taskId);
    const wsId = task?.workspace_id ?? readWorkspaceId;
    if (!wsId) return;
    const sortOrder = task?.subtasks?.length ?? 0;
    try {
      const created = await apiFetch<ApiSubtaskRow>(`/workspaces/${wsId}/tasks/${taskId}/subtasks`, {
        method: "POST",
        body: JSON.stringify({ title, sortOrder }),
      });
      const dbSub = fromApiSubtask(created);
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, subtasks: [...(t.subtasks ?? []), dbSub] } : t,
      ));
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message ?? "Falha ao criar subtarefa.", variant: "destructive" });
    }
  }, [readWorkspaceId]);

  const toggleSubtask = useCallback(async (subtaskId: string, taskId: string) => {
    const task = tasksRef.current.find(t => t.id === taskId);
    const subtask = task?.subtasks?.find(s => s.id === subtaskId);
    if (!subtask) return;
    const wsId = task?.workspace_id ?? readWorkspaceId;
    if (!wsId) return;
    try {
      const updated = await apiFetch<ApiSubtaskRow>(
        `/workspaces/${wsId}/tasks/${taskId}/subtasks/${subtaskId}`,
        { method: "PATCH", body: JSON.stringify({ completed: !subtask.completed }) },
      );
      const dbSub = fromApiSubtask(updated);
      setTasks(prev => prev.map(t =>
        t.id === taskId
          ? { ...t, subtasks: t.subtasks?.map(s => s.id === subtaskId ? dbSub : s) }
          : t,
      ));
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message ?? "Falha ao atualizar subtarefa.", variant: "destructive" });
    }
  }, [readWorkspaceId]);

  const deleteSubtask = useCallback(async (subtaskId: string, taskId: string) => {
    const task = tasksRef.current.find(t => t.id === taskId);
    const wsId = task?.workspace_id ?? readWorkspaceId;
    if (!wsId) return;
    try {
      await apiFetch<void>(
        `/workspaces/${wsId}/tasks/${taskId}/subtasks/${subtaskId}`,
        { method: "DELETE" },
      );
      setTasks(prev => prev.map(t =>
        t.id === taskId
          ? { ...t, subtasks: t.subtasks?.filter(s => s.id !== subtaskId) }
          : t,
      ));
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message ?? "Falha ao remover subtarefa.", variant: "destructive" });
    }
  }, [readWorkspaceId]);

  const addMultipleSubtasks = useCallback(async (taskId: string, titles: string[]) => {
    const task = tasksRef.current.find(t => t.id === taskId);
    const wsId = task?.workspace_id ?? readWorkspaceId;
    if (!wsId) return;
    const startOrder = task?.subtasks?.length ?? 0;
    // The REST API only ships single-subtask create; sequence the inserts so
    // the optimistic state stays in order. Cheap for the small N that the AI
    // assist usually returns (≤10 subtasks).
    try {
      const created: DbSubtask[] = [];
      for (let i = 0; i < titles.length; i++) {
        const row = await apiFetch<ApiSubtaskRow>(`/workspaces/${wsId}/tasks/${taskId}/subtasks`, {
          method: "POST",
          body: JSON.stringify({ title: titles[i], sortOrder: startOrder + i }),
        });
        created.push(fromApiSubtask(row));
      }
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, subtasks: [...(t.subtasks ?? []), ...created] } : t,
      ));
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message ?? "Falha ao criar subtarefas.", variant: "destructive" });
    }
  }, [readWorkspaceId]);

  return {
    tasks, isLoading, addTask, updateTask, deleteTask, toggleStatus,
    addSubtask, toggleSubtask, deleteSubtask, addMultipleSubtasks,
    refetch: fetchTasks,
  };
}

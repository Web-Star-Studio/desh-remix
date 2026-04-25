// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useWorkspaceFilter } from "@/hooks/workspace/useWorkspaceFilter";

// Types — canonical definitions live in /src/types/tasks.ts
export type { DbTask, DbSubtask } from "@/types/tasks";
import type { DbTask, DbSubtask } from "@/types/tasks";

export function useDbTasks() {
  const { user } = useAuth();
  const { activeWorkspaceId, getInsertWorkspaceId } = useWorkspaceFilter();
  const [tasks, setTasks] = useState<DbTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const tasksRef = useRef<DbTask[]>([]);
  tasksRef.current = tasks;

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    let tasksQuery = supabase
      .from("tasks")
      .select("id, title, status, priority, due_date, project, description, recurrence, completed_at, workspace_id, google_task_id, google_tasklist_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (activeWorkspaceId) {
      tasksQuery = tasksQuery.eq("workspace_id", activeWorkspaceId);
    }

    const tasksRes = await tasksQuery;

    if (tasksRes.error) {
      console.error("Error fetching tasks:", tasksRes.error);
      setIsLoading(false);
      return;
    }

    const taskIds = (tasksRes.data || []).map((t: any) => t.id);

    let subtasksData: any[] = [];
    if (taskIds.length > 0) {
      const { data } = await supabase
        .from("task_subtasks")
        .select("id, task_id, title, completed, sort_order")
        .in("task_id", taskIds)
        .order("sort_order", { ascending: true });
      subtasksData = data || [];
    }

    const subtasksByTask: Record<string, DbSubtask[]> = {};
    subtasksData.forEach((s: any) => {
      if (!subtasksByTask[s.task_id]) subtasksByTask[s.task_id] = [];
      subtasksByTask[s.task_id].push(s as DbSubtask);
    });

    const result = (tasksRes.data || []).map((t: any) => ({
      ...t,
      subtasks: subtasksByTask[t.id] || [],
    })) as DbTask[];

    setTasks(result);
    setIsLoading(false);
  }, [user, activeWorkspaceId]);

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
    const { data, error } = await supabase
      .from("tasks")
      .insert({ title, priority, user_id: user.id, ...(wsId ? { workspace_id: wsId } : {}), ...extra } as any)
      .select("id, title, status, priority, due_date, project, description, recurrence, completed_at, workspace_id, google_task_id, google_tasklist_id")
      .single();

    if (error) {
      toast({ title: "Erro", description: "Falha ao criar tarefa.", variant: "destructive" });
    } else if (data) {
      setTasks(prev => [{ ...(data as DbTask), subtasks: [] }, ...prev]);
    }
    return data as DbTask | undefined;
  }, [user, getInsertWorkspaceId]);

  // Update including google_task_id support
  const updateTask = useCallback(async (
    id: string,
    updates: Partial<Pick<DbTask, "status" | "priority" | "title" | "project" | "due_date" | "description" | "recurrence" | "completed_at" | "google_task_id" | "google_tasklist_id">>
  ) => {
    const { error } = await supabase
      .from("tasks")
      .update(updates as any)
      .eq("id", id);

    if (error) {
      toast({ title: "Erro", description: "Falha ao atualizar tarefa.", variant: "destructive" });
    } else {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    }
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Erro", description: "Falha ao remover tarefa.", variant: "destructive" });
    } else {
      setTasks(prev => prev.filter(t => t.id !== id));
    }
  }, []);

  const toggleStatus = useCallback(async (id: string) => {
    const task = tasksRef.current.find(t => t.id === id);
    if (!task) return;
    const next: Record<string, DbTask["status"]> = { todo: "in_progress", in_progress: "done", done: "todo" };
    const nextStatus = next[task.status];
    await updateTask(id, {
      status: nextStatus,
      completed_at: nextStatus === "done" ? new Date().toISOString() : null
    });
  }, [updateTask]);

  // Subtask operations
  const addSubtask = useCallback(async (taskId: string, title: string) => {
    const task = tasksRef.current.find(t => t.id === taskId);
    const sortOrder = task?.subtasks?.length || 0;

    const { data, error } = await supabase
      .from("task_subtasks")
      .insert({ task_id: taskId, title, sort_order: sortOrder })
      .select("id, task_id, title, completed, sort_order")
      .single();

    if (error) {
      toast({ title: "Erro", description: "Falha ao criar subtarefa.", variant: "destructive" });
    } else if (data) {
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, subtasks: [...(t.subtasks || []), data as DbSubtask] } : t
      ));
    }
  }, []);

  const toggleSubtask = useCallback(async (subtaskId: string, taskId: string) => {
    const task = tasksRef.current.find(t => t.id === taskId);
    const subtask = task?.subtasks?.find(s => s.id === subtaskId);
    if (!subtask) return;

    const { error } = await supabase
      .from("task_subtasks")
      .update({ completed: !subtask.completed })
      .eq("id", subtaskId);

    if (error) {
      toast({ title: "Erro", description: "Falha ao atualizar subtarefa.", variant: "destructive" });
    } else {
      setTasks(prev => prev.map(t =>
        t.id === taskId
          ? { ...t, subtasks: t.subtasks?.map(s => s.id === subtaskId ? { ...s, completed: !s.completed } : s) }
          : t
      ));
    }
  }, []);

  const deleteSubtask = useCallback(async (subtaskId: string, taskId: string) => {
    const { error } = await supabase
      .from("task_subtasks")
      .delete()
      .eq("id", subtaskId);

    if (error) {
      toast({ title: "Erro", description: "Falha ao remover subtarefa.", variant: "destructive" });
    } else {
      setTasks(prev => prev.map(t =>
        t.id === taskId
          ? { ...t, subtasks: t.subtasks?.filter(s => s.id !== subtaskId) }
          : t
      ));
    }
  }, []);

  const addMultipleSubtasks = useCallback(async (taskId: string, titles: string[]) => {
    const task = tasksRef.current.find(t => t.id === taskId);
    const startOrder = task?.subtasks?.length || 0;

    const rows = titles.map((title, i) => ({
      task_id: taskId,
      title,
      sort_order: startOrder + i,
    }));

    const { data, error } = await supabase
      .from("task_subtasks")
      .insert(rows)
      .select("id, task_id, title, completed, sort_order");

    if (error) {
      toast({ title: "Erro", description: "Falha ao criar subtarefas.", variant: "destructive" });
    } else if (data) {
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, subtasks: [...(t.subtasks || []), ...(data as DbSubtask[])] } : t
      ));
    }
  }, []);

  return {
    tasks, isLoading, addTask, updateTask, deleteTask, toggleStatus,
    addSubtask, toggleSubtask, deleteSubtask, addMultipleSubtasks,
    refetch: fetchTasks,
  };
}

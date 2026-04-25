import React from "react";
import { AlertTriangle, Clock, Calendar } from "lucide-react";
/**
 * useTasksPageState – Extracts all state, handlers, and derived data from TasksPage
 * into a single composable hook, keeping the page component focused on rendering.
 */
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import canvasConfetti from "canvas-confetti";
import { toast } from "@/hooks/use-toast";
import { useConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import { useConnections } from "@/contexts/ConnectionsContext";
import { useDbTasks, type DbTask } from "@/hooks/tasks/useDbTasks";
import { useGoogleServiceData } from "@/hooks/integrations/useGoogleServiceData";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { useComposioWorkspaceId } from "@/hooks/integrations/useComposioWorkspaceId";
import { priorityLabels } from "@/lib/taskConstants";
import { calculateStreak } from "@/lib/taskUtils";

export function useTasksPageState() {
  const { invoke: rawInvoke } = useEdgeFn();
  const _composioWsId = useComposioWorkspaceId();
  const invoke = useCallback(<T = any>(o: Parameters<typeof rawInvoke<T>>[0]) => {
    if (o.fn === "composio-proxy" && o.body && typeof o.body === "object") {
      return rawInvoke<T>({ ...o, body: { ...o.body, workspace_id: _composioWsId } });
    }
    return rawInvoke<T>(o);
  }, [rawInvoke, _composioWsId]);

  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const { getConnectionByCategory } = useConnections();
  const navigate = useNavigate();

  const {
    data: googleTasks, isLoading: googleTasksLoading, isConnected: googleTasksConnected,
    connectionNames: googleTasksNames, refetch: googleTasksRefetch,
    needsScope: tasksNeedsScope, requestScope: tasksRequestScope,
  } = useGoogleServiceData<any[]>({
    service: "tasks",
    path: "/lists/@default/tasks",
    params: { maxResults: "100", showCompleted: "true" },
  });

  const isConnected = googleTasksConnected;

  const {
    tasks, isLoading: dbLoading, addTask, updateTask, toggleStatus, deleteTask,
    addSubtask, toggleSubtask, deleteSubtask, addMultipleSubtasks, refetch: refetchTasks,
  } = useDbTasks();

  // ── UI State ──
  const [viewMode, setViewMode] = useState<"list" | "kanban" | "stats">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<DbTask["priority"]>("medium");
  const [newProject, setNewProject] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newRecurrence, setNewRecurrence] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterDue, setFilterDue] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState<DbTask["priority"]>("medium");
  const [editProject, setEditProject] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editRecurrence, setEditRecurrence] = useState("");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [dayPlan, setDayPlan] = useState<any>(null);
  const [aiSuggestResult, setAiSuggestResult] = useState<{ priority: string; project: string } | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<"default" | "priority" | "due" | "project">("default");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const autoSuggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newDueDateRef = useRef(newDueDate);
  newDueDateRef.current = newDueDate;

  // Cleanup auto-suggest timer on unmount
  useEffect(() => {
    return () => { if (autoSuggestTimerRef.current) clearTimeout(autoSuggestTimerRef.current); };
  }, []);

  // ── Derived ──
  const streak = useMemo(() => calculateStreak(tasks), [tasks]);
  const isLoading = dbLoading || googleTasksLoading;
  const today = new Date().toISOString().split("T")[0];

  const projects = useMemo(() => {
    const set = new Set(tasks.filter(t => t.project).map(t => t.project!));
    return Array.from(set).sort();
  }, [tasks]);

  const activeFiltersCount = [filterPriority, filterProject, filterDue].filter(f => f !== "all").length;

  const filtered = useMemo(() => {
    let result = tasks;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q) || t.project?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
    }
    if (filterPriority !== "all") result = result.filter(t => t.priority === filterPriority);
    if (filterProject !== "all") result = result.filter(t => t.project === filterProject);
    if (filterDue === "overdue") result = result.filter(t => t.due_date && t.due_date < today);
    else if (filterDue === "today") result = result.filter(t => t.due_date === today);
    else if (filterDue === "week") {
      const weekLater = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
      result = result.filter(t => t.due_date && t.due_date >= today && t.due_date <= weekLater);
    } else if (filterDue === "none") result = result.filter(t => !t.due_date);

    const PRIORITY_W = { high: 3, medium: 2, low: 1 };
    if (sortMode === "priority") result = [...result].sort((a, b) => (PRIORITY_W[b.priority] || 0) - (PRIORITY_W[a.priority] || 0));
    else if (sortMode === "due") result = [...result].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });
    else if (sortMode === "project") result = [...result].sort((a, b) => (a.project || "").localeCompare(b.project || ""));
    return result;
  }, [tasks, searchQuery, filterPriority, filterProject, filterDue, today, sortMode]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter(t => t.status === "done").length;
    const inProgress = tasks.filter(t => t.status === "in_progress").length;
    const overdue = tasks.filter(t => t.due_date && t.due_date < today && t.status !== "done").length;
    const recurring = tasks.filter(t => t.recurrence).length;
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const doneThisWeek = tasks.filter(t => t.completed_at && t.completed_at >= weekAgo).length;
    const byProject: Record<string, { total: number; done: number }> = {};
    tasks.forEach(t => {
      const p = t.project || "Sem projeto";
      if (!byProject[p]) byProject[p] = { total: 0, done: 0 };
      byProject[p].total++;
      if (t.status === "done") byProject[p].done++;
    });
    const byPriority = { high: 0, medium: 0, low: 0 };
    tasks.filter(t => t.status !== "done").forEach(t => byPriority[t.priority]++);
    return { total, done, inProgress, overdue, recurring, doneThisWeek, byProject, byPriority };
  }, [tasks, today]);

  const urgentTask = useMemo(() => {
    return tasks
      .filter(t => t.status !== "done" && t.due_date && t.due_date <= today)
      .sort((a, b) => {
        const pw: Record<string, number> = { high: 3, medium: 2, low: 1 };
        return (pw[b.priority] || 0) - (pw[a.priority] || 0);
      })[0] || null;
  }, [tasks, today]);

  // ── Google Tasks sync ──
  const syncToGoogle = useCallback(async (action: "create" | "update" | "delete", title?: string, opts?: { due?: string; status?: string; googleTaskId?: string }) => {
    if (!googleTasksConnected) return null;
    const STATUS_MAP: Record<string, string> = { todo: "needsAction", in_progress: "needsAction", done: "completed" };
    try {
      if (action === "create") {
        const body: any = { title };
        if (opts?.due) body.due = `${opts.due}T12:00:00.000Z`;
        const { data } = await invoke<any>({ fn: "composio-proxy", body: { service: "tasks", path: "/lists/@default/tasks", method: "POST", body } });
        return data;
      } else if (action === "update" && opts?.googleTaskId) {
        const body: any = {};
        if (title) body.title = title;
        if (opts.status) body.status = STATUS_MAP[opts.status] ?? "needsAction";
        if (opts.due) body.due = `${opts.due}T12:00:00.000Z`;
        await invoke<any>({ fn: "composio-proxy", body: { service: "tasks", path: `/lists/@default/tasks/${opts.googleTaskId}`, method: "PATCH", body } });
      } else if (action === "delete" && opts?.googleTaskId) {
        await invoke<any>({ fn: "composio-proxy", body: { service: "tasks", path: `/lists/@default/tasks/${opts.googleTaskId}`, method: "DELETE" } });
      }
    } catch (err) { console.warn("Google Tasks sync error:", err); }
    return null;
  }, [googleTasksConnected, invoke]);

  // ── Import Google Tasks ──
  const handleImportGoogleTasks = useCallback(async () => {
    if (!googleTasks || googleTasks.length === 0) return;
    setImporting(true);
    let imported = 0;
    let linked = 0;
    try {
      const existingGoogleIds = new Set(tasks.map((t: any) => t.google_task_id).filter(Boolean));
      for (const gt of googleTasks as any[]) {
        if (!gt.id || existingGoogleIds.has(gt.id)) continue;
        const due = gt.due ? gt.due.split("T")[0] : null;
        const matchByTitle = tasks.find(t =>
          !t.google_task_id && t.title.toLowerCase().trim() === (gt.title || "").toLowerCase().trim() && (t.due_date || null) === due
        );
        if (matchByTitle) {
          await updateTask(matchByTitle.id, { google_task_id: gt.id } as any);
          linked++;
          existingGoogleIds.add(gt.id);
          continue;
        }
        const newTask = await addTask(gt.title || "Tarefa importada", "medium", { due_date: due, description: gt.notes || null });
        if (newTask?.id) { await updateTask(newTask.id, { google_task_id: gt.id } as any); imported++; }
      }
      const parts = [];
      if (imported > 0) parts.push(`${imported} importada(s)`);
      if (linked > 0) parts.push(`${linked} vinculada(s)`);
      toast({ title: parts.length ? parts.join(" • ") : "Tudo sincronizado!", description: "Google Tasks ✓" });
    } catch (err: any) {
      toast({ title: "Erro ao importar", description: err?.message, variant: "destructive" });
    } finally { setImporting(false); }
  }, [googleTasks, tasks, addTask, updateTask]);

  // Auto-import on first connection
  useEffect(() => {
    if (googleTasksConnected && googleTasks && googleTasks.length > 0 && !sessionStorage.getItem("desh-gtasks-auto-imported")) {
      sessionStorage.setItem("desh-gtasks-auto-imported", "1");
      handleImportGoogleTasks();
    }
  }, [googleTasksConnected, googleTasks, handleImportGoogleTasks]);

  // ── Handlers ──
  const handleTitleChange = useCallback((val: string) => {
    setNewTitle(val);
    setAiSuggestResult(null);
    if (autoSuggestTimerRef.current) clearTimeout(autoSuggestTimerRef.current);
    if (val.trim().length >= 5) {
      autoSuggestTimerRef.current = setTimeout(async () => {
        try {
          const { data } = await invoke<any>({ fn: "ai-router", body: { module: "tasks", action: "suggest_priority", task: { title: val } } });
          if (data?.result?.priority) {
            setAiSuggestResult({ priority: data.result.priority, project: data.result.project || "" });
            setNewPriority(data.result.priority);
            if (data.result.project) setNewProject(data.result.project);
            if (data.result.suggested_due && !newDueDateRef.current) setNewDueDate(data.result.suggested_due);
          }
        } catch { /* silent */ }
      }, 900);
    }
  }, [invoke]);

  const handleAdd = useCallback(async () => {
    if (!newTitle.trim()) return;
    const newTask = await addTask(newTitle.trim(), newPriority, {
      project: newProject.trim() || null,
      due_date: newDueDate || null,
      recurrence: newRecurrence || null,
    });
    const googleData = await syncToGoogle("create", newTitle.trim(), { due: newDueDate || undefined });
    if (googleData?.id && newTask?.id) {
      await updateTask(newTask.id, { google_task_id: googleData.id } as any);
    }
    googleTasksRefetch();
    setNewTitle(""); setNewProject(""); setNewDueDate(""); setNewPriority("medium"); setNewRecurrence("");
  }, [newTitle, newPriority, newProject, newDueDate, newRecurrence, addTask, syncToGoogle, updateTask, googleTasksRefetch]);

  const startEdit = useCallback((task: DbTask) => {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditPriority(task.priority);
    setEditProject(task.project || "");
    setEditDueDate(task.due_date || "");
    setEditDescription(task.description || "");
    setEditRecurrence(task.recurrence || "");
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId || !editTitle.trim()) return;
    const task = tasks.find(t => t.id === editingId);
    await updateTask(editingId, {
      title: editTitle.trim(), priority: editPriority, project: editProject.trim() || null,
      due_date: editDueDate || null, description: editDescription.trim() || null, recurrence: editRecurrence || null,
    });
    const googleTaskId = (task as any)?.google_task_id || googleTasks.find((g: any) => g.title === task?.title)?.id;
    if (googleTaskId) await syncToGoogle("update", editTitle.trim(), { due: editDueDate || undefined, googleTaskId });
    setEditingId(null);
  }, [editingId, editTitle, editPriority, editProject, editDueDate, editDescription, editRecurrence, tasks, updateTask, googleTasks, syncToGoogle]);

  const handleAddSubtask = useCallback(async (taskId: string) => {
    if (!newSubtaskTitle.trim()) return;
    await addSubtask(taskId, newSubtaskTitle.trim());
    if (googleTasksConnected) {
      const parentTask = tasks.find(t => t.id === taskId);
      const parentGoogleId = (parentTask as any)?.google_task_id;
      if (parentGoogleId) {
        try {
          await invoke<any>({ fn: "composio-proxy", body: { service: "tasks", path: `/lists/@default/tasks`, method: "POST", body: { title: newSubtaskTitle.trim(), parent: parentGoogleId } } });
        } catch (err) { console.warn("Google subtask sync error:", err); }
      }
    }
    setNewSubtaskTitle("");
  }, [newSubtaskTitle, addSubtask, googleTasksConnected, tasks, invoke]);

  const handleAiSuggest = useCallback(async () => {
    if (!newTitle.trim()) return;
    setAiLoading("new");
    try {
      const { data, error } = await invoke<any>({ fn: "ai-router", body: { module: "tasks", action: "suggest_priority", task: { title: newTitle } } });
      if (error) throw new Error(error);
      const r = data.result;
      if (r.priority) setNewPriority(r.priority);
      if (r.project) setNewProject(r.project);
      if (r.suggested_due && !newDueDate) setNewDueDate(r.suggested_due);
      toast({ title: "IA sugeriu", description: `Prioridade: ${priorityLabels[r.priority] || r.priority}${r.estimate ? ` • ${r.estimate}` : ""}${r.project ? ` • ${r.project}` : ""}${r.suggested_due ? ` • Prazo: ${r.suggested_due}` : ""}` });
    } catch (err: any) {
      toast({ title: "Erro na IA", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally { setAiLoading(null); }
  }, [newTitle, newDueDate, invoke]);

  const handleAiBreak = useCallback(async (task: DbTask) => {
    setAiLoading(task.id);
    try {
      const { data, error } = await invoke<any>({ fn: "ai-router", body: { module: "tasks", action: "break_into_subtasks", task: { title: task.title, description: task.description } } });
      if (error) throw new Error(error);
      if (data.result?.subtasks) {
        await addMultipleSubtasks(task.id, data.result.subtasks);
        setExpandedId(task.id);
        toast({ title: "Subtarefas criadas!", description: `${data.result.subtasks.length} subtarefas adicionadas` });
      }
    } catch (err: any) {
      toast({ title: "Erro na IA", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally { setAiLoading(null); }
  }, [addMultipleSubtasks, invoke]);

  const handleAiPlanDay = useCallback(async () => {
    setAiLoading("plan");
    try {
      const pendingTasks = tasks.filter(t => t.status !== "done").map(t => ({
        id: t.id, title: t.title, priority: t.priority, project: t.project,
        due_date: t.due_date, subtasks_count: t.subtasks?.length || 0,
      }));
      const { data, error } = await invoke<any>({ fn: "ai-router", body: { module: "tasks", action: "plan_day", tasks: pendingTasks } });
      if (error) throw new Error(error);
      setDayPlan(data.result);
      toast({ title: "Plano do dia gerado!" });
    } catch (err: any) {
      toast({ title: "Erro na IA", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally { setAiLoading(null); }
  }, [tasks, invoke]);

  const handleDuplicate = useCallback(async (task: DbTask) => {
    const newTask = await addTask(`${task.title} (cópia)`, task.priority, {
      project: task.project, due_date: task.due_date, description: task.description, recurrence: task.recurrence,
    });
    if (newTask && task.subtasks?.length) await addMultipleSubtasks(newTask.id, task.subtasks.map(s => s.title));
    toast({ title: "Tarefa duplicada!" });
  }, [addTask, addMultipleSubtasks]);

  const handleDeleteTask = useCallback(async (task: DbTask) => {
    const ok = await confirm({ title: "Excluir tarefa?", description: `"${task.title}" será excluída permanentemente.`, confirmLabel: "Excluir" });
    if (!ok) return;
    const googleTaskId = (task as any)?.google_task_id || googleTasks.find((g: any) => g.title === task.title)?.id;
    if (googleTaskId) await syncToGoogle("delete", undefined, { googleTaskId });
    await deleteTask(task.id);
  }, [confirm, googleTasks, syncToGoogle, deleteTask]);

  const handleToggleStatus = useCallback(async (task: DbTask) => {
    await toggleStatus(task.id);
    const nextStatus = task.status === "todo" ? "in_progress" : task.status === "in_progress" ? "done" : "todo";
    if (nextStatus === "done") canvasConfetti({ particleCount: 50, spread: 45, origin: { y: 0.7 } });
    const googleTaskId = (task as any)?.google_task_id || googleTasks.find((g: any) => g.title === task.title)?.id;
    if (googleTaskId) await syncToGoogle("update", undefined, { status: nextStatus, googleTaskId });
  }, [toggleStatus, googleTasks, syncToGoogle]);

  // ── Batch ──
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);
  const selectAll = useCallback(() => setSelectedIds(new Set(filtered.map(t => t.id))), [filtered]);

  const handleBatchDelete = useCallback(async () => {
    const count = selectedIds.size;
    const ok = await confirm({ title: `Excluir ${count} tarefa(s)?`, description: `${count} tarefa(s) será(ão) excluída(s) permanentemente.`, confirmLabel: "Excluir" });
    if (!ok) return;
    for (const id of selectedIds) {
      const task = tasks.find(t => t.id === id);
      const googleTaskId = (task as any)?.google_task_id;
      if (googleTaskId) await syncToGoogle("delete", undefined, { googleTaskId });
      await deleteTask(id);
    }
    setSelectedIds(new Set());
    toast({ title: `${count} tarefa(s) excluída(s)` });
  }, [selectedIds, tasks, deleteTask, syncToGoogle, confirm]);

  const handleBatchStatus = useCallback(async (status: DbTask["status"]) => {
    for (const id of selectedIds) {
      await updateTask(id, { status, completed_at: status === "done" ? new Date().toISOString() : null });
    }
    setSelectedIds(new Set());
    toast({ title: `${selectedIds.size} tarefa(s) movidas para ${status}` });
    if (status === "done") canvasConfetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
  }, [selectedIds, updateTask]);

  const handleBatchPriority = useCallback(async (priority: DbTask["priority"]) => {
    for (const id of selectedIds) await updateTask(id, { priority });
    setSelectedIds(new Set());
    toast({ title: `Prioridade alterada para ${priorityLabels[priority]}` });
  }, [selectedIds, updateTask]);

  // ── Drag & Drop ──
  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    setDraggedId(taskId);
    e.dataTransfer.effectAllowed = "move";
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent, status: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(status);
  }, []);
  const handleDragLeave = useCallback(() => setDragOverCol(null), []);
  const handleDrop = useCallback(async (e: React.DragEvent, newStatus: DbTask["status"]) => {
    e.preventDefault();
    setDragOverCol(null);
    if (!draggedId) return;
    const task = tasks.find(t => t.id === draggedId);
    if (task && task.status !== newStatus) {
      await updateTask(draggedId, { status: newStatus, completed_at: newStatus === "done" ? new Date().toISOString() : null });
      const googleTaskId = (task as any)?.google_task_id || googleTasks.find((g: any) => g.title === task.title)?.id;
      if (googleTaskId) await syncToGoogle("update", undefined, { status: newStatus, googleTaskId });
    }
    setDraggedId(null);
  }, [draggedId, tasks, updateTask, googleTasks, syncToGoogle]);
  const handleDragEnd = useCallback(() => { setDraggedId(null); setDragOverCol(null); }, []);

  // ── Helpers ──
  const getProgress = useCallback((task: DbTask) => {
    if (!task.subtasks?.length) return null;
    const done = task.subtasks.filter(s => s.completed).length;
    return { done, total: task.subtasks.length, pct: Math.round((done / task.subtasks.length) * 100) };
  }, []);

  const getProjectColor = useCallback((project: string) => {
    const COLORS = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-rose-500", "bg-amber-500", "bg-cyan-500", "bg-pink-500", "bg-indigo-500"];
    const seed = [...project].reduce((a, c) => a + c.charCodeAt(0), 0);
    return COLORS[seed % COLORS.length];
  }, []);

  const getDueBadge = useCallback((task: DbTask) => {
    if (!task.due_date || task.status === "done") return null;
    const diff = Math.ceil((new Date(task.due_date).getTime() - new Date(today).getTime()) / 86400000);
    if (diff < 0) return { label: `${Math.abs(diff)}d atrasada`, cls: "text-destructive bg-destructive/10", icon: React.createElement(AlertTriangle, { className: "w-2.5 h-2.5" }) };
    if (diff === 0) return { label: "Hoje", cls: "text-yellow-500 bg-yellow-500/10", icon: React.createElement(Clock, { className: "w-2.5 h-2.5" }) };
    if (diff <= 3) return { label: `${diff}d`, cls: "text-orange-400 bg-orange-400/10", icon: React.createElement(Calendar, { className: "w-2.5 h-2.5" }) };
    return { label: task.due_date.slice(5), cls: "text-muted-foreground bg-foreground/5", icon: React.createElement(Calendar, { className: "w-2.5 h-2.5" }) };
  }, [today]);

  const clearFilters = useCallback(() => {
    setFilterPriority("all"); setFilterProject("all"); setFilterDue("all");
  }, []);

  const resetNewTask = useCallback(() => {
    setNewTitle(""); setNewProject(""); setNewDueDate(""); setNewPriority("medium"); setNewRecurrence("");
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName);
      if (e.key === "Escape") {
        if (editingId) { setEditingId(null); e.preventDefault(); }
        else if (expandedId) { setExpandedId(null); e.preventDefault(); }
        else if (selectMode) { setSelectMode(false); setSelectedIds(new Set()); e.preventDefault(); }
        else if (dayPlan) { setDayPlan(null); e.preventDefault(); }
      }
      if (isInput) return;
      if (e.key === "/" && !isInput) { e.preventDefault(); searchInputRef.current?.focus(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "n") { e.preventDefault(); document.querySelector<HTMLInputElement>('input[placeholder="Nova tarefa..."]')?.focus(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "a" && selectMode) { e.preventDefault(); selectAll(); }
      if ((e.key === "Delete" || e.key === "Backspace") && selectMode && selectedIds.size > 0 && !isInput) { e.preventDefault(); handleBatchDelete(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editingId, expandedId, selectMode, selectedIds, dayPlan, selectAll, handleBatchDelete]);

  const handleCreateFromTemplate = useCallback(async (title: string, priority: DbTask["priority"], project: string | null, subtasks?: string[]) => {
    const task = await addTask(title, priority, { project: project || null });
    if (task && subtasks?.length) {
      await addMultipleSubtasks(task.id, subtasks);
      setExpandedId(task.id);
    }
  }, [addTask, addMultipleSubtasks]);

  return {
    // Navigation
    navigate,
    // Data
    tasks, filtered, stats, streak, urgentTask, projects, googleTasks, googleTasksNames,
    // Loading states
    isLoading, dbLoading, googleTasksLoading, importing, aiLoading,
    // Connection
    isConnected, googleTasksConnected, tasksNeedsScope, tasksRequestScope,
    // View state
    viewMode, setViewMode, searchQuery, setSearchQuery, showFilters, setShowFilters,
    sortMode, setSortMode, activeFiltersCount,
    // Filters
    filterPriority, setFilterPriority, filterProject, setFilterProject, filterDue, setFilterDue, clearFilters,
    // New task
    newTitle, newPriority, setNewPriority, newProject, setNewProject, newDueDate, setNewDueDate, newRecurrence, setNewRecurrence,
    aiSuggestResult, handleTitleChange, handleAdd, handleAiSuggest, resetNewTask,
    // Edit
    editingId, setEditingId, editTitle, setEditTitle, editPriority, setEditPriority,
    editProject, setEditProject, editDueDate, setEditDueDate, editDescription, setEditDescription,
    editRecurrence, setEditRecurrence, startEdit, saveEdit,
    // Subtasks
    newSubtaskTitle, setNewSubtaskTitle, handleAddSubtask, toggleSubtask, deleteSubtask,
    // Task actions
    handleToggleStatus, handleDeleteTask, handleDuplicate, handleAiBreak, handleAiPlanDay, handleImportGoogleTasks,
    refetchTasks, addMultipleSubtasks,
    // Expand / Focus
    expandedId, setExpandedId, focusTaskId, setFocusTaskId,
    // Selection / batch
    selectMode, setSelectMode, selectedIds, setSelectedIds, toggleSelect, selectAll,
    handleBatchDelete, handleBatchStatus, handleBatchPriority,
    // Drag & drop
    draggedId, dragOverCol, handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd,
    // Day plan
    dayPlan, setDayPlan,
    // Helpers
    getProgress, getProjectColor, getDueBadge, today,
    // Refs
    searchInputRef,
    // Template
    handleCreateFromTemplate,
    // Dialogs
    confirmDialog,
    // Google Tasks refetch
    googleTasksRefetch,
  };
}
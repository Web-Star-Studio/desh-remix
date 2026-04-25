import React, { useState, useMemo, useCallback, useRef } from "react";
import DeshTooltip from "@/components/ui/DeshTooltip";
import { useNavigate } from "react-router-dom";
import GlassCard from "./GlassCard";
import WidgetEmptyState from "./WidgetEmptyState";
import WidgetTitle from "./WidgetTitle";
import ConnectionBadge from "./ConnectionBadge";
import GoogleSyncTimestamp from "./GoogleSyncTimestamp";
import WorkspaceBadge from "./WorkspaceBadge";
import ScopeRequestBanner from "./ScopeRequestBanner";
import { useDbTasks, type DbTask } from "@/hooks/tasks/useDbTasks";
import { useConnections } from "@/contexts/ConnectionsContext";
import { useGoogleServiceData } from "@/hooks/integrations/useGoogleServiceData";
import { useGoogleData } from "@/hooks/files/useGoogleData";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, Circle, ListTodo, Plus, Trash2, X, AlertTriangle,
  ArrowDown, ArrowRight, Loader2, ExternalLink, Search, Sparkles,
  BarChart3, Zap, Clock, Target, TrendingUp, Filter, ChevronRight,
  Star, Copy, CalendarDays
} from "lucide-react";

/** Lightweight view model for the widget UI */
interface WidgetTask {
  id: string;
  text: string;
  done: boolean;
  priority: "high" | "medium" | "low";
  workspace_id?: string | null;
  google_task_id?: string | null;
  google_tasklist_id?: string | null;
}

const PRIORITY_CONFIG = {
  high: { icon: AlertTriangle, label: "Alta", class: "text-destructive", bg: "bg-destructive/15" },
  medium: { icon: ArrowRight, label: "Média", class: "text-warning", bg: "bg-warning/15" },
  low: { icon: ArrowDown, label: "Baixa", class: "text-primary", bg: "bg-primary/15" },
};

const TasksWidget = () => {
  const navigate = useNavigate();
  const { invoke } = useEdgeFn();
  const { fetchGoogleData } = useGoogleData();

  // ── Single source of truth: DB tasks via useDbTasks ──
  const { tasks: dbTasks, isLoading: dbLoading, addTask: dbAddTask, updateTask: dbUpdateTask, deleteTask: dbDeleteTask, toggleStatus: dbToggleStatus, refetch: dbRefetch } = useDbTasks();

  // ── Google Tasks connection (for sync, not as primary source) ──
  const { getConnectionsByCategory } = useConnections();
  const taskConns = getConnectionsByCategory("task");
  const { data: googleTaskLists, isLoading: googleLoading, isConnected: googleConnected, connectionNames: googleNames, refetch: googleRefetch, needsScope: tasksNeedsScope, requestScope: tasksRequestScope, lastSyncedAt: tasksLastSync } = useGoogleServiceData<any[]>({
    service: "tasks", path: "/users/@me/lists",
  });

  const isLoading = dbLoading || googleLoading;

  // Map DbTask → WidgetTask
  const tasks: WidgetTask[] = useMemo(() =>
    dbTasks.map(t => ({
      id: t.id,
      text: t.title,
      done: t.status === "done",
      priority: t.priority,
      workspace_id: t.workspace_id,
      google_task_id: t.google_task_id,
      google_tasklist_id: t.google_tasklist_id,
    })),
  [dbTasks]);

  // UI state
  const [newTask, setNewTask] = useState("");
  const [newPriority, setNewPriority] = useState<WidgetTask["priority"]>("medium");
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"priority" | "alpha" | "status">("priority");

  // AI state
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const aiCacheRef = useRef<{ key: string; text: string; ts: number } | null>(null);

  // ── Helpers ──
  const getGoogleListId = () => googleTaskLists.length > 0 ? googleTaskLists[0].id : "@default";

  // ── CRUD: always persist to DB, optionally sync to Google ──
  const handleAdd = async () => {
    if (!newTask.trim()) return;
    setActionLoading(true);
    try {
      // 1. Always save to local DB
      const created = await dbAddTask(newTask.trim(), newPriority);

      // 2. If Google connected, also create in Google Tasks and store the remote ID
      if (googleConnected && created) {
        try {
          const listId = getGoogleListId();
          const result = await fetchGoogleData<any>({
            service: "tasks",
            path: `/lists/${listId}/tasks`,
            method: "POST",
            body: { title: newTask.trim() },
          });
          if (result?.id) {
            await dbUpdateTask(created.id, { google_task_id: result.id, google_tasklist_id: listId });
          }
        } catch (e) {
          console.warn("[TasksWidget] Google sync failed on add, task saved locally:", e);
        }
      }

      toast({ title: "Tarefa criada", description: googleConnected ? "Salva localmente e sincronizada com Google Tasks." : "Tarefa salva." });
    } catch {
      toast({ title: "Erro", description: "Falha ao criar tarefa.", variant: "destructive" });
    } finally {
      setActionLoading(false);
      setNewTask("");
      setNewPriority("medium");
      setAdding(false);
    }
  };

  const handleToggle = async (task: WidgetTask) => {
    setActionLoading(true);
    try {
      await dbToggleStatus(task.id);

      // Sync to Google if linked
      if (googleConnected && task.google_task_id) {
        try {
          const listId = task.google_tasklist_id || getGoogleListId();
          await fetchGoogleData({
            service: "tasks",
            path: `/lists/${listId}/tasks/${task.google_task_id}`,
            method: "PATCH",
            body: { status: task.done ? "needsAction" : "completed" },
          });
        } catch (e) {
          console.warn("[TasksWidget] Google sync failed on toggle:", e);
        }
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (task: WidgetTask) => {
    setActionLoading(true);
    try {
      await dbDeleteTask(task.id);

      // Delete from Google if linked
      if (googleConnected && task.google_task_id) {
        try {
          const listId = task.google_tasklist_id || getGoogleListId();
          await fetchGoogleData({
            service: "tasks",
            path: `/lists/${listId}/tasks/${task.google_task_id}`,
            method: "DELETE",
          });
        } catch (e) {
          console.warn("[TasksWidget] Google sync failed on delete:", e);
        }
      }

      toast({ title: "Tarefa removida" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDuplicate = async (task: WidgetTask) => {
    await dbAddTask(task.text, task.priority);
    toast({ title: "Tarefa duplicada" });
  };

  // ── Computed data ──
  const filteredTasks = useMemo(() => {
    let list = tasks.filter(t => {
      if (filter === "pending") return !t.done;
      if (filter === "done") return t.done;
      return true;
    });
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t => t.text.toLowerCase().includes(q));
    }
    return list;
  }, [tasks, filter, searchQuery]);

  const sortedTasks = useMemo(() => {
    const sorted = [...filteredTasks];
    if (sortBy === "priority") {
      sorted.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        const pOrder = { high: 0, medium: 1, low: 2 };
        return (pOrder[a.priority || "medium"] || 1) - (pOrder[b.priority || "medium"] || 1);
      });
    } else if (sortBy === "alpha") {
      sorted.sort((a, b) => a.text.localeCompare(b.text, "pt-BR"));
    } else {
      sorted.sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));
    }
    return sorted;
  }, [filteredTasks, sortBy]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter(t => t.done).length;
    const pending = total - done;
    const high = tasks.filter(t => !t.done && t.priority === "high").length;
    const medium = tasks.filter(t => !t.done && t.priority === "medium").length;
    const low = tasks.filter(t => !t.done && t.priority === "low").length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, pending, high, medium, low, pct };
  }, [tasks]);

  const sourceNames = googleConnected ? googleNames : [];

  // AI suggestion
  const generateAISuggestion = useCallback(async () => {
    const key = tasks.map(t => t.text).join("|");
    if (aiCacheRef.current?.key === key && Date.now() - aiCacheRef.current.ts < 5 * 60 * 1000) {
      setAiSuggestion(aiCacheRef.current.text); return;
    }
    if (tasks.length === 0) { setAiSuggestion("Adicione tarefas para receber sugestões inteligentes."); return; }
    setAiLoading(true);
    try {
      const pending = tasks.filter(t => !t.done).slice(0, 10).map(t => `- [${t.priority || "medium"}] ${t.text}`).join("\n");
      const done = tasks.filter(t => t.done).slice(0, 5).map(t => `- ✓ ${t.text}`).join("\n");
      const { data, error } = await invoke<any>({
        fn: "chat",
        body: {
          messages: [
            { role: "system", content: "Você é um assistente de produtividade. Analise as tarefas do usuário e dê um conselho prático e conciso em português brasileiro. Sugira priorização, agrupamento ou próximos passos. Máximo 3 frases curtas." },
            { role: "user", content: `Pendentes:\n${pending || "Nenhuma"}\n\nConcluídas:\n${done || "Nenhuma"}` }
          ]
        }
      });
      if (error) throw new Error(error);
      const text = typeof data === "string" ? data : (data?.content || data?.choices?.[0]?.message?.content || "Sem sugestões.");
      setAiSuggestion(text);
      aiCacheRef.current = { key, text, ts: Date.now() };
    } catch { setAiSuggestion("Não foi possível gerar sugestões."); }
    finally { setAiLoading(false); }
  }, [tasks, invoke]);

  // ── Task row component ──
  const TaskRow = ({ task, compact = false }: { task: WidgetTask; compact?: boolean }) => {
    const pConfig = PRIORITY_CONFIG[task.priority || "medium"];
    const PIcon = pConfig.icon;
    return (
      <div className={`flex items-center gap-2 group ${compact ? "" : "p-2.5 rounded-xl bg-foreground/5 hover:bg-foreground/10"} transition-colors`}>
        <button
          onClick={() => handleToggle(task)}
          disabled={actionLoading}
          className="flex items-center gap-2 flex-1 text-left disabled:opacity-50"
        >
          {task.done
            ? <CheckCircle2 className={`${compact ? "w-4 h-4" : "w-5 h-5"} text-primary flex-shrink-0`} />
            : <Circle className={`${compact ? "w-4 h-4" : "w-5 h-5"} text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors`} />
          }
          <span className={`${compact ? "text-xs" : "text-sm"} ${task.done ? "line-through text-muted-foreground" : "text-foreground/85"} truncate`}>
            {task.text}
          </span>
          {compact && <WorkspaceBadge workspaceId={task.workspace_id} />}
        </button>
        <PIcon className={`${compact ? "w-3 h-3" : "w-4 h-4"} flex-shrink-0 ${pConfig.class}`} />
        {task.google_task_id && (
          <DeshTooltip label="Sincronizado com Google Tasks">
            <span className="text-[8px] text-muted-foreground/50">G</span>
          </DeshTooltip>
        )}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
          {!compact && (
            <button onClick={() => handleDuplicate(task)} className="text-muted-foreground/50 hover:text-foreground transition-colors">
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => handleDelete(task)}
            disabled={actionLoading}
            className="text-destructive/50 hover:text-destructive transition-colors disabled:opacity-30"
          >
            <Trash2 className={`${compact ? "w-3.5 h-3.5" : "w-4 h-4"}`} />
          </button>
        </div>
      </div>
    );
  };

  // ── Priority mini chart ──
  const PriorityBar = () => {
    const total = stats.high + stats.medium + stats.low;
    if (total === 0) return null;
    return (
      <div className="flex h-1.5 rounded-full overflow-hidden bg-foreground/10 mt-1">
        {stats.high > 0 && <div className="bg-destructive/60 transition-all" style={{ width: `${(stats.high / total) * 100}%` }} />}
        {stats.medium > 0 && <div className="bg-warning/60 transition-all" style={{ width: `${(stats.medium / total) * 100}%` }} />}
        {stats.low > 0 && <div className="bg-primary/60 transition-all" style={{ width: `${(stats.low / total) * 100}%` }} />}
      </div>
    );
  };

  // ── POPUP CONTENT ──
  const popupContent = (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        <div className="p-2.5 rounded-xl bg-foreground/5 text-center">
          <p className="text-lg font-bold text-foreground">{stats.total}</p>
          <p className="text-[10px] text-muted-foreground">Total</p>
        </div>
        <div className="p-2.5 rounded-xl bg-foreground/5 text-center">
          <p className="text-lg font-bold text-primary">{stats.done}</p>
          <p className="text-[10px] text-muted-foreground">Feitas</p>
        </div>
        <div className="p-2.5 rounded-xl bg-foreground/5 text-center">
          <p className="text-lg font-bold text-foreground">{stats.pending}</p>
          <p className="text-[10px] text-muted-foreground">Pendentes</p>
        </div>
        <div className="p-2.5 rounded-xl bg-foreground/5 text-center">
          <p className="text-lg font-bold text-foreground">{stats.pct}%</p>
          <p className="text-[10px] text-muted-foreground">Progresso</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-foreground/10 rounded-full h-2">
        <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width: `${stats.pct}%` }} />
      </div>

      {/* AI Insights */}
      <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Sugestões IA
          </span>
          <button onClick={generateAISuggestion} disabled={aiLoading}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-primary/15 text-primary font-medium hover:bg-primary/25 transition-colors disabled:opacity-50 flex items-center gap-1">
            {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            {aiLoading ? "Analisando..." : aiSuggestion ? "Atualizar" : "Gerar"}
          </button>
        </div>
        {aiSuggestion ? (
          <p className="text-xs text-foreground/80 leading-relaxed">{aiSuggestion}</p>
        ) : (
          <p className="text-xs text-muted-foreground/60 italic">Clique para sugestões de produtividade baseadas nas suas tarefas.</p>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-8">
          <TabsTrigger value="tasks" className="text-[11px] gap-1"><ListTodo className="w-3 h-3" />Tarefas</TabsTrigger>
          <TabsTrigger value="priority" className="text-[11px] gap-1"><Target className="w-3 h-3" />Prioridade</TabsTrigger>
          <TabsTrigger value="insights" className="text-[11px] gap-1"><BarChart3 className="w-3 h-3" />Insights</TabsTrigger>
        </TabsList>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-3 mt-3">
          {/* Search + sort */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar tarefas..."
                className="w-full bg-foreground/5 rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
            <div className="flex items-center gap-0.5 bg-foreground/5 rounded-lg p-0.5">
              {([["priority", "Prioridade"], ["alpha", "A-Z"], ["status", "Status"]] as const).map(([key, label]) => (
                <button key={key} onClick={() => setSortBy(key)}
                  className={`text-[9px] px-2 py-1 rounded-md font-medium transition-colors ${sortBy === key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex gap-1">
            {(["all", "pending", "done"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`text-[10px] px-2.5 py-0.5 rounded-full font-medium transition-colors ${filter === f ? "bg-primary/20 text-primary" : "bg-foreground/5 text-muted-foreground hover:text-foreground"}`}>
                {f === "all" ? `Todas (${stats.total})` : f === "pending" ? `Pendentes (${stats.pending})` : `Feitas (${stats.done})`}
              </button>
            ))}
          </div>

          {/* Quick add */}
          <div className="flex items-center gap-2">
            <input value={newTask} onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()} placeholder="Adicionar tarefa rápida..."
              className="flex-1 bg-foreground/5 rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50"
              disabled={actionLoading} />
            <div className="flex gap-0.5">
              {(["high", "medium", "low"] as const).map(p => {
                const c = PRIORITY_CONFIG[p];
                return (
                  <button key={p} onClick={() => setNewPriority(p)}
                    className={`p-1 rounded transition-colors ${newPriority === p ? c.bg : "hover:bg-foreground/5"}`} title={c.label}>
                    <c.icon className={`w-3 h-3 ${c.class}`} />
                  </button>
                );
              })}
            </div>
            <button onClick={handleAdd} disabled={actionLoading || !newTask.trim()}
              className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors disabled:opacity-50 flex items-center gap-1">
              {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            </button>
          </div>

          {/* Task list */}
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto scrollbar-thin">
            {sortedTasks.map(task => <TaskRow key={task.id} task={task} />)}
            {sortedTasks.length === 0 && (
              <p className="text-xs text-muted-foreground/60 italic text-center py-6">
                {searchQuery ? "Nenhuma tarefa encontrada" : "Nenhuma tarefa"}
              </p>
            )}
          </div>
        </TabsContent>

        {/* Priority Tab */}
        <TabsContent value="priority" className="space-y-3 mt-3">
          {(["high", "medium", "low"] as const).map(p => {
            const config = PRIORITY_CONFIG[p];
            const PIcon = config.icon;
            const pTasks = tasks.filter(t => !t.done && t.priority === p);
            return (
              <div key={p} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium flex items-center gap-1.5 ${config.class}`}>
                    <PIcon className="w-3.5 h-3.5" /> {config.label}
                  </span>
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{pTasks.length}</Badge>
                </div>
                {pTasks.length > 0 ? pTasks.map(t => (
                  <div key={t.id} className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-foreground/5 transition-colors group">
                    <button onClick={() => handleToggle(t)}
                      disabled={actionLoading} className="disabled:opacity-50">
                      <Circle className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </button>
                    <span className="text-xs text-foreground/85 truncate flex-1">{t.text}</span>
                    <button onClick={() => handleDelete(t)}
                      disabled={actionLoading} className="opacity-0 group-hover:opacity-100 text-destructive/50 hover:text-destructive transition-all disabled:opacity-30">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )) : (
                  <p className="text-[10px] text-muted-foreground/50 italic pl-5">Nenhuma tarefa</p>
                )}
              </div>
            );
          })}
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-3 mt-3">
          {/* Priority distribution */}
          <div className="p-3 rounded-xl bg-foreground/5">
            <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-primary" /> Distribuição de prioridade
            </p>
            <div className="flex items-end gap-2 h-16">
              {(["high", "medium", "low"] as const).map(p => {
                const config = PRIORITY_CONFIG[p];
                const count = tasks.filter(t => !t.done && t.priority === p).length;
                const max = Math.max(stats.high, stats.medium, stats.low, 1);
                const height = count > 0 ? Math.max((count / max) * 100, 10) : 4;
                return (
                  <div key={p} className="flex-1 flex flex-col items-center gap-0.5">
                    <span className="text-[9px] text-muted-foreground/70 tabular-nums">{count || ""}</span>
                    <div className={`w-full rounded-t-sm transition-all ${count > 0 ? config.bg : "bg-foreground/10"}`} style={{ height: `${height}%` }} />
                    <span className="text-[8px] text-muted-foreground/60">{config.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick insights */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-foreground/5">
              <TrendingUp className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="text-xs font-medium text-foreground">Taxa de conclusão</p>
                <p className="text-[10px] text-muted-foreground">{stats.pct}% das tarefas concluídas</p>
              </div>
            </div>
            {stats.high > 0 && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-destructive/5 border border-destructive/10">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">Atenção</p>
                  <p className="text-[10px] text-muted-foreground">{stats.high} tarefa{stats.high > 1 ? "s" : ""} de alta prioridade pendente{stats.high > 1 ? "s" : ""}</p>
                </div>
              </div>
            )}
            {stats.pending === 0 && stats.total > 0 && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/10">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">Tudo em dia! 🎉</p>
                  <p className="text-[10px] text-muted-foreground">Todas as tarefas foram concluídas</p>
                </div>
              </div>
            )}
          </div>

          <button onClick={() => navigate("/tasks")}
            className="w-full py-2 rounded-lg bg-foreground/5 text-xs text-muted-foreground hover:text-primary hover:bg-foreground/10 transition-colors flex items-center justify-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5" /> Abrir módulo completo <ChevronRight className="w-3 h-3" />
          </button>
        </TabsContent>
      </Tabs>
    </div>
  );

  // ── COMPACT CARD ──
  return (
    <GlassCard className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <WidgetTitle label="Tarefas"
            icon={<ListTodo className="w-3.5 h-3.5 text-primary" />}
            popupIcon={<ListTodo className="w-5 h-5 text-primary" />}
            popupContent={popupContent} />
          {googleConnected && <ConnectionBadge isConnected={true} isLoading={isLoading} sourceCount={1} sourceNames={sourceNames} />}
        </div>
        <div className="flex items-center gap-1">
          {googleConnected && <GoogleSyncTimestamp lastSyncedAt={tasksLastSync} onRefresh={() => { dbRefetch(); googleRefetch(); }} isLoading={isLoading} />}
          <button onClick={() => setAdding(!adding)} className="text-primary hover:scale-110 transition-transform">
            {adding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
          <DeshTooltip label="Ver tudo">
            <button onClick={() => navigate("/tasks")} className="text-muted-foreground hover:text-primary transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </DeshTooltip>
        </div>
      </div>

      {tasksNeedsScope && <ScopeRequestBanner service="tasks" onRequest={tasksRequestScope} />}

      {/* Stats mini */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-muted-foreground">{stats.done}/{stats.total} concluídas</p>
        {stats.high > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium flex items-center gap-0.5">
            <AlertTriangle className="w-2.5 h-2.5" /> {stats.high} urgente{stats.high > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="w-full bg-foreground/10 rounded-full h-1.5 mb-1">
        <div className="bg-primary h-1.5 rounded-full transition-all duration-500" style={{ width: `${stats.pct}%` }} />
      </div>
      <PriorityBar />

      {/* Filters */}
      <div className="flex gap-1 my-2">
        {(["all", "pending", "done"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${filter === f ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-foreground/5"}`}>
            {f === "all" ? "Todas" : f === "pending" ? "Pendentes" : "Feitas"}
          </button>
        ))}
      </div>

      {/* Quick add */}
      {adding && (
        <div className="space-y-2 mb-3">
          <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder="Nova tarefa..." autoFocus disabled={actionLoading}
            className="w-full bg-foreground/5 rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Prioridade:</span>
            {(["high", "medium", "low"] as const).map(p => {
              const config = PRIORITY_CONFIG[p];
              return (
                <button key={p} onClick={() => setNewPriority(p)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors flex items-center gap-1 ${newPriority === p ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-foreground/5"}`}>
                  <config.icon className="w-2.5 h-2.5" /> {config.label}
                </button>
              );
            })}
          </div>
          <button onClick={handleAdd} disabled={actionLoading || !newTask.trim()}
            className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors disabled:opacity-50 flex items-center gap-1.5">
            {actionLoading && <Loader2 className="w-3 h-3 animate-spin" />}
            Adicionar
          </button>
        </div>
      )}

      {/* Task list */}
      <div className="space-y-1.5 flex-1 overflow-y-auto min-h-0 scrollbar-thin">
        {sortedTasks.map(task => <TaskRow key={task.id} task={task} compact />)}
        {sortedTasks.length === 0 && !dbLoading && (
          <WidgetEmptyState
            icon={CheckCircle2}
            title={filter === "all" ? "Nenhuma tarefa ainda" : filter === "pending" ? "Tudo em dia! 🎉" : "Nenhuma concluída"}
            description={filter === "all" ? "Adicione sua primeira tarefa acima" : undefined}
          />
        )}
      </div>
    </GlassCard>
  );
};

export default React.memo(TasksWidget);

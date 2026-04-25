import React, { useMemo, useCallback, lazy, Suspense, type DragEvent } from "react";
import PageLayout from "@/components/dashboard/PageLayout";
import DeshTooltip from "@/components/ui/DeshTooltip";
import TaskAIDayPlan from "@/components/tasks/TaskAIDayPlan";
import TaskStatsStrip from "@/components/tasks/TaskStatsStrip";
import HeaderActions from "@/components/dashboard/HeaderActions";
import ScopeRequestBanner from "@/components/dashboard/ScopeRequestBanner";
import MoveToWorkspace from "@/components/dashboard/MoveToWorkspace";
import GoogleSyncBadge from "@/components/dashboard/GoogleSyncBadge";
import GlassCard from "@/components/dashboard/GlassCard";
import ConnectionBadge from "@/components/dashboard/ConnectionBadge";
import WorkspaceBadge from "@/components/dashboard/WorkspaceBadge";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import TaskCard from "@/components/tasks/TaskCard";
import TaskOverdueBanner from "@/components/tasks/TaskOverdueBanner";
import TaskTemplates from "@/components/tasks/TaskTemplates";
import TaskBulkBar from "@/components/tasks/TaskBulkBar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy-load heavy conditional panels
const TaskFocusMode = lazy(() => import("@/components/tasks/TaskFocusMode"));
const TaskCompletionHeatmap = lazy(() => import("@/components/tasks/TaskCompletionHeatmap"));
const TaskProductivityStats = lazy(() => import("@/components/tasks/TaskProductivityStats"));
import {
  ArrowLeft, Plus, Search, ListTodo, LayoutGrid, Calendar, Trash2,
  CheckCircle2, Circle, Loader2, ChevronDown, ChevronRight, X,
  Sparkles, Wand2, Edit3, Save, Filter, RefreshCw, BarChart3,
  Clock, TrendingUp, Repeat, Target, Zap, Star, AlertTriangle,
  GripVertical, ArrowUpDown, Trophy, Flame, Inbox, Tag, Copy,
  CheckSquare, Square,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { priorityColors, priorityLabels, statusLabels, recurrenceLabels } from "@/lib/taskConstants";
import { useTasksPageState } from "@/hooks/tasks/useTasksPageState";
import type { DbTask } from "@/hooks/tasks/useDbTasks";

const statusColumns: Array<DbTask["status"]> = ["todo", "in_progress", "done"];

const TasksPage = () => {
  const s = useTasksPageState();

  // Render a task card with all props
  const renderTaskCard = useCallback((task: DbTask, compact = false) => (
    <TaskCard
      key={task.id}
      task={task}
      compact={compact}
      isExpanded={s.expandedId === task.id}
      isEditing={s.editingId === task.id}
      isDragged={s.draggedId === task.id}
      selectMode={s.selectMode}
      isSelected={s.selectedIds.has(task.id)}
      searchQuery={s.searchQuery}
      today={s.today}
      googleTasksConnected={s.googleTasksConnected}
      aiLoading={s.aiLoading}
      editTitle={s.editTitle}
      editPriority={s.editPriority}
      editProject={s.editProject}
      editDueDate={s.editDueDate}
      editDescription={s.editDescription}
      editRecurrence={s.editRecurrence}
      newSubtaskTitle={s.newSubtaskTitle}
      onToggleExpand={() => s.setExpandedId(s.expandedId === task.id ? null : task.id)}
      onToggleStatus={() => s.handleToggleStatus(task)}
      onStartEdit={() => s.startEdit(task)}
      onSaveEdit={s.saveEdit}
      onCancelEdit={() => s.setEditingId(null)}
      onDelete={() => s.handleDeleteTask(task)}
      onDuplicate={() => s.handleDuplicate(task)}
      onAiBreak={() => s.handleAiBreak(task)}
      onFocus={() => s.setFocusTaskId(task.id)}
      onToggleSelect={() => s.toggleSelect(task.id)}
      onDragStart={(e) => s.handleDragStart(e as any, task.id)}
      onDragEnd={s.handleDragEnd}
      onFilterProject={s.setFilterProject}
      onEditTitleChange={s.setEditTitle}
      onEditPriorityChange={s.setEditPriority}
      onEditProjectChange={s.setEditProject}
      onEditDueDateChange={s.setEditDueDate}
      onEditDescriptionChange={s.setEditDescription}
      onEditRecurrenceChange={s.setEditRecurrence}
      onNewSubtaskTitleChange={s.setNewSubtaskTitle}
      onAddSubtask={() => s.handleAddSubtask(task.id)}
      onToggleSubtask={(subtaskId) => s.toggleSubtask(subtaskId, task.id)}
      onDeleteSubtask={(subtaskId) => s.deleteSubtask(subtaskId, task.id)}
      onRefetch={s.refetchTasks}
      getProjectColor={s.getProjectColor}
      getDueBadge={s.getDueBadge}
      getProgress={s.getProgress}
    />
  ), [s]);

  // Stats view (memoized)
  const statsViewContent = useMemo(() => {
    const { stats, tasks } = s;
    const score = (() => {
      if (stats.total === 0) return 0;
      const completionRate = stats.done / stats.total;
      const overduepenalty = Math.min(stats.overdue * 0.05, 0.3);
      const weekBonus = Math.min(stats.doneThisWeek * 0.05, 0.2);
      return Math.round(Math.max(0, Math.min(100, (completionRate + weekBonus - overduepenalty) * 100)));
    })();
    const scoreColor = score >= 75 ? "text-green-400" : score >= 50 ? "text-yellow-500" : "text-destructive";
    const scoreLabel = score >= 75 ? "Excelente" : score >= 50 ? "Bom" : "Precisa de atenção";

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <AnimatedItem index={1}>
            <GlassCard>
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Total</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-[10px] text-muted-foreground">{stats.done} concluídas</p>
              {stats.total > 0 && <Progress value={(stats.done / stats.total) * 100} className="h-1.5 mt-2" />}
            </GlassCard>
          </AnimatedItem>
          <AnimatedItem index={2}>
            <GlassCard>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-xs text-muted-foreground">Esta semana</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.doneThisWeek}</p>
              <p className="text-[10px] text-muted-foreground">concluídas</p>
            </GlassCard>
          </AnimatedItem>
          <AnimatedItem index={3}>
            <GlassCard>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                <span className="text-xs text-muted-foreground">Em andamento</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.inProgress}</p>
              {stats.overdue > 0 && <p className="text-[10px] text-destructive flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" />{stats.overdue} atrasadas</p>}
            </GlassCard>
          </AnimatedItem>
          <AnimatedItem index={4}>
            <GlassCard>
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Produtividade</span>
              </div>
              <p className={`text-2xl font-bold ${scoreColor}`}>{score}<span className="text-sm font-normal">/100</span></p>
              <p className={`text-[10px] ${scoreColor}`}>{scoreLabel}</p>
              <Progress value={score} className="h-1.5 mt-2" />
            </GlassCard>
          </AnimatedItem>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AnimatedItem index={5}>
            <GlassCard>
              <p className="widget-title mb-3">Pendentes por Prioridade</p>
              <div className="space-y-2.5">
                {(["high", "medium", "low"] as const).map(p => (
                  <div key={p} className="flex items-center gap-2">
                    <span className={`text-[10px] w-14 flex-shrink-0 ${priorityColors[p]} px-1.5 py-0.5 rounded-full text-center font-medium`}>{priorityLabels[p]}</span>
                    <div className="flex-1 bg-foreground/5 rounded-full h-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${stats.total ? (stats.byPriority[p] / Math.max(...Object.values(stats.byPriority), 1)) * 100 : 0}%` }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className={`h-2 rounded-full ${p === "high" ? "bg-destructive" : p === "medium" ? "bg-yellow-500" : "bg-green-400"}`}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-5 text-right font-mono">{stats.byPriority[p]}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </AnimatedItem>
          <AnimatedItem index={6}>
            <GlassCard>
              <p className="widget-title mb-3">Por Projeto</p>
              <div className="space-y-2.5 max-h-40 overflow-y-auto pr-1">
                {Object.entries(stats.byProject).length === 0 && <p className="text-xs text-muted-foreground">Nenhum projeto</p>}
                {Object.entries(stats.byProject).sort((a, b) => b[1].total - a[1].total).map(([name, data]) => (
                  <div key={name} className="flex items-center gap-2">
                    <button onClick={() => s.setFilterProject(name)} className="text-xs text-foreground truncate w-24 text-left hover:text-primary transition-colors">{name}</button>
                    <div className="flex-1 bg-foreground/5 rounded-full h-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${data.total ? (data.done / data.total) * 100 : 0}%` }}
                        transition={{ duration: 0.6, delay: 0.15 }}
                        className="h-2 rounded-full bg-primary"
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-10 text-right font-mono">{data.done}/{data.total}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </AnimatedItem>
        </div>
        <AnimatedItem index={7}>
          <GlassCard>
            <p className="widget-title mb-3">Análise de Produtividade</p>
            <Suspense fallback={<div className="h-20" />}><TaskProductivityStats tasks={tasks} /></Suspense>
          </GlassCard>
        </AnimatedItem>
        <AnimatedItem index={8}>
          <GlassCard>
            <Suspense fallback={<div className="h-16" />}><TaskCompletionHeatmap tasks={tasks} /></Suspense>
          </GlassCard>
        </AnimatedItem>
      </div>
    );
  }, [s.stats, s.tasks]);

  return (
    <PageLayout maxWidth="full">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <button onClick={() => s.navigate("/")} className="flex items-center gap-2 text-white/80 hover:text-white transition-colors drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)] touch-target">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <HeaderActions />
        </div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-sans font-semibold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">Tarefas</h1>
          </div>
          <div className="flex items-center gap-2">
            <ConnectionBadge isConnected={s.isConnected} isLoading={s.isLoading} sourceNames={s.googleTasksConnected ? s.googleTasksNames : undefined} size="lg" />
            {s.googleTasksConnected && (
              <button
                onClick={s.handleImportGoogleTasks}
                disabled={s.importing || !s.googleTasks || s.googleTasks.length === 0}
                className="flex items-center gap-1 bg-foreground/10 text-foreground/80 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-foreground/20 transition-colors disabled:opacity-50"
                title="Importar tarefas do Google Tasks para o banco local"
              >
                {s.importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Importar Google Tasks</span>
              </button>
            )}
          </div>
        </div>
        <TaskStatsStrip
          stats={s.stats}
          streak={s.streak}
          urgentTask={s.urgentTask}
          onFilterOverdue={() => { s.setFilterDue("overdue"); s.setShowFilters(false); }}
        />
        {s.tasksNeedsScope && <ScopeRequestBanner service="tasks" onRequest={s.tasksRequestScope} />}
      </motion.div>

      {/* Toolbar */}
      <AnimatedItem index={0}>
        <GlassCard size="auto" className="mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input ref={s.searchInputRef} type="text" placeholder="Buscar tarefas... ( / )" value={s.searchQuery} onChange={e => s.setSearchQuery(e.target.value)}
                className="w-full bg-foreground/5 rounded-lg pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => s.setShowFilters(!s.showFilters)}
                className={`p-2 rounded-lg transition-colors relative ${s.showFilters ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                aria-label="Filtros">
                <Filter className="w-4 h-4" />
                {s.activeFiltersCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-primary text-primary-foreground rounded-full text-[8px] flex items-center justify-center">{s.activeFiltersCount}</span>
                )}
              </button>
              <div className="relative group/sort">
                <DeshTooltip label="Ordenar">
                  <button className={`p-2 rounded-lg transition-colors ${s.sortMode !== "default" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`} aria-label="Ordenar">
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                </DeshTooltip>
                <div className="absolute right-0 top-full mt-1 bg-background border border-foreground/10 rounded-lg shadow-lg z-20 hidden group-hover/sort:flex flex-col min-w-[120px] overflow-hidden">
                  {[{ v: "default", l: "Padrão" }, { v: "priority", l: "Prioridade" }, { v: "due", l: "Vencimento" }, { v: "project", l: "Projeto" }].map(opt => (
                    <button key={opt.v} onClick={() => s.setSortMode(opt.v as any)}
                      className={`px-3 py-2 text-xs text-left transition-colors ${s.sortMode === opt.v ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"}`}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => s.setViewMode("list")} className={`p-2 rounded-lg transition-colors ${s.viewMode === "list" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`} aria-label="Vista em lista">
                <ListTodo className="w-4 h-4" />
              </button>
              <button onClick={() => s.setViewMode("kanban")} className={`p-2 rounded-lg transition-colors ${s.viewMode === "kanban" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`} aria-label="Vista kanban">
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button onClick={() => s.setViewMode("stats")} className={`p-2 rounded-lg transition-colors ${s.viewMode === "stats" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`} aria-label="Estatísticas">
                <BarChart3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => { s.setSelectMode(!s.selectMode); if (s.selectMode) s.setSelectedIds(new Set()); }}
                className={`p-2 rounded-lg transition-colors ${s.selectMode ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                title="Selecionar múltiplas"
              >
                <CheckSquare className="w-4 h-4" />
              </button>
              <button
                onClick={s.handleAiPlanDay}
                disabled={s.aiLoading === "plan" || s.tasks.filter(t => t.status !== "done").length === 0}
                className="flex items-center gap-1 p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                title="IA planeja seu dia"
              >
                {s.aiLoading === "plan" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                <span className="text-xs hidden sm:inline">Planejar dia</span>
              </button>
            </div>
          </div>

          {/* Batch action bar */}
          <AnimatePresence>
            {s.selectMode && s.selectedIds.size > 0 && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-foreground/5 flex-wrap">
                  <span className="text-xs font-medium text-foreground">{s.selectedIds.size} selecionada(s)</span>
                  <button onClick={s.selectAll} className="text-[10px] text-primary hover:underline">Selecionar todas</button>
                  <div className="flex items-center gap-1 ml-auto flex-wrap">
                    <button onClick={() => s.handleBatchStatus("done")} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/10 text-green-400 text-[10px] hover:bg-green-500/20 transition-colors">
                      <CheckCircle2 className="w-3 h-3" /> Concluir
                    </button>
                    <button onClick={() => s.handleBatchStatus("todo")} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-foreground/5 text-foreground text-[10px] hover:bg-foreground/10 transition-colors">
                      <Circle className="w-3 h-3" /> A fazer
                    </button>
                    {(["high", "medium", "low"] as const).map(p => (
                      <button key={p} onClick={() => s.handleBatchPriority(p)}
                        className={`px-2 py-1 rounded-lg text-[10px] transition-colors ${priorityColors[p]}`}>
                        {priorityLabels[p]}
                      </button>
                    ))}
                    <button onClick={s.handleBatchDelete} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-destructive/10 text-destructive text-[10px] hover:bg-destructive/20 transition-colors">
                      <Trash2 className="w-3 h-3" /> Excluir
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filters */}
          <AnimatePresence>
            {s.showFilters && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-foreground/5 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Prioridade:</span>
                  {["all", "high", "medium", "low"].map(p => (
                    <button key={p} onClick={() => s.setFilterPriority(p)}
                      className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${s.filterPriority === p ? "bg-primary/20 text-primary" : "bg-foreground/5 text-muted-foreground hover:text-foreground"}`}>
                      {p === "all" ? "Todas" : priorityLabels[p]}
                    </button>
                  ))}
                  <span className="text-foreground/10">|</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Data:</span>
                  {[{ v: "all", l: "Todas" }, { v: "overdue", l: "Atrasadas" }, { v: "today", l: "Hoje" }, { v: "week", l: "Esta semana" }, { v: "none", l: "Sem data" }].map(d => (
                    <button key={d.v} onClick={() => s.setFilterDue(d.v)}
                      className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${s.filterDue === d.v ? "bg-primary/20 text-primary" : "bg-foreground/5 text-muted-foreground hover:text-foreground"}`}>
                      {d.l}
                    </button>
                  ))}
                  {s.projects.length > 0 && (
                    <>
                      <span className="text-foreground/10">|</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Projeto:</span>
                      <button onClick={() => s.setFilterProject("all")}
                        className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${s.filterProject === "all" ? "bg-primary/20 text-primary" : "bg-foreground/5 text-muted-foreground hover:text-foreground"}`}>Todos</button>
                      {s.projects.map(p => (
                        <button key={p} onClick={() => s.setFilterProject(p!)}
                          className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${s.filterProject === p ? "bg-primary/20 text-primary" : "bg-foreground/5 text-muted-foreground hover:text-foreground"}`}>{p}</button>
                      ))}
                    </>
                  )}
                  {s.activeFiltersCount > 0 && (
                    <button onClick={s.clearFilters}
                      className="px-2 py-0.5 rounded-full text-[10px] text-destructive hover:bg-destructive/10 transition-colors">Limpar filtros</button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Add task */}
          <div className="flex gap-2 mt-3 flex-wrap">
            <div className="relative flex-1 min-w-[150px]">
              <input type="text" placeholder="Nova tarefa..." value={s.newTitle} onChange={e => s.handleTitleChange(e.target.value)}
                onKeyDown={e => e.key === "Enter" && s.handleAdd()}
                className="w-full bg-foreground/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
              {s.aiSuggestResult && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <span className="text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" />{priorityLabels[s.aiSuggestResult.priority]}
                  </span>
                </div>
              )}
            </div>
            <select value={s.newPriority} onChange={e => s.setNewPriority(e.target.value as DbTask["priority"])}
              className="bg-foreground/5 rounded-lg px-2 py-2 text-xs text-foreground outline-none">
              <option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option>
            </select>
            <input value={s.newProject} onChange={e => s.setNewProject(e.target.value)} placeholder="Projeto"
              className="bg-foreground/5 rounded-lg px-2 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none w-24 hidden sm:block" />
            <input type="date" value={s.newDueDate} onChange={e => s.setNewDueDate(e.target.value)}
              className="bg-foreground/5 rounded-lg px-2 py-2 text-xs text-foreground outline-none hidden sm:block" />
            <select value={s.newRecurrence} onChange={e => s.setNewRecurrence(e.target.value)}
              className="bg-foreground/5 rounded-lg px-2 py-2 text-xs text-foreground outline-none hidden sm:block">
              <option value="">Uma vez</option><option value="daily">Diária</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option>
            </select>
            <button onClick={s.handleAiSuggest} disabled={!s.newTitle.trim() || s.aiLoading === "new"}
              className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50" title="IA sugere prioridade e projeto">
              {s.aiLoading === "new" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            </button>
            <button onClick={s.handleAdd} className="flex items-center gap-1 bg-primary/20 text-primary px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/30 transition-colors">
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Adicionar</span>
            </button>
          </div>
          <div className="mt-2">
            <TaskTemplates onCreateFromTemplate={s.handleCreateFromTemplate} />
          </div>
        </GlassCard>
      </AnimatedItem>

      {/* Overdue banner */}
      <TaskOverdueBanner
        tasks={s.tasks}
        onFilterOverdue={() => { s.setFilterDue("overdue"); s.setShowFilters(false); }}
        onFocusTask={(id) => s.setExpandedId(id)}
      />

      <TaskAIDayPlan dayPlan={s.dayPlan} onDismiss={() => s.setDayPlan(null)} />

      {/* Views */}
      {s.dbLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[0, 1, 2].map(i => (
            <GlassCard key={i}>
              <Skeleton className="h-4 w-24 mb-3" />
              {[0, 1, 2, 3].map(j => (
                <Skeleton key={j} className="h-14 w-full rounded-xl mb-2" />
              ))}
            </GlassCard>
          ))}
        </div>
      ) : s.viewMode === "stats" ? (
        statsViewContent
      ) : s.viewMode === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1 min-h-0" style={{ minHeight: 'calc(100vh - 380px)' }}>
          {statusColumns.map((status, ci) => {
            const col = s.filtered.filter(t => t.status === status);
            const colTotal = s.tasks.filter(t => t.status === status).length;
            const COLUMN_ACCENT: Record<string, string> = { todo: "bg-foreground/30", in_progress: "bg-primary", done: "bg-green-400" };
            const COLUMN_ICONS: Record<string, React.ReactNode> = {
              todo: <Inbox className="w-3.5 h-3.5 text-muted-foreground" />,
              in_progress: <Flame className="w-3.5 h-3.5 text-primary" />,
              done: <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />,
            };
            const pct = s.tasks.length ? Math.round((colTotal / s.tasks.length) * 100) : 0;
            return (
              <AnimatedItem key={status} index={ci + 1} className="flex flex-col min-h-0">
                <GlassCard
                  size="auto"
                  className={`transition-all flex flex-col h-full ${s.dragOverCol === status ? "ring-2 ring-primary/50 bg-primary/5" : ""}`}
                  onDragOver={(e: any) => s.handleDragOver(e, status)}
                  onDragLeave={s.handleDragLeave}
                  onDrop={(e: any) => s.handleDrop(e, status)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      {COLUMN_ICONS[status]}
                      <p className="widget-title">{statusLabels[status]}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
                      <span className="text-xs font-mono bg-foreground/8 text-muted-foreground px-2 py-0.5 rounded-full">{col.length}</span>
                    </div>
                  </div>
                  {s.tasks.length > 0 && (
                    <div className="mb-3">
                      <div className="w-full bg-foreground/5 rounded-full h-1 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, delay: ci * 0.1 }}
                          className={`h-1 rounded-full ${COLUMN_ACCENT[status]}`}
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-foreground/10 scrollbar-track-transparent">
                    <AnimatePresence mode="popLayout">
                      <div className="space-y-2">
                        {col.map(task => renderTaskCard(task))}
                        {col.length === 0 && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className={`flex flex-col items-center justify-center py-8 rounded-xl border-2 border-dashed transition-colors ${s.draggedId ? "border-primary/30 bg-primary/5" : "border-foreground/5"}`}>
                            {s.draggedId
                              ? <p className="text-xs text-primary">Solte aqui</p>
                              : status === "todo" ? (
                                <><ListTodo className="w-5 h-5 text-muted-foreground/30 mb-1" /><p className="text-[11px] text-muted-foreground">Adicione tarefas acima</p></>
                              ) : status === "in_progress" ? (
                                <><Flame className="w-5 h-5 text-muted-foreground/30 mb-1" /><p className="text-[11px] text-muted-foreground">Nenhuma em andamento</p></>
                              ) : (
                                <><Trophy className="w-5 h-5 text-muted-foreground/30 mb-1" /><p className="text-[11px] text-muted-foreground">Complete tarefas aqui!</p></>
                              )
                            }
                          </motion.div>
                        )}
                      </div>
                    </AnimatePresence>
                  </div>
                </GlassCard>
              </AnimatedItem>
            );
          })}
        </div>
      ) : (
        <AnimatedItem index={1}>
          <GlassCard size="auto">
            <AnimatePresence>
              <div className="space-y-1.5 max-h-[calc(100vh-400px)] overflow-y-auto">
                {s.filtered.length === 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-10 gap-2">
                    <Search className="w-6 h-6 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Nenhuma tarefa encontrada</p>
                    {s.activeFiltersCount > 0 && (
                      <button onClick={() => { s.clearFilters(); s.setSearchQuery(""); }}
                        className="text-xs text-primary hover:underline">Limpar filtros</button>
                    )}
                  </motion.div>
                )}
                {s.filtered.map(task => (
                  <div key={task.id} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-20 text-right flex-shrink-0">{statusLabels[task.status]}</span>
                    <div className="flex-1">{renderTaskCard(task, true)}</div>
                  </div>
                ))}
              </div>
            </AnimatePresence>
          </GlassCard>
        </AnimatedItem>
      )}

      {/* Floating bulk bar */}
      <TaskBulkBar
        count={s.selectedIds.size}
        totalCount={s.filtered.length}
        onBatchStatus={s.handleBatchStatus}
        onBatchPriority={s.handleBatchPriority}
        onBatchDelete={s.handleBatchDelete}
        onSelectAll={s.selectAll}
        onClear={() => { s.setSelectedIds(new Set()); s.setSelectMode(false); }}
      />

      {/* Focus mode overlay */}
      {s.focusTaskId && (() => {
        const focusTask = s.tasks.find(t => t.id === s.focusTaskId);
        if (!focusTask) return null;
        return (
          <Suspense fallback={null}>
            <TaskFocusMode
              task={focusTask}
              onClose={() => s.setFocusTaskId(null)}
              onToggleStatus={() => s.handleToggleStatus(focusTask)}
              onToggleSubtask={(subId) => s.toggleSubtask(subId, focusTask.id)}
            />
          </Suspense>
        );
      })()}

      {s.confirmDialog}
    </PageLayout>
  );
};

export default TasksPage;
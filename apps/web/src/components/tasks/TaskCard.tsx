import React, { memo, useMemo } from "react";
import DeshTooltip from "@/components/ui/DeshTooltip";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Circle, ChevronDown, ChevronRight, X,
  Wand2, Edit3, Save, Trash2, Loader2, GripVertical,
  Calendar, Clock, AlertTriangle, Repeat, Copy, Plus,
  CheckSquare, Square, Sparkles, ClipboardCopy, Play, Pause,
  ArrowRight, Focus
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import GoogleSyncBadge from "@/components/dashboard/GoogleSyncBadge";
import WorkspaceBadge from "@/components/dashboard/WorkspaceBadge";
import MoveToWorkspace from "@/components/dashboard/MoveToWorkspace";
import TaskTimeTracker from "@/components/tasks/TaskTimeTracker";
import type { DbTask, DbSubtask } from "@/hooks/tasks/useDbTasks";
import type { ReactNode, DragEvent } from "react";
import { DeshContextMenu, type DeshContextAction } from "@/components/ui/DeshContextMenu";

import { priorityColors, priorityLabels, recurrenceLabels } from "@/lib/taskConstants";

const highlightMatch = (text: string, query: string): ReactNode => {
  if (!query || !text) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return <>{text.slice(0, idx)}<mark className="bg-primary/20 text-foreground rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>{text.slice(idx + query.length)}</>;
};

export interface TaskCardProps {
  task: DbTask;
  compact?: boolean;
  // State
  isExpanded: boolean;
  isEditing: boolean;
  isDragged: boolean;
  selectMode: boolean;
  isSelected: boolean;
  searchQuery: string;
  today: string;
  googleTasksConnected: boolean;
  aiLoading: string | null;
  // Edit state
  editTitle: string;
  editPriority: DbTask["priority"];
  editProject: string;
  editDueDate: string;
  editDescription: string;
  editRecurrence: string;
  newSubtaskTitle: string;
  // Callbacks
  onToggleExpand: () => void;
  onToggleStatus: () => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onAiBreak: () => void;
  onFocus: () => void;
  onToggleSelect: () => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onFilterProject: (project: string) => void;
  // Edit setters
  onEditTitleChange: (v: string) => void;
  onEditPriorityChange: (v: DbTask["priority"]) => void;
  onEditProjectChange: (v: string) => void;
  onEditDueDateChange: (v: string) => void;
  onEditDescriptionChange: (v: string) => void;
  onEditRecurrenceChange: (v: string) => void;
  onNewSubtaskTitleChange: (v: string) => void;
  onAddSubtask: () => void;
  onToggleSubtask: (subtaskId: string) => void;
  onDeleteSubtask: (subtaskId: string) => void;
  // Workspace
  onRefetch: () => void;
  // Helpers
  getProjectColor: (project: string) => string;
  getDueBadge: (task: DbTask) => { label: string; cls: string; icon: ReactNode } | null;
  getProgress: (task: DbTask) => { done: number; total: number; pct: number } | null;
}

const TaskCard = memo(({
  task, compact,
  isExpanded, isEditing, isDragged, selectMode, isSelected,
  searchQuery, today, googleTasksConnected, aiLoading,
  editTitle, editPriority, editProject, editDueDate, editDescription, editRecurrence, newSubtaskTitle,
  onToggleExpand, onToggleStatus, onStartEdit, onSaveEdit, onCancelEdit, onDelete, onDuplicate,
  onAiBreak, onFocus, onToggleSelect, onDragStart, onDragEnd, onFilterProject,
  onEditTitleChange, onEditPriorityChange, onEditProjectChange, onEditDueDateChange,
  onEditDescriptionChange, onEditRecurrenceChange, onNewSubtaskTitleChange,
  onAddSubtask, onToggleSubtask, onDeleteSubtask,
  onRefetch, getProjectColor, getDueBadge, getProgress,
}: TaskCardProps) => {
  const progress = getProgress(task);
  const isOverdue = task.due_date && task.due_date < today && task.status !== "done";
  const dueBadge = getDueBadge(task);
  const isDueToday = task.due_date === today && task.status !== "done";
  const projectColor = task.project ? getProjectColor(task.project) : null;

  const stopProp = (e: React.MouseEvent | React.PointerEvent) => e.stopPropagation();

  // Context Menu Actions
  const contextActions = useMemo<DeshContextAction[]>(() => [
    {
      id: "toggle_status",
      label: task.status === "done" ? "Marcar como não concluída" : "Concluir tarefa",
      icon: task.status === "done" ? Circle : CheckCircle2,
      onClick: onToggleStatus,
    },
    {
      id: "edit",
      label: "Editar tarefa",
      icon: Edit3,
      onClick: onStartEdit,
    },
    {
      id: "duplicate",
      label: "Duplicar tarefa",
      icon: Copy,
      onClick: onDuplicate,
    },
    {
      id: "ai_break",
      label: "Decompor com IA",
      icon: Wand2,
      onClick: onAiBreak,
      disabled: !!aiLoading,
    },
    {
      id: "focus",
      label: "Modo foco",
      icon: Play,
      onClick: onFocus,
      dividerAfter: true,
    },
    {
      id: "copy_title",
      label: "Copiar título",
      icon: ClipboardCopy,
      onClick: () => {
        navigator.clipboard.writeText(task.title);
      },
      dividerAfter: true,
    },
    {
      id: "delete",
      label: "Excluir tarefa",
      icon: Trash2,
      destructive: true,
      onClick: onDelete,
    },
  ], [task, onToggleStatus, onStartEdit, onDuplicate, onAiBreak, aiLoading, onDelete]);

  return (
    <DeshContextMenu actions={contextActions}>
      <motion.div
        layout={!isEditing}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`rounded-xl border bg-background/40 hover:bg-background/60 backdrop-blur-sm transition-all group ${compact ? "p-2" : "p-3"} ${isDragged ? "opacity-40 scale-95 shadow-lg" : "shadow-sm hover:shadow-md"} ${
          isOverdue
            ? "border-destructive/30 bg-destructive/5"
            : isDueToday
            ? "border-amber-500/25 bg-amber-500/5"
            : task.status === "done"
            ? "border-foreground/5 opacity-75"
            : "border-foreground/8 hover:border-primary/20"
        }`}
        draggable={!isEditing}
        onDragStart={isEditing ? undefined : (e: any) => onDragStart(e)}
        onDragEnd={onDragEnd}
      >
        {isOverdue && (
          <div className="h-0.5 w-full rounded-t-xl bg-destructive/60 -mt-3 -mx-3 mb-2 px-3" style={{ width: "calc(100% + 24px)", marginLeft: "-12px", marginTop: "-12px", borderRadius: "10px 10px 0 0" }} />
        )}

        <div className="flex items-start gap-2">
          {selectMode && (
            <button onClick={() => onToggleSelect()} className="flex-shrink-0 pt-1">
              {isSelected
                ? <CheckSquare className="w-4 h-4 text-primary" />
                : <Square className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />}
            </button>
          )}
          <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
            <button
              onClick={onToggleStatus}
              className="relative group/btn"
              title={task.status === "done" ? "Reabrir" : task.status === "in_progress" ? "Concluir" : "Iniciar"}
            >
              {task.status === "done" ? (
                <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }}>
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                </motion.div>
              ) : task.status === "in_progress" ? (
                <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.8 }}>
                  <Circle className="w-4 h-4 text-primary fill-primary/20" />
                </motion.div>
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
              )}
            </button>
            <GripVertical className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors cursor-grab" />
          </div>

          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-1.5" onMouseDown={stopProp} onPointerDown={stopProp}>
                <input value={editTitle} onChange={e => onEditTitleChange(e.target.value)} className="w-full bg-foreground/10 rounded px-2 py-1 text-sm text-foreground outline-none" autoFocus />
                <textarea value={editDescription} onChange={e => onEditDescriptionChange(e.target.value)} placeholder="Descrição..." rows={2}
                  className="w-full bg-foreground/10 rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none resize-none" />
                <div className="flex items-center gap-1.5 flex-wrap">
                  <select value={editPriority} onChange={e => onEditPriorityChange(e.target.value as DbTask["priority"])}
                    className="bg-foreground/10 rounded px-2 py-1 text-[10px] text-foreground outline-none">
                    <option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option>
                  </select>
                  <input value={editProject} onChange={e => onEditProjectChange(e.target.value)} placeholder="Projeto"
                    className="bg-foreground/10 rounded px-2 py-1 text-[10px] text-foreground placeholder:text-muted-foreground outline-none w-24" />
                  <input type="date" value={editDueDate} onChange={e => onEditDueDateChange(e.target.value)}
                    className="bg-foreground/10 rounded px-2 py-1 text-[10px] text-foreground outline-none" />
                  <select value={editRecurrence} onChange={e => onEditRecurrenceChange(e.target.value)}
                    className="bg-foreground/10 rounded px-2 py-1 text-[10px] text-foreground outline-none">
                    <option value="">Sem recorrência</option>
                    <option value="daily">Diária</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option>
                  </select>
                  <button onClick={onSaveEdit} className="p-1 rounded hover:bg-primary/20 text-primary transition-colors"><Save className="w-3.5 h-3.5" /></button>
                  <button onClick={onCancelEdit} className="p-1 rounded hover:bg-foreground/10 text-muted-foreground transition-colors"><X className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <button onClick={onToggleExpand} className="flex-shrink-0">
                    {isExpanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                  </button>
                  <p className={`text-sm font-medium flex-1 leading-snug ${task.status === "done" ? "line-through text-muted-foreground" : isOverdue ? "text-destructive" : "text-foreground"}`}>
                    {searchQuery ? highlightMatch(task.title, searchQuery) : task.title}
                  </p>
                </div>
                {task.description && !isExpanded && (
                  <p className="text-[11px] text-muted-foreground ml-4 mt-0.5 line-clamp-1">{task.description}</p>
                )}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap ml-4">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${priorityColors[task.priority]}`}>{priorityLabels[task.priority]}</span>
                  {task.project && (
                    <button
                      onClick={() => onFilterProject(task.project!)}
                      className="flex items-center gap-1 text-[9px] text-foreground/70 bg-foreground/8 hover:bg-primary/15 hover:text-primary px-1.5 py-0.5 rounded-full transition-colors"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${projectColor}`} />
                      {task.project}
                    </button>
                  )}
                  <WorkspaceBadge workspaceId={(task as any).workspace_id} />
                  {dueBadge && (
                    <span className={`text-[9px] flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-medium ${dueBadge.cls}`}>
                      {dueBadge.icon}{dueBadge.label}
                    </span>
                  )}
                  {task.recurrence && (
                    <span className="text-[9px] flex items-center gap-0.5 text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                      <Repeat className="w-2.5 h-2.5" /> {recurrenceLabels[task.recurrence]}
                    </span>
                  )}
                  {progress && (
                    <span className={`text-[9px] font-medium tabular-nums ${progress.pct === 100 ? "text-green-400" : "text-muted-foreground"}`}>
                      {progress.done}/{progress.total}
                    </span>
                  )}
                  <TaskTimeTracker taskId={task.id} taskTitle={task.title} compact />
                  {googleTasksConnected && <GoogleSyncBadge variant="synced" />}
                </div>
                {progress && progress.total > 0 && (
                  <div className="mt-2 ml-4">
                    <Progress value={progress.pct} className={`h-1 ${progress.pct === 100 ? "[&>div]:bg-green-400" : ""}`} />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {!isEditing && (
              <>
                <DeshTooltip label="Editar">
                  <button onClick={onStartEdit} className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all">
                    <Edit3 className="w-3 h-3" />
                  </button>
                </DeshTooltip>
                <DeshTooltip label="Subtarefas com IA">
                  <button onClick={onAiBreak} disabled={aiLoading === task.id}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all disabled:opacity-50">
                    {aiLoading === task.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  </button>
                </DeshTooltip>
                <DeshTooltip label="Duplicar">
                  <button onClick={onDuplicate}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all">
                    <Copy className="w-3 h-3" />
                  </button>
                </DeshTooltip>
                <MoveToWorkspace
                  table="tasks"
                  itemId={task.id}
                  currentWorkspaceId={task.workspace_id}
                  onMoved={onRefetch}
                />
                <DeshTooltip label="Excluir">
                  <button onClick={onDelete} className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </DeshTooltip>
              </>
            )}
          </div>
        </div>

        {/* Expanded subtasks */}
        <AnimatePresence>
          {isExpanded && !isEditing && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="ml-6 mt-2 pt-2 border-t border-foreground/5 space-y-1">
                {task.description && <p className="text-xs text-muted-foreground mb-2">{task.description}</p>}
                {task.subtasks?.map(sub => (
                  <div key={sub.id} className="flex items-center gap-2 group/sub">
                    <button onClick={() => onToggleSubtask(sub.id)} className="flex-shrink-0">
                      {sub.completed
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                        : <Circle className="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition-colors" />}
                    </button>
                    <span className={`text-xs flex-1 ${sub.completed ? "line-through text-muted-foreground" : "text-foreground/80"}`}>{sub.title}</span>
                    <button onClick={() => onDeleteSubtask(sub.id)} className="opacity-0 group-hover/sub:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-1.5 mt-2" onMouseDown={stopProp} onPointerDown={stopProp}>
                  <input value={newSubtaskTitle} onChange={e => onNewSubtaskTitleChange(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && onAddSubtask()}
                    placeholder="Nova subtarefa..." className="flex-1 bg-foreground/5 rounded-lg px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/30" />
                  <button onClick={onAddSubtask} className="text-primary hover:text-primary/80 transition-colors p-1 rounded hover:bg-primary/10">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </DeshContextMenu>
  );
});

TaskCard.displayName = "TaskCard";

export default TaskCard;
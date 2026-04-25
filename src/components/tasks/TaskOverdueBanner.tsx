import { memo, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Clock, ArrowRight, Flame } from "lucide-react";
import type { DbTask } from "@/types/tasks";
import { priorityLabels, MS_PER_DAY } from "@/lib/taskConstants";

interface TaskOverdueBannerProps {
  tasks: DbTask[];
  onFilterOverdue: () => void;
  onFocusTask: (taskId: string) => void;
}

const TaskOverdueBanner = memo(({ tasks, onFilterOverdue, onFocusTask }: TaskOverdueBannerProps) => {
  const today = new Date().toISOString().split("T")[0];

  const overdueTasks = useMemo(() => {
    return tasks
      .filter(t => t.due_date && t.due_date < today && t.status !== "done")
      .sort((a, b) => {
        const pw: Record<string, number> = { high: 3, medium: 2, low: 1 };
        return (pw[b.priority] || 0) - (pw[a.priority] || 0);
      });
  }, [tasks, today]);

  if (overdueTasks.length === 0) return null;

  const mostUrgent = overdueTasks[0];
  const daysOverdue = Math.ceil((Date.now() - new Date(mostUrgent.due_date!).getTime()) / MS_PER_DAY);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-3 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-destructive/15 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {overdueTasks.length} tarefa{overdueTasks.length > 1 ? "s" : ""} atrasada{overdueTasks.length > 1 ? "s" : ""}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Mais urgente: <span className="text-destructive font-medium">{mostUrgent.title}</span>
              {" "}({daysOverdue} dia{daysOverdue > 1 ? "s" : ""})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onFocusTask(mostUrgent.id)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
          >
            <Flame className="w-3 h-3" /> Focar agora
          </button>
          <button
            onClick={onFilterOverdue}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-foreground/5 text-muted-foreground text-xs hover:bg-foreground/10 transition-colors"
          >
            Ver todas <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </motion.div>
  );
});

TaskOverdueBanner.displayName = "TaskOverdueBanner";
export default TaskOverdueBanner;

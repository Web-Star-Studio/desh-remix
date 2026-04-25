import { memo } from "react";
import { motion } from "framer-motion";
import { Target, CheckCircle2, TrendingUp, AlertTriangle, Clock, Flame } from "lucide-react";

interface TaskStatsStripProps {
  stats: {
    total: number;
    done: number;
    doneThisWeek: number;
    overdue: number;
  };
  streak: number;
  urgentTask: { title: string } | null;
  onFilterOverdue: () => void;
}

const TaskStatsStrip = ({ stats, streak, urgentTask, onFilterOverdue }: TaskStatsStripProps) => {
  if (stats.total === 0) return null;

  return (
    <div className="flex items-center gap-3 mb-4 flex-wrap">
      <div className="flex items-center gap-2 bg-background/60 backdrop-blur-md rounded-xl px-3 py-1.5 border border-border/30">
        <Target className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs text-white/80"><span className="font-semibold text-white">{stats.total}</span> tarefas</span>
        <div className="w-px h-3 bg-foreground/20" />
        <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
        <span className="text-xs text-white/80"><span className="font-semibold text-white">{stats.done}</span> concluídas</span>
        <div className="w-px h-3 bg-foreground/20" />
        <TrendingUp className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs text-white/80"><span className="font-semibold text-white">{stats.doneThisWeek}</span> esta semana</span>
      </div>
      {stats.overdue > 0 && (
        <button
          onClick={onFilterOverdue}
          className="flex items-center gap-1.5 bg-background/60 backdrop-blur-md rounded-xl px-3 py-1.5 border border-destructive/30 hover:bg-background/70 transition-colors"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
          <span className="text-xs text-destructive font-medium">{stats.overdue} atrasada{stats.overdue > 1 ? "s" : ""}</span>
        </button>
      )}
      {urgentTask && !stats.overdue && (
        <div className="flex items-center gap-1.5 bg-background/60 backdrop-blur-md rounded-xl px-3 py-1.5 border border-amber-500/25">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs text-amber-300 font-medium truncate max-w-[180px]">Hoje: {urgentTask.title}</span>
        </div>
      )}
      {streak > 0 && (
        <div className="flex items-center gap-1.5 bg-background/60 backdrop-blur-md rounded-xl px-3 py-1.5 border border-primary/25">
          <Flame className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs text-primary font-medium">{streak} dia{streak > 1 ? "s" : ""} seguido{streak > 1 ? "s" : ""}</span>
        </div>
      )}
      {stats.total > 0 && (
        <div className="flex items-center gap-2 bg-background/60 backdrop-blur-md rounded-xl px-3 py-1.5 border border-border/30">
          <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-green-400"
              initial={{ width: 0 }}
              animate={{ width: `${(stats.done / stats.total) * 100}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
          <span className="text-xs text-white/70 tabular-nums">{Math.round((stats.done / stats.total) * 100)}%</span>
        </div>
      )}
    </div>
  );
};

export default memo(TaskStatsStrip);

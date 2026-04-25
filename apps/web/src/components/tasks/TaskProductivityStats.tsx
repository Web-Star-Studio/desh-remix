import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Flame, Target, Zap, Calendar } from "lucide-react";
import type { DbTask } from "@/types/tasks";

interface TaskProductivityStatsProps {
  tasks: DbTask[];
}

const TaskProductivityStats = memo(({ tasks }: TaskProductivityStatsProps) => {
  const stats = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // Completed tasks per day for the last 14 days
    const dailyCounts: Record<string, number> = {};
    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dailyCounts[d.toISOString().split("T")[0]] = 0;
    }
    tasks.filter(t => t.completed_at).forEach(t => {
      const day = t.completed_at!.split("T")[0];
      if (day in dailyCounts) dailyCounts[day]++;
    });

    const days = Object.entries(dailyCounts).sort((a, b) => b[0].localeCompare(a[0]));
    const thisWeek = days.slice(0, 7).reduce((s, [, c]) => s + c, 0);
    const lastWeek = days.slice(7, 14).reduce((s, [, c]) => s + c, 0);
    const weekTrend = lastWeek === 0 ? (thisWeek > 0 ? 100 : 0) : Math.round(((thisWeek - lastWeek) / lastWeek) * 100);

    // Average completion time (for tasks with due_date and completed_at)
    const completionTimes: number[] = [];
    tasks.forEach(t => {
      if (t.completed_at && t.due_date) {
        const due = new Date(t.due_date).getTime();
        const completed = new Date(t.completed_at).getTime();
        const diffDays = Math.round((completed - due) / 86400000);
        completionTimes.push(diffDays);
      }
    });
    const avgDelay = completionTimes.length > 0
      ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length)
      : null;

    // Streak
    let streak = 0;
    const completedDates = new Set(tasks.filter(t => t.completed_at).map(t => t.completed_at!.split("T")[0]));
    const d = new Date();
    if (!completedDates.has(d.toISOString().split("T")[0])) d.setDate(d.getDate() - 1);
    while (completedDates.has(d.toISOString().split("T")[0])) {
      streak++;
      d.setDate(d.getDate() - 1);
    }

    // Best day of week
    const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
    tasks.filter(t => t.completed_at).forEach(t => {
      dayOfWeekCounts[new Date(t.completed_at!).getDay()]++;
    });
    const bestDayIdx = dayOfWeekCounts.indexOf(Math.max(...dayOfWeekCounts));
    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    // Subtask completion rate
    let totalSubs = 0, doneSubs = 0;
    tasks.forEach(t => {
      (t.subtasks || []).forEach(s => { totalSubs++; if (s.completed) doneSubs++; });
    });

    return {
      thisWeek,
      lastWeek,
      weekTrend,
      streak,
      avgDelay,
      bestDay: dayNames[bestDayIdx],
      bestDayCount: dayOfWeekCounts[bestDayIdx],
      subtaskRate: totalSubs > 0 ? Math.round((doneSubs / totalSubs) * 100) : null,
      dailyCounts: days.slice(0, 7).reverse(),
    };
  }, [tasks]);

  const trendIcon = stats.weekTrend > 0 ? <TrendingUp className="w-3 h-3" /> : stats.weekTrend < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />;
  const trendColor = stats.weekTrend > 0 ? "text-green-400" : stats.weekTrend < 0 ? "text-destructive" : "text-muted-foreground";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {/* Weekly trend */}
      <div className="rounded-xl border border-foreground/5 bg-background/40 p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Zap className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] text-muted-foreground">Semana</span>
        </div>
        <p className="text-lg font-bold text-foreground">{stats.thisWeek}</p>
        <div className={`flex items-center gap-0.5 text-[10px] ${trendColor}`}>
          {trendIcon}
          {stats.weekTrend > 0 ? "+" : ""}{stats.weekTrend}% vs anterior
        </div>
      </div>

      {/* Streak */}
      <div className="rounded-xl border border-foreground/5 bg-background/40 p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Flame className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-[10px] text-muted-foreground">Streak</span>
        </div>
        <p className="text-lg font-bold text-foreground">{stats.streak}<span className="text-xs font-normal text-muted-foreground ml-0.5">dias</span></p>
        <p className="text-[10px] text-muted-foreground">consecutivos</p>
      </div>

      {/* Best day */}
      <div className="rounded-xl border border-foreground/5 bg-background/40 p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Calendar className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-[10px] text-muted-foreground">Melhor dia</span>
        </div>
        <p className="text-lg font-bold text-foreground">{stats.bestDay}</p>
        <p className="text-[10px] text-muted-foreground">{stats.bestDayCount} tarefas concluídas</p>
      </div>

      {/* Avg delay / subtask rate */}
      <div className="rounded-xl border border-foreground/5 bg-background/40 p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Target className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[10px] text-muted-foreground">Subtarefas</span>
        </div>
        <p className="text-lg font-bold text-foreground">{stats.subtaskRate ?? 0}<span className="text-xs font-normal text-muted-foreground">%</span></p>
        <p className="text-[10px] text-muted-foreground">taxa de conclusão</p>
      </div>

      {/* Mini sparkline for last 7 days */}
      <div className="col-span-2 md:col-span-4 rounded-xl border border-foreground/5 bg-background/40 p-3">
        <p className="text-[10px] text-muted-foreground mb-2">Últimos 7 dias</p>
        <div className="flex items-end gap-1 h-10">
          {stats.dailyCounts.map(([date, count]) => {
            const maxCount = Math.max(...stats.dailyCounts.map(([, c]) => c), 1);
            const height = Math.max((count / maxCount) * 100, 8);
            return (
              <motion.div
                key={date}
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ duration: 0.4, delay: 0.05 }}
                className={`flex-1 rounded-t-sm ${count > 0 ? "bg-primary/60" : "bg-foreground/5"}`}
                title={`${date.slice(5)}: ${count} tarefa(s)`}
              />
            );
          })}
        </div>
        <div className="flex gap-1 mt-1">
          {stats.dailyCounts.map(([date]) => (
            <span key={date} className="flex-1 text-center text-[8px] text-muted-foreground/50">{date.slice(8)}</span>
          ))}
        </div>
      </div>
    </div>
  );
});

TaskProductivityStats.displayName = "TaskProductivityStats";
export default TaskProductivityStats;

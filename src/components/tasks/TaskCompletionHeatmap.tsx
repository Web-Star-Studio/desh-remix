import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import type { DbTask } from "@/types/tasks";

interface TaskCompletionHeatmapProps {
  tasks: DbTask[];
}

const DAYS = 28; // 4 weeks

const TaskCompletionHeatmap = memo(({ tasks }: TaskCompletionHeatmapProps) => {
  const heatData = useMemo(() => {
    const map: Record<string, number> = {};
    tasks.forEach(t => {
      if (t.completed_at) {
        const day = t.completed_at.split("T")[0];
        map[day] = (map[day] || 0) + 1;
      }
    });

    const days: { date: string; count: number; label: string }[] = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      days.push({
        date: dateStr,
        count: map[dateStr] || 0,
        label: d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" }),
      });
    }
    return days;
  }, [tasks]);

  const maxCount = Math.max(1, ...heatData.map(d => d.count));

  const getIntensity = (count: number) => {
    if (count === 0) return "bg-foreground/5";
    const pct = count / maxCount;
    if (pct <= 0.25) return "bg-primary/20";
    if (pct <= 0.5) return "bg-primary/40";
    if (pct <= 0.75) return "bg-primary/60";
    return "bg-primary/80";
  };

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2 font-medium">Atividade (28 dias)</p>
      <div className="grid grid-cols-7 gap-1">
        {heatData.map((day, i) => (
          <motion.div
            key={day.date}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.01 }}
            className={`w-full aspect-square rounded-sm ${getIntensity(day.count)} relative group cursor-default`}
            title={`${day.label}: ${day.count} tarefa${day.count !== 1 ? "s" : ""}`}
          >
            {day.count > 0 && (
              <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold text-primary-foreground/70">
                {day.count}
              </span>
            )}
          </motion.div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-1 mt-1.5">
        <span className="text-[9px] text-muted-foreground/50">Menos</span>
        {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
          <div key={i} className={`w-2.5 h-2.5 rounded-sm ${v === 0 ? "bg-foreground/5" : v <= 0.25 ? "bg-primary/20" : v <= 0.5 ? "bg-primary/40" : v <= 0.75 ? "bg-primary/60" : "bg-primary/80"}`} />
        ))}
        <span className="text-[9px] text-muted-foreground/50">Mais</span>
      </div>
    </div>
  );
});

TaskCompletionHeatmap.displayName = "TaskCompletionHeatmap";
export default TaskCompletionHeatmap;

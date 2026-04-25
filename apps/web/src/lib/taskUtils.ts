import type { DbTask } from "@/hooks/tasks/useDbTasks";

/**
 * Calculate consecutive-day streak of completed tasks.
 */
export const calculateStreak = (tasks: DbTask[]): number => {
  const completedDates = new Set(
    tasks.filter(t => t.completed_at).map(t => t.completed_at!.split("T")[0])
  );
  let streak = 0;
  const d = new Date();
  const todayStr = d.toISOString().split("T")[0];
  if (!completedDates.has(todayStr)) {
    d.setDate(d.getDate() - 1);
  }
  while (completedDates.has(d.toISOString().split("T")[0])) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
};

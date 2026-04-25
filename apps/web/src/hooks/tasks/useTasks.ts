/**
 * useTasks — Domain facade for the Tasks module.
 */
import { useDbTasks } from "./useDbTasks";
import { useTasksPageState } from "./useTasksPageState";

export function useTasks() {
  const db = useDbTasks();
  const pageState = useTasksPageState();

  return {
    ...db,
    ...pageState,
  } as const;
}

import {
  ListTodo, StickyNote, CalendarDays, Users, Target, DollarSign,
  ArrowLeftRight, Repeat, PieChart,
} from "lucide-react";
import type { WorkspaceShareModule } from "@/types/common";

export const MODULE_ICONS: Record<WorkspaceShareModule, React.ElementType> = {
  tasks: ListTodo,
  notes: StickyNote,
  calendar: CalendarDays,
  contacts: Users,
  habits: Target,
  financegoals: DollarSign,
  transactions: ArrowLeftRight,
  recurring: Repeat,
  budgets: PieChart,
};

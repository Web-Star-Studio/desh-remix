export type EventCategory = "trabalho" | "pessoal" | "saúde" | "educação" | "lazer" | "outro";
export type RecurrenceType = "none" | "daily" | "weekly" | "monthly";

export const EVENT_CATEGORY_COLORS: Record<EventCategory, string> = {
  trabalho: "bg-blue-500",
  pessoal: "bg-emerald-500",
  saúde: "bg-rose-500",
  educação: "bg-amber-500",
  lazer: "bg-violet-500",
  outro: "bg-muted-foreground",
};

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  trabalho: "Trabalho",
  pessoal: "Pessoal",
  saúde: "Saúde",
  educação: "Educação",
  lazer: "Lazer",
  outro: "Outro",
};

export interface CalendarEvent {
  id: string;
  day: number;
  month: number;
  year: number;
  label: string;
  color: string;
  category: EventCategory;
  recurrence: RecurrenceType;
  workspace_id?: string | null;
}

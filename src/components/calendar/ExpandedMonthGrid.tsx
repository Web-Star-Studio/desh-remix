import { cn } from "@/lib/utils";
import { memo, useMemo, useState, useRef, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Eye } from "lucide-react";
import { EVENT_CATEGORY_COLORS, type EventCategory } from "@/types/calendar";
import { DeshContextMenu } from "@/components/ui/DeshContextMenu";

interface CalendarEvent {
  id: string;
  day: number;
  month: number;
  year: number;
  label: string;
  title?: string;
  color: string;
  category: EventCategory;
  startTime?: string | null;
  endTime?: string | null;
  remote?: boolean;
  googleId?: string;
}

interface ExpandedMonthGridProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onMonthChange: (date: Date) => void;
  events: CalendarEvent[];
  dragEventId: string | null;
  onDrop?: (date: Date) => void;
  className?: string;
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const ExpandedMonthGrid = memo(({
  selectedDate,
  onSelectDate,
  onMonthChange,
  events,
  dragEventId,
  onDrop,
  className,
}: ExpandedMonthGridProps) => {
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();

  const weeks = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const cells: { date: Date; isOutside: boolean }[] = [];

    // Previous month fill
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      cells.push({ date: d, isOutside: true });
    }

    // Current month
    for (let d = 1; d <= totalDays; d++) {
      cells.push({ date: new Date(year, month, d), isOutside: false });
    }

    // Next month fill
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        cells.push({ date: new Date(year, month + 1, i), isOutside: true });
      }
    }

    // Split into weeks
    const result: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      result.push(cells.slice(i, i + 7));
    }
    return result;
  }, [year, month]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach(e => {
      const key = `${e.year}-${e.month}-${e.day}`;
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [events]);

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  const prevMonth = () => {
    const d = new Date(year, month - 1, 1);
    onMonthChange(d);
  };

  const nextMonth = () => {
    const d = new Date(year, month + 1, 1);
    onMonthChange(d);
  };

  const goToday = () => {
    onMonthChange(new Date());
    onSelectDate(new Date());
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground capitalize">
            {format(selectedDate, "MMMM yyyy", { locale: ptBR })}
          </h2>
          <button
            onClick={goToday}
            className="px-2 py-0.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            Hoje
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1" role="row">
        {WEEKDAY_LABELS.map(label => (
          <div key={label} className="text-center text-xs font-medium text-muted-foreground py-1.5" role="columnheader" aria-label={label}>
            {label}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 flex-1 border-t border-l border-border/20 rounded-xl overflow-hidden" role="grid" aria-label="Calendário mensal">
        {weeks.map((week, wi) =>
          week.map((cell, di) => {
            const dayKey = `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`;
            const isToday = dayKey === todayKey;
            const isSelected =
              cell.date.getDate() === selectedDate.getDate() &&
              cell.date.getMonth() === selectedDate.getMonth() &&
              cell.date.getFullYear() === selectedDate.getFullYear();
            const dayEvents = eventsByDay[dayKey] || [];
            const isDragOver = dragOverDay === dayKey && !!dragEventId;

            return (
              <DeshContextMenu key={`${wi}-${di}`} actions={[
                { id: "create", label: "Criar evento", icon: Plus, onClick: () => { onSelectDate(cell.date); } },
                { id: "view", label: "Ver dia", icon: Eye, onClick: () => onSelectDate(cell.date) }
              ]}>
                <div
                  onClick={() => !cell.isOutside && onSelectDate(cell.date)}
                  onDragOver={e => {
                    if (!dragEventId || cell.isOutside) return;
                    e.preventDefault();
                    setDragOverDay(dayKey);
                  }}
                  onDragLeave={() => setDragOverDay(null)}
                  onDrop={e => {
                    e.preventDefault();
                    setDragOverDay(null);
                    if (dragEventId && !cell.isOutside && onDrop) onDrop(cell.date);
                  }}
                  className={cn(
                    "relative border-r border-b border-border/20 p-1 min-h-[72px] sm:min-h-[80px] lg:min-h-[88px] cursor-pointer transition-all duration-150 group",
                    cell.isOutside
                      ? "bg-foreground/5"
                      : isSelected
                      ? "bg-primary/10 ring-1 ring-inset ring-primary/30"
                      : "hover:bg-muted/30",
                    isDragOver && "bg-primary/20 ring-2 ring-inset ring-primary/40 shadow-[inset_0_0_12px_hsl(var(--primary)/0.15)]",
                  )}
                >
                  {/* Day number */}
                <div className="flex items-center justify-between mb-0.5">
                  <span
                    className={cn(
                      "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full transition-colors",
                      cell.isOutside && "text-muted-foreground/40",
                      isToday && "bg-primary text-primary-foreground font-bold",
                      isSelected && !isToday && "text-primary font-bold",
                      !isToday && !isSelected && !cell.isOutside && "text-foreground/80",
                    )}
                  >
                    {cell.date.getDate()}
                  </span>
                  {dayEvents.length > 3 && (
                    <span className="text-[10px] text-muted-foreground font-medium">
                      +{dayEvents.length - 3}
                    </span>
                  )}
                </div>

                {/* Event pills — show up to 3 */}
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map(ev => {
                    const colorClass = EVENT_CATEGORY_COLORS[ev.category] || ev.color || "bg-primary";
                    const title = ev.title || ev.label?.replace(/\s*\(\d{2}:\d{2}\)/, "").trim() || "";
                    return (
                      <div
                        key={ev.id}
                        className={cn(
                          "flex items-center gap-1 px-1 py-px rounded text-[10px] leading-tight truncate",
                          "bg-muted/60 hover:bg-muted/80 transition-colors",
                        )}
                        title={`${ev.startTime || ""} ${title}`}
                      >
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", colorClass)} />
                        <span className="truncate text-foreground/70">
                          {ev.startTime && (
                            <span className="text-muted-foreground font-medium mr-0.5">
                              {ev.startTime.slice(0, 5)}
                            </span>
                          )}
                          {title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              </DeshContextMenu>
            );
          })
        )}
      </div>
    </div>
  );
});

ExpandedMonthGrid.displayName = "ExpandedMonthGrid";

export default ExpandedMonthGrid;

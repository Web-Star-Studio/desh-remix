import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { CalendarEvent } from "@/hooks/calendar/useCalendarEvents";

interface WeekGridProps {
  weekDays: Date[];
  todayDay: number;
  todayMonth: number;
  selectedDay: number | null;
  displayEvents: CalendarEvent[];
  onSelectDay: (day: number | null) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}

const DAY_NAMES_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const WeekGrid = ({
  weekDays, todayDay, todayMonth, selectedDay, displayEvents,
  onSelectDay, onPrevWeek, onNextWeek,
}: WeekGridProps) => {
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  // Pre-compute event counts by day-month key
  const eventCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    displayEvents.forEach(e => {
      const key = `${e.month}-${e.day}`;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [displayEvents]);

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onPrevWeek}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-foreground/5 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">
            {weekStart.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
            {" – "}
            {weekEnd.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
          </p>
          <p className="text-[10px] text-muted-foreground/60 capitalize">
            {weekStart.toLocaleDateString("pt-BR", { year: "numeric" })}
          </p>
        </div>
        <button
          onClick={onNextWeek}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-foreground/5 transition-all"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-3">
        {weekDays.map((wd, i) => {
          const d = wd.getDate();
          const m = wd.getMonth();
          const isToday = d === todayDay && m === todayMonth;
          const isSelected = selectedDay === d;
          const count = eventCountMap[`${m}-${d}`] || 0;

          return (
            <motion.button
              key={i}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.1 }}
              onClick={() => onSelectDay(isSelected ? null : d)}
              className={`relative flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all ${
                isToday
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : isSelected
                  ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                  : "text-foreground/80 hover:bg-foreground/5"
              }`}
            >
              <span className={`text-[10px] font-medium ${isToday ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {DAY_NAMES_SHORT[i]}
              </span>
              <span className="text-sm font-bold">{d}</span>

              {/* Event indicators */}
              {count > 0 && !isToday && (
                <div className="flex items-center gap-0.5">
                  {count === 1 && <span className="w-1 h-1 rounded-full bg-primary" />}
                  {count === 2 && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-primary opacity-90" />
                      <span className="w-1 h-1 rounded-full bg-primary opacity-50" />
                    </>
                  )}
                  {count >= 3 && (
                    <span className="text-[8px] font-bold text-primary">{count}</span>
                  )}
                </div>
              )}
              {isToday && count > 0 && (
                <span className="text-[8px] font-medium text-primary-foreground/75">{count}ev</span>
              )}
            </motion.button>
          );
        })}
      </div>
    </>
  );
};

export default WeekGrid;

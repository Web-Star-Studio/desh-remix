import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

interface MonthGridProps {
  monthName: string;
  viewYear: number;
  isCurrentMonth: boolean;
  todayDay: number;
  days: (number | null)[];
  selectedDay: number | null;
  eventDays: Set<number>;
  eventCountByDay?: Record<number, number>; // day → count for density
  maxEventCount?: number;
  onSelectDay: (day: number | null) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onGoToday: () => void;
}

const DAY_NAMES = ["D", "S", "T", "Q", "Q", "S", "S"];

const MonthGrid = ({
  monthName, viewYear, isCurrentMonth, todayDay, days,
  selectedDay, eventDays, eventCountByDay = {}, maxEventCount = 1,
  onSelectDay, onPrevMonth, onNextMonth, onGoToday,
}: MonthGridProps) => (
  <>
    <div className="flex items-center justify-between mb-3">
      <button
        onClick={onPrevMonth}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-foreground/5 transition-all"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-2">
        <p className="text-lg font-semibold text-foreground capitalize">{monthName} {viewYear}</p>
        {!isCurrentMonth && (
          <button
            onClick={onGoToday}
            className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors"
          >
            Hoje
          </button>
        )}
      </div>
      <button
        onClick={onNextMonth}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-foreground/5 transition-all"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>

    {/* Day headers */}
    <div className="grid grid-cols-7 gap-1 text-center text-xs mb-1">
      {DAY_NAMES.map((d, i) => (
        <span key={i} className="text-muted-foreground/60 font-medium py-1 text-[10px] uppercase tracking-wide">{d}</span>
      ))}
    </div>

    {/* Day cells */}
    <div className="grid grid-cols-7 gap-1 text-center text-xs mb-3">
      {days.map((day, i) => {
        const isToday = isCurrentMonth && day === todayDay;
        const isSelected = selectedDay === day && !!day;
        const count = day ? (eventCountByDay[day] || 0) : 0;
        const intensity = count > 0 && !isToday && !isSelected
          ? 0.06 + (count / Math.max(maxEventCount, 1)) * 0.22
          : 0;

        return (
          <motion.button
            key={i}
            whileHover={day ? { scale: 1.08 } : undefined}
            whileTap={day ? { scale: 0.95 } : undefined}
            transition={{ duration: 0.12 }}
            onClick={() => day && onSelectDay(isSelected ? null : day)}
            className={`relative py-1.5 rounded-lg text-xs transition-all ${
              isToday
                ? "bg-primary text-primary-foreground font-bold shadow-sm"
                : isSelected
                ? "bg-primary/20 text-primary font-semibold ring-1 ring-primary/50"
                : day
                ? "text-foreground/80 hover:bg-foreground/8 cursor-pointer"
                : "cursor-default"
            }`}
            style={intensity > 0 ? { background: `hsl(var(--primary) / ${intensity})` } : undefined}
            disabled={!day}
          >
            {day || ""}
            {/* Event dot(s) */}
            {day && eventDays.has(day) && !isToday && (
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5">
                {count > 2 ? (
                  <>
                    <span className="w-1 h-1 rounded-full bg-primary opacity-90" />
                    <span className="w-1 h-1 rounded-full bg-primary opacity-60" />
                    <span className="w-1 h-1 rounded-full bg-primary opacity-30" />
                  </>
                ) : count === 2 ? (
                  <>
                    <span className="w-1 h-1 rounded-full bg-primary opacity-90" />
                    <span className="w-1 h-1 rounded-full bg-primary opacity-50" />
                  </>
                ) : (
                  <span className="w-1 h-1 rounded-full bg-primary" />
                )}
              </span>
            )}
            {/* Count badge for busy days */}
            {day && count > 3 && !isToday && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[13px] h-[13px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[8px] font-bold leading-none px-0.5 pointer-events-none">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  </>
);

export default MonthGrid;

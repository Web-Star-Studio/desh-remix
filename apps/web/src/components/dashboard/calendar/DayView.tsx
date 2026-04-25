import { useRef, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X, Clock, MapPin, Users, Video, ChevronRight } from "lucide-react";

interface DayEvent {
  id: string;
  label: string;
  color: string;
  startHour?: number; // 0–23
  startMin?: number;  // 0–59
  endHour?: number;
  endMin?: number;
  googleId?: string;
  location?: string;
  attendees?: any[];
  hangoutLink?: string;
  remote?: boolean;
}

interface DayViewProps {
  date: Date;
  events: DayEvent[];
  onClose: () => void;
  onEventClick?: (event: DayEvent) => void;
}

const HOUR_HEIGHT = 64; // px per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function parseEventTime(event: DayEvent) {
  // Try to extract HH:MM from label like "Meeting (09:30)"
  const match = event.label.match(/\((\d{1,2}):(\d{2})\)/);
  if (match) {
    return {
      startHour: parseInt(match[1]),
      startMin: parseInt(match[2]),
      endHour: parseInt(match[1]) + 1,
      endMin: parseInt(match[2]),
    };
  }
  if (event.startHour !== undefined) {
    return {
      startHour: event.startHour,
      startMin: event.startMin ?? 0,
      endHour: event.endHour ?? event.startHour + 1,
      endMin: event.endMin ?? 0,
    };
  }
  return null;
}

function getTopOffset(hour: number, min: number) {
  return (hour + min / 60) * HOUR_HEIGHT;
}

function getDuration(startH: number, startM: number, endH: number, endM: number) {
  const startTotal = startH * 60 + startM;
  const endTotal = endH * 60 + endM;
  const diffMin = Math.max(endTotal - startTotal, 30); // min 30min height
  return (diffMin / 60) * HOUR_HEIGHT;
}

// Detect overlapping events and assign column indices
function layoutEvents(events: Array<{ event: DayEvent; startH: number; startM: number; endH: number; endM: number }>) {
  type Col = typeof events[number] & { col: number; totalCols: number };
  const result: Col[] = events.map(e => ({ ...e, col: 0, totalCols: 1 }));

  for (let i = 0; i < result.length; i++) {
    const a = result[i];
    const aStart = a.startH * 60 + a.startM;
    const aEnd = a.endH * 60 + a.endM;
    const overlapping = [a];
    for (let j = 0; j < result.length; j++) {
      if (i === j) continue;
      const b = result[j];
      const bStart = b.startH * 60 + b.startM;
      const bEnd = b.endH * 60 + b.endM;
      if (bStart < aEnd && bEnd > aStart) overlapping.push(b);
    }
    overlapping.forEach((ev, idx) => {
      ev.col = idx;
      ev.totalCols = overlapping.length;
    });
  }
  return result;
}

const DayView = ({ date, events, onClose, onEventClick }: DayViewProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to 7am on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 7 * HOUR_HEIGHT - 16;
    }
  }, []);

  const now = useMemo(() => new Date(), []);
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  const nowTopOffset = isToday
    ? getTopOffset(now.getHours(), now.getMinutes())
    : null;

  // Day progress percentage (only meaningful for today)
  const dayProgress = isToday
    ? Math.round(((now.getHours() * 60 + now.getMinutes()) / (24 * 60)) * 100)
    : null;

  // Parse events into timed + all-day
  const timedItems: Array<{
    event: DayEvent;
    startH: number;
    startM: number;
    endH: number;
    endM: number;
  }> = [];
  const allDayItems: DayEvent[] = [];

  events.forEach(ev => {
    const parsed = parseEventTime(ev);
    if (parsed) {
      timedItems.push({ event: ev, startH: parsed.startHour, startM: parsed.startMin, endH: parsed.endHour, endM: parsed.endMin });
    } else {
      allDayItems.push(ev);
    }
  });

  const laid = layoutEvents(timedItems);

  // Next upcoming event (if today)
  const nextEvent = useMemo(() => {
    if (!isToday) return null;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const upcoming = timedItems
      .filter(t => t.startH * 60 + t.startM > nowMin)
      .sort((a, b) => (a.startH * 60 + a.startM) - (b.startH * 60 + b.startM));
    return upcoming[0] || null;
  }, [isToday, timedItems, now]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ background: "hsl(var(--background) / 0.97)", backdropFilter: "blur(24px)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b shrink-0"
        style={{ borderColor: "hsl(var(--border))" }}
      >
        <div>
          <p className="text-xs font-medium capitalize" style={{ color: "hsl(var(--muted-foreground))" }}>
            {format(date, "EEEE", { locale: ptBR })}
          </p>
          <p className="text-xl font-bold" style={{ color: "hsl(var(--foreground))" }}>
            {format(date, "dd 'de' MMMM yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Day progress */}
          {dayProgress !== null && (
            <div className="hidden sm:flex flex-col items-end gap-1">
              <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                {dayProgress}% do dia
              </span>
              <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(var(--foreground) / 0.08)" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${dayProgress}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ background: "hsl(var(--primary))" }}
                />
              </div>
            </div>
          )}
          {isToday && (
            <span
              className="text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}
            >
              Hoje
            </span>
          )}
          <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
            {events.length} evento{events.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors hover:bg-foreground/10"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Next event banner */}
      {nextEvent && (
        <div
          className="px-5 py-2 border-b flex items-center gap-3 shrink-0"
          style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--primary) / 0.04)" }}
        >
          <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "hsl(var(--primary))" }} />
          <span className="text-xs font-medium" style={{ color: "hsl(var(--primary))" }}>Próximo:</span>
          <span className="text-xs truncate" style={{ color: "hsl(var(--foreground) / 0.8)" }}>
            {nextEvent.event.label.replace(/\s*\(\d{2}:\d{2}\)/, "")}
          </span>
          <span className="text-xs ml-auto shrink-0 tabular-nums" style={{ color: "hsl(var(--muted-foreground))" }}>
            {String(nextEvent.startH).padStart(2, "0")}:{String(nextEvent.startM).padStart(2, "0")}
          </span>
        </div>
      )}

      {/* All-day strip */}
      {allDayItems.length > 0 && (
        <div
          className="px-5 py-2 border-b flex items-center gap-2 flex-wrap shrink-0"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider w-14 text-right shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>
            Dia todo
          </span>
          {allDayItems.map(ev => (
            <button
              key={ev.id}
              onClick={() => onEventClick?.(ev)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90 ${ev.color}`}
            >
              {ev.label.replace(/\s*\(\d{2}:\d{2}\)/, "")}
            </button>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div className="flex flex-1 overflow-hidden">
        {/* Scrollable area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto relative">
          <div className="relative" style={{ height: `${24 * HOUR_HEIGHT}px`, minWidth: 0 }}>
            {/* Hour lines + labels */}
            {HOURS.map(h => (
              <div
                key={h}
                className="absolute left-0 right-0 flex items-start"
                style={{ top: `${h * HOUR_HEIGHT}px` }}
              >
                <span
                  className="text-[10px] w-14 text-right pr-3 shrink-0 select-none -mt-2"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
                </span>
                <div
                  className="flex-1 border-t"
                  style={{ borderColor: "hsl(var(--border) / 0.5)" }}
                />
              </div>
            ))}

            {/* Current time line */}
            {nowTopOffset !== null && (
              <div
                className="absolute left-14 right-0 z-20 flex items-center pointer-events-none"
                style={{ top: `${nowTopOffset}px` }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full -ml-1.5 shrink-0"
                  style={{ background: "hsl(var(--primary))" }}
                />
                <div
                  className="flex-1 h-0.5"
                  style={{ background: "hsl(var(--primary))" }}
                />
              </div>
            )}

            {/* Events */}
            <div className="absolute left-14 right-3 top-0 bottom-0">
              {laid.map(({ event: ev, startH, startM, endH, endM, col, totalCols }) => {
                const top = getTopOffset(startH, startM);
                const height = getDuration(startH, startM, endH, endM);
                const widthPct = 1 / totalCols;
                const leftPct = col / totalCols;
                const cleanLabel = ev.label.replace(/\s*\(\d{2}:\d{2}\)/, "");
                const startStr = `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;
                const endStr = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

                return (
                  <motion.button
                    key={ev.id}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => onEventClick?.(ev)}
                    className={`absolute rounded-lg px-2 py-1.5 text-left overflow-hidden text-white transition-all hover:brightness-110 hover:shadow-lg ${ev.color}`}
                    style={{
                      top: `${top}px`,
                      height: `${height - 2}px`,
                      left: `calc(${leftPct * 100}% + ${col > 0 ? 2 : 0}px)`,
                      width: `calc(${widthPct * 100}% - ${col > 0 ? 2 : 0}px - 2px)`,
                      opacity: 0.92,
                    }}
                  >
                    <p className="text-xs font-semibold leading-tight truncate">{cleanLabel}</p>
                    <p className="text-[10px] opacity-80 mt-0.5 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {startStr} – {endStr}
                    </p>
                    {height > 60 && ev.location && (
                      <p className="text-[10px] opacity-75 flex items-center gap-1 mt-0.5 truncate">
                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                        {ev.location}
                      </p>
                    )}
                    {height > 80 && ev.hangoutLink && (
                      <p className="text-[10px] opacity-75 flex items-center gap-1 mt-0.5">
                        <Video className="w-2.5 h-2.5 shrink-0" />
                        Meet
                      </p>
                    )}
                    {height > 80 && ev.attendees && ev.attendees.length > 0 && (
                      <p className="text-[10px] opacity-75 flex items-center gap-1 mt-0.5">
                        <Users className="w-2.5 h-2.5 shrink-0" />
                        {ev.attendees.length} participante{ev.attendees.length !== 1 ? "s" : ""}
                      </p>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default DayView;

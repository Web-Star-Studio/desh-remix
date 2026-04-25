import { useRef, useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Clock, Loader2, GripVertical, Plus } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

/* ─── Types ─────────────────────────────────────────────────────────────── */
export interface WeekTimeEvent {
  id: string;
  googleId?: string;
  title: string;
  startTime?: string | null; // "HH:MM"
  endTime?: string | null;   // "HH:MM"
  day: number;
  month: number;
  year: number;
  color: string;             // tailwind bg-* class
  remote: boolean;
}

interface WeekTimeGridProps {
  weekDays: Date[];
  events: WeekTimeEvent[];
  movingEventId: string | null;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onMoveEvent: (eventId: string, newDate: Date, newStartTime: string, newEndTime: string) => Promise<void>;
  onEventClick?: (event: WeekTimeEvent) => void;
  onSlotClick?: (date: Date, time: string) => void;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */
const HOUR_START = 6;
const HOUR_END = 23;
const TOTAL_HOURS = HOUR_END - HOUR_START;
const SLOT_MINUTES = 30;
const SLOTS_PER_HOUR = 60 / SLOT_MINUTES;
const TOTAL_SLOTS = TOTAL_HOURS * SLOTS_PER_HOUR;
const TIME_COL_W = 36;

const DAY_NAMES_SHORT = ["D", "S", "T", "Q", "Q", "S", "S"];
const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};
const toTimeStr = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/* ─── Component ──────────────────────────────────────────────────────────── */
export default function WeekTimeGrid({
  weekDays, events, movingEventId,
  onPrevWeek, onNextWeek, onMoveEvent,
  onEventClick, onSlotClick,
}: WeekTimeGridProps) {
  const isMobile = useIsMobile();
  const SLOT_H = isMobile ? 26 : 28;
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

  // Drag state (HTML5 drag-and-drop)
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffsetMin, setDragOffsetMin] = useState(0);
  const [dropTarget, setDropTarget] = useState<{ dayIndex: number; slotIndex: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);

  /* ─── Auto-scroll to current time on mount ───────────────────────────── */
  useEffect(() => {
    if (hasScrolled.current || !gridRef.current) return;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin >= HOUR_START * 60 && nowMin <= HOUR_END * 60) {
      const scrollTarget = ((nowMin - HOUR_START * 60) / SLOT_MINUTES) * SLOT_H - 80;
      gridRef.current.scrollTo({ top: Math.max(0, scrollTarget), behavior: "smooth" });
      hasScrolled.current = true;
    }
  }, [SLOT_H]);

  /* ─── Helpers ─────────────────────────────────────────────────────────── */
  const slotToMinutes = (slotIndex: number) => HOUR_START * 60 + slotIndex * SLOT_MINUTES;

  const eventsForDay = useCallback((d: Date) =>
    events.filter(e =>
      e.day === d.getDate() &&
      e.month === d.getMonth() &&
      e.year === d.getFullYear()
    ), [events]);

  const eventStyle = (ev: WeekTimeEvent) => {
    if (!ev.startTime) return null;
    const startMin = toMinutes(ev.startTime);
    const endMin = ev.endTime ? toMinutes(ev.endTime) : startMin + 60;
    const clampedStart = Math.max(startMin, HOUR_START * 60);
    const clampedEnd = Math.min(endMin, HOUR_END * 60);
    const top = ((clampedStart - HOUR_START * 60) / SLOT_MINUTES) * SLOT_H;
    const height = Math.max(((clampedEnd - clampedStart) / SLOT_MINUTES) * SLOT_H, SLOT_H);
    return { top, height };
  };

  /* ─── Drag handlers ──────────────────────────────────────────────────────*/
  const handleDragStart = useCallback((ev: React.DragEvent, event: WeekTimeEvent) => {
    if (isMobile) return;
    setDraggingId(event.id);
    const target = ev.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const offsetPx = ev.clientY - rect.top;
    const offsetMin = Math.floor((offsetPx / SLOT_H) * SLOT_MINUTES);
    setDragOffsetMin(Math.max(0, offsetMin));
    ev.dataTransfer.effectAllowed = "move";
  }, [isMobile, SLOT_H]);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDropTarget(null);
  }, []);

  const handleSlotDragOver = useCallback((e: React.DragEvent, dayIndex: number, slotIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget({ dayIndex, slotIndex });
  }, []);

  const handleSlotDrop = useCallback(async (e: React.DragEvent, dayIndex: number, slotIndex: number) => {
    e.preventDefault();
    if (!draggingId) return;

    const draggedEvent = events.find(ev => ev.id === draggingId);
    if (!draggedEvent) { setDraggingId(null); setDropTarget(null); return; }

    const rawStartMin = slotToMinutes(slotIndex) - dragOffsetMin;
    const newStartMin = Math.max(HOUR_START * 60, Math.round(rawStartMin / SLOT_MINUTES) * SLOT_MINUTES);

    const origStartMin = draggedEvent.startTime ? toMinutes(draggedEvent.startTime) : HOUR_START * 60;
    const origEndMin = draggedEvent.endTime ? toMinutes(draggedEvent.endTime) : origStartMin + 60;
    const durationMin = origEndMin - origStartMin;
    const newEndMin = Math.min(HOUR_END * 60, newStartMin + durationMin);

    const newDate = weekDays[dayIndex];
    const newStartTime = toTimeStr(newStartMin);
    const newEndTime = toTimeStr(newEndMin);

    const isSameDay = newDate.getDate() === draggedEvent.day &&
      newDate.getMonth() === draggedEvent.month &&
      newDate.getFullYear() === draggedEvent.year;
    if (isSameDay && newStartTime === draggedEvent.startTime) {
      setDraggingId(null); setDropTarget(null);
      return;
    }

    await onMoveEvent(draggedEvent.id, newDate, newStartTime, newEndTime);
    setDraggingId(null);
    setDropTarget(null);
  }, [draggingId, dragOffsetMin, events, weekDays, onMoveEvent]);

  /* ─── Slot click handler ─────────────────────────────────────────────── */
  const handleSlotClick = useCallback((dayIndex: number, slotIndex: number) => {
    if (draggingId) return;
    const date = weekDays[dayIndex];
    const minutes = slotToMinutes(slotIndex);
    const time = toTimeStr(minutes);
    onSlotClick?.(date, time);
  }, [weekDays, draggingId, onSlotClick]);

  /* ─── Current time indicator ─────────────────────────────────────────── */
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowTop = ((nowMin - HOUR_START * 60) / SLOT_MINUTES) * SLOT_H;
  const showNow = nowMin >= HOUR_START * 60 && nowMin <= HOUR_END * 60;

  /* ─── Drop ghost preview ──────────────────────────────────────────────── */
  const draggedEvent = draggingId ? events.find(e => e.id === draggingId) : null;
  const ghostDurationMin = draggedEvent?.startTime && draggedEvent?.endTime
    ? toMinutes(draggedEvent.endTime) - toMinutes(draggedEvent.startTime)
    : 60;

  const dayNames = isMobile ? DAY_NAMES_SHORT : DAY_NAMES;

  /* ─── Event count per day ────────────────────────────────────────────── */
  const dayEventCounts = weekDays.map(d => eventsForDay(d).length);
  const totalWeekEvents = dayEventCounts.reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col h-full select-none">
      {/* Header nav */}
      <div className="flex items-center justify-between mb-2 sm:mb-3 px-1">
        <button
          onClick={onPrevWeek}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all active:scale-90"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center min-w-0">
          <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
            {weekDays[0].toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
            {" – "}
            {weekDays[6].toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}
          </p>
          <p className="text-[9px] sm:text-[10px] text-muted-foreground/60 flex items-center justify-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {totalWeekEvents} evento{totalWeekEvents !== 1 ? "s" : ""}
            {!isMobile && " · arraste para mover"}
          </p>
        </div>
        <button
          onClick={onNextWeek}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all active:scale-90"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day column headers */}
      <div className="flex" style={{ paddingLeft: TIME_COL_W }}>
        {weekDays.map((d, i) => {
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          const isToday = key === todayStr;
          const count = dayEventCounts[i];
          return (
            <div key={i} className="flex-1 text-center pb-1 sm:pb-2">
              <p className={`text-[9px] sm:text-[10px] font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                {dayNames[i]}
              </p>
              <div className={`inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-xs sm:text-sm font-bold transition-colors ${
                isToday ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30" : "text-foreground/80"
              }`}>
                {d.getDate()}
              </div>
              {count > 0 && (
                <div className="flex justify-center gap-0.5 mt-0.5">
                  {count <= 3 ? (
                    Array.from({ length: count }, (_, idx) => (
                      <div key={idx} className={`w-1 h-1 rounded-full ${isToday ? "bg-primary-foreground/60" : "bg-primary/60"}`} />
                    ))
                  ) : (
                    <span className={`text-[8px] font-bold ${isToday ? "text-primary-foreground/70" : "text-primary/70"}`}>{count}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Scrollable grid */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden rounded-xl border border-foreground/8 bg-foreground/[0.02]" ref={gridRef}>
        <div className="flex relative" style={{ minHeight: TOTAL_SLOTS * SLOT_H }}>
          {/* Time labels column */}
          <div className="shrink-0 sticky left-0 z-10 bg-background/80 backdrop-blur-sm" style={{ width: TIME_COL_W }}>
            {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
              const hour = HOUR_START + i;
              return (
                <div
                  key={hour}
                  className="flex items-start justify-end pr-1 sm:pr-2"
                  style={{ height: SLOTS_PER_HOUR * SLOT_H }}
                >
                  <span className="text-[8px] sm:text-[9px] text-muted-foreground/50 -translate-y-1.5 tabular-nums">
                    {String(hour).padStart(2, "0")}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Day columns */}
          {weekDays.map((d, dayIndex) => {
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const isToday = key === todayStr;
            const dayEvs = eventsForDay(d);

            return (
              <div key={dayIndex} className={`flex-1 relative border-l border-foreground/8 min-w-0 ${isToday ? "bg-primary/[0.03]" : ""}`}>
                {/* Hour grid lines + slot click targets */}
                {Array.from({ length: TOTAL_SLOTS }, (_, slotIdx) => {
                  const isHourBoundary = slotIdx % SLOTS_PER_HOUR === 0;
                  const isDropTarget = dropTarget?.dayIndex === dayIndex && dropTarget?.slotIndex === slotIdx;
                  return (
                    <div
                      key={slotIdx}
                      className={`absolute w-full transition-all duration-150 ${
                        isDropTarget
                          ? "bg-primary/20 ring-2 ring-primary/50 ring-inset z-10 shadow-inner"
                          : isHourBoundary
                          ? "border-t border-foreground/10"
                          : "border-t border-foreground/[0.04]"
                      } ${onSlotClick ? "cursor-pointer hover:bg-primary/[0.06] active:bg-primary/10" : ""}`}
                      style={{ top: slotIdx * SLOT_H, height: SLOT_H }}
                      onClick={() => handleSlotClick(dayIndex, slotIdx)}
                      onDragOver={!isMobile ? (e => handleSlotDragOver(e, dayIndex, slotIdx)) : undefined}
                      onDrop={!isMobile ? (e => handleSlotDrop(e, dayIndex, slotIdx)) : undefined}
                    >
                      {/* + indicator on hover for empty slots */}
                      {onSlotClick && !isDropTarget && (
                        <div className="w-full h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                          <Plus className="w-3 h-3 text-primary/40" />
                        </div>
                      )}
                      {/* Ghost preview */}
                      {isDropTarget && draggingId && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 0.5, scale: 1 }}
                          className={`absolute inset-x-0.5 sm:inset-x-1 rounded-lg ${draggedEvent?.color || "bg-primary"} z-20 pointer-events-none border-2 border-dashed border-white/30 shadow-lg`}
                          style={{ top: 0, height: (ghostDurationMin / SLOT_MINUTES) * SLOT_H }}
                        />
                      )}
                    </div>
                  );
                })}

                {/* Current time indicator */}
                {isToday && showNow && (
                  <div
                    className="absolute left-0 right-0 z-30 flex items-center pointer-events-none"
                    style={{ top: nowTop }}
                  >
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0 -ml-1 shadow-sm shadow-primary/50" />
                    <div className="flex-1 h-[1.5px] bg-primary opacity-80" />
                  </div>
                )}

                {/* Events */}
                {dayEvs.filter(ev => ev.startTime).map(ev => {
                  const style = eventStyle(ev);
                  if (!style) return null;
                  const isDragging = draggingId === ev.id;
                  const isMoving = movingEventId === ev.id;
                  const isShort = style.height < SLOT_H * 2;

                  return (
                    <div
                      key={ev.id}
                      className={`absolute inset-x-0.5 sm:inset-x-1 rounded-lg overflow-hidden z-20 group transition-all duration-200 ${ev.color} ${
                        isDragging ? "ring-2 ring-primary opacity-30 scale-95 rotate-1 shadow-2xl" : "hover:brightness-110 hover:shadow-lg"
                      } ${onEventClick ? "cursor-pointer active:scale-[0.97]" : ""} ${!isMobile ? "cursor-grab active:cursor-grabbing hover:scale-[1.02]" : ""}`}
                      style={{ top: style.top, height: style.height }}
                      draggable={!isMobile && ev.remote && !isMoving}
                      onDragStart={!isMobile ? ((e: React.DragEvent<HTMLDivElement>) => handleDragStart(e, ev)) : undefined}
                      onDragEnd={!isMobile ? handleDragEnd : undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick?.(ev);
                      }}
                      title={`${ev.title} · ${ev.startTime}${ev.endTime ? `–${ev.endTime}` : ""}`}
                    >
                      <div className="p-1 sm:p-1.5 h-full flex flex-col overflow-hidden">
                        <div className="flex items-start gap-0.5 min-w-0">
                          {!isMobile && (
                            <GripVertical className="w-2.5 h-2.5 text-white/40 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                          <p className={`${isShort ? "text-[8px] sm:text-[9px]" : "text-[9px] sm:text-[11px]"} font-semibold text-white leading-snug truncate flex-1`}>
                            {isMoving ? <Loader2 className="w-2.5 h-2.5 animate-spin inline-block" /> : ev.title}
                          </p>
                        </div>
                        {!isShort && (
                          <p className="text-[7px] sm:text-[9px] text-white/70 leading-none mt-0.5">
                            {ev.startTime}{ev.endTime ? ` – ${ev.endTime}` : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* All-day events (no startTime) */}
                {dayEvs.filter(ev => !ev.startTime).map((ev, idx) => (
                  <div
                    key={ev.id}
                    className={`absolute inset-x-0.5 sm:inset-x-1 rounded-md ${ev.color} opacity-85 cursor-pointer active:scale-[0.97] transition-transform`}
                    style={{ top: idx * (isMobile ? 14 : 16), height: isMobile ? 12 : 14 }}
                    title={ev.title}
                    onClick={(e) => { e.stopPropagation(); onEventClick?.(ev); }}
                  >
                    <p className={`text-[7px] sm:text-[8px] text-white font-medium truncate px-1 ${isMobile ? "leading-[12px]" : "leading-[14px]"}`}>{ev.title}</p>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Drag hint — desktop only */}
      {!isMobile && (
        <AnimatePresence>
          {draggingId && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mt-2 text-center text-xs text-primary font-medium flex items-center justify-center gap-2 py-1.5 rounded-lg bg-primary/10 border border-primary/20"
            >
              <GripVertical className="w-3.5 h-3.5" />
              Solte no slot desejado para reagendar
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

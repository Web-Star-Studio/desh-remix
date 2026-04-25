import { memo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, CheckCircle2, Clock, HelpCircle, LayoutList } from "lucide-react";
import { EVENT_CATEGORY_COLORS } from "@/contexts/DashboardContext";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import GlassCard from "@/components/dashboard/GlassCard";
import CalendarEventCard from "@/components/calendar/CalendarEventCard";
import CalendarAddEventForm from "@/components/calendar/CalendarAddEventForm";
import type { EventCategory, RecurrenceType } from "@/types/calendar";

interface CalendarDayDetailPanelProps {
  selectedDate: Date;
  selectedEvents: any[];
  filterPending: boolean;
  pendingEvents: any[];
  editingEventId: string | null;
  dragEventId: string | null;
  calendarWorkspaceId: string | null;
  rsvpMap: Record<string, string>;
  rsvpLoading: Record<string, boolean>;
  onRsvp: (eventId: string, status: string) => void;
  onEdit: (ev: any) => void;
  onDelete: (ev: any) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onOpenEdit: () => void;
  onCancelEdit: () => void;
  onSetDetailEvent: (ev: any) => void;
  onDayViewOpen: () => void;
  // Add event form props
  newTitle: string; setNewTitle: (v: string) => void;
  newTime: string; setNewTime: (v: string) => void;
  newEndTime: string; setNewEndTime: (v: string) => void;
  newCategory: EventCategory; setNewCategory: (v: EventCategory) => void;
  newRecurrence: RecurrenceType; setNewRecurrence: (v: RecurrenceType) => void;
  newDescription: string; setNewDescription: (v: string) => void;
  newLocation: string; setNewLocation: (v: string) => void;
  newGuests: string; setNewGuests: (v: string) => void;
  newReminder: number; setNewReminder: (v: number) => void;
  addMeet: boolean; setAddMeet: (v: boolean) => void;
  showAdvanced: boolean; setShowAdvanced: (v: boolean) => void;
  googleConnected: boolean;
  creatingRemote: boolean;
  onSubmit: () => void;
}

const CalendarDayDetailPanel = memo((props: CalendarDayDetailPanelProps) => {
  const {
    selectedDate, selectedEvents, filterPending, pendingEvents,
    editingEventId, dragEventId, calendarWorkspaceId,
    rsvpMap, rsvpLoading, onRsvp, onEdit, onDelete,
    onDragStart, onDragEnd, onOpenEdit, onCancelEdit, onSetDetailEvent, onDayViewOpen,
    ...formProps
  } = props;

  return (
    <AnimatedItem index={2}>
      <GlassCard className="flex flex-col h-full sticky top-4" size="auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0">
            {filterPending ? (
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                Convites pendentes
                <span className="text-xs text-muted-foreground font-normal">({pendingEvents.length})</span>
              </p>
            ) : (
              <>
                <p className="text-sm font-semibold text-foreground">
                  {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {format(selectedDate, "EEEE", { locale: ptBR })} · {selectedEvents.length} evento{selectedEvents.length !== 1 ? "s" : ""}
                </p>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!filterPending && selectedEvents.length > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                selectedEvents.length >= 5 ? "bg-destructive/15 text-destructive" :
                selectedEvents.length >= 3 ? "bg-amber-500/15 text-amber-400" :
                "bg-emerald-500/15 text-emerald-400"
              }`}>
                {selectedEvents.length >= 5 ? "Cheio" : selectedEvents.length >= 3 ? "Moderado" : "Leve"}
              </span>
            )}
            {!filterPending && (
              <button
                onClick={onDayViewOpen}
                aria-label="Vista de dia (00h–24h)"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <LayoutList className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Mini Day Timeline */}
        {!filterPending && selectedEvents.some(e => e.startTime) && (() => {
          const HOUR_START = 6;
          const HOUR_END = 23;
          const TOTAL_HOURS = HOUR_END - HOUR_START;
          const toMinutes = (t: string) => {
            const [h, m] = t.split(":").map(Number);
            return h * 60 + (m || 0);
          };
          const timedEvents = selectedEvents
            .filter(e => e.startTime)
            .map(e => {
              const startMin = toMinutes(e.startTime);
              const endMin = e.endTime ? toMinutes(e.endTime) : startMin + 60;
              const clampedStart = Math.max(startMin, HOUR_START * 60);
              const clampedEnd = Math.min(endMin, HOUR_END * 60);
              const leftPct = ((clampedStart - HOUR_START * 60) / (TOTAL_HOURS * 60)) * 100;
              const widthPct = Math.max(((clampedEnd - clampedStart) / (TOTAL_HOURS * 60)) * 100, 1.5);
              return { ev: e, startMin, endMin, leftPct, widthPct };
            });

          const now = new Date();
          const nowMin = now.getHours() * 60 + now.getMinutes();
          const isToday = selectedDate.getDate() === now.getDate() && selectedDate.getMonth() === now.getMonth() && selectedDate.getFullYear() === now.getFullYear();
          const nowPct = ((nowMin - HOUR_START * 60) / (TOTAL_HOURS * 60)) * 100;
          const showNow = isToday && nowPct >= 0 && nowPct <= 100;

          const hourLabels = [6, 9, 12, 15, 18, 21];

          return (
            <div className="mb-3">
              <div className="relative rounded-xl bg-muted/50 border border-border/20 px-2 pt-3.5 pb-1.5 overflow-hidden">
                {hourLabels.map(h => {
                  const pct = ((h - HOUR_START) / TOTAL_HOURS) * 100;
                  return (
                    <div key={h} className="absolute top-0 bottom-0 flex flex-col" style={{ left: `${pct}%` }}>
                      <span className="text-xs text-muted-foreground/50 leading-none pl-0.5">{String(h).padStart(2, "0")}</span>
                      <div className="flex-1 border-l border-border/20" />
                    </div>
                  );
                })}

                {showNow && (
                  <div
                    className="absolute top-0 bottom-0 z-20 flex flex-col items-center"
                    style={{ left: `${nowPct}%` }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-3 -ml-[3px]" />
                    <div className="flex-1 border-l border-primary border-dashed" />
                  </div>
                )}

                <div className="relative h-5 mt-0.5">
                  {timedEvents.map(({ ev, leftPct, widthPct }, idx) => {
                    const rsvpStatus = rsvpMap[ev.googleId] ?? ev.attendees?.find((a: any) => a.self)?.responseStatus;
                    const isPending = rsvpStatus === "needsAction";
                    const colorClass = EVENT_CATEGORY_COLORS[ev.category] || "bg-primary";
                    return (
                      <div
                        key={ev.id || idx}
                        title={ev.label || ev.title}
                        className={`absolute top-0 h-full rounded-sm cursor-pointer transition-opacity hover:opacity-80 ${colorClass} ${isPending ? "ring-1 ring-amber-400/60" : ""}`}
                        style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: "3px", opacity: 0.85 }}
                        onClick={() => {
                          document.getElementById(`cal-event-${ev.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Event list */}
        <div className="flex-1 space-y-2 mb-3 max-h-[50vh] overflow-y-auto pr-0.5 scrollbar-thin">
          {selectedEvents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              {filterPending ? (
                <>
                  <CheckCircle2 className="w-8 h-8 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">Sem convites pendentes</p>
                </>
              ) : (
                <>
                  <CalendarDays className="w-8 h-8 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhum evento neste dia</p>
                </>
              )}
            </div>
          )}
          {selectedEvents.map(event => {
            const isRecurring = event.id.includes("_rec_");
            const isEditingThis = editingEventId === event.id;
            return (
              <div
                key={event.id}
                onClick={() => onSetDetailEvent(event)}
                className="cursor-pointer"
              >
                <CalendarEventCard
                  event={event}
                  isEditing={isEditingThis}
                  isDragging={dragEventId === event.id}
                  isRecurring={isRecurring}
                  showDate={filterPending}
                  workspaceId={calendarWorkspaceId}
                  rsvpMap={rsvpMap}
                  rsvpLoading={rsvpLoading}
                  onRsvp={onRsvp}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onOpenEdit={onOpenEdit}
                  onCancelEdit={onCancelEdit}
                />
              </div>
            );
          })}
        </div>

        {/* Add event form */}
        <CalendarAddEventForm {...formProps} />
      </GlassCard>
    </AnimatedItem>
  );
});

CalendarDayDetailPanel.displayName = "CalendarDayDetailPanel";

export default CalendarDayDetailPanel;

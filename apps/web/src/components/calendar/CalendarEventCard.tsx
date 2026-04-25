import { memo } from "react";
import { motion } from "framer-motion";
import { Clock, MapPin, Repeat, Users, Video, ExternalLink, Edit3, Trash2, X, GripVertical, CalendarDays } from "lucide-react";
import { EVENT_CATEGORY_COLORS, EVENT_CATEGORY_LABELS, type EventCategory } from "@/types/calendar";
import WorkspaceBadge from "@/components/dashboard/WorkspaceBadge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const RECURRENCE_LABELS: Record<string, string> = {
  none: "Não repete",
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
};

interface RsvpOption {
  key: string;
  label: string;
  active: string;
}

const RSVP_OPTIONS: RsvpOption[] = [
  { key: "accepted", label: "✓", active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  { key: "declined", label: "✕", active: "bg-destructive/20 text-destructive border-destructive/30" },
  { key: "tentative", label: "?", active: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
];

interface CalendarEventCardProps {
  event: any;
  isEditing?: boolean;
  isDragging?: boolean;
  isRecurring?: boolean;
  showDate?: boolean;
  workspaceId?: string;
  rsvpMap: Record<string, string>;
  rsvpLoading: Record<string, boolean>;
  onRsvp: (event: any, response: string) => void;
  onEdit?: (event: any) => void;
  onDelete?: (event: any) => void;
  onDragStart?: (eventId: string) => void;
  onDragEnd?: () => void;
  onOpenEdit?: () => void;
  onCancelEdit?: () => void;
}

const CalendarEventCard = memo(({
  event,
  isEditing = false,
  isDragging = false,
  isRecurring = false,
  showDate = false,
  workspaceId,
  rsvpMap,
  rsvpLoading,
  onRsvp,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
  onOpenEdit,
  onCancelEdit,
}: CalendarEventCardProps) => {
  const ev = event as any;
  const rsvpStatus = rsvpMap[ev.googleId] ?? ev.attendees?.find((a: any) => a.self)?.responseStatus;
  const isLoading = rsvpLoading[ev.googleId];

  // Duration calculation
  const durationStr = (() => {
    if (!ev.startTime || !ev.endTime) return null;
    const [sh, sm] = ev.startTime.split(":").map(Number);
    const [eh, em] = ev.endTime.split(":").map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff <= 0) return null;
    if (diff < 60) return `${diff}min`;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return m > 0 ? `${h}h${m}min` : `${h}h`;
  })();

  // Countdown for today's events
  const countdownStr = (() => {
    const now = new Date();
    if (ev.day !== now.getDate() || ev.month !== now.getMonth() || ev.year !== now.getFullYear()) return null;
    if (!ev.startTime) return null;
    const [h, m] = ev.startTime.split(":").map(Number);
    const eventMs = new Date(ev.year, ev.month, ev.day, h, m).getTime();
    const diff = eventMs - now.getTime();
    if (diff < 0 || diff > 4 * 60 * 60 * 1000) return null;
    const mins = Math.round(diff / 60000);
    if (mins < 1) return "agora";
    if (mins < 60) return `em ${mins}min`;
    return `em ${Math.floor(mins / 60)}h${mins % 60 > 0 ? `${mins % 60}min` : ""}`;
  })();

  return (
    <motion.div
      id={`cal-event-${event.id}`}
      layout
      className={`rounded-xl border overflow-hidden group transition-all duration-200 ${
        isDragging
          ? "opacity-40 scale-95 border-primary/40 bg-primary/10 shadow-lg rotate-1"
          : "bg-muted/50 border-border/20 cursor-grab active:cursor-grabbing hover:border-primary/20 hover:shadow-md"
      }`}
      draggable={!isRecurring && !isEditing}
      onDragStart={() => onDragStart?.(event.id)}
      onDragEnd={() => onDragEnd?.()}
    >
      <div className={`h-0.5 w-full ${EVENT_CATEGORY_COLORS[event.category] || event.color}`} />

      <div className="p-2.5">
        {isEditing ? (
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-muted-foreground flex-1">Abrindo editor…</p>
            <button onClick={onOpenEdit} className="text-primary hover:text-primary/80">
              <Edit3 className="w-3 h-3" />
            </button>
            <button onClick={onCancelEdit} className="text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <>
            {showDate && (
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <CalendarDays className="w-3 h-3" />
                {format(new Date(ev.year, ev.month, ev.day), "EEE, d MMM", { locale: ptBR })}
              </p>
            )}
            <div className="flex items-start justify-between gap-1.5 mb-1">
              <div className="flex-1 min-w-0 flex items-center gap-1.5">
                <p className="text-xs font-semibold text-foreground leading-tight truncate">{ev.title || ev.label}</p>
                {countdownStr && (
                  <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium animate-pulse">
                    {countdownStr}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {ev.htmlLink && (
                  <a href={ev.htmlLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-muted-foreground hover:text-primary transition-colors p-0.5">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {!isRecurring && onEdit && (
                  <button onClick={() => onEdit(event)} className="text-muted-foreground hover:text-primary transition-colors p-0.5">
                    <Edit3 className="w-3 h-3" />
                  </button>
                )}
                {!isRecurring && onDelete && (
                  <button onClick={() => onDelete(event)} className="text-muted-foreground hover:text-destructive transition-colors p-0.5">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Meta info row */}
            <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
              {ev.startTime && (
                <span className="flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {ev.startTime}{ev.endTime ? `–${ev.endTime}` : ""}
                  {durationStr && (
                    <span className="text-muted-foreground/60 ml-0.5">({durationStr})</span>
                  )}
                </span>
              )}
              {ev.location && (
                <span className="flex items-center gap-0.5 truncate max-w-[120px]">
                  <MapPin className="w-2.5 h-2.5 shrink-0" />
                  {ev.location}
                </span>
              )}
              {(event.recurrence !== "none" || ev.rruleInfo) && (
                <span className="text-primary flex items-center gap-0.5">
                  <Repeat className="w-2.5 h-2.5" /> {ev.rruleInfo?.label || RECURRENCE_LABELS[event.recurrence]}
                </span>
              )}
              {ev.attendees?.length > 0 && (
                <span className="flex items-center gap-0.5">
                  <Users className="w-2.5 h-2.5" /> {ev.attendees.length}
                </span>
              )}
              {ev.meetLink && (
                <a href={ev.meetLink} target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="flex items-center gap-0.5 text-primary hover:text-primary/80">
                  <Video className="w-2.5 h-2.5" /> Meet
                </a>
              )}
              <WorkspaceBadge workspaceId={workspaceId} />
            </div>

            {/* RSVP buttons */}
            {ev.googleId && ev.attendees?.length > 0 && ev.attendees.some((a: any) => a.self) && (
              <div className="flex items-center gap-1 mt-1" onClick={e => e.stopPropagation()}>
                {RSVP_OPTIONS.map(opt => {
                  const isActive = rsvpStatus === opt.key;
                  return (
                    <button
                      key={opt.key}
                      disabled={isLoading}
                      onClick={() => onRsvp(ev, opt.key)}
                      className={`w-6 h-6 rounded-full text-xs font-bold border transition-all disabled:opacity-50 flex items-center justify-center ${
                        isActive ? opt.active : "text-muted-foreground border-border/40 hover:bg-muted/50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
});

CalendarEventCard.displayName = "CalendarEventCard";

export default CalendarEventCard;

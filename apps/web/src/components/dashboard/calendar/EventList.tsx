import React, { useState, useMemo } from "react";
import { Plus, X, Loader2, Pencil, Trash2, Check, Clock, MapPin, Video, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarEvent } from "@/hooks/calendar/useCalendarEvents";
import EventFormDialog, { type EventFormData } from "./AddEventDialog";

interface EventListProps {
  selectedDay: number | null;
  displayEvents: CalendarEvent[];
  editingEventId: string | null;
  editValue: string;
  actionLoading: string | null;
  creatingEvent: boolean;
  initialAdding?: boolean;
  viewMonth: number;
  viewYear: number;
  onSetEditValue: (val: string) => void;
  onAdd: (name: string, day: number, options?: any) => void;
  onEditRemote: (id: string, options?: any) => void;
  onDeleteRemote: (id: string) => void;
  onDeleteLocal: (id: string) => void;
  onStartEditing: (id: string, label: string) => void;
  onCancelEditing: () => void;
  onAddingChange?: (adding: boolean) => void;
}

const EventList = ({
  selectedDay, displayEvents, editingEventId, editValue, actionLoading,
  creatingEvent, initialAdding, viewMonth, viewYear, onSetEditValue, onAdd, onEditRemote, onDeleteRemote,
  onDeleteLocal, onStartEditing, onCancelEditing, onAddingChange,
}: EventListProps) => {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Auto-open dialog when initialAdding is true
  React.useEffect(() => {
    if (initialAdding && selectedDay !== null && !addDialogOpen) {
      setAddDialogOpen(true);
    }
  }, [initialAdding, selectedDay]);

  const handleAddDialogChange = (open: boolean) => {
    setAddDialogOpen(open);
    if (!open) onAddingChange?.(false);
  };

  const handleOpenAddDialog = () => {
    setAddDialogOpen(true);
    onAddingChange?.(true);
  };

  const handleSubmitAdd = (data: EventFormData) => {
    onAdd(data.title, selectedDay ?? 1, {
      startTime: data.startTime, endTime: data.endTime, location: data.location,
      description: data.description, attendees: data.attendees, recurrence: data.recurrence,
      addMeet: data.addMeet, category: data.category, date: data.date,
    });
    setAddDialogOpen(false);
    onAddingChange?.(false);
  };

  const handleOpenEditDialog = (event: CalendarEvent) => {
    setEditingEvent(event);
    setEditDialogOpen(true);
  };

  const handleSubmitEdit = (data: EventFormData) => {
    if (!editingEvent) return;
    if (editingEvent.remote) {
      onEditRemote(editingEvent.id, {
        title: data.title, startTime: data.startTime, endTime: data.endTime,
        location: data.location, description: data.description, attendees: data.attendees,
        recurrence: data.recurrence, addMeet: data.addMeet, date: data.date,
      });
    }
    setEditDialogOpen(false);
    setEditingEvent(null);
  };

  const dayEvents = selectedDay !== null ? displayEvents.filter(e => e.day === selectedDay) : [];
  const visibleEvents = selectedDay !== null ? dayEvents : displayEvents.slice(0, 4);

  const extractTime = (label: string): string | null => {
    const match = label.match(/^(\d{2}:\d{2})/);
    return match ? match[1] : null;
  };

  const cleanLabel = (label: string) => label.replace(/^\d{2}:\d{2}\s*-\s*/, "").replace(/\s*\(\d{2}:\d{2}\)/, "");

  const defaultDate = selectedDay !== null
    ? `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`
    : new Date().toISOString().split("T")[0];

  // Build initial data for edit dialog from the event
  const editInitialData = useMemo((): Partial<EventFormData> | undefined => {
    if (!editingEvent) return undefined;
    const time = extractTime(editingEvent.label);
    const title = cleanLabel(editingEvent.label);
    const ev = editingEvent as any;
    return {
      title,
      date: `${editingEvent.year}-${String(editingEvent.month + 1).padStart(2, "0")}-${String(editingEvent.day).padStart(2, "0")}`,
      startTime: time || "09:00",
      endTime: ev.endTime || (time ? `${String(parseInt(time.split(":")[0]) + 1).padStart(2, "0")}:${time.split(":")[1]}` : "10:00"),
      location: ev.location || "",
      description: ev.description || "",
      attendees: ev.attendees || [],
      recurrence: editingEvent.recurrence || "none",
      category: editingEvent.category || "outro",
      addMeet: !!ev.meetLink,
    };
  }, [editingEvent]);

  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
          {selectedDay !== null ? (
            <>
              <Calendar className="w-3 h-3" />
              Dia {selectedDay}
              {dayEvents.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-semibold">
                  {dayEvents.length}
                </span>
              )}
            </>
          ) : (
            "Próximos eventos"
          )}
        </p>
        {selectedDay !== null && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleOpenAddDialog}
            className="w-5 h-5 flex items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-all"
          >
            <Plus className="w-3 h-3" />
          </motion.button>
        )}
      </div>

      <AnimatePresence>
        {visibleEvents.map((e, idx) => {
          const time = extractTime(e.label);
          const title = cleanLabel(e.label);
          const ev = e as any;

          return (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 4 }}
              transition={{ duration: 0.15, delay: idx * 0.03 }}
              className="group"
            >
              <div className="flex items-start gap-2 py-1 px-1.5 rounded-lg hover:bg-foreground/5 transition-colors">
                <div className="flex flex-col items-center gap-0.5 shrink-0 pt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${e.color}`} />
                  {time && (
                    <span className="text-[9px] text-muted-foreground/70 tabular-nums leading-none">{time}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-foreground/85 truncate block leading-snug">{title}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {selectedDay === null && (
                      <span className="text-[9px] text-muted-foreground/60 flex items-center gap-0.5">
                        <Calendar className="w-2.5 h-2.5" />
                        Dia {e.day}
                      </span>
                    )}
                    {ev.location && (
                      <span className="text-[9px] text-muted-foreground/60 flex items-center gap-0.5 truncate">
                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{ev.location}</span>
                      </span>
                    )}
                    {ev.meetLink && (
                      <span className="text-[9px] text-primary/70 flex items-center gap-0.5">
                        <Video className="w-2.5 h-2.5" />
                        Meet
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                  {e.remote ? (
                    <>
                      <button
                        onClick={() => handleOpenEditDialog(e)}
                        className="p-0.5 text-muted-foreground hover:text-primary transition-colors rounded"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onDeleteRemote(e.id)}
                        disabled={actionLoading === e.id}
                        className="p-0.5 text-muted-foreground hover:text-destructive transition-colors rounded disabled:opacity-50"
                      >
                        {actionLoading === e.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => onDeleteLocal(e.id)}
                      className="p-0.5 text-muted-foreground/50 hover:text-destructive transition-colors rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {selectedDay !== null && dayEvents.length === 0 && !addDialogOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-1.5 py-4 text-muted-foreground"
        >
          <Calendar className="w-6 h-6 opacity-25" />
          <p className="text-xs text-muted-foreground/60 italic">Dia livre — clique em + para adicionar</p>
        </motion.div>
      )}
      {displayEvents.length === 0 && selectedDay === null && (
        <p className="text-xs text-muted-foreground/60 italic text-center py-2">Nenhum evento este mês</p>
      )}

      {/* Add Event Dialog */}
      <EventFormDialog
        open={addDialogOpen}
        onOpenChange={handleAddDialogChange}
        defaultDate={defaultDate}
        creating={creatingEvent}
        onSubmit={handleSubmitAdd}
        mode="add"
      />

      {/* Edit Event Dialog */}
      <EventFormDialog
        open={editDialogOpen}
        onOpenChange={(v) => { setEditDialogOpen(v); if (!v) setEditingEvent(null); }}
        defaultDate={editInitialData?.date}
        creating={!!actionLoading}
        onSubmit={handleSubmitEdit}
        initialData={editInitialData}
        mode="edit"
      />
    </div>
  );
};

export default EventList;

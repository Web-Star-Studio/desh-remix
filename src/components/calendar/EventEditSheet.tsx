import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Edit3, CalendarDays, Clock, MapPin, AlignLeft, CheckCircle2, AlertCircle, Loader2, Bell } from "lucide-react";

const REMINDER_OPTIONS = [
  { value: 0, label: "Sem lembrete" },
  { value: 5, label: "5 minutos antes" },
  { value: 10, label: "10 minutos antes" },
  { value: 15, label: "15 minutos antes" },
  { value: 30, label: "30 minutos antes" },
  { value: 60, label: "1 hora antes" },
  { value: 120, label: "2 horas antes" },
  { value: 1440, label: "1 dia antes" },
];

interface EventEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editEventTitle: string;
  setEditEventTitle: (v: string) => void;
  editEventDate: string;
  setEditEventDate: (v: string) => void;
  editEventTime: string;
  setEditEventTime: (v: string) => void;
  editEventEndTime: string;
  setEditEventEndTime: (v: string) => void;
  editEventLocation: string;
  setEditEventLocation: (v: string) => void;
  editEventDescription: string;
  setEditEventDescription: (v: string) => void;
  editEventReminder: number;
  setEditEventReminder: (v: number) => void;
  editingRemote: boolean;
  editingEvent: any;
  detectConflict: (dateStr: string, startTime: string, endTime: string, excludeId?: string) => boolean;
  onSave: () => void;
  onCancel: () => void;
}

const inputClass = "w-full bg-muted/50 border border-border/30 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors";
const selectClass = "w-full bg-muted/50 border border-border/30 rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 transition-colors appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23999%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_0.5rem_center] bg-[length:0.8rem] pr-7";

const EventEditSheet = ({
  open,
  onOpenChange,
  editEventTitle,
  setEditEventTitle,
  editEventDate,
  setEditEventDate,
  editEventTime,
  setEditEventTime,
  editEventEndTime,
  setEditEventEndTime,
  editEventLocation,
  setEditEventLocation,
  editEventDescription,
  setEditEventDescription,
  editEventReminder,
  setEditEventReminder,
  editingRemote,
  editingEvent,
  detectConflict,
  onSave,
  onCancel,
}: EventEditSheetProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <Edit3 className="w-4 h-4 text-primary" />
            Editar Evento
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-6">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Título</label>
            <input
              type="text"
              value={editEventTitle}
              onChange={e => setEditEventTitle(e.target.value)}
              placeholder="Nome do evento"
              className={inputClass}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" /> Data
            </label>
            <input
              type="date"
              value={editEventDate}
              onChange={e => setEditEventDate(e.target.value)}
              className={`${inputClass} [color-scheme:dark]`}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Horário
            </label>
            <div className="flex items-center gap-2">
              <input type="time" value={editEventTime} onChange={e => setEditEventTime(e.target.value)}
                className={`flex-1 ${inputClass} [color-scheme:dark]`} />
              <span className="text-muted-foreground text-sm">–</span>
              <input type="time" value={editEventEndTime} onChange={e => setEditEventEndTime(e.target.value)}
                className={`flex-1 ${inputClass} [color-scheme:dark]`} />
            </div>
            {editEventDate && editEventTime && editEventEndTime && detectConflict(editEventDate, editEventTime, editEventEndTime, editingEvent?.id) && (
              <p className="text-xs text-amber-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Existe outro evento neste período
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5" /> Lembrete
            </label>
            <select
              value={editEventReminder}
              onChange={e => setEditEventReminder(Number(e.target.value))}
              className={selectClass}
            >
              {REMINDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Local
            </label>
            <input type="text" value={editEventLocation} onChange={e => setEditEventLocation(e.target.value)}
              placeholder="Endereço ou link"
              className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <AlignLeft className="w-3.5 h-3.5" /> Descrição
            </label>
            <textarea value={editEventDescription} onChange={e => setEditEventDescription(e.target.value)}
              placeholder="Adicione detalhes…" rows={4}
              className={`${inputClass} resize-none`} />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={onSave}
              disabled={editingRemote || !editEventTitle.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {editingRemote ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {editingRemote ? "Salvando…" : "Salvar"}
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl bg-muted/50 text-muted-foreground text-sm hover:bg-muted/70 hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default EventEditSheet;

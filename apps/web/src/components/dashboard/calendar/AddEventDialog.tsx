import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  CalendarDays, Clock, MapPin, AlignLeft, Users, Repeat, Video, Bell,
  CheckCircle2, Loader2, Plus, X, Edit3,
} from "lucide-react";
import type { EventCategory, RecurrenceType } from "@/types/calendar";
import { EVENT_CATEGORY_LABELS } from "@/types/calendar";

export interface EventFormData {
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;
  location: string;
  description: string;
  attendees: string[];
  recurrence: RecurrenceType;
  category: EventCategory;
  addMeet: boolean;
  reminderMinutes: number;
}

// Keep backward compat alias
export type AddEventData = EventFormData;

interface EventFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string;
  creating?: boolean;
  onSubmit: (data: EventFormData) => void;
  /** If provided, dialog is in edit mode */
  initialData?: Partial<EventFormData>;
  mode?: "add" | "edit";
}

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: "none", label: "Não repete" },
  { value: "daily", label: "Diário" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
];

const inputClass = "w-full bg-muted/50 border border-border/30 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors";
const labelClass = "text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5";
const selectClass = "w-full bg-muted/50 border border-border/30 rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 transition-colors appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23999%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_0.5rem_center] bg-[length:0.8rem] pr-7";

const defaultFormData = (defaultDate?: string, initial?: Partial<EventFormData>): EventFormData => ({
  title: initial?.title || "",
  date: initial?.date || defaultDate || new Date().toISOString().split("T")[0],
  startTime: initial?.startTime || "09:00",
  endTime: initial?.endTime || "10:00",
  location: initial?.location || "",
  description: initial?.description || "",
  attendees: initial?.attendees || [],
  recurrence: initial?.recurrence || "none",
  category: initial?.category || "outro",
  addMeet: initial?.addMeet || false,
  reminderMinutes: initial?.reminderMinutes ?? 15,
});

const FormContent = ({ data, setData, loading, onSubmit, onCancel, mode }: {
  data: EventFormData;
  setData: React.Dispatch<React.SetStateAction<EventFormData>>;
  loading: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  mode: "add" | "edit";
}) => {
  const [attendeeInput, setAttendeeInput] = useState("");

  const addAttendee = () => {
    const email = attendeeInput.trim();
    if (email && !data.attendees.includes(email)) {
      setData(prev => ({ ...prev, attendees: [...prev.attendees, email] }));
      setAttendeeInput("");
    }
  };

  const removeAttendee = (email: string) => {
    setData(prev => ({ ...prev, attendees: prev.attendees.filter(a => a !== email) }));
  };

  const isEdit = mode === "edit";
  const submitLabel = isEdit ? "Salvar" : "Criar evento";
  const loadingLabel = isEdit ? "Salvando…" : "Criando…";

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className={labelClass}>Título</label>
        <input type="text" value={data.title} onChange={e => setData(prev => ({ ...prev, title: e.target.value }))} placeholder="Nome do evento" className={inputClass} autoFocus />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={labelClass}><CalendarDays className="w-3.5 h-3.5" /> Data</label>
          <input type="date" value={data.date} onChange={e => setData(prev => ({ ...prev, date: e.target.value }))} className={`${inputClass} [color-scheme:dark]`} />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}><Clock className="w-3.5 h-3.5" /> Horário</label>
          <div className="flex items-center gap-2">
            <input type="time" value={data.startTime} onChange={e => setData(prev => ({ ...prev, startTime: e.target.value }))} className={`flex-1 ${inputClass} [color-scheme:dark]`} />
            <span className="text-muted-foreground text-sm">–</span>
            <input type="time" value={data.endTime} onChange={e => setData(prev => ({ ...prev, endTime: e.target.value }))} className={`flex-1 ${inputClass} [color-scheme:dark]`} />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={labelClass}><MapPin className="w-3.5 h-3.5" /> Local</label>
        <input type="text" value={data.location} onChange={e => setData(prev => ({ ...prev, location: e.target.value }))} placeholder="Endereço ou link" className={inputClass} />
      </div>

      <div className="space-y-1.5">
        <label className={labelClass}><AlignLeft className="w-3.5 h-3.5" /> Descrição</label>
        <textarea value={data.description} onChange={e => setData(prev => ({ ...prev, description: e.target.value }))} placeholder="Adicione detalhes…" rows={3} className={`${inputClass} resize-none`} />
      </div>

      <div className="space-y-1.5">
        <label className={labelClass}><Users className="w-3.5 h-3.5" /> Convidados</label>
        <div className="flex gap-2">
          <input type="email" value={attendeeInput} onChange={e => setAttendeeInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addAttendee(); } }} placeholder="email@exemplo.com" className={`flex-1 ${inputClass}`} />
          <button type="button" onClick={addAttendee} disabled={!attendeeInput.trim()} className="px-2.5 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {data.attendees.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {data.attendees.map(email => (
              <span key={email} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                {email}
                <button onClick={() => removeAttendee(email)} className="hover:text-destructive transition-colors"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={labelClass}><Repeat className="w-3.5 h-3.5" /> Periodicidade</label>
          <select value={data.recurrence} onChange={e => setData(prev => ({ ...prev, recurrence: e.target.value as RecurrenceType }))} className={selectClass}>
            {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>Categoria</label>
          <select value={data.category} onChange={e => setData(prev => ({ ...prev, category: e.target.value as EventCategory }))} className={selectClass}>
            {(Object.keys(EVENT_CATEGORY_LABELS) as EventCategory[]).map(cat => <option key={cat} value={cat}>{EVENT_CATEGORY_LABELS[cat]}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={labelClass}><Bell className="w-3.5 h-3.5" /> Lembrete</label>
        <select value={data.reminderMinutes} onChange={e => setData(prev => ({ ...prev, reminderMinutes: Number(e.target.value) }))} className={selectClass}>
          <option value={0}>Sem lembrete</option>
          <option value={5}>5 minutos antes</option>
          <option value={10}>10 minutos antes</option>
          <option value={15}>15 minutos antes</option>
          <option value={30}>30 minutos antes</option>
          <option value={60}>1 hora antes</option>
          <option value={120}>2 horas antes</option>
          <option value={1440}>1 dia antes</option>
        </select>
      </div>

      <button type="button" onClick={() => setData(prev => ({ ...prev, addMeet: !prev.addMeet }))}
        className={`flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border transition-colors text-sm ${data.addMeet ? "border-primary/40 bg-primary/10 text-primary" : "border-border/30 bg-muted/30 text-muted-foreground hover:border-primary/20"}`}>
        <Video className="w-4 h-4" />
        <span className="flex-1 text-left">Adicionar Google Meet</span>
        <span className={`w-4 h-4 rounded-full border-2 transition-colors flex items-center justify-center ${data.addMeet ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>
          {data.addMeet && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
        </span>
      </button>

      <div className="flex gap-2 pt-2">
        <button onClick={onSubmit} disabled={loading || !data.title.trim()}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {loading ? loadingLabel : submitLabel}
        </button>
        <button onClick={onCancel} className="px-4 py-2.5 rounded-xl bg-muted/50 text-muted-foreground text-sm hover:bg-muted/70 hover:text-foreground transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  );
};

const EventFormDialog = ({ open, onOpenChange, defaultDate, creating = false, onSubmit, initialData, mode = "add" }: EventFormDialogProps) => {
  const isMobile = useIsMobile();
  const [data, setData] = useState<EventFormData>(() => defaultFormData(defaultDate, initialData));

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setData(defaultFormData(defaultDate, initialData));
    }
  }, [open, defaultDate, initialData]);

  const handleSubmit = () => {
    if (!data.title.trim()) return;
    onSubmit(data);
  };

  const handleCancel = () => onOpenChange(false);
  const isEdit = mode === "edit";
  const Icon = isEdit ? Edit3 : Plus;
  const title = isEdit ? "Editar Evento" : "Novo Evento";

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] bg-background/95 backdrop-blur-xl border-foreground/10">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="flex items-center gap-2 text-foreground">
              <Icon className="w-4 h-4 text-primary" />
              {title}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto">
            <FormContent data={data} setData={setData} loading={creating} onSubmit={handleSubmit} onCancel={handleCancel} mode={mode} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-background/95 backdrop-blur-xl border-foreground/10 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Icon className="w-4 h-4 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <FormContent data={data} setData={setData} loading={creating} onSubmit={handleSubmit} onCancel={handleCancel} mode={mode} />
      </DialogContent>
    </Dialog>
  );
};

// backward compat default export
export default EventFormDialog;

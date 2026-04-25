import { useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Clock, MapPin, AlignLeft, UserPlus, Video, Bell, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { EVENT_CATEGORY_LABELS, type EventCategory, type RecurrenceType } from "@/types/calendar";

const CATEGORIES: EventCategory[] = ["trabalho", "pessoal", "saúde", "educação", "lazer", "outro"];
const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  none: "Não repete", daily: "Diário", weekly: "Semanal", monthly: "Mensal",
};

interface CalendarAddEventFormProps {
  newTitle: string;
  setNewTitle: (v: string) => void;
  newTime: string;
  setNewTime: (v: string) => void;
  newEndTime: string;
  setNewEndTime: (v: string) => void;
  newCategory: EventCategory;
  setNewCategory: (v: EventCategory) => void;
  newRecurrence: RecurrenceType;
  setNewRecurrence: (v: RecurrenceType) => void;
  newDescription: string;
  setNewDescription: (v: string) => void;
  newLocation: string;
  setNewLocation: (v: string) => void;
  newGuests: string;
  setNewGuests: (v: string) => void;
  newReminder: number;
  setNewReminder: (v: number) => void;
  addMeet: boolean;
  setAddMeet: (v: boolean) => void;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  googleConnected: boolean;
  creatingRemote: boolean;
  onSubmit: () => void;
}

const CalendarAddEventForm = memo(({
  newTitle, setNewTitle,
  newTime, setNewTime,
  newEndTime, setNewEndTime,
  newCategory, setNewCategory,
  newRecurrence, setNewRecurrence,
  newDescription, setNewDescription,
  newLocation, setNewLocation,
  newGuests, setNewGuests,
  newReminder, setNewReminder,
  addMeet, setAddMeet,
  showAdvanced, setShowAdvanced,
  googleConnected, creatingRemote,
  onSubmit,
}: CalendarAddEventFormProps) => {
  const selectAppearance = "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23999%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_0.3rem_center] bg-[length:0.8rem]";

  return (
    <div className="border-t border-border/30 pt-2.5 mt-auto">
      <input
        type="text"
        value={newTitle}
        onChange={e => setNewTitle(e.target.value)}
        onKeyDown={e => e.key === "Enter" && onSubmit()}
        placeholder="Novo evento…"
        className="w-full bg-muted/50 rounded-xl px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none mb-2"
      />
      <div className="flex gap-1.5 mb-2">
        <div className="flex gap-1 flex-1 items-center bg-muted/50 rounded-xl px-2">
          <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
          <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
            className="bg-transparent py-1.5 text-xs text-foreground outline-none w-full [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-60" />
          <span className="text-muted-foreground text-xs">–</span>
          <input type="time" value={newEndTime} onChange={e => setNewEndTime(e.target.value)}
            className="bg-transparent py-1.5 text-xs text-foreground outline-none w-full [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-60" />
        </div>
        <select value={newCategory} onChange={e => setNewCategory(e.target.value as EventCategory)}
          className={`bg-muted/50 rounded-xl px-2 pr-6 py-1.5 text-xs text-foreground outline-none appearance-none ${selectAppearance}`}>
          {CATEGORIES.map(cat => <option key={cat} value={cat}>{EVENT_CATEGORY_LABELS[cat]}</option>)}
        </select>
      </div>

      <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1.5">
        {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {showAdvanced ? "Menos" : "Mais detalhes"}
      </button>

      <AnimatePresence initial={false}>
        {showAdvanced && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-1.5 mb-2">
            <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-1.5">
              <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
              <input type="text" value={newLocation} onChange={e => setNewLocation(e.target.value)} placeholder="Local"
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none" />
            </div>
            <div className="flex items-start gap-2 bg-muted/50 rounded-xl px-3 py-1.5">
              <AlignLeft className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
              <textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Descrição" rows={2}
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none resize-none" />
            </div>
            {googleConnected && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-1.5">
                <UserPlus className="w-3 h-3 text-muted-foreground shrink-0" />
                <input type="text" value={newGuests} onChange={e => setNewGuests(e.target.value)} placeholder="Convidados (e-mails)"
                  className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none" />
              </div>
            )}
            <select value={newRecurrence} onChange={e => setNewRecurrence(e.target.value as RecurrenceType)}
              className={`w-full bg-muted/50 rounded-xl px-3 pr-6 py-1.5 text-xs text-foreground outline-none appearance-none ${selectAppearance}`}>
              {(Object.keys(RECURRENCE_LABELS) as RecurrenceType[]).map(r => <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>)}
            </select>
            <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-1.5">
              <Bell className="w-3 h-3 text-muted-foreground shrink-0" />
              <select value={newReminder} onChange={e => setNewReminder(Number(e.target.value))}
                className="flex-1 bg-transparent text-xs text-foreground outline-none appearance-none">
                <option value={0}>Sem lembrete</option>
                <option value={5}>5 min antes</option>
                <option value={10}>10 min antes</option>
                <option value={15}>15 min antes</option>
                <option value={30}>30 min antes</option>
                <option value={60}>1h antes</option>
                <option value={120}>2h antes</option>
                <option value={1440}>1 dia antes</option>
              </select>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-1.5">
        {googleConnected && (
          <button type="button" onClick={() => setAddMeet(!addMeet)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              addMeet ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground hover:text-foreground"
            }`}>
            <Video className="w-3 h-3" /> Meet
          </button>
        )}
        <button onClick={onSubmit} disabled={creatingRemote}
          className="flex-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1 disabled:opacity-50">
          {creatingRemote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Adicionar
        </button>
      </div>
    </div>
  );
});

CalendarAddEventForm.displayName = "CalendarAddEventForm";
export default CalendarAddEventForm;

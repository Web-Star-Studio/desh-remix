import { memo } from "react";
import { AlertTriangle, CalendarDays, Mail, MessageCircle, Timer } from "lucide-react";

type MainFilter = "all" | "tasks" | "events" | "emails" | "whatsapp" | "notices";

interface InboxSummaryCardsProps {
  overdueTasks: number;
  todayEvents: number;
  unreadEmails: number;
  unreadWhatsapp: number;
  snoozedCount?: number;
  onFilterChange: (filter: MainFilter) => void;
}

const InboxSummaryCards = memo(({
  overdueTasks, todayEvents, unreadEmails, unreadWhatsapp, snoozedCount = 0, onFilterChange,
}: InboxSummaryCardsProps) => {
  if (overdueTasks === 0 && todayEvents === 0 && unreadEmails === 0 && unreadWhatsapp === 0 && snoozedCount === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 sm:flex gap-2 mb-4">
      {overdueTasks > 0 && (
        <button onClick={() => onFilterChange("tasks")} className="glass-card rounded-xl px-3 py-2.5 flex items-center gap-2 text-destructive border border-destructive/20 shrink-0 hover:bg-destructive/5 transition-colors">
          <AlertTriangle className="w-3.5 h-3.5" />
          <div className="text-left">
            <span className="text-sm font-bold">{overdueTasks}</span>
            <span className="text-[10px] ml-1 opacity-80">atrasada(s)</span>
          </div>
        </button>
      )}
      {todayEvents > 0 && (
        <button onClick={() => onFilterChange("events")} className="glass-card rounded-xl px-3 py-2.5 flex items-center gap-2 text-emerald-500 shrink-0 hover:bg-emerald-500/5 transition-colors">
          <CalendarDays className="w-3.5 h-3.5" />
          <div className="text-left">
            <span className="text-sm font-bold">{todayEvents}</span>
            <span className="text-[10px] ml-1 opacity-80">evento(s) hoje</span>
          </div>
        </button>
      )}
      {unreadEmails > 0 && (
        <button onClick={() => onFilterChange("emails")} className="glass-card rounded-xl px-3 py-2.5 flex items-center gap-2 text-sky-500 shrink-0 hover:bg-sky-500/5 transition-colors">
          <Mail className="w-3.5 h-3.5" />
          <div className="text-left">
            <span className="text-sm font-bold">{unreadEmails}</span>
            <span className="text-[10px] ml-1 opacity-80">e-mail(s)</span>
          </div>
        </button>
      )}
      {unreadWhatsapp > 0 && (
        <button onClick={() => onFilterChange("whatsapp")} className="glass-card rounded-xl px-3 py-2.5 flex items-center gap-2 text-green-500 shrink-0 hover:bg-green-500/5 transition-colors">
          <MessageCircle className="w-3.5 h-3.5" />
          <div className="text-left">
            <span className="text-sm font-bold">{unreadWhatsapp}</span>
            <span className="text-[10px] ml-1 opacity-80">WhatsApp</span>
          </div>
        </button>
      )}
      {snoozedCount > 0 && (
        <div className="glass-card rounded-xl px-3 py-2.5 flex items-center gap-2 text-muted-foreground shrink-0">
          <Timer className="w-3.5 h-3.5" />
          <div className="text-left">
            <span className="text-sm font-bold">{snoozedCount}</span>
            <span className="text-[10px] ml-1 opacity-80">adiado(s)</span>
          </div>
        </div>
      )}
    </div>
  );
});

InboxSummaryCards.displayName = "InboxSummaryCards";

export default InboxSummaryCards;

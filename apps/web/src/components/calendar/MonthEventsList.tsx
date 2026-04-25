import { useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Clock, MapPin, Search, X, Users, Video, ChevronRight, CheckCircle2, XCircle, HelpCircle, AlertCircle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import GlassCard from "@/components/dashboard/GlassCard";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import GoogleSyncBadge from "@/components/dashboard/GoogleSyncBadge";
import WorkspaceBadge from "@/components/dashboard/WorkspaceBadge";
import { EVENT_CATEGORY_COLORS } from "@/contexts/DashboardContext";

interface MonthEventsListProps {
  selectedDate: Date;
  filteredAllEvents: any[];
  rsvpMap: Record<string, string>;
  rsvpLoading: Record<string, boolean>;
  onRsvp: (event: any, response: string) => void;
  onSelectEvent: (event: any) => void;
  setSelectedDate: (d: Date) => void;
  calendarWorkspaceId?: string;
}

const MonthEventsList = ({
  selectedDate,
  filteredAllEvents,
  rsvpMap,
  rsvpLoading,
  onRsvp,
  onSelectEvent,
  setSelectedDate,
  calendarWorkspaceId,
}: MonthEventsListProps) => {
  const [monthSearch, setMonthSearch] = useState("");

  const now = useMemo(() => new Date(), []);
  const searchTerm = monthSearch.toLowerCase().trim();
  
  const monthEvents = useMemo(() => 
    filteredAllEvents
      .filter(e => e.month === selectedDate.getMonth() && e.year === selectedDate.getFullYear())
      .filter(e => !searchTerm || (e.label || "").toLowerCase().includes(searchTerm))
      .sort((a, b) => a.day - b.day),
    [filteredAllEvents, selectedDate, searchTerm]
  );

  const upcomingEvents = useMemo(() => 
    monthEvents.filter(e => {
      const d = new Date(e.year, e.month, e.day);
      return d >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }),
    [monthEvents, now]
  );

  const pastEvents = useMemo(() => 
    monthEvents.filter(e => {
      const d = new Date(e.year, e.month, e.day);
      return d < new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }).reverse(),
    [monthEvents, now]
  );

  const renderEventRow = useCallback((event: any) => {
    const isToday = event.day === now.getDate() && event.month === now.getMonth() && event.year === now.getFullYear();
    const isSelected = event.day === selectedDate.getDate() && event.month === selectedDate.getMonth() && event.year === selectedDate.getFullYear();
    const label: string = event.label || "";
    const highlightLabel = () => {
      if (!searchTerm) return <span>{label}</span>;
      const idx = label.toLowerCase().indexOf(searchTerm);
      if (idx === -1) return <span>{label}</span>;
      return (
        <>
          {label.slice(0, idx)}
          <mark className="bg-primary/30 text-foreground rounded-sm px-0.5">{label.slice(idx, idx + searchTerm.length)}</mark>
          {label.slice(idx + searchTerm.length)}
        </>
      );
    };

    return (
      <motion.div
        key={event.id}
        layout
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        className={`flex items-center gap-2.5 p-2 rounded-xl transition-colors cursor-pointer group ${
          isSelected ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted/50"
        }`}
        onClick={() => { setSelectedDate(new Date(event.year, event.month, event.day)); onSelectEvent(event); }}
      >
        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex flex-col items-center justify-center text-center overflow-hidden ${
          isToday ? "bg-primary text-primary-foreground" : "bg-muted/50 text-foreground/70"
        }`}>
          <span className="text-[9px] leading-none opacity-70 truncate w-full text-center">
            {format(new Date(event.year, event.month, event.day), "EEE", { locale: ptBR })}
          </span>
          <span className="text-xs font-bold leading-tight">{event.day}</span>
        </div>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${EVENT_CATEGORY_COLORS[event.category] || event.color}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-foreground/90 truncate">{highlightLabel()}</p>
          <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
            {((event as any).startTime || (event as any).endTime) && (
              <span className="flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5" />
                {(event as any).startTime}{(event as any).endTime ? ` – ${(event as any).endTime}` : ""}
              </span>
            )}
            {(event as any).location && (
              <span className="flex items-center gap-0.5 truncate max-w-[100px]">
                <MapPin className="w-2.5 h-2.5 shrink-0" />
                {(event as any).location}
              </span>
            )}
            {isToday && <span className="bg-primary/20 text-primary px-1 py-0.5 rounded-full font-medium">Hoje</span>}
            {(event as any).attendees?.length > 0 && (
              <span className="flex items-center gap-0.5">
                <Users className="w-2.5 h-2.5" /> {(event as any).attendees.length}
              </span>
            )}
            {(event as any).meetLink && (
              <a href={(event as any).meetLink} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-0.5 text-primary hover:text-primary/80">
                <Video className="w-2.5 h-2.5" /> Meet
              </a>
            )}
            {(event as any).remote && <GoogleSyncBadge variant="from-google" />}
            <WorkspaceBadge workspaceId={calendarWorkspaceId} />
          </div>
          {/* RSVP in monthly list */}
          {(() => {
            const gEvent = event as any;
            if (!gEvent.googleId || !gEvent.attendees?.length) return null;
            const selfAttendee = gEvent.attendees.find((a: any) => a.self);
            if (!selfAttendee) return null;
            const currentStatus = rsvpMap[gEvent.googleId] ?? selfAttendee.responseStatus ?? "needsAction";
            const isLoading = rsvpLoading[gEvent.googleId];
            const RSVP_OPTIONS = [
              { key: "accepted",  label: "✓", active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
              { key: "declined",  label: "✕", active: "bg-destructive/20 text-destructive border-destructive/30" },
              { key: "tentative", label: "?", active: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
            ] as const;
            return (
              <div className="flex items-center gap-1 mt-1" onClick={e => e.stopPropagation()}>
                {RSVP_OPTIONS.map(opt => {
                  const isActive = currentStatus === opt.key;
                  return (
                    <button
                      key={opt.key}
                      disabled={isLoading}
                      onClick={() => onRsvp(gEvent, opt.key)}
                      className={`w-6 h-6 rounded-full text-xs font-bold border transition-all disabled:opacity-50 flex items-center justify-center ${
                        isActive ? opt.active : "text-muted-foreground border-border/40 hover:bg-muted/50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>
        <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </motion.div>
    );
  }, [now, selectedDate, searchTerm, rsvpMap, rsvpLoading, onRsvp, onSelectEvent, setSelectedDate, calendarWorkspaceId]);

  return (
    <AnimatedItem index={3} className="mt-3">
      <GlassCard size="auto">
        <div className="flex items-center gap-2 mb-2">
          <CalendarDays className="w-3.5 h-3.5 text-primary" />
          <p className="text-xs font-semibold text-foreground">Eventos do mês</p>
          <span className="text-xs text-muted-foreground ml-auto">
            {format(selectedDate, "MMMM yyyy", { locale: ptBR })}
          </span>
        </div>

        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={monthSearch}
            onChange={e => setMonthSearch(e.target.value)}
            placeholder="Buscar…"
            className="w-full bg-muted/50 rounded-xl pl-7 pr-7 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/30 transition-all"
          />
          <AnimatePresence>
            {monthSearch && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => setMonthSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3 h-3" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <Tabs defaultValue="upcoming">
          <TabsList className="w-full mb-2 h-7">
            <TabsTrigger value="upcoming" className="flex-1 text-xs h-6 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              Próximos ({upcomingEvents.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="flex-1 text-xs h-6 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              Passados ({pastEvents.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            {upcomingEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4 italic">
                {searchTerm ? "Nenhum resultado" : "Nenhum evento próximo"}
              </p>
            ) : (
              <div className="space-y-0.5 max-h-64 overflow-y-auto pr-1">
                {upcomingEvents.map(renderEventRow)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past">
            {pastEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4 italic">
                {searchTerm ? "Nenhum resultado" : "Nenhum evento passado"}
              </p>
            ) : (
              <div className="space-y-0.5 max-h-64 overflow-y-auto pr-1">
                {pastEvents.map(renderEventRow)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </GlassCard>
    </AnimatedItem>
  );
};

export default MonthEventsList;

/**
 * useCalendarPageState — all state & logic for CalendarPage.
 * The page component becomes a pure render layer.
 */
import type { ComposioCalendarEvent, ComposioCalendarAttendee, GoogleCalendar, MappedCalendarEvent, GoogleCalendarEventBody } from "@/types/composio";
import { useDashboard, EVENT_CATEGORY_COLORS, type EventCategory, type RecurrenceType } from "@/contexts/DashboardContext";
import { useConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { toast } from "@/hooks/use-toast";
import { useGoogleServiceData } from "@/hooks/integrations/useGoogleServiceData";
import { useCalendarActions } from "@/hooks/integrations/useCalendarActions";
import { useCalendarSync } from "@/hooks/calendar/useCalendarSync";
import { useCalendarRsvp } from "@/hooks/calendar/useCalendarRsvp";
import { useCalendarKeyboard } from "@/hooks/calendar/useCalendarKeyboard";
import { buildIcs } from "@/lib/calendarExport";

const CATEGORIES: EventCategory[] = ["trabalho", "pessoal", "saúde", "educação", "lazer", "outro"];

/** Build a timezone-aware ISO string that preserves the local offset instead of converting to UTC */
function toLocalISOString(date: Date): string {
  const off = date.getTimezoneOffset();
  const sign = off <= 0 ? "+" : "-";
  const absOff = Math.abs(off);
  const hh = String(Math.floor(absOff / 60)).padStart(2, "0");
  const mm = String(absOff % 60).padStart(2, "0");
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${hh}:${mm}`;
}

export function useCalendarPageState() {
  const { invoke } = useEdgeFn();
  const calendar = useCalendarActions();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const { state, addEvent, updateEvent, deleteEvent } = useDashboard();
  const navigate = useNavigate();
  const [calSearchParams, setCalSearchParams] = useSearchParams();
  const isMobile = useIsMobile();

  // ── Core state ────────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("09:00");
  const [newCategory, setNewCategory] = useState<EventCategory>("outro");
  const [newRecurrence, setNewRecurrence] = useState<RecurrenceType>("none");
  const [filterCategory, setFilterCategory] = useState<EventCategory | "all">("all");
  const [filterPending, setFilterPending] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<Record<string, unknown> | null>(null);
  const [dragEventId, setDragEventId] = useState<string | null>(null);
  const [dragOverCalId, setDragOverCalId] = useState<string | null>(null);
  const handleDropRef = useRef<(date: Date) => void>(() => {});
  const [creatingRemote, setCreatingRemote] = useState(false);
  const [addMeet, setAddMeet] = useState(false);
  const [dayViewOpen, setDayViewOpen] = useState(false);
  const [calView, setCalView] = useState<"month" | "week">("month");
  const [weekOffset, setWeekOffset] = useState(0);
  const [movingEventId, setMovingEventId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [weekNewEventOpen, setWeekNewEventOpen] = useState(false);
  const [weekNewEventDate, setWeekNewEventDate] = useState<Date | null>(null);
  const [weekNewEventTime, setWeekNewEventTime] = useState("09:00");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [detailEvent, setDetailEvent] = useState<any | null>(null);
  const [newEndTime, setNewEndTime] = useState("10:00");
  const [newDescription, setNewDescription] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newGuests, setNewGuests] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newReminder, setNewReminder] = useState(15);

  // ── Deep-link ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const isNew = calSearchParams.get("new");
    const withContact = calSearchParams.get("with");
    if (isNew === "true" && withContact) {
      setNewTitle(`Reunião com ${decodeURIComponent(withContact)}`);
      setNewGuests(decodeURIComponent(withContact));
      setShowAdvanced(true);
      setCalSearchParams(prev => { prev.delete("new"); prev.delete("with"); return prev; }, { replace: true });
    }
  }, []);

  // ── Google Calendar integration ───────────────────────────────────────────
  const googleParams = useMemo(() => {
    const timeMin = new Date(Date.UTC(selectedDate.getFullYear(), selectedDate.getMonth(), 1)).toISOString();
    const timeMax = new Date(Date.UTC(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59)).toISOString();
    return { timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "100" };
  }, [selectedDate]);

  const {
    data: googleEvents, isLoading: googleLoading, isConnected: googleConnected,
    connectionNames: googleNames, refetch: googleRefetch,
    needsScope: calendarNeedsScope, requestScope: calendarRequestScope,
    connectionWorkspaceId: calendarWorkspaceId,
    isComposio: isComposioCalendar,
    connectionVerified: calendarConnectionVerified,
  } = useGoogleServiceData<ComposioCalendarEvent[]>({
    service: "calendar",
    path: "/calendars/primary/events",
    params: googleParams,
    pollingInterval: 30 * 60 * 1000,
  });

  const { data: calendarList } = useGoogleServiceData<GoogleCalendar[]>({
    service: "calendar",
    path: "/users/me/calendarList",
    params: { minAccessRole: "reader" },
    enabled: googleConnected && calendarConnectionVerified,
    pollingInterval: 30 * 60 * 1000,
  });

  const secondaryCalendars = useMemo(() => {
    return (calendarList || []).filter(
      (cal: GoogleCalendar) => !cal.primary && cal.selected !== false && !cal.hidden
    );
  }, [calendarList]);

  const [secondaryEventsMap, setSecondaryEventsMap] = useState<Record<string, ComposioCalendarEvent[]>>({});
  const handleSecondaryData = useCallback((calendarId: string, events: ComposioCalendarEvent[]) => {
    setSecondaryEventsMap(prev => {
      if (prev[calendarId] === events) return prev;
      return { ...prev, [calendarId]: events };
    });
  }, []);

  const SECONDARY_COLORS = ["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500"];
  const secondaryColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    secondaryCalendars.forEach((cal: GoogleCalendar, i: number) => {
      map[cal.id] = SECONDARY_COLORS[i % SECONDARY_COLORS.length];
    });
    return map;
  }, [secondaryCalendars]);

  // ── parseRrule + mapGoogleEvent ───────────────────────────────────────────
  const parseRrule = useCallback((recurrenceArr: string[] | undefined): { key: string; label: string; icon: string } | null => {
    if (!recurrenceArr?.length) return null;
    const rule = recurrenceArr.find(r => r.startsWith("RRULE:")) || "";
    if (!rule) return null;
    const freq = rule.match(/FREQ=([A-Z]+)/)?.[1] || "";
    const interval = parseInt(rule.match(/INTERVAL=(\d+)/)?.[1] || "1", 10);
    if (freq === "DAILY")   return interval > 1 ? { key: "daily",   label: `A cada ${interval} dias`,    icon: "↻" } : { key: "daily",   label: "Diário",    icon: "↻" };
    if (freq === "WEEKLY")  return interval > 1 ? { key: "weekly",  label: `A cada ${interval} semanas`, icon: "↻" } : { key: "weekly",  label: "Semanal",   icon: "↻" };
    if (freq === "MONTHLY") return interval > 1 ? { key: "monthly", label: `A cada ${interval} meses`,   icon: "↻" } : { key: "monthly", label: "Mensal",    icon: "↻" };
    if (freq === "YEARLY")  return { key: "yearly",  label: "Anual",     icon: "↻" };
    return null;
  }, []);

  const mapGoogleEvent = useCallback((e: ComposioCalendarEvent, color: string, idx: number, calendarId = "primary") => {
    const startStr = e.start?.dateTime || e.start?.date || e.created;
    const start = new Date(startStr);
    const timeStr = e.start?.dateTime
      ? new Date(e.start.dateTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : null;
    const endTimeStr = e.end?.dateTime
      ? new Date(e.end.dateTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : null;
    const attendees = (e.attendees || []).map((a: ComposioCalendarAttendee) => ({
      email: a.email,
      displayName: a.displayName || a.email,
      responseStatus: a.responseStatus,
      self: a.self,
    }));
    return {
      id: `google_${e.id || idx}`,
      day: start.getDate(),
      month: start.getMonth(),
      year: start.getFullYear(),
      label: timeStr ? `${e.summary || "Evento"} (${timeStr})` : (e.summary || "Evento"),
      title: e.summary || "Evento",
      color,
      category: "outro" as EventCategory,
      recurrence: "none" as RecurrenceType,
      rruleInfo: parseRrule(e.recurrence) ?? (e.recurringEventId ? { key: "recurring", label: "Recorrente", icon: "↻" } : null),
      remote: true,
      googleId: e.id,
      calendarId,
      meetLink: e.hangoutLink || e.conferenceData?.entryPoints?.find(ep => ep.entryPointType === "video")?.uri || null,
      description: e.description || null,
      location: e.location || null,
      attendees,
      startTime: timeStr,
      endTime: endTimeStr,
      status: e.status || "confirmed",
      htmlLink: e.htmlLink || null,
      organizer: e.organizer || null,
    } as MappedCalendarEvent;
  }, []);

  const mapGoogleEvents = useCallback((events: ComposioCalendarEvent[], color: string, calendarId = "primary") => {
    return events.map((e, i) => mapGoogleEvent(e, color, i, calendarId));
  }, [mapGoogleEvent]);

  // ── Full Google Calendar sync ─────────────────────────────────────────────
  const {
    fullSyncEvents, fullSyncLastSyncedAt, syncTokens, incrementalSyncedAt,
    fullSyncStatus, setFullSyncStatus, fullSyncProgress, lastSyncType,
    persistedSyncLoading, persistedSync, savePersistedSync, clearSyncCache,
    runFullSync, runIncrementalSync, syncTooltipText,
    optimisticAdd, optimisticRemove, optimisticUpdate,
  } = useCalendarSync({
    googleConnected,
    connectionVerified: calendarConnectionVerified,
    secondaryCalendars,
    mapGoogleEvent,
    usingComposio: isComposioCalendar,
  });

  // ── Calendar visibility filter ────────────────────────────────────────────
  const [disabledCalendars, setDisabledCalendars] = useState<Set<string>>(new Set());
  const toggleCalendar = useCallback((calId: string) => {
    setDisabledCalendars(prev => {
      const next = new Set(prev);
      if (next.has(calId)) next.delete(calId);
      else next.add(calId);
      return next;
    });
  }, []);

  const googleMappedEvents = useMemo(() => {
    if (!googleConnected) return [];
    let events: MappedCalendarEvent[];
    if (fullSyncEvents.length > 0) {
      events = fullSyncEvents;
    } else {
      const primary = mapGoogleEvents(googleEvents || [], "bg-primary", "primary");
      const secondary = secondaryCalendars.flatMap((cal: GoogleCalendar) =>
        mapGoogleEvents(secondaryEventsMap[cal.id] || [], secondaryColorMap[cal.id] || "bg-accent", cal.id)
      );
      events = [...primary, ...secondary];
    }
    if (disabledCalendars.size === 0) return events;
    return events.filter(e => !disabledCalendars.has(e.calendarId || "primary"));
  }, [googleConnected, fullSyncEvents, googleEvents, secondaryCalendars, secondaryEventsMap, secondaryColorMap, mapGoogleEvents, disabledCalendars]);

  // ── Stable month/year to avoid recalculations on day changes ────────────
  const viewMonth = selectedDate.getMonth();
  const viewYear = selectedDate.getFullYear();

  // ── Expand recurring events ───────────────────────────────────────────────
  const expandedEvents = useMemo(() => {
    const expanded = [...state.events];
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    state.events.forEach(event => {
      if (event.recurrence === "none") return;
      if (event.recurrence === "daily") {
        for (let d = 1; d <= daysInMonth; d++) {
          if (d === event.day && event.month === viewMonth && event.year === viewYear) continue;
          expanded.push({ ...event, id: `${event.id}_rec_${d}`, day: d, month: viewMonth, year: viewYear });
        }
      } else if (event.recurrence === "weekly") {
        const origDate = new Date(event.year, event.month, event.day);
        const dayOfWeek = origDate.getDay();
        for (let d = 1; d <= daysInMonth; d++) {
          const checkDate = new Date(viewYear, viewMonth, d);
          if (checkDate.getDay() === dayOfWeek) {
            if (d === event.day && viewMonth === event.month && viewYear === event.year) continue;
            expanded.push({ ...event, id: `${event.id}_rec_${d}`, day: d, month: viewMonth, year: viewYear });
          }
        }
      } else if (event.recurrence === "monthly") {
        if (viewMonth !== event.month || viewYear !== event.year) {
          const day = Math.min(event.day, daysInMonth);
          expanded.push({ ...event, id: `${event.id}_rec_m`, day, month: viewMonth, year: viewYear });
        }
      }
    });

    return expanded;
  }, [state.events, viewMonth, viewYear]);

  // ── Week time grid ────────────────────────────────────────────────────────
  const weekDays = useMemo(() => {
    const base = new Date(selectedDate);
    base.setDate(base.getDate() - base.getDay() + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [selectedDate, weekOffset]);

  const weekTimeEvents = useMemo(() => {
    const source = googleConnected ? googleMappedEvents : expandedEvents;
    return source.map((e) => ({
      id: e.id,
      googleId: e.googleId,
      title: ("title" in e ? e.title : null) || e.label?.replace(/\s*\(\d{2}:\d{2}\)/, "").trim() || "Evento",
      startTime: ("startTime" in e ? (e as MappedCalendarEvent).startTime : null) ?? null,
      endTime: ("endTime" in e ? (e as MappedCalendarEvent).endTime : null) ?? null,
      day: e.day,
      month: e.month,
      year: e.year,
      color: e.color || "bg-primary",
      remote: !!("remote" in e && e.remote),
    }));
  }, [googleConnected, googleMappedEvents, expandedEvents]);

  // ── Move event (week grid) ────────────────────────────────────────────────
  const handleMoveEvent = useCallback(async (
    eventId: string, newDate: Date, newStartTime: string, newEndTime_: string,
  ) => {
    const ev = weekTimeEvents.find(e => e.id === eventId);
    if (!ev) return;
    setMovingEventId(eventId);
    try {
      if (ev.googleId && googleConnected) {
        const [sh, sm] = newStartTime.split(":").map(Number);
        const [eh, em] = newEndTime_.split(":").map(Number);
        const startISO = toLocalISOString(new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate(), sh, sm));
        const endISO = toLocalISOString(new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate(), eh, em));
        await calendar.updateEvent({
          calendar_id: "primary",
          event_id: ev.googleId,
          start_datetime: startISO,
          end_datetime: endISO,
        });
        toast({
          title: "Evento movido!",
          description: `${ev.title} → ${newDate.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })} às ${newStartTime}`,
        });
        if (fullSyncEvents.length > 0 && ev.googleId) {
          const updated = fullSyncEvents.map(fe => {
            if (fe.googleId !== ev.googleId) return fe;
            return { ...fe, day: newDate.getDate(), month: newDate.getMonth(), year: newDate.getFullYear(), startTime: newStartTime, endTime: newEndTime_ };
          });
          savePersistedSync({ ...persistedSync, events: updated });
        }
        googleRefetch();
      }
    } catch (err: any) {
      toast({ title: "Erro ao mover evento", description: err.message, variant: "destructive" });
    } finally {
      setMovingEventId(null);
    }
  }, [weekTimeEvents, googleConnected, calendar, googleRefetch, fullSyncEvents, savePersistedSync, persistedSync]);

  // ── Export helpers ─────────────────────────────────────────────────────────
  const exportToIcs = useCallback(() => {
    const eventsToExport = googleConnected ? googleMappedEvents : expandedEvents;
    if (eventsToExport.length === 0) {
      toast({ title: "Nenhum evento para exportar", description: "Importe seus eventos do Google Calendar primeiro ou adicione eventos locais.", variant: "destructive" });
      return;
    }
    buildIcs(eventsToExport, `desh-calendar-mes-${format(selectedDate, "yyyy-MM", { locale: ptBR })}.ics`);
    toast({ title: "Exportado!", description: `${eventsToExport.length} eventos do mês exportados para .ics.` });
  }, [googleConnected, googleMappedEvents, expandedEvents, selectedDate]);

  const exportAllToIcs = useCallback(() => {
    const allEvts = fullSyncEvents.length > 0
      ? fullSyncEvents
      : googleConnected ? googleMappedEvents : expandedEvents;
    if (allEvts.length === 0) {
      toast({
        title: "Nenhum evento para exportar",
        description: fullSyncEvents.length === 0 && googleConnected
          ? "Clique em 'Importar todos os eventos' primeiro para baixar o histórico completo."
          : "Adicione eventos locais primeiro.",
        variant: "destructive",
      });
      return;
    }
    buildIcs(allEvts, `desh-calendar-historico-${new Date().toISOString().slice(0, 10)}.ics`);
    toast({ title: "Histórico exportado!", description: `${allEvts.length} eventos exportados para .ics.` });
  }, [fullSyncEvents, googleConnected, googleMappedEvents, expandedEvents]);

  // ── Add event ─────────────────────────────────────────────────────────────
  const handleAddEvent = useCallback(async () => {
    if (!newTitle.trim()) return;
    if (googleConnected) {
      setCreatingRemote(true);
      try {
        const [hours, minutes] = newTime.split(":").map(Number);
        const [endHours, endMinutes] = newEndTime.split(":").map(Number);
        const startDateTime = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), hours, minutes);
        const endDateTime = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), endHours, endMinutes);
        if (endDateTime <= startDateTime) endDateTime.setHours(startDateTime.getHours() + 1, startDateTime.getMinutes());
        const startAt = toLocalISOString(startDateTime);
        const endAt = toLocalISOString(endDateTime);

        const eventBody: GoogleCalendarEventBody = {
          summary: newTitle.trim(),
          start: { dateTime: startAt },
          end: { dateTime: endAt },
        };
        if (newDescription.trim()) eventBody.description = newDescription.trim();
        if (newLocation.trim()) eventBody.location = newLocation.trim();
        if (newGuests.trim()) {
          const emails = newGuests.split(",").map(e => e.trim()).filter(Boolean);
          if (emails.length) eventBody.attendees = emails.map(email => ({ email }));
        }
        if (newReminder > 0) {
          eventBody.reminders = {
            useDefault: false,
            overrides: [
              { method: "email", minutes: newReminder },
              { method: "popup", minutes: newReminder },
            ],
          };
        }
        if (addMeet) {
          eventBody.conferenceData = {
            createRequest: {
              requestId: crypto.randomUUID(),
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          };
        }
        const createdEvent = await calendar.createEvent<any>({
          calendar_id: "primary",
          ...eventBody,
        });
        if (createdEvent?.error) {
          throw new Error(createdEvent.error.message || createdEvent.error.detail || JSON.stringify(createdEvent.error));
        }
        const hasValidId = createdEvent?.id || createdEvent?.event_id;
        const normalizedEvent = (createdEvent && hasValidId) ? { ...createdEvent } : null;
        if (normalizedEvent) {
          if (!normalizedEvent.id && normalizedEvent.event_id) normalizedEvent.id = normalizedEvent.event_id;
          if (!normalizedEvent.start && normalizedEvent.start_datetime) normalizedEvent.start = { dateTime: normalizedEvent.start_datetime };
          if (!normalizedEvent.end && normalizedEvent.end_datetime) normalizedEvent.end = { dateTime: normalizedEvent.end_datetime };
          if (!normalizedEvent.summary && normalizedEvent.title) normalizedEvent.summary = normalizedEvent.title;
          if (normalizedEvent.start?.dateTime || normalizedEvent.start?.date) {
            const mapped = mapGoogleEvent(normalizedEvent, "bg-primary", 0, "primary");
            savePersistedSync({ ...persistedSync, events: [...fullSyncEvents, mapped] });
          }
        }
        toast({ title: "Evento criado!", description: "Adicionado ao Google Calendar." });
        setTimeout(() => googleRefetch(), 2000);
        googleRefetch();
      } catch (err: any) {
        toast({ title: "Erro ao criar evento", description: err.message, variant: "destructive" });
      } finally {
        setCreatingRemote(false);
      }
    } else {
      const label = `${newTitle} (${newTime})`;
      addEvent(selectedDate.getDate(), selectedDate.getMonth(), selectedDate.getFullYear(), label, newCategory, newRecurrence);
    }
    setNewTitle("");
    setNewDescription("");
    setNewLocation("");
    setNewGuests("");
    setShowAdvanced(false);
  }, [newTitle, newTime, newEndTime, newDescription, newLocation, newGuests, newReminder, addMeet, newCategory, newRecurrence, selectedDate, googleConnected, calendar, mapGoogleEvent, savePersistedSync, persistedSync, fullSyncEvents, googleRefetch, addEvent]);

  // ── RSVP ──────────────────────────────────────────────────────────────────
  const { rsvpMap, rsvpLoading, handleRsvp, isPendingEvent } = useCalendarRsvp({ googleConnected, connectionVerified: calendarConnectionVerified, googleRefetch });

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useCalendarKeyboard({
    selectedDate,
    setSelectedDate,
    calView,
    setCalView,
    onToday: () => setSelectedDate(new Date()),
    onNewEvent: () => {
      const titleInput = document.querySelector<HTMLInputElement>('input[placeholder="Novo evento…"]');
      titleInput?.focus();
    },
    weekOffset,
    setWeekOffset,
  });

  // ── Smart time suggestion ─────────────────────────────────────────────────
  useEffect(() => {
    const now = new Date();
    const currentMin = now.getMinutes();
    const roundedMin = currentMin < 30 ? 30 : 0;
    const roundedHour = currentMin < 30 ? now.getHours() : now.getHours() + 1;
    const startH = Math.min(roundedHour, 23);
    const endH = Math.min(startH + 1, 23);
    setNewTime(`${String(startH).padStart(2, "0")}:${String(roundedMin).padStart(2, "0")}`);
    setNewEndTime(`${String(endH).padStart(2, "0")}:${String(roundedMin).padStart(2, "0")}`);
  }, [selectedDate]);

  // ── Merged events ─────────────────────────────────────────────────────────
  const allEvents = useMemo(() => {
    if (googleConnected) return googleMappedEvents;
    return expandedEvents;
  }, [googleConnected, googleMappedEvents, expandedEvents]);

  const calendarEventCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allEvents.forEach(e => {
      if (e.month === viewMonth && e.year === viewYear) {
        const calId = e.calendarId || "primary";
        counts[calId] = (counts[calId] || 0) + 1;
      }
    });
    return counts;
  }, [allEvents, viewMonth, viewYear]);

  const pendingEvents = useMemo(() =>
    allEvents
      .filter(isPendingEvent)
      .sort((a, b) => {
        const da = new Date(a.year, a.month, a.day).getTime();
        const db = new Date(b.year, b.month, b.day).getTime();
        return da - db;
      }),
    [allEvents, isPendingEvent]);

  const pendingCount = pendingEvents.length;

  const selectedEvents = useMemo(() => {
    if (filterPending) return pendingEvents;
    let events = allEvents.filter(
      e => e.day === selectedDate.getDate() && e.month === selectedDate.getMonth() && e.year === selectedDate.getFullYear()
    );
    if (filterCategory !== "all") events = events.filter(e => e.category === filterCategory);
    return events;
  }, [allEvents, selectedDate, filterCategory, filterPending, pendingEvents]);

  const filteredAllEvents = useMemo(() => {
    if (filterPending) return pendingEvents;
    let events = allEvents as (typeof allEvents[number])[];
    if (filterCategory !== "all") events = events.filter(e => e.category === filterCategory);
    return events;
  }, [allEvents, filterCategory, filterPending, pendingEvents]);

  const eventDates = useMemo(() => filteredAllEvents.map(e => new Date(e.year, e.month, e.day)), [filteredAllEvents]);

  const eventCountByDay = useMemo(() => {
    const map: Record<string, number> = {};
    filteredAllEvents.forEach(e => {
      const key = `${e.year}-${String(e.month + 1).padStart(2, "0")}-${String(e.day).padStart(2, "0")}`;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [filteredAllEvents]);

  const maxEventCount = useMemo(() => {
    const counts = Object.values(eventCountByDay);
    return counts.length ? Math.max(...counts) : 1;
  }, [eventCountByDay]);

  const eventTitlesByDay = useMemo(() => {
    const map: Record<string, string[]> = {};
    filteredAllEvents.forEach(e => {
      const key = `${e.year}-${String(e.month + 1).padStart(2, "0")}-${String(e.day).padStart(2, "0")}`;
      const title = ("title" in e ? (e as MappedCalendarEvent).title : null) || e.label || "";
      const cleanTitle = title.replace(/\s*\(\d{2}:\d{2}\)/, "").trim();
      if (!map[key]) map[key] = [];
      if (map[key].length < 5) map[key].push(cleanTitle);
    });
    return map;
  }, [filteredAllEvents]);

  const [hoveredDayKey, setHoveredDayKey] = useState<string | null>(null);
  const [tooltipAnchor, setTooltipAnchor] = useState<{ x: number; y: number } | null>(null);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Rich edit sheet state ─────────────────────────────────────────────────
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editEventTitle, setEditEventTitle] = useState("");
  const [editEventTime, setEditEventTime] = useState("");
  const [editEventEndTime, setEditEventEndTime] = useState("");
  const [editEventDate, setEditEventDate] = useState("");
  const [editEventDescription, setEditEventDescription] = useState("");
  const [editEventLocation, setEditEventLocation] = useState("");
  const [editEventReminder, setEditEventReminder] = useState(15);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editingRemote, setEditingRemote] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editingEvent, setEditingEvent] = useState<any | null>(null);

  const startEditEvent = useCallback((event: any) => {
    setEditingEvent(event);
    setEditingEventId(event.id);
    setEditEventTitle(event.title || event.label?.replace(/\s*\(\d{2}:\d{2}\)/, "").trim() || "");
    setEditEventTime(event.startTime || "09:00");
    setEditEventEndTime(event.endTime || "10:00");
    setEditEventDate(`${event.year}-${String(event.month + 1).padStart(2, "0")}-${String(event.day).padStart(2, "0")}`);
    setEditEventDescription(event.description ?? "");
    setEditEventLocation(event.location ?? "");
    setEditEventReminder(event.reminderMinutes ?? 15);
    setEditSheetOpen(true);
  }, []);

  const detectConflict = useCallback((
    dateStr: string, startTime: string, endTime: string, excludeId?: string
  ): boolean => {
    const [year, month, day] = dateStr.split("-").map(Number);
    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const newStart = toMin(startTime);
    const newEnd = toMin(endTime);
    return allEvents.some(ev => {
      if (ev.id === excludeId) return false;
      if (ev.year !== year || ev.month !== month - 1 || ev.day !== day) return false;
      const evStart = ev.startTime ? toMin(ev.startTime) : null;
      const evEnd = ev.endTime ? toMin(ev.endTime) : null;
      if (!evStart || !evEnd) return false;
      return newStart < evEnd && newEnd > evStart;
    });
  }, [allEvents]);

  const saveEditEvent = useCallback(async () => {
    if (!editEventTitle.trim() || !editingEvent) return;
    if (editEventTime && editEventEndTime && detectConflict(editEventDate, editEventTime, editEventEndTime, editingEvent.id)) {
      toast({ title: "⚠️ Conflito de horário", description: "Já existe outro evento neste período. O evento será salvo mesmo assim.", variant: "destructive" });
    }
    if (editingEvent.googleId && googleConnected) {
      setEditingRemote(true);
      try {
        const [year, month, day] = editEventDate.split("-").map(Number);
        const [sh, sm] = editEventTime.split(":").map(Number);
        const [eh, em] = editEventEndTime.split(":").map(Number);
        const startAt = toLocalISOString(new Date(year, month - 1, day, sh, sm));
        const endAt = toLocalISOString(new Date(year, month - 1, day, eh, em));
        const patchBody: GoogleCalendarEventBody = {
          summary: editEventTitle.trim(),
          start: { dateTime: startAt },
          end: { dateTime: endAt },
        };
        if (editEventDescription !== undefined) patchBody.description = editEventDescription;
        if (editEventLocation !== undefined) patchBody.location = editEventLocation;
        if (editEventReminder > 0) {
          patchBody.reminders = {
            useDefault: false,
            overrides: [
              { method: "email", minutes: editEventReminder },
              { method: "popup", minutes: editEventReminder },
            ],
          };
        } else {
          patchBody.reminders = { useDefault: true };
        }
        const calId = editingEvent.calendarId || "primary";
        await calendar.updateEvent({
          calendar_id: calId,
          event_id: editingEvent.googleId,
          ...patchBody,
        });
        toast({ title: "Evento atualizado!", description: `"${editEventTitle.trim()}" salvo no Google Calendar.` });
        googleRefetch();
      } catch (err: any) {
        toast({ title: "Erro ao editar evento", description: err.message, variant: "destructive" });
      } finally {
        setEditingRemote(false);
      }
    } else if (editingEvent.id) {
      const label = `${editEventTitle.trim()} (${editEventTime})`;
      updateEvent(editingEvent.id, { label });
      toast({ title: "Evento atualizado!" });
    }
    setEditSheetOpen(false);
    setEditingEventId(null);
    setEditingEvent(null);
  }, [editEventTitle, editEventDate, editEventTime, editEventEndTime, editEventDescription, editEventLocation, editEventReminder, editingEvent, googleConnected, calendar, googleRefetch, updateEvent, detectConflict]);

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const handleDragStart = useCallback((eventId: string) => {
    if (eventId.includes("_rec_")) return;
    setDragEventId(eventId);
  }, []);

  const handleDrop = async (date: Date) => {
    if (!dragEventId) return;
    const event = allEvents.find(e => e.id === dragEventId);
    if (event && (event as any).googleId && googleConnected) {
      setCreatingRemote(true);
      try {
        const googleId = (event as any).googleId;
        const calId = (event as any).calendarId || "primary";
        // Try raw google event first, fall back to mapped event times
        const origEvent = googleEvents?.find((e: any) => e.id === googleId);
        const mappedEv = event as MappedCalendarEvent;
        const origStart = origEvent?.start?.dateTime ? new Date(origEvent.start.dateTime) : null;
        const origEnd = origEvent?.end?.dateTime ? new Date(origEvent.end.dateTime) : null;
        const body: any = {};
        if (origStart && origEnd) {
          const newStart = new Date(date);
          newStart.setHours(origStart.getHours(), origStart.getMinutes());
          const newEnd = new Date(date);
          newEnd.setHours(origEnd.getHours(), origEnd.getMinutes());
          body.start = { dateTime: toLocalISOString(newStart) };
          body.end = { dateTime: toLocalISOString(newEnd) };
        } else if (mappedEv.startTime && mappedEv.endTime) {
          // Fallback: use mapped event's start/end times (from fullSync)
          const [sh, sm] = mappedEv.startTime.split(":").map(Number);
          const [eh, em] = mappedEv.endTime.split(":").map(Number);
          const newStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), sh, sm);
          const newEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), eh, em);
          body.start = { dateTime: toLocalISOString(newStart) };
          body.end = { dateTime: toLocalISOString(newEnd) };
        } else {
          body.start = { date: format(date, "yyyy-MM-dd") };
          body.end = { date: format(date, "yyyy-MM-dd") };
        }
        await calendar.updateEvent({
          calendar_id: calId,
          event_id: googleId,
          ...body,
        });
        toast({ title: "Evento movido!", description: `Reagendado para ${format(date, "dd/MM")}` });
        if (fullSyncEvents.length > 0) {
          const updated = fullSyncEvents.map(fe => {
            if (fe.googleId !== googleId) return fe;
            return { ...fe, day: date.getDate(), month: date.getMonth(), year: date.getFullYear() };
          });
          savePersistedSync({ ...persistedSync, events: updated });
        }
        googleRefetch();
      } catch (err: any) {
        toast({ title: "Erro ao mover evento", description: err.message, variant: "destructive" });
      } finally {
        setCreatingRemote(false);
      }
    } else {
      updateEvent(dragEventId, {
        day: date.getDate(),
        month: date.getMonth(),
        year: date.getFullYear(),
      });
      toast({ title: "Evento movido!", description: `Reagendado para ${format(date, "dd/MM")}` });
    }
    setDragEventId(null);
  };
  handleDropRef.current = handleDrop;

  const handleDropToCalendar = useCallback(async (targetCalId: string) => {
    setDragOverCalId(null);
    if (!dragEventId || !googleConnected) return;
    const event = allEvents.find(e => e.id === dragEventId);
    const sourceCalId: string = (event as any)?.calendarId || "primary";
    if (sourceCalId === targetCalId) { setDragEventId(null); return; }
    setCreatingRemote(true);
    try {
      const googleId = (event as any)?.googleId || dragEventId;
      await calendar.execute("GOOGLECALENDAR_EVENTS_MOVE", {
        calendar_id: sourceCalId,
        event_id: googleId,
        destination: targetCalId,
      });
      toast({ title: "Evento movido!", description: "Transferido para o calendário selecionado." });
      googleRefetch();
    } catch (err: any) {
      toast({ title: "Erro ao mover evento", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setCreatingRemote(false);
      setDragEventId(null);
    }
  }, [dragEventId, googleConnected, allEvents, calendar, googleRefetch]);

  // ── AI Summary ────────────────────────────────────────────────────────────
  const handleAiSummary = useCallback(async (action: "daily_summary" | "weekly_summary") => {
    setAiLoading(action);
    setAiSummary(null);
    try {
      const eventsToSend = action === "daily_summary"
        ? selectedEvents.map(e => ({ label: e.label, category: e.category }))
        : expandedEvents
            .filter(e => {
              const d = new Date(e.year, e.month, e.day);
              const start = new Date(selectedDate);
              start.setDate(start.getDate() - start.getDay());
              const end = new Date(start);
              end.setDate(end.getDate() + 6);
              return d >= start && d <= end;
            })
            .map(e => ({ day: e.day, label: e.label, category: e.category }));

      const { data, error } = await invoke<any>({
        fn: "ai-router",
        body: { module: "calendar", action, events: eventsToSend, date: format(selectedDate, "dd/MM/yyyy") },
      });
      if (error) throw new Error(error);
      setAiSummary({ type: action, ...data.result });
    } catch (err: any) {
      toast({ title: "Erro na IA", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setAiLoading(null);
    }
  }, [selectedEvents, expandedEvents, selectedDate, invoke]);

  // ── Delete event handler ──────────────────────────────────────────────────
  const handleDeleteEvent = useCallback(async (ev: any) => {
    const ok = await confirm({
      title: "Excluir evento?",
      description: `"${ev.title || ev.label}" será excluído permanentemente.`,
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    const gId = ev.googleId;
    if (gId) {
      try {
        const delCalId = ev.calendarId || "primary";
        await calendar.deleteEvent({ calendar_id: delCalId, event_id: gId });
        toast({ title: "Evento excluído" });
        if (fullSyncEvents.length > 0) {
          savePersistedSync({ ...persistedSync, events: fullSyncEvents.filter(fe => fe.googleId !== gId) });
        }
        googleRefetch();
      } catch (err: any) {
        toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
      }
    } else {
      deleteEvent(ev.id);
    }
  }, [confirm, calendar, fullSyncEvents, savePersistedSync, persistedSync, googleRefetch, deleteEvent]);

  // ── Delete from detail sheet (no confirm) ─────────────────────────────────
  const handleDeleteFromDetail = useCallback(async (ev: any) => {
    if (ev.googleId) {
      try {
        const delCalId2 = ev.calendarId || "primary";
        await calendar.deleteEvent({ calendar_id: delCalId2, event_id: ev.googleId });
        toast({ title: "Evento excluído" });
        if (fullSyncEvents.length > 0) {
          savePersistedSync({ ...persistedSync, events: fullSyncEvents.filter(fe => fe.googleId !== ev.googleId) });
        }
        googleRefetch();
      } catch (err: any) {
        toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
      }
    } else {
      deleteEvent(ev.id);
    }
  }, [calendar, fullSyncEvents, savePersistedSync, persistedSync, googleRefetch, deleteEvent]);

  return {
    // Core state
    selectedDate, setSelectedDate,
    newTitle, setNewTitle,
    newTime, setNewTime,
    newEndTime, setNewEndTime,
    newCategory, setNewCategory,
    newRecurrence, setNewRecurrence,
    newDescription, setNewDescription,
    newLocation, setNewLocation,
    newGuests, setNewGuests,
    newReminder, setNewReminder,
    showAdvanced, setShowAdvanced,
    addMeet, setAddMeet,
    filterCategory, setFilterCategory,
    filterPending, setFilterPending,
    calView, setCalView,
    weekOffset, setWeekOffset,
    dragEventId, setDragEventId,
    dragOverCalId, setDragOverCalId,
    creatingRemote,
    dayViewOpen, setDayViewOpen,
    mobileDetailOpen, setMobileDetailOpen,
    weekNewEventOpen, setWeekNewEventOpen,
    weekNewEventDate, setWeekNewEventDate,
    weekNewEventTime, setWeekNewEventTime,
    detailEvent, setDetailEvent,
    movingEventId,
    aiLoading, aiSummary, setAiSummary,
    isMobile,
    confirmDialog,

    // Google Calendar
    googleConnected, googleLoading, googleNames, googleRefetch,
    googleParams, googleEvents,
    calendarNeedsScope, calendarRequestScope,
    calendarWorkspaceId, calendarConnectionVerified,
    isComposioCalendar,
    calendarList, secondaryCalendars, secondaryColorMap, secondaryEventsMap,
    handleSecondaryData,
    disabledCalendars, toggleCalendar,

    // Sync
    fullSyncEvents, fullSyncStatus, setFullSyncStatus,
    fullSyncProgress, syncTokens,
    persistedSyncLoading, clearSyncCache,
    runFullSync, runIncrementalSync, syncTooltipText,

    // Derived data
    allEvents, expandedEvents, googleMappedEvents,
    selectedEvents, filteredAllEvents, pendingEvents, pendingCount,
    eventDates, eventCountByDay, maxEventCount, eventTitlesByDay,
    calendarEventCounts,
    weekDays, weekTimeEvents,
    handleDropRef,

    // Tooltip
    hoveredDayKey, setHoveredDayKey,
    tooltipAnchor, setTooltipAnchor,
    tooltipTimeoutRef,

    // Edit sheet
    editingEventId, setEditingEventId,
    editEventTitle, setEditEventTitle,
    editEventTime, setEditEventTime,
    editEventEndTime, setEditEventEndTime,
    editEventDate, setEditEventDate,
    editEventDescription, setEditEventDescription,
    editEventLocation, setEditEventLocation,
    editEventReminder, setEditEventReminder,
    editSheetOpen, setEditSheetOpen,
    editingRemote,
    editingEvent, setEditingEvent,

    // Handlers
    handleAddEvent,
    handleDragStart,
    handleDropToCalendar,
    handleMoveEvent,
    handleAiSummary,
    handleDeleteEvent,
    handleDeleteFromDetail,
    startEditEvent,
    saveEditEvent,
    detectConflict,
    exportToIcs, exportAllToIcs,

    // RSVP
    rsvpMap, rsvpLoading, handleRsvp, isPendingEvent,

    // Constants
    CATEGORIES,
  };
}

import { useState, useMemo, useCallback } from "react";
import { useConnections } from "@/contexts/ConnectionsContext";

import { useGoogleServiceData } from "@/hooks/integrations/useGoogleServiceData";
import { useDashboard, type EventCategory, type RecurrenceType } from "@/contexts/DashboardContext";

import { useCalendarActions } from "@/hooks/integrations/useCalendarActions";
import { toast } from "@/hooks/use-toast";

export interface CalendarEvent {
  id: string;
  day: number;
  month: number;
  year: number;
  label: string;
  color: string;
  remote: boolean;
  category: EventCategory;
  recurrence: RecurrenceType;
  calendarId?: string; // Google Calendar ID this event belongs to
}

const EVENT_COLORS = ["bg-primary", "bg-accent", "bg-destructive", "bg-muted-foreground", "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500"];

const formatTime = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

export const useCalendarEvents = (viewMonth: number, viewYear: number) => {
  const calendar = useCalendarActions();


  const { state, addEvent, deleteEvent } = useDashboard();
  const { getConnectionsByCategory } = useConnections();
  const calendarConns = getConnectionsByCategory("calendar");
  const connectionIds = calendarConns.map(c => c.id);
  const calendarConn = calendarConns[0];

  const [creatingEvent, setCreatingEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Google Calendar data - fetch calendar list for multi-calendar support
  const { data: googleCalendarList, isConnected: googleConnected, connectionNames: googleNames, needsScope: calendarNeedsScope, requestScope: calendarRequestScope } = useGoogleServiceData<any[]>({
    service: "calendar",
    path: "/users/me/calendarList",
    params: { minAccessRole: "reader" },
    pollingInterval: 30 * 60 * 1000, // 30 min — list rarely changes
  });

  const googleParams = useMemo(() => {
    // Normalize to start/end of month in UTC to maximise cache sharing between
    // CalendarWidget and CalendarPage even across different timezone offsets
    const timeMin = new Date(Date.UTC(viewYear, viewMonth, 1)).toISOString();
    const timeMax = new Date(Date.UTC(viewYear, viewMonth + 1, 0, 23, 59, 59)).toISOString();
    return { timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "50" };
  }, [viewMonth, viewYear]);

  // Fetch events from primary calendar only — secondary calendars are fetched in CalendarPage
  const { data: googleEvents, isLoading: googleLoading, refetch: googleRefetch, lastSyncedAt: calendarLastSync } = useGoogleServiceData<any[]>({
    service: "calendar",
    path: "/calendars/primary/events",
    params: googleParams,
    enabled: googleConnected,
    pollingInterval: 30 * 60 * 1000, // 30 min polling
  });

  // Merge primary Google Calendar events only (no secondary here — reduces API calls ~50%)
  const allGoogleEvents = useMemo(() => {
    if (!googleConnected) return [];
    const primary = (googleEvents || []).map((e: any) => ({ ...e, _calendarId: "primary", _calendarColor: googleCalendarList?.find((c: any) => c.primary)?.backgroundColor || null }));
    return primary.sort((a, b) => {
      const aTime = a.start?.dateTime || a.start?.date || "";
      const bTime = b.start?.dateTime || b.start?.date || "";
      return aTime.localeCompare(bTime);
    });
  }, [googleConnected, googleEvents, googleCalendarList]);

  const isConnected = googleConnected;
  const isLoading = googleLoading;
  const refetch = googleRefetch;

  // Map Google calendar colors to Tailwind classes
  const calColorMap = useMemo(() => {
    const map = new Map<string, string>();
    (googleCalendarList || []).forEach((cal: any, i: number) => {
      map.set(cal.id, EVENT_COLORS[i % EVENT_COLORS.length]);
    });
    return map;
  }, [googleCalendarList]);

  const mappedEvents = useMemo<CalendarEvent[] | null>(() => {
    const daysInView = new Date(viewYear, viewMonth + 1, 0).getDate();

    if (googleConnected) {
      return allGoogleEvents.map((e: any, i: number) => {
        const startStr = e.start?.dateTime || e.start?.date || e.created;
        const start = new Date(startStr);
        const timeStr = e.start?.dateTime ? formatTime(e.start.dateTime) : null;
        const day = Math.min(start.getDate(), daysInView);
        const calColor = calColorMap.get(e._calendarId) || EVENT_COLORS[i % EVENT_COLORS.length];
        return {
          id: e.id || String(i),
          day,
          month: viewMonth,
          year: viewYear,
          label: timeStr ? `${timeStr} - ${e.summary || "Evento"}` : (e.summary || "Evento"),
          color: calColor,
          remote: true,
          category: "outro" as EventCategory,
          recurrence: "none" as RecurrenceType,
          calendarId: e._calendarId || "primary",
        };
      });
    }

    return null;
  }, [googleConnected, allGoogleEvents, viewMonth, viewYear, calColorMap]);

  // Always include local events (from Pandora/automations) and merge with remote
  const localEvents: CalendarEvent[] = useMemo(() =>
    state.events
      .filter(e => e.month === viewMonth && e.year === viewYear)
      .map(e => ({ ...e, remote: false })) as CalendarEvent[],
    [state.events, viewMonth, viewYear]
  );

  const displayEvents: CalendarEvent[] = useMemo(() => {
    if (!mappedEvents) return localEvents;
    // Build a Set of normalized labels for O(1) lookup instead of O(n²)
    const remoteLabels = new Set(
      mappedEvents.map(re => `${re.day}|${re.label.toLowerCase().replace(/^\d{2}:\d{2}\s*[-–]\s*/, "").trim()}`)
    );
    const dedupedLocal = localEvents.filter(le => {
      const key = `${le.day}|${le.label.toLowerCase().replace(/^\d{2}:\d{2}\s*[-–]\s*/, "").trim()}`;
      return !remoteLabels.has(key);
    });
    return [...mappedEvents, ...dedupedLocal];
  }, [mappedEvents, localEvents]);

  const handleAdd = useCallback(async (eventName: string, selectedDay: number, options?: {
    startTime?: string; endTime?: string; location?: string; description?: string;
    attendees?: string[]; recurrence?: string; addMeet?: boolean; category?: EventCategory;
    date?: string;
  }) => {
    if (!eventName.trim()) return;

    const startHour = options?.startTime ? parseInt(options.startTime.split(":")[0]) : 9;
    const startMin = options?.startTime ? parseInt(options.startTime.split(":")[1]) : 0;
    const endHour = options?.endTime ? parseInt(options.endTime.split(":")[0]) : startHour + 1;
    const endMin = options?.endTime ? parseInt(options.endTime.split(":")[1]) : 0;

    // If date is provided, parse it to get the actual day/month/year
    let eventDay = selectedDay;
    let eventMonth = viewMonth;
    let eventYear = viewYear;
    if (options?.date) {
      const d = new Date(options.date + "T12:00:00");
      eventDay = d.getDate();
      eventMonth = d.getMonth();
      eventYear = d.getFullYear();
    }

    if (googleConnected) {
      setCreatingEvent(true);
      try {
        const startAt = new Date(eventYear, eventMonth, eventDay, startHour, startMin).toISOString();
        const endAt = new Date(eventYear, eventMonth, eventDay, endHour, endMin).toISOString();
        const body: any = {
          summary: eventName.trim(),
          start_datetime: startAt,
          end_datetime: endAt,
          calendar_id: "primary",
        };
        if (options?.location) body.location = options.location;
        if (options?.description) body.description = options.description;
        if (options?.attendees?.length) {
          body.attendees = options.attendees.map(email => ({ email }));
        }
        if (options?.addMeet) {
          body.conferenceData = { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } };
        }
        if (options?.recurrence && options.recurrence !== "none") {
          const ruleMap: Record<string, string> = { daily: "RRULE:FREQ=DAILY", weekly: "RRULE:FREQ=WEEKLY", monthly: "RRULE:FREQ=MONTHLY" };
          body.recurrence = [ruleMap[options.recurrence]];
        }

        if (options?.addMeet) body.conference_data_version = 1;
        await calendar.createEvent(body);
        toast({ title: "Evento criado!", description: "O evento foi adicionado ao Google Calendar." });
        refetch();
      } catch (err: any) {
        console.error("Error creating Google event:", err);
        toast({ title: "Erro ao criar evento", description: err.message, variant: "destructive" });
      } finally {
        setCreatingEvent(false);
      }
    } else {
      addEvent(eventDay, eventMonth, eventYear, eventName.trim(), options?.category, options?.recurrence as any);
    }
  }, [googleConnected, isConnected, viewYear, viewMonth, addEvent, refetch, calendar]);

  const handleDeleteRemote = useCallback(async (eventId: string) => {
    if (googleConnected) {
      setActionLoading(eventId);
      try {
        await calendar.deleteEvent({ calendar_id: "primary", event_id: eventId });
        toast({ title: "Evento excluído" });
        refetch();
      } catch (err: any) {
        console.error("Error deleting Google event:", err);
        toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
      } finally {
        setActionLoading(null);
      }
    }
  }, [googleConnected, refetch, calendar]);

  const handleEditRemote = useCallback(async (eventId: string, options?: {
    title?: string; startTime?: string; endTime?: string; location?: string;
    description?: string; attendees?: string[]; recurrence?: string; addMeet?: boolean;
    date?: string;
  }) => {
    const summary = options?.title?.trim() || editValue.trim();
    if (!summary) return;

    if (googleConnected) {
      setActionLoading(eventId);
      try {
        const body: any = { summary, event_id: eventId, calendar_id: "primary" };
        if (options?.location !== undefined) body.location = options.location;
        if (options?.description !== undefined) body.description = options.description;
        if (options?.attendees?.length) body.attendees = options.attendees.map(email => ({ email }));
        if (options?.date && options?.startTime && options?.endTime) {
          const [sh, sm] = options.startTime.split(":").map(Number);
          const [eh, em] = options.endTime.split(":").map(Number);
          const d = new Date(options.date + "T12:00:00");
          body.start_datetime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm).toISOString();
          body.end_datetime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh, em).toISOString();
        }
        if (options?.recurrence && options.recurrence !== "none") {
          const ruleMap: Record<string, string> = { daily: "RRULE:FREQ=DAILY", weekly: "RRULE:FREQ=WEEKLY", monthly: "RRULE:FREQ=MONTHLY" };
          body.recurrence = [ruleMap[options.recurrence]];
        }
        if (options?.addMeet) {
          body.conferenceData = { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } };
        }

        if (options?.addMeet) body.conference_data_version = 1;
        await calendar.updateEvent(body);
        toast({ title: "Evento atualizado" });
        setEditingEventId(null);
        setEditValue("");
        refetch();
      } catch (err: any) {
        console.error("Error editing Google event:", err);
        toast({ title: "Erro ao editar", description: err.message, variant: "destructive" });
      } finally {
        setActionLoading(null);
      }
    }
  }, [googleConnected, editValue, refetch, calendar]);

  const startEditing = useCallback((eventId: string, currentLabel: string) => {
    setEditingEventId(eventId);
    setEditValue(currentLabel.replace(/^\d{2}:\d{2} - /, ""));
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingEventId(null);
    setEditValue("");
  }, []);

  return {
    displayEvents,
    isLoading,
    isConnected,
    connectionCount: googleConnected ? 1 : connectionIds.length,
    connectionNames: googleConnected ? googleNames : calendarConns.map(c => `${c.platform} - ${c.name}`),
    creatingEvent,
    editingEventId,
    editValue,
    setEditValue,
    actionLoading,
    handleAdd,
    handleDeleteRemote,
    handleEditRemote,
    startEditing,
    cancelEditing,
    deleteEvent,
    calendarNeedsScope,
    calendarRequestScope,
    calendarLastSync,
    refetch,
    googleConnected,
  };
};

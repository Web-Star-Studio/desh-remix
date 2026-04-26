import { useCallback, useMemo } from "react";
import { executeComposioAction, ComposioExecuteError } from "@/lib/composio-client";
import { useComposioWorkspaceId } from "@/hooks/integrations/useComposioWorkspaceId";

/**
 * Typed wrapper around Composio's googlecalendar toolkit. Replaces the legacy
 * `composio-proxy` edge function. Action slugs mirror
 * `components/admin/ComposioActionsTab.tsx`.
 */

export const CALENDAR_ACTIONS = {
  LIST_CALENDARS: "GOOGLECALENDAR_LIST_CALENDARS",
  GET_CALENDAR: "GOOGLECALENDAR_GET_CALENDAR",
  FIND_EVENT: "GOOGLECALENDAR_FIND_EVENT",
  EVENTS_GET: "GOOGLECALENDAR_EVENTS_GET",
  EVENTS_MOVE: "GOOGLECALENDAR_EVENTS_MOVE",
  CREATE_EVENT: "GOOGLECALENDAR_CREATE_EVENT",
  UPDATE_EVENT: "GOOGLECALENDAR_UPDATE_EVENT",
  DELETE_EVENT: "GOOGLECALENDAR_DELETE_EVENT",
  QUICK_ADD: "GOOGLECALENDAR_QUICK_ADD",
  FIND_FREE_SLOTS: "GOOGLECALENDAR_FIND_FREE_SLOTS",
  REMOVE_ATTENDEE: "GOOGLECALENDAR_REMOVE_ATTENDEE",
} as const;

export type CalendarAction = (typeof CALENDAR_ACTIONS)[keyof typeof CALENDAR_ACTIONS];

export function useCalendarActions() {
  const workspaceId = useComposioWorkspaceId();

  const execute = useCallback(
    <T = unknown>(action: CalendarAction, args: Record<string, unknown> = {}) =>
      executeComposioAction<T>(workspaceId, "googlecalendar", action, args),
    [workspaceId],
  );

  return useMemo(
    () => ({
      execute,
      listCalendars: <T = unknown>(args: Record<string, unknown> = {}) => execute<T>(CALENDAR_ACTIONS.LIST_CALENDARS, args),
      getCalendar: <T = unknown>(calendarId: string) => execute<T>(CALENDAR_ACTIONS.GET_CALENDAR, { calendar_id: calendarId }),
      findEvents: <T = unknown>(args: Record<string, unknown> = {}) => execute<T>(CALENDAR_ACTIONS.FIND_EVENT, args),
      getEvent: <T = unknown>(args: { calendar_id: string; event_id: string }) => execute<T>(CALENDAR_ACTIONS.EVENTS_GET, args),
      createEvent: <T = unknown>(args: Record<string, unknown>) => execute<T>(CALENDAR_ACTIONS.CREATE_EVENT, args),
      updateEvent: <T = unknown>(args: Record<string, unknown>) => execute<T>(CALENDAR_ACTIONS.UPDATE_EVENT, args),
      deleteEvent: <T = unknown>(args: { calendar_id: string; event_id: string }) => execute<T>(CALENDAR_ACTIONS.DELETE_EVENT, args),
      quickAdd: <T = unknown>(args: { calendar_id: string; text: string }) => execute<T>(CALENDAR_ACTIONS.QUICK_ADD, args),
      findFreeSlots: <T = unknown>(args: Record<string, unknown>) => execute<T>(CALENDAR_ACTIONS.FIND_FREE_SLOTS, args),
    }),
    [execute],
  );
}

export { ComposioExecuteError };

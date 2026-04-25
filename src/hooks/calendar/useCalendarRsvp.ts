/**
 * useCalendarRsvp — Extracted from CalendarPage
 * Handles RSVP responses for Google Calendar events.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { useComposioProxy } from "@/hooks/integrations/useComposioProxy";
import { toast } from "@/hooks/use-toast";

export function useCalendarRsvp({
  googleConnected,
  connectionVerified,
  googleRefetch,
}: {
  googleConnected: boolean;
  connectionVerified?: boolean;
  googleRefetch: () => void;
}) {
  const { callComposioProxy } = useComposioProxy();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const [rsvpMap, setRsvpMap] = useState<Record<string, string>>({});
  const [rsvpLoading, setRsvpLoading] = useState<Record<string, boolean>>({});

  const handleRsvp = useCallback(async (event: any, response: "accepted" | "declined" | "tentative") => {
    const googleId: string = event.googleId;
    if (!googleId || !googleConnected || connectionVerified === false) return;
    setRsvpLoading(prev => ({ ...prev, [googleId]: true }));
    setRsvpMap(prev => ({ ...prev, [googleId]: response }));
    try {
      const calId = event.calendarId || "primary";
      await callComposioProxy({
        service: "calendar",
        path: `/calendars/${encodeURIComponent(calId)}/events/${googleId}`,
        method: "PATCH",
        data: {
          attendees: (event.attendees || []).map((a: any) =>
            a.self ? { ...a, responseStatus: response } : a
          ),
        },
      });
      const labels: Record<string, string> = { accepted: "Confirmado ✓", declined: "Recusado", tentative: "Talvez" };
      if (mountedRef.current) toast({ title: labels[response] });
      googleRefetch();
    } catch (err: any) {
      if (mountedRef.current) {
        setRsvpMap(prev => { const copy = { ...prev }; delete copy[googleId]; return copy; });
        toast({ title: "Erro ao responder", description: err.message, variant: "destructive" });
      }
    } finally {
      if (mountedRef.current) setRsvpLoading(prev => ({ ...prev, [googleId]: false }));
    }
  }, [googleConnected, connectionVerified, callComposioProxy, googleRefetch]);

  const isPendingEvent = useCallback((ev: any) => {
    const selfAttendee = ev.attendees?.find((a: any) => a.self === true);
    if (!selfAttendee) return false;
    const status = rsvpMap[ev.googleId] ?? selfAttendee.responseStatus;
    return status === "needsAction";
  }, [rsvpMap]);

  return { rsvpMap, rsvpLoading, handleRsvp, isPendingEvent };
}

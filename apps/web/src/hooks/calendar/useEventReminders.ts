import { useEffect, useMemo, useRef } from "react";
import { useGoogleServiceData } from "@/hooks/integrations/useGoogleServiceData";
import { useSoundAlerts } from "@/hooks/ui/useSoundAlerts";
import { useDashboardState } from "@/contexts/DashboardContext";
import { toast } from "@/hooks/use-toast";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { useAuth } from "@/contexts/AuthContext";

const STORAGE_KEY = "desh-event-reminders-v2";
const CHECK_INTERVAL = 60_000; // 1 min

// Each event gets a reminder at ≤30 min and ≤5 min (two separate alerts)
const THRESHOLDS = [
  { minutes: 30, key: "30m" },
  { minutes: 5,  key: "5m"  },
];

interface SentMap { [eventKey: string]: number }

function getSent(): SentMap {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}

function markSent(key: string) {
  const sent = getSent();
  sent[key] = Date.now();
  const cutoff = Date.now() - 86_400_000;
  for (const k of Object.keys(sent)) if (sent[k] < cutoff) delete sent[k];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sent));
}

function sendBrowserNotification(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try { new Notification(title, { body, icon: "/desh-icon.png" }); } catch {}
}

function minutesLabel(min: number) {
  return min === 1 ? "1 minuto" : `${min} minutos`;
}

export function useEventReminders() {
  const { user } = useAuth();
  // Bucket the time window to 5 minutes so the params reference is stable
  // across renders. A fresh `new Date()` literal each render destabilises
  // useGoogleServiceData's fetchData callback and trips React's max-update
  // depth check.
  const calendarParams = useMemo(() => ({
    timeMin: new Date().toISOString(),
    timeMax: new Date(Date.now() + 2 * 3600_000).toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "20",
  }), [Math.floor(Date.now() / 300_000)]);

  const { data: googleEvents, isConnected: googleConnected } = useGoogleServiceData<any[]>({
    service: "calendar",
    path: "/calendars/primary/events",
    params: calendarParams,
    pollingInterval: 5 * 60_000,
  });

  const state = useDashboardState();
  const { playSound } = useSoundAlerts();
  const { invoke } = useEdgeFn();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      const sent = getSent();

      // ── Google Calendar events ────────────────────────────────────────────
      if (googleConnected && googleEvents?.length) {
        for (const ev of googleEvents) {
          const startStr = ev.start?.dateTime;
          if (!startStr) continue;
          const startMs = new Date(startStr).getTime();
          const diffMin = Math.round((startMs - now) / 60_000);

          for (const { minutes, key } of THRESHOLDS) {
            if (diffMin > 0 && diffMin <= minutes) {
              const storageKey = `${ev.id}-${key}`;
              if (sent[storageKey]) continue;

              const title = ev.summary || "Evento";
              const timeStr = new Date(startStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

              toast({
                title: `📅 ${title}`,
                description: `Começa às ${timeStr} — em ${minutesLabel(diffMin)}`,
                duration: key === "5m" ? 15_000 : 8_000,
              });

              sendBrowserNotification(
                `📅 Evento em ${minutesLabel(diffMin)}`,
                `${title} — ${timeStr}`
              );

              // Send email for 30m threshold only (avoid double emails)
              if (key === "30m" && user?.id) {
                invoke({
                  fn: "email-system",
                  body: {
                    action: "send-notification",
                    type: "event_reminder",
                    user_id: user.id,
                    data: { title, time_str: timeStr, minutes: diffMin },
                  },
                }).catch(() => {});
              }

              if (key === "5m") playSound("calendar");
              markSent(storageKey);
            }
          }
        }
      }

      // ── Local dashboard events ────────────────────────────────────────────
      const todayLocal = new Date();
      const todayDay   = todayLocal.getDate();
      const todayMonth = todayLocal.getMonth();
      const todayYear  = todayLocal.getFullYear();

      for (const ev of state.events) {
        if (ev.day !== todayDay || ev.month !== todayMonth || ev.year !== todayYear) continue;

        const timeMatch = ev.label.match(/^(\d{2}):(\d{2})/);
        if (!timeMatch) continue;

        const [, hStr, mStr] = timeMatch;
        const evMs = new Date(todayYear, todayMonth, todayDay, Number(hStr), Number(mStr)).getTime();
        const diffMin = Math.round((evMs - now) / 60_000);

        for (const { minutes, key } of THRESHOLDS) {
          if (diffMin > 0 && diffMin <= minutes) {
            const storageKey = `local-${ev.id}-${key}`;
            if (sent[storageKey]) continue;

            const title = ev.label.replace(/^\d{2}:\d{2} - /, "");
            const timeStr = `${hStr}:${mStr}`;

            toast({
              title: `📅 ${title}`,
              description: `Começa às ${timeStr} — em ${minutesLabel(diffMin)}`,
              duration: key === "5m" ? 15_000 : 8_000,
            });

            sendBrowserNotification(
              `📅 Evento em ${minutesLabel(diffMin)}`,
              `${title} — ${timeStr}`
            );

            // Send email for 30m threshold
            if (key === "30m" && user?.id) {
              invoke({
                fn: "email-system",
                body: {
                  action: "send-notification",
                  type: "event_reminder",
                  user_id: user.id,
                  data: { title, time_str: timeStr, minutes: diffMin },
                },
              }).catch(() => {});
            }

            if (key === "5m") playSound("calendar");
            markSent(storageKey);
          }
        }
      }
    };

    check();
    intervalRef.current = setInterval(check, CHECK_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [googleEvents, googleConnected, state.events, playSound, invoke, user]);
}

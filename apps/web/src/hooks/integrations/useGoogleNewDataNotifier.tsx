import { useEffect, useRef, useCallback } from "react";
import { useGoogleServiceData } from "./useGoogleServiceData";
import { SoundType } from "@/hooks/ui/useSoundAlerts";

const STORAGE_KEY = "desh-google-seen-ids";

interface ServiceConfig {
  service: string;
  path: string;
  params?: Record<string, string>;
  label: string;
  icon: string;
  sound: SoundType;
  idExtractor: (item: any) => string;
  titleExtractor: (item: any) => string;
}

const SERVICES: ServiceConfig[] = [
  {
    service: "gmail",
    path: "/gmail/v1/users/me/messages",
    label: "E-mail",
    icon: "📧",
    sound: "email",
    idExtractor: (m) => m.id,
    titleExtractor: (m) => {
      const subj = m.payload?.headers?.find((h: any) => h.name?.toLowerCase() === "subject");
      return subj?.value || "Novo e-mail";
    },
  },
  {
    service: "calendar",
    path: "/calendars/primary/events",
    label: "Evento",
    icon: "📅",
    sound: "calendar",
    idExtractor: (e) => e.id,
    titleExtractor: (e) => e.summary || "Novo evento",
  },
  {
    service: "tasks",
    path: "/lists/@default/tasks",
    label: "Tarefa",
    icon: "✅",
    sound: "task",
    idExtractor: (t) => t.id,
    titleExtractor: (t) => t.title || "Nova tarefa",
  },
  // People and Drive disabled — high API quota pressure, low notification value
  // { service: "people", ... },
  // { service: "drive", ... },
];

function getSeenIds(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setSeenIds(data: Record<string, string[]>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function sendBrowserNotification(title: string, body: string, icon: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    new Notification(title, { body, icon: "/desh-icon.png", badge: "/desh-icon.png" });
  } catch {
    // Safari or restricted contexts
  }
}

const GOOGLE_NOTIF_STORAGE_KEY = "desh-google-notif-prefs";

function isServiceEnabled(service: string): boolean {
  try {
    const raw = localStorage.getItem(GOOGLE_NOTIF_STORAGE_KEY);
    if (!raw) return true; // default all on
    const prefs = JSON.parse(raw);
    return prefs[service] !== false;
  } catch {
    return true;
  }
}

function ServiceNotifier({ config }: { config: ServiceConfig }) {
  const { data, isConnected } = useGoogleServiceData<any[]>({
    service: config.service,
    path: config.path,
    params: config.params,
    pollingInterval: 30 * 60 * 1000, // 30 min — reduce API pressure
  });
  const initialLoad = useRef(true);

  useEffect(() => {
    if (!isConnected || !data || data.length === 0) return;
    if (!isServiceEnabled(config.service)) return;

    const ids = data.map(config.idExtractor).filter(Boolean);
    const seenMap = getSeenIds();
    const seen = new Set(seenMap[config.service] || []);

    if (initialLoad.current) {
      // First load: just store IDs, don't notify
      initialLoad.current = false;
      seenMap[config.service] = ids.slice(0, 200);
      setSeenIds(seenMap);
      return;
    }

    const newItems = data.filter((item) => {
      const id = config.idExtractor(item);
      return id && !seen.has(id);
    });

    if (newItems.length > 0) {
      // Send browser notifications (max 3 to avoid spam)
      const toNotify = newItems.slice(0, 3);
      for (const item of toNotify) {
        const title = config.titleExtractor(item);
        sendBrowserNotification(
          `${config.icon} Novo ${config.label}`,
          title,
          "/desh-icon.png"
        );
      }

      if (newItems.length > 3) {
        sendBrowserNotification(
          `${config.icon} ${config.label}`,
          `+${newItems.length - 3} novos itens`,
          "/desh-icon.png"
        );
      }

      // Update seen IDs
      const allIds = [...ids, ...Array.from(seen)].slice(0, 500);
      seenMap[config.service] = allIds;
      setSeenIds(seenMap);
    }
  }, [data, isConnected]);

  return null;
}

/**
 * Requests notification permission and renders invisible ServiceNotifier
 * components for each Google service.
 */
export function useGoogleNewDataNotifier() {
  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  return { ServiceNotifiers: GoogleServiceNotifiers };
}

/** Render this component to activate background notifiers */
export function GoogleServiceNotifiers() {
  return (
    <>
      {SERVICES.map((config) => (
        <ServiceNotifier key={config.service} config={config} />
      ))}
    </>
  );
}

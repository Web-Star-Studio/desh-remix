// TODO: Migrar para edge function — acesso direto ao Supabase
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";

const DEADLINE_STORAGE_KEY = "desh-deadline-notified";
const CHECK_INTERVAL = 60_000; // 1 min

function getNotified(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DEADLINE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function markNotified(id: string) {
  const data = getNotified();
  data[id] = Date.now();
  const cutoff = Date.now() - 172800000;
  for (const key of Object.keys(data)) {
    if (data[key] < cutoff) delete data[key];
  }
  try {
    localStorage.setItem(DEADLINE_STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function sendNotification(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon: "/desh-icon.png",
      badge: "/desh-icon.png",
      tag: `local-${Date.now()}`,
    });
  } catch {}
}

/**
 * Monitors local DB tasks for upcoming deadlines and new inserts,
 * sending browser push notifications + email via Resend.
 */
export function useLocalDataNotifier() {
  const { user } = useAuth();
  const initialLoad = useRef(true);
  const { invoke } = useEdgeFn();

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Listen for new task inserts via Realtime
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("local-notifier")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tasks", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (initialLoad.current) return;
          const task = payload.new as any;
          if (task.status === "done") return;
          sendNotification("✅ Nova tarefa criada", task.title || "Tarefa sem título");
        }
      )
      .subscribe();

    const timer = setTimeout(() => {
      initialLoad.current = false;
    }, 5000);

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Check for upcoming task deadlines every minute
  useEffect(() => {
    if (!user) return;

    const checkDeadlines = async () => {
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 3600000);

      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, due_date, status")
        .eq("user_id", user.id)
        .neq("status", "done")
        .not("due_date", "is", null)
        .gte("due_date", now.toISOString())
        .lte("due_date", oneHourFromNow.toISOString())
        .limit(20);

      if (!tasks || tasks.length === 0) return;

      const notified = getNotified();

      for (const task of tasks) {
        if (notified[task.id]) continue;
        const dueDate = new Date(task.due_date!);
        const minutesUntil = Math.round((dueDate.getTime() - now.getTime()) / 60000);

        if (minutesUntil <= 60 && minutesUntil > 0) {
          let timeLabel: string;
          if (minutesUntil <= 15) {
            timeLabel = `em ${minutesUntil} min`;
          } else if (minutesUntil <= 30) {
            timeLabel = "em ~30 min";
          } else {
            timeLabel = "em ~1 hora";
          }

          sendNotification(
            `⏰ Prazo próximo`,
            `${task.title} — vence ${timeLabel}`
          );

          // Send email notification (fire-and-forget)
          invoke({
            fn: "email-system",
            body: {
              action: "send-notification",
              type: "task_reminder",
              user_id: user.id,
              data: { title: task.title, time_label: timeLabel },
            },
          }).catch(() => {}); // silently fail

          markNotified(task.id);
        }
      }
    };

    const initialTimer = setTimeout(checkDeadlines, 10000);
    const interval = setInterval(checkDeadlines, CHECK_INTERVAL);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [user, invoke]);
}

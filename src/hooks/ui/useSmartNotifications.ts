// TODO: Migrar para edge function — acesso direto ao Supabase
import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useSoundAlerts } from "@/hooks/ui/useSoundAlerts";
import { useProactiveInsights } from "@/hooks/ai/useProactiveInsights";

const STORAGE_KEY = "desh-smart-notif";
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 min

interface SmartNotifState {
  dailySummaryDate: string | null;
}

function getState(): SmartNotifState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { dailySummaryDate: null };
  } catch {
    return { dailySummaryDate: null };
  }
}

function saveState(s: SmartNotifState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

function sendNotif(title: string, body: string, tag: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, { body, icon: "/desh-icon.png", badge: "/desh-icon.png", tag });
    setTimeout(() => n.close(), 10000);
  } catch {}
}

/**
 * Smart contextual push notifications:
 * 1. Daily morning summary (tasks + events count)
 */
export function useSmartNotifications() {
  const { user } = useAuth();
  const { playSound } = useSoundAlerts();
  const proactiveInsights = useProactiveInsights();
  const running = useRef(false);

  // Request permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const checkDailySummary = useCallback(async () => {
    if (!user) return;
    const state = getState();
    const today = new Date().toDateString();
    if (state.dailySummaryDate === today) return;

    const hour = new Date().getHours();
    // Only send between 7-10 AM
    if (hour < 7 || hour > 10) return;

    try {
      const [{ count: taskCount }, { count: eventCount }] = await Promise.all([
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .neq("status", "done"),
        supabase
          .from("user_data")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("data_type", "calendar"),
      ]);

      const tasks = taskCount ?? 0;
      const events = eventCount ?? 0;
      const parts: string[] = [];
      if (tasks > 0) parts.push(`${tasks} tarefa${tasks > 1 ? "s" : ""} pendente${tasks > 1 ? "s" : ""}`);
      if (events > 0) parts.push(`${events} evento${events > 1 ? "s" : ""} no calendário`);

      if (parts.length > 0) {
        sendNotif(
          "☀️ Bom dia! Seu resumo",
          `Hoje você tem ${parts.join(" e ")}. Bora começar! 💪`,
          "daily-summary"
        );
        playSound("notification");
      }
      state.dailySummaryDate = today;
      saveState(state);
    } catch {}
  }, [user, playSound]);

  useEffect(() => {
    if (!user || running.current) return;
    running.current = true;

    const runAll = () => {
      checkDailySummary();
    };

    // Initial check after 15s (let widgets load first)
    const initialTimer = setTimeout(runAll, 15_000);
    const interval = setInterval(runAll, CHECK_INTERVAL);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      running.current = false;
    };
  }, [user, checkDailySummary]);

  return proactiveInsights;
}

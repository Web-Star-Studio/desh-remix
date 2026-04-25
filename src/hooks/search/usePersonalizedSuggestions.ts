// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays } from "date-fns";

interface Suggestion {
  text: string;
  source: "task" | "event" | "history" | "habit";
  icon: string;
}

const fallbackSuggestions: Suggestion[] = [
  { text: "Dicas de produtividade", source: "history", icon: "🔥" },
  { text: "Como organizar minha rotina", source: "history", icon: "📋" },
  { text: "Inteligência Artificial 2026", source: "history", icon: "🤖" },
  { text: "Melhores hábitos diários", source: "history", icon: "✨" },
];

export function usePersonalizedSuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>(fallbackSuggestions);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) { setLoading(false); return; }

      const items: Suggestion[] = [];
      const today = format(new Date(), "yyyy-MM-dd");
      const nextWeek = format(addDays(new Date(), 7), "yyyy-MM-dd");

      // Fetch pending high-priority tasks
      const { data: tasks } = await supabase
        .from("tasks")
        .select("title, priority, due_date")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("due_date", { ascending: true })
        .limit(10);

      if (tasks?.length) {
        // Overdue or due today
        const urgent = tasks.filter(t => t.due_date && t.due_date <= today);
        const upcoming = tasks.filter(t => t.due_date && t.due_date > today && t.due_date <= nextWeek);
        const highPri = tasks.filter(t => t.priority === "high");

        const taskPool = [...new Set([...urgent, ...highPri, ...upcoming])].slice(0, 3);
        for (const t of taskPool) {
          items.push({
            text: `Como fazer: ${t.title}`,
            source: "task",
            icon: t.priority === "high" ? "🔴" : "📌",
          });
        }
      }

      // Fetch upcoming events (next 7 days)
      const { data: events } = await supabase
        .from("user_data")
        .select("data")
        .eq("user_id", user.id)
        .eq("data_type", "calendar_events")
        .limit(1)
        .single();

      if (events?.data && Array.isArray(events.data)) {
        const now = new Date();
        const nowMonth = now.getMonth();
        const nowDay = now.getDate();
        const nowYear = now.getFullYear();

        const upcomingEvents = (events.data as any[])
          .filter((e: any) => {
            const eDate = new Date(e.year, e.month, e.day);
            return eDate >= now && eDate <= addDays(now, 7);
          })
          .slice(0, 2);

        for (const e of upcomingEvents) {
          items.push({
            text: `Preparar para: ${e.label}`,
            source: "event",
            icon: "📅",
          });
        }
      }

      // Fetch habits with low streaks
      const { data: habitsData } = await supabase
        .from("user_data")
        .select("data")
        .eq("user_id", user.id)
        .eq("data_type", "habits")
        .limit(1)
        .single();

      if (habitsData?.data && Array.isArray(habitsData.data)) {
        const struggling = (habitsData.data as any[])
          .filter((h: any) => (h.streak || 0) === 0 || !h.completedToday)
          .slice(0, 2);

        for (const h of struggling) {
          items.push({
            text: `Dicas para manter: ${h.name}`,
            source: "habit",
            icon: "🏋️",
          });
        }
      }

      // Fetch recent search history for context-aware suggestions
      const { data: searchHist } = await supabase
        .from("user_data")
        .select("data")
        .eq("user_id", user.id)
        .eq("data_type", "search_history")
        .limit(1)
        .single();

      if (searchHist?.data) {
        const history = searchHist.data as any;
        const recentQueries = (history.history || [])
          .slice(0, 5)
          .map((h: any) => h.query)
          .filter(Boolean);

        // Extract topics from recent queries for "explore more" suggestions
        if (recentQueries.length >= 2) {
          const lastTopic = recentQueries[0];
          items.push({
            text: `Mais sobre: ${lastTopic}`,
            source: "history",
            icon: "🔍",
          });
        }
      }

      if (cancelled) return;

      if (items.length > 0) {
        // Deduplicate and limit to 8
        const seen = new Set<string>();
        const unique = items.filter(i => {
          const key = i.text.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).slice(0, 8);

        // If fewer than 4, pad with fallbacks
        if (unique.length < 4) {
          for (const fb of fallbackSuggestions) {
            if (unique.length >= 8) break;
            if (!seen.has(fb.text.toLowerCase())) {
              unique.push(fb);
              seen.add(fb.text.toLowerCase());
            }
          }
        }

        setSuggestions(unique);
      }
      setLoading(false);
    }

    fetch();
    return () => { cancelled = true; };
  }, []);

  return { suggestions, loading };
}

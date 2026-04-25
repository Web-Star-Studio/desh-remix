// TODO: Migrar para edge function — acesso direto ao Supabase
import { useEffect, useRef, useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useSoundAlerts } from "@/hooks/ui/useSoundAlerts";
import { toast } from "@/hooks/use-toast";

const INTERVAL = 30 * 60 * 1000; // 30 min
const CACHE_KEY = "desh-proactive-last";

export interface AIInsight {
  id: string;
  user_id: string;
  type: string;
  severity: "info" | "warning" | "success";
  title: string;
  message: string;
  action_url: string | null;
  icon: string;
  dismissed: boolean;
  created_at: string;
  expires_at: string;
}

function sendPush(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, { body, icon: "/desh-icon.png", badge: "/desh-icon.png", tag: "ai-insight" });
    setTimeout(() => n.close(), 8000);
  } catch {}
}

export function useProactiveInsights() {
  const { user } = useAuth();
  const { playSound } = useSoundAlerts();
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const running = useRef(false);

  // Fetch active insights from DB
  const fetchInsights = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("ai_insights")
      .select("id, user_id, type, severity, title, message, action_url, icon, dismissed, created_at, expires_at")
      .eq("dismissed", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setInsights(data as AIInsight[]);
  }, [user]);

  // Trigger AI analysis
  const analyzeNow = useCallback(async () => {
    if (!user || loading) return;

    // Check cache
    const last = localStorage.getItem(CACHE_KEY);
    if (last && Date.now() - Number(last) < INTERVAL) return;

    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) return;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: "proactive-insights" }),
        }
      );

      if (resp.status === 429) {
        console.warn("Proactive insights rate limited");
        return;
      }
      if (resp.status === 402) {
        console.warn("Proactive insights: credits exhausted");
        return;
      }

      if (resp.ok) {
        const result = await resp.json();
        localStorage.setItem(CACHE_KEY, String(Date.now()));

        if (result.insights && result.insights.length > 0) {
          // Notify for new insights
          result.insights.forEach((i: any) => {
            toast({
              title: `🤖 ${i.title}`,
              description: i.message,
            });
            sendPush(`🤖 ${i.title}`, i.message);
          });
          playSound("notification");
          // Refresh from DB
          await fetchInsights();
        }
      }
    } catch (e) {
      console.error("Proactive insights error:", e);
    } finally {
      setLoading(false);
    }
  }, [user, loading, fetchInsights, playSound]);

  // Dismiss an insight
  const dismissInsight = useCallback(async (id: string) => {
    setInsights(prev => prev.filter(i => i.id !== id));
    await supabase.from("ai_insights").update({ dismissed: true } as any).eq("id", id);
  }, []);

  // Dismiss all
  const dismissAllInsights = useCallback(async () => {
    const ids = insights.map(i => i.id);
    setInsights([]);
    await Promise.all(
      ids.map(id => supabase.from("ai_insights").update({ dismissed: true } as any).eq("id", id))
    );
  }, [insights]);

  // Initial load + periodic analysis
  useEffect(() => {
    if (!user || running.current) return;
    running.current = true;

    fetchInsights();

    // First analysis after 20s (let app load)
    const initialTimer = setTimeout(analyzeNow, 20_000);
    const interval = setInterval(analyzeNow, INTERVAL);

    // Realtime subscription
    const channel = supabase
      .channel("ai-insights-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ai_insights" }, () => {
        fetchInsights();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ai_insights" }, () => {
        fetchInsights();
      })
      .subscribe();

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      supabase.removeChannel(channel);
      running.current = false;
    };
  }, [user, fetchInsights, analyzeNow]);

  return { insights, loading, dismissInsight, dismissAllInsights, analyzeNow, refetch: fetchInsights };
}

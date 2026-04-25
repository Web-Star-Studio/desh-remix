import { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSoundAlerts } from "@/hooks/ui/useSoundAlerts";
import { toast } from "@/hooks/use-toast";

export interface Broadcast {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success";
  action_url: string | null;
  created_at: string;
  active?: boolean;
}

interface NotificationsContextValue {
  broadcasts: Broadcast[];
  dismissedIds: Set<string>;
  visible: Broadcast[];
  dismissed: Broadcast[];
  unreadCount: number;
  loading: boolean;
  dismiss: (id: string) => Promise<void>;
  undismiss: (id: string) => Promise<void>;
  dismissAll: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
};

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const { playSound } = useSoundAlerts();
  const initialLoadDone = useRef(false);
  const mountedRef = useRef(true);

  // Main broadcasts + dismissals fetch & realtime
  useEffect(() => {
    mountedRef.current = true;

    if (!user) {
      setBroadcasts([]);
      setDismissedIds(new Set());
      setLoading(false);
      initialLoadDone.current = false;
      return;
    }

    const controller = new AbortController();

    const fetchAll = async () => {
      setLoading(true);
      const [{ data: bcs }, { data: dismissals }] = await Promise.all([
        supabase
          .from("broadcasts")
          .select("id, title, message, type, action_url, created_at, active")
          .eq("active", true)
          .or("expires_at.is.null,expires_at.gt.now()")
          .order("created_at", { ascending: false })
          .limit(50)
          .abortSignal(controller.signal),
        supabase
          .from("broadcast_dismissals")
          .select("broadcast_id")
          .abortSignal(controller.signal),
      ]);
      if (!mountedRef.current) return;
      if (bcs) setBroadcasts(bcs as Broadcast[]);
      if (dismissals) setDismissedIds(new Set(dismissals.map((d: any) => d.broadcast_id)));
      setLoading(false);
      initialLoadDone.current = true;
    };

    fetchAll().catch(() => {/* aborted */});

    const channel = supabase
      .channel("notifications-ctx")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "broadcasts" }, (payload) => {
        const nb = payload.new as Broadcast & { active: boolean; expires_at: string | null };
        if (nb.type && nb.active !== false) {
          if (nb.expires_at && new Date(nb.expires_at) <= new Date()) return;
          setBroadcasts(prev => [nb, ...prev]);
          if (initialLoadDone.current) playSound("broadcast");
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "broadcasts" }, (payload) => {
        const updated = payload.new as Broadcast & { active: boolean };
        setBroadcasts(prev =>
          updated.active === false
            ? prev.filter(b => b.id !== updated.id)
            : prev.map(b => (b.id === updated.id ? { ...b, ...updated } : b))
        );
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "broadcasts" }, (payload) => {
        const oldId = (payload.old as any).id;
        setBroadcasts(prev => prev.filter(b => b.id !== oldId));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "broadcast_dismissals" }, (payload) => {
        const row = payload.new as any;
        if (row.user_id === user.id) {
          setDismissedIds(prev => new Set([...prev, row.broadcast_id]));
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "broadcast_dismissals" }, (payload) => {
        const row = payload.old as any;
        if (row.user_id === user.id) {
          setDismissedIds(prev => {
            const next = new Set(prev);
            next.delete(row.broadcast_id);
            return next;
          });
        }
      })
      .subscribe();

    return () => {
      mountedRef.current = false;
      controller.abort();
      supabase.removeChannel(channel);
    };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = useCallback(async (id: string) => {
    if (!user) return;
    setDismissedIds(prev => new Set([...prev, id]));
    await supabase.from("broadcast_dismissals").insert({ broadcast_id: id, user_id: user.id } as any);
    toast({ title: "Aviso dispensado", description: "Você pode revisá-lo no histórico." });
  }, [user]);

  const undismiss = useCallback(async (id: string) => {
    if (!user) return;
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    await supabase.from("broadcast_dismissals").delete().eq("broadcast_id", id).eq("user_id", user.id);
  }, [user]);

  const dismissAll = useCallback(async () => {
    if (!user) return;
    const toDismiss = broadcasts.filter(b => !dismissedIds.has(b.id));
    if (toDismiss.length === 0) return;
    setDismissedIds(prev => new Set([...prev, ...toDismiss.map(b => b.id)]));
    await supabase.from("broadcast_dismissals").insert(
      toDismiss.map(b => ({ broadcast_id: b.id, user_id: user.id })) as any
    );
  }, [user, broadcasts, dismissedIds]);

  const visible = useMemo(() => broadcasts.filter(b => !dismissedIds.has(b.id)), [broadcasts, dismissedIds]);
  const dismissed = useMemo(() => broadcasts.filter(b => dismissedIds.has(b.id)), [broadcasts, dismissedIds]);

  // AI insights count
  const [aiInsightsCount, setAiInsightsCount] = useState(0);

  useEffect(() => {
    if (!user) { setAiInsightsCount(0); return; }

    let active = true;
    const fetchCount = async () => {
      const { count } = await supabase
        .from("ai_insights")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("dismissed", false)
        .gt("expires_at", new Date().toISOString());
      if (active) setAiInsightsCount(count ?? 0);
    };
    fetchCount();

    const ch = supabase
      .channel("ai-insights-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_insights" }, () => {
        if (active) fetchCount();
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [user]);

  const value = useMemo<NotificationsContextValue>(() => ({
    broadcasts,
    dismissedIds,
    visible,
    dismissed,
    unreadCount: visible.length + aiInsightsCount,
    loading,
    dismiss,
    undismiss,
    dismissAll,
  }), [broadcasts, dismissedIds, visible, dismissed, aiInsightsCount, loading, dismiss, undismiss, dismissAll]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};
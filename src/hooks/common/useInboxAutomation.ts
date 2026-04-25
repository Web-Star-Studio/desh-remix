// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface SnoozedItem {
  id: string;
  until: Date;
  title: string;
}

export function useInboxAutomation() {
  const [snoozedItems, setSnoozedItems] = useState<Map<string, SnoozedItem>>(new Map());
  const [autoAnalyzed, setAutoAnalyzed] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [focusItemIds, setFocusItemIds] = useState<Set<string>>(new Set());
  const unsnoozTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logQueueRef = useRef<{ action: string; details: Record<string, any> }[]>([]);
  const logFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const snoozeItem = useCallback((id: string, title: string, minutes: number) => {
    const until = new Date(Date.now() + minutes * 60 * 1000);
    setSnoozedItems(prev => {
      const next = new Map(prev);
      next.set(id, { id, until, title });
      return next;
    });
    toast({
      title: "Item adiado",
      description: `"${title.slice(0, 40)}" voltará em ${minutes} min`,
    });
  }, []);

  const unsnoozeItem = useCallback((id: string) => {
    setSnoozedItems(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Only run snooze check interval when there are snoozed items
  useEffect(() => {
    if (snoozedItems.size === 0) {
      if (unsnoozTimerRef.current) {
        clearInterval(unsnoozTimerRef.current);
        unsnoozTimerRef.current = null;
      }
      return;
    }

    if (unsnoozTimerRef.current) return; // already running

    unsnoozTimerRef.current = setInterval(() => {
      const now = Date.now();
      setSnoozedItems(prev => {
        let changed = false;
        const next = new Map(prev);
        for (const [id, item] of next) {
          if (item.until.getTime() <= now) {
            next.delete(id);
            changed = true;
            toast({ title: "Item de volta!", description: `"${item.title.slice(0, 40)}" voltou ao inbox` });
          }
        }
        return changed ? next : prev;
      });
    }, 30_000);

    return () => {
      if (unsnoozTimerRef.current) {
        clearInterval(unsnoozTimerRef.current);
        unsnoozTimerRef.current = null;
      }
    };
  }, [snoozedItems.size]);

  const toggleFocusMode = useCallback(() => {
    setFocusMode(prev => !prev);
  }, []);

  const setFocusItems = useCallback((ids: string[]) => {
    setFocusItemIds(new Set(ids));
  }, []);

  const markAutoAnalyzed = useCallback(() => setAutoAnalyzed(true), []);

  // Debounced activity logging — batches logs and flushes every 2s
  const flushLogs = useCallback(async () => {
    const batch = logQueueRef.current.splice(0);
    if (batch.length === 0) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const rows = batch.map(entry => ({
        user_id: session.user.id,
        action: entry.action,
        category: "inbox" as const,
        details: entry.details,
      }));
      await supabase.from("user_activity_logs").insert(rows);
    } catch {
      // silent
    }
  }, []);

  const logInboxActivity = useCallback((action: string, details: Record<string, any> = {}) => {
    logQueueRef.current.push({ action, details });
    if (logFlushTimerRef.current) clearTimeout(logFlushTimerRef.current);
    logFlushTimerRef.current = setTimeout(flushLogs, 2000);
  }, [flushLogs]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (logFlushTimerRef.current) clearTimeout(logFlushTimerRef.current);
      flushLogs();
    };
  }, [flushLogs]);

  return {
    snoozedItems,
    snoozeItem,
    unsnoozeItem,
    autoAnalyzed,
    markAutoAnalyzed,
    focusMode,
    toggleFocusMode,
    focusItemIds,
    setFocusItems,
    logInboxActivity,
  };
}

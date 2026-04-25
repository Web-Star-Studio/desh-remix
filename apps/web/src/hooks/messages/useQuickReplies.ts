// TODO: Migrar para edge function — acesso direto ao Supabase
/**
 * useQuickReplies — CRUD for quick reply templates.
 * Uses raw supabase client with `as any` casts since the table
 * may not be in the auto-generated types yet.
 */
import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface QuickReply {
  id: string;
  title: string;
  body: string;
  shortcut: string | null;
  sortOrder: number;
}

export function useQuickReplies() {
  const { user } = useAuth();
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("quick_replies")
      .select("id, title, body, shortcut, sort_order")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true });
    if (data) {
      setReplies((data as any[]).map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        shortcut: r.shortcut,
        sortOrder: r.sort_order,
      })));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = useCallback(async (title: string, body: string, shortcut?: string) => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("quick_replies")
      .insert({ user_id: user.id, title, body, shortcut: shortcut || null })
      .select()
      .single();
    if (data) {
      const r = data as any;
      setReplies(prev => [...prev, {
        id: r.id,
        title: r.title,
        body: r.body,
        shortcut: r.shortcut,
        sortOrder: r.sort_order,
      }]);
    }
  }, [user]);

  const update = useCallback(async (id: string, updates: Partial<{ title: string; body: string; shortcut: string }>) => {
    await (supabase as any).from("quick_replies").update(updates).eq("id", id);
    setReplies(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }, []);

  const remove = useCallback(async (id: string) => {
    await (supabase as any).from("quick_replies").delete().eq("id", id);
    setReplies(prev => prev.filter(r => r.id !== id));
  }, []);

  return { replies, loading, add, update, remove, refetch: fetch };
}

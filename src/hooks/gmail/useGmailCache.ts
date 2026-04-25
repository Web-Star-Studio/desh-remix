import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { CachedEmail } from "@/types/email";

interface UseGmailCacheOptions {
  gmailConnectionCount: number;
  accountInfoMap: Map<string, { email: string; color: string }>;
}

export function useGmailCache({ gmailConnectionCount, accountInfoMap }: UseGmailCacheOptions) {
  const { user } = useAuth();
  const [cachedEmails, setCachedEmails] = useState<CachedEmail[]>([]);
  const [isLoadingCache, setIsLoadingCache] = useState(false);
  const [folderUnreadCounts, setFolderUnreadCounts] = useState<Record<string, number>>({});
  const activeFolderRef = useRef("inbox");
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);

  // Debounce timer for loadUnreadCounts to prevent hammering on rapid realtime events
  const unreadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mapRow = useCallback((row: any): CachedEmail => {
    const acct = accountInfoMap.get(row.connection_id);
    return {
      id: row.gmail_id,
      gmail_id: row.gmail_id,
      from: row.from_name || "Desconhecido",
      email: row.from_email || "",
      subject: row.subject || "Sem assunto",
      body: row.snippet || "",
      date: (() => {
        if (!row.date) return "";
        const d = new Date(row.date);
        return isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      })(),
      unread: row.is_unread ?? true,
      starred: row.is_starred ?? false,
      hasAttachment: row.has_attachment ?? false,
      folder: row.folder || "inbox",
      labels: (row.label_ids || [])
        .filter((lid: string) => !["INBOX", "SENT", "DRAFT", "TRASH", "SPAM", "UNREAD", "CHAT", "STARRED"].includes(lid))
        .map((lid: string) => `gmail:${lid}`),
      accountEmail: acct?.email,
      accountColor: gmailConnectionCount > 1 ? acct?.color : undefined,
      connectionId: row.connection_id || undefined,
      workspaceId: row.workspace_id || null,
      threadId: row.thread_id || undefined,
    };
  }, [gmailConnectionCount, accountInfoMap]);

  /** Load real unread counts from DB for all folders (debounced) */
  const loadUnreadCounts = useCallback(async () => {
    if (!user) return;
    const folders = ["inbox", "sent", "drafts", "trash", "spam"];
    const results: Record<string, number> = {};
    await Promise.all(folders.map(async (f) => {
      const { count, error } = await supabase
        .from("gmail_messages_cache" as any)
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("folder", f)
        .eq("is_unread", true);
      if (!error && count !== null) results[f] = count;
    }));
    setFolderUnreadCounts(results);
  }, [user]);

  /** Debounced version — coalesces rapid realtime events into a single DB call */
  const debouncedLoadUnreadCounts = useCallback(() => {
    if (unreadDebounceRef.current) clearTimeout(unreadDebounceRef.current);
    unreadDebounceRef.current = setTimeout(() => {
      loadUnreadCounts();
    }, 800);
  }, [loadUnreadCounts]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (unreadDebounceRef.current) clearTimeout(unreadDebounceRef.current);
    };
  }, []);

  const loadCachedEmails = useCallback(async (folder = "inbox") => {
    if (!user) return;
    activeFolderRef.current = folder;
    offsetRef.current = 0;
    hasMoreRef.current = true;
    setIsLoadingCache(true);
    try {
      const { data, error } = await supabase
        .from("gmail_messages_cache" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("folder", folder)
        .order("date", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const rows = (data || []) as any[];
      setCachedEmails(rows.map(mapRow));
      offsetRef.current = rows.length;
      hasMoreRef.current = rows.length === 1000;
      // Also refresh unread counts (immediate, not debounced, since this is user-initiated)
      loadUnreadCounts();
    } catch (err) {
      console.error("Error loading cached emails:", err);
    } finally {
      setIsLoadingCache(false);
    }
  }, [user, mapRow, loadUnreadCounts]);

  /** Load emails by Gmail label (cross-folder) */
  const loadEmailsByLabel = useCallback(async (gmailLabelId: string) => {
    if (!user) return;
    setIsLoadingCache(true);
    try {
      const { data, error } = await supabase
        .from("gmail_messages_cache" as any)
        .select("*")
        .eq("user_id", user.id)
        .contains("label_ids", [gmailLabelId])
        .order("date", { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = (data || []) as any[];
      setCachedEmails(rows.map(mapRow));
    } catch (err) {
      console.error("Error loading emails by label:", err);
    } finally {
      setIsLoadingCache(false);
    }
  }, [user, mapRow]);

  const loadMoreEmails = useCallback(async (folder?: string) => {
    if (!user || !hasMoreRef.current) return;
    const f = folder || activeFolderRef.current;
    try {
      const { data, error } = await supabase
        .from("gmail_messages_cache" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("folder", f)
        .order("date", { ascending: false })
        .range(offsetRef.current, offsetRef.current + 499);
      if (error) throw error;
      const rows = (data || []) as any[];
      if (rows.length > 0) {
        setCachedEmails(prev => {
          const existingIds = new Set(prev.map(e => e.gmail_id));
          const newRows = rows.filter(r => !existingIds.has(r.gmail_id));
          return [...prev, ...newRows.map(mapRow)];
        });
        offsetRef.current += rows.length;
      }
      hasMoreRef.current = rows.length === 500;
    } catch (err) {
      console.error("Error loading more emails:", err);
    }
  }, [user, mapRow]);

  // ─── REALTIME SUBSCRIPTION ───
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`gmail-cache-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "gmail_messages_cache",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new;
          if (row.folder !== activeFolderRef.current) return;
          setCachedEmails(prev => {
            if (prev.some(e => e.gmail_id === row.gmail_id)) return prev;
            const mapped = mapRow(row);
            return [mapped, ...prev];
          });
          debouncedLoadUnreadCounts();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "gmail_messages_cache",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new;
          setCachedEmails(prev => prev.map(e =>
            e.gmail_id === row.gmail_id ? mapRow(row) : e
          ));
          debouncedLoadUnreadCounts();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "gmail_messages_cache",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const oldRow = payload.old as any;
          if (oldRow?.gmail_id) {
            setCachedEmails(prev => prev.filter(e => e.gmail_id !== oldRow.gmail_id));
          }
          debouncedLoadUnreadCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, mapRow, debouncedLoadUnreadCounts]);

  // ─── OPTIMISTIC CACHE UPDATES ───
  const updateEmailInCache = useCallback(async (
    gmailId: string,
    updates: Partial<{ is_unread: boolean; is_starred: boolean; label_ids: string[]; folder: string }>
  ) => {
    if (!user) return;
    const shouldRemoveFromView = updates.folder && updates.folder !== activeFolderRef.current;
    
    setCachedEmails(prev => {
      if (shouldRemoveFromView) {
        return prev.filter(e => e.gmail_id !== gmailId);
      }
      return prev.map(e => {
        if (e.gmail_id !== gmailId) return e;
        return {
          ...e,
          unread: updates.is_unread !== undefined ? updates.is_unread : e.unread,
          starred: updates.is_starred !== undefined ? updates.is_starred : e.starred,
          folder: updates.folder || e.folder,
          labels: updates.label_ids
            ? updates.label_ids.filter(lid => !["INBOX", "SENT", "DRAFT", "TRASH", "SPAM", "UNREAD", "CHAT", "STARRED"].includes(lid)).map(lid => `gmail:${lid}`)
            : e.labels,
        };
      });
    });
    
    try {
      const { error } = await supabase
        .from("gmail_messages_cache" as any)
        .update(updates)
        .eq("user_id", user.id)
        .eq("gmail_id", gmailId);
      if (error) console.error("Cache update error:", error);
    } catch (err) {
      console.error("Cache update exception:", err);
    }
  }, [user]);

  const removeEmailsFromCache = useCallback(async (gmailIds: string[]) => {
    if (!user || gmailIds.length === 0) return;
    setCachedEmails(prev => prev.filter(e => !gmailIds.includes(e.gmail_id)));
    supabase
      .from("gmail_messages_cache" as any)
      .delete()
      .eq("user_id", user.id)
      .in("gmail_id", gmailIds)
      .then(({ error }) => { if (error) console.error("Cache cleanup error:", error); });
  }, [user]);

  return {
    cachedEmails,
    isLoadingCache,
    loadCachedEmails,
    loadMoreEmails,
    loadEmailsByLabel,
    updateEmailInCache,
    removeEmailsFromCache,
    activeFolderRef,
    folderUnreadCounts,
    loadUnreadCounts,
  };
}

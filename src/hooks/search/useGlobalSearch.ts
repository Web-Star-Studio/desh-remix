import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface GlobalSearchResult {
  id: string;
  module: "emails" | "notes" | "contacts" | "tasks" | "files" | "conversations";
  title: string;
  subtitle?: string;
  url: string;
}

export interface GlobalSearchResults {
  emails: GlobalSearchResult[];
  notes: GlobalSearchResult[];
  contacts: GlobalSearchResult[];
  tasks: GlobalSearchResult[];
  files: GlobalSearchResult[];
  conversations: GlobalSearchResult[];
}

const EMPTY: GlobalSearchResults = {
  emails: [], notes: [], contacts: [], tasks: [], files: [], conversations: [],
};

/**
 * useGlobalSearch — Debounced parallel local search across 6 modules.
 * @param limit Max results per module (default 3)
 */
export function useGlobalSearch(limit = 3) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const search = useCallback(async (q: string) => {
    if (!user || !q.trim()) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }

    setLoading(true);
    const pattern = `%${q.trim()}%`;

    try {
      const [emailsRes, notesRes, contactsRes, tasksRes, filesRes, convsRes] = await Promise.all([
        supabase.from("emails_cache")
          .select("id, gmail_id, subject, from_name, from_email, body_preview")
          .eq("user_id", user.id)
          .or(`subject.ilike.${pattern},from_name.ilike.${pattern},body_preview.ilike.${pattern}`)
          .order("received_at", { ascending: false })
          .limit(limit),

        supabase.from("user_data")
          .select("id, data")
          .eq("user_id", user.id)
          .eq("data_type", "note")
          .or(`data->>title.ilike.${pattern},data->>content.ilike.${pattern}`)
          .limit(limit),

        supabase.from("contacts")
          .select("id, name, email, phone, company")
          .eq("user_id", user.id)
          .or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
          .order("name")
          .limit(limit),

        supabase.from("tasks")
          .select("id, title, status")
          .eq("user_id", user.id)
          .ilike("title", pattern)
          .order("created_at", { ascending: false })
          .limit(limit),

        supabase.from("files")
          .select("id, name, mime_type")
          .eq("user_id", user.id)
          .eq("is_trashed", false)
          .ilike("name", pattern)
          .order("created_at", { ascending: false })
          .limit(limit),

        supabase.from("ai_conversations")
          .select("id, title")
          .eq("user_id", user.id)
          .ilike("title", pattern)
          .order("updated_at", { ascending: false })
          .limit(limit),
      ]);

      if (!mountedRef.current) return;

      const emails: GlobalSearchResult[] = (emailsRes.data || []).map(e => ({
        id: e.id, module: "emails" as const,
        title: e.subject || "(Sem assunto)",
        subtitle: e.from_name || e.from_email || "",
        url: "/email",
      }));

      const notes: GlobalSearchResult[] = (notesRes.data || []).map(n => {
        const d = n.data as any;
        const rawContent = (d?.content || "").replace(/<[^>]*>/g, "").trim();
        return {
          id: n.id, module: "notes" as const,
          title: d?.title || "Sem título",
          subtitle: rawContent.slice(0, 60),
          url: `/notes?id=${n.id}`,
        };
      });

      const contacts: GlobalSearchResult[] = (contactsRes.data || []).map(c => ({
        id: c.id, module: "contacts" as const,
        title: c.name,
        subtitle: [c.email, c.company].filter(Boolean).join(" · "),
        url: `/contacts?search=${encodeURIComponent(c.name)}`,
      }));

      const tasks: GlobalSearchResult[] = (tasksRes.data || []).map(t => ({
        id: t.id, module: "tasks" as const,
        title: t.title,
        subtitle: t.status === "done" ? "Concluída" : t.status === "in_progress" ? "Em progresso" : "Pendente",
        url: `/tasks?highlight=${t.id}`,
      }));

      const files: GlobalSearchResult[] = (filesRes.data || []).map(f => ({
        id: f.id, module: "files" as const,
        title: f.name,
        subtitle: f.mime_type?.split("/").pop() || "",
        url: "/files",
      }));

      const conversations: GlobalSearchResult[] = (convsRes.data || []).map(c => ({
        id: c.id, module: "conversations" as const,
        title: c.title || "Conversa",
        url: "/ai",
      }));

      setResults({ emails, notes, contacts, tasks, files, conversations });
    } catch (err) {
      console.error("[useGlobalSearch]", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [user, limit]);

  // Debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  const totalResults = useMemo(
    () => Object.values(results).reduce((sum, arr) => sum + arr.length, 0),
    [results]
  );

  return { query, setQuery, results, loading, totalResults };
}

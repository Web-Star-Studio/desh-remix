// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/common/useAuthSession";
import { toast } from "sonner";

export interface SearchHistoryItem {
  id: string;
  query: string;
  filter: string;
  answer: string | null;
  tldr: string | null;
  key_facts: string[];
  citations: string[];
  images: string[];
  related_queries: string[];
  favorited: boolean;
  project_id: string | null;
  created_at: string;
}

export interface SearchProject {
  id: string;
  name: string;
  color: string;
  icon: string;
  created_at: string;
  updated_at: string;
  count?: number;
}

const PAGE_SIZE = 20;
const MAX_HISTORY = 500;

export function useSearchHistory() {
  const { session } = useAuthSession();
  const userId = session?.user?.id;

  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [projects, setProjects] = useState<SearchProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  // Debounce save to avoid hammering DB
  const saveQueueRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load projects with counts in a single query pass
  const loadProjects = useCallback(async () => {
    if (!userId) return;
    const [projRes, countsRes] = await Promise.all([
      supabase.from("search_projects").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("search_history").select("project_id").eq("user_id", userId).not("project_id", "is", null),
    ]);

    if (projRes.data) {
      const countMap: Record<string, number> = {};
      countsRes.data?.forEach((c: any) => {
        countMap[c.project_id] = (countMap[c.project_id] || 0) + 1;
      });
      setProjects(projRes.data.map((p: any) => ({ ...p, count: countMap[p.id] || 0 })));
    }
  }, [userId]);

  // Load history page
  const loadHistory = useCallback(async (pageNum = 0, append = false) => {
    if (!userId) return;
    setLoading(true);
    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("search_history")
      .select("id, query, filter, answer, tldr, key_facts, citations, images, related_queries, favorited, project_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (!error && data) {
      const items = data as unknown as SearchHistoryItem[];
      if (append) {
        setHistory(prev => [...prev, ...items]);
      } else {
        setHistory(items);
      }
      setHasMore(items.length === PAGE_SIZE);
      setPage(pageNum);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (userId) {
      Promise.all([loadHistory(0), loadProjects()]);
    }
  }, [userId, loadHistory, loadProjects]);

  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      loadHistory(page + 1, true);
    }
  }, [hasMore, loading, page, loadHistory]);

  // Save search to history (debounced, dedup, limit)
  const saveSearch = useCallback(async (params: {
    query: string;
    filter: string;
    answer?: string;
    tldr?: string;
    key_facts?: string[];
    citations?: string[];
    images?: string[];
    related_queries?: string[];
  }) => {
    if (!userId) return;

    // Debounce: cancel previous pending save for rapid re-searches
    if (saveQueueRef.current) clearTimeout(saveQueueRef.current);

    saveQueueRef.current = setTimeout(async () => {
      // Dedup: skip if same query+filter within 1 minute
      const oneMinAgo = new Date(Date.now() - 60000).toISOString();
      const { data: recent } = await supabase
        .from("search_history")
        .select("id")
        .eq("user_id", userId)
        .eq("query", params.query)
        .eq("filter", params.filter)
        .gte("created_at", oneMinAgo)
        .limit(1);

      if (recent && recent.length > 0) {
        await supabase
          .from("search_history")
          .update({
            answer: params.answer,
            tldr: params.tldr,
            key_facts: params.key_facts || [],
            citations: params.citations || [],
            images: params.images || [],
            related_queries: params.related_queries || [],
          })
          .eq("id", recent[0].id);

        // Optimistic update instead of full reload
        setHistory(prev => prev.map(h =>
          h.id === recent[0].id
            ? { ...h, answer: params.answer || h.answer, tldr: params.tldr || h.tldr }
            : h
        ));
        return;
      }

      const { data: inserted } = await supabase.from("search_history").insert({
        user_id: userId,
        query: params.query,
        filter: params.filter,
        answer: params.answer,
        tldr: params.tldr,
        key_facts: params.key_facts || [],
        citations: params.citations || [],
        images: params.images || [],
        related_queries: params.related_queries || [],
      }).select("id, query, filter, answer, tldr, key_facts, citations, images, related_queries, favorited, project_id, created_at").single();

      // Optimistic: prepend to history instead of refetching
      if (inserted) {
        setHistory(prev => [inserted as unknown as SearchHistoryItem, ...prev.slice(0, PAGE_SIZE - 1)]);
      }

      // Enforce limit in background (non-blocking)
      supabase
        .from("search_history")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .then(({ count }) => {
          if (count && count > MAX_HISTORY) {
            const excess = count - MAX_HISTORY;
            supabase
              .from("search_history")
              .select("id")
              .eq("user_id", userId)
              .eq("favorited", false)
              .order("created_at", { ascending: true })
              .limit(excess)
              .then(({ data: oldest }) => {
                if (oldest?.length) {
                  supabase.from("search_history").delete().in("id", oldest.map(o => o.id));
                }
              });
          }
        });
    }, 500);
  }, [userId]);

  const toggleFavorite = useCallback(async (id: string, current: boolean) => {
    setHistory(prev => prev.map(h => h.id === id ? { ...h, favorited: !current } : h));
    await supabase.from("search_history").update({ favorited: !current }).eq("id", id);
  }, []);

  const moveToProject = useCallback(async (id: string, projectId: string | null) => {
    setHistory(prev => prev.map(h => h.id === id ? { ...h, project_id: projectId } : h));
    await supabase.from("search_history").update({ project_id: projectId }).eq("id", id);
    loadProjects();
  }, [loadProjects]);

  const deleteItem = useCallback(async (id: string) => {
    setHistory(prev => prev.filter(h => h.id !== id));
    await supabase.from("search_history").delete().eq("id", id);
  }, []);

  const clearHistory = useCallback(async () => {
    if (!userId) return;
    await supabase.from("search_history").delete().eq("user_id", userId).eq("favorited", false);
    loadHistory(0);
    loadProjects();
    toast.success("Histórico limpo");
  }, [userId, loadHistory, loadProjects]);

  // Projects CRUD
  const createProject = useCallback(async (name: string, color: string, icon: string) => {
    if (!userId) return;
    const { error } = await supabase.from("search_projects").insert({ user_id: userId, name, color, icon });
    if (!error) {
      loadProjects();
      toast.success("Projeto criado");
    }
  }, [userId, loadProjects]);

  const updateProject = useCallback(async (id: string, data: Partial<{ name: string; color: string; icon: string }>) => {
    await supabase.from("search_projects").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id);
    loadProjects();
  }, [loadProjects]);

  const deleteProject = useCallback(async (id: string) => {
    await supabase.from("search_history").update({ project_id: null }).eq("project_id", id);
    await supabase.from("search_projects").delete().eq("id", id);
    loadProjects();
    loadHistory(0);
    toast.success("Projeto removido");
  }, [loadProjects, loadHistory]);

  const refresh = useCallback(() => {
    loadHistory(0);
    loadProjects();
  }, [loadHistory, loadProjects]);

  return {
    history,
    projects,
    loading,
    hasMore,
    loadMore,
    saveSearch,
    toggleFavorite,
    moveToProject,
    deleteItem,
    clearHistory,
    createProject,
    updateProject,
    deleteProject,
    refresh,
  };
}
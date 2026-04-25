// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { idbGet, idbSet, idbClear } from "@/lib/idbCache";

export interface SerpResult {
  organic_results: Array<{
    position: number;
    title: string;
    link: string;
    snippet: string;
    displayed_link?: string;
    favicon?: string;
    date?: string;
  }>;
  knowledge_graph?: {
    title: string;
    type?: string;
    description?: string;
    image?: string;
    attributes?: Record<string, string>;
    source?: { name: string; link: string };
  };
  featured_snippet?: {
    title: string;
    content: string;
    link: string;
  };
  people_also_ask?: Array<{
    question: string;
    snippet?: string;
    link?: string;
  }>;
  related_searches?: string[];
  shopping_results?: Array<{
    title: string;
    price: string;
    link: string;
    source: string;
    thumbnail?: string;
    rating?: number;
    reviews?: number;
  }>;
  news_results?: Array<{
    title: string;
    link: string;
    source: string;
    date: string;
    snippet?: string;
    thumbnail?: string;
  }>;
  image_results?: Array<{
    title: string;
    link: string;
    thumbnail: string;
    original: string;
    source: string;
  }>;
  answer_box?: {
    type: string;
    answer?: string;
    snippet?: string;
    title?: string;
    link?: string;
  };
  // Specialized engine results
  summary?: any;
  graph?: any[];
  financials?: any;
  markets?: any;
  best_flights?: any[];
  other_flights?: any[];
  price_insights?: any;
  airports?: any[];
  properties?: any[];
  brands?: any[];
  jobs_results?: any[];
  chips?: any[];
  events_results?: any[];
  scholar_results?: any[];
  total_results?: number;
  profiles?: any[];
  video_results?: any[];
  local_results?: any[];
  patent_results?: any[];
  interest_over_time?: any[];
  related_queries?: any[];
  compared_breakdown_by_region?: any[];
  search_metadata: {
    total_time_taken?: number;
    engine: string;
    query: string;
    ai_params?: Record<string, any>;
    request_duration_ms?: number;
  };
}

export interface SerpSuggestion {
  corrected_queries: string[];
  explanation: string;
}

interface CacheEntry {
  data: SerpResult;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 30;

const getCacheKey = (query: string, engine: string, extraParams?: Record<string, any>) => {
  const paramStr = extraParams ? JSON.stringify(extraParams) : "";
  return `${engine}::${query.trim().toLowerCase()}::${paramStr}`;
};

export function useSerpSearch() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SerpResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<SerpSuggestion | null>(null);
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pruneCache = useCallback(() => {
    const cache = cacheRef.current;
    if (cache.size <= MAX_CACHE_ENTRIES) return;
    const now = Date.now();
    for (const [key, entry] of cache) {
      if (now - entry.timestamp > CACHE_TTL_MS) cache.delete(key);
    }
    if (cache.size > MAX_CACHE_ENTRIES) {
      const entries = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
      for (let i = 0; i < entries.length - MAX_CACHE_ENTRIES; i++) {
        cache.delete(entries[i][0]);
      }
    }
  }, []);

  const searchImmediate = useCallback(async (query: string, engine = "google", extraParams?: Record<string, any>, _retryAttempt = 0) => {
    if (!query.trim()) return;

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    const cacheKey = getCacheKey(query, engine, extraParams);

    // Check memory cache first (sync, no latency)
    const cached = cacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setResult(cached.data);
      setError(null);
      setSuggestion(null);
      setLoading(false);
      return;
    }

    // Show loading immediately, check IDB in background
    setLoading(true);
    setError(null);
    setSuggestion(null);

    // Check IndexedDB cache (non-blocking — if found, use it and stop)
    try {
      const idbCached = await idbGet<SerpResult>(cacheKey);
      if (idbCached && !controller.signal.aborted) {
        cacheRef.current.set(cacheKey, { data: idbCached, timestamp: Date.now() });
        setResult(idbCached);
        setLoading(false);
        return;
      }
    } catch {
      // IDB failed, continue to network
    }

    if (controller.signal.aborted) return;

    setResult(null);
    const startTime = Date.now();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Sessão expirada.");
        return;
      }

      if (controller.signal.aborted) return;

      const { data, error: fnErr } = await supabase.functions.invoke("serp-proxy", {
        body: { action: "search", query: query.trim(), engine, ...extraParams },
      });

      if (controller.signal.aborted) return;

      if (fnErr) {
        let errorBody = data;
        if (!errorBody && fnErr && typeof (fnErr as any).context?.json === "function") {
          try { errorBody = await (fnErr as any).context.json(); } catch {}
        }
        
        // Auto-retry on 5xx (up to 2 retries with exponential backoff)
        const status = (fnErr as any)?.status || (errorBody as any)?.status;
        if (status >= 500 && _retryAttempt < 2) {
          const delay = (1 + _retryAttempt) * 1500;
          await new Promise(r => setTimeout(r, delay));
          if (!controller.signal.aborted) {
            return searchImmediate(query, engine, extraParams, _retryAttempt + 1);
          }
          return;
        }
        
        if (errorBody?.suggestion) {
          setSuggestion(errorBody.suggestion as SerpSuggestion);
        }
        const msg = errorBody?.error || fnErr.message || "Erro na busca";
        throw new Error(msg);
      }
      if (data?.error) {
        if (data?.suggestion) {
          setSuggestion(data.suggestion as SerpSuggestion);
        }
        throw new Error(data.error);
      }

      const duration = Date.now() - startTime;
      const resultData = data as SerpResult;

      if (resultData.search_metadata && !resultData.search_metadata.request_duration_ms) {
        resultData.search_metadata.request_duration_ms = duration;
      }

      // Save to memory + IndexedDB (fire-and-forget)
      cacheRef.current.set(cacheKey, { data: resultData, timestamp: Date.now() });
      pruneCache();
      idbSet(cacheKey, resultData).catch(() => {});

      setResult(resultData);
    } catch (err: any) {
      if (controller.signal.aborted) return;
      console.error("SerpSearch error:", err);
      const msg = err.message || "Erro na busca estruturada";
      setError(msg);
      if (!msg.includes("Missing") && !msg.includes("identificar") && !msg.includes("preciso")) {
        toast.error("Erro na busca estruturada");
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [pruneCache]);

  const searchDebounced = useCallback((query: string, engine = "google", extraParams?: Record<string, any>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchImmediate(query, engine, extraParams);
    }, 300);
  }, [searchImmediate]);

  const search = useCallback(async (query: string, engine = "google", extraParams?: Record<string, any>) => {
    return searchImmediate(query, engine, extraParams);
  }, [searchImmediate]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setSuggestion(null);
    setLoading(false);
  }, []);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
    idbClear().catch(() => {});
  }, []);

  return { search, searchDebounced, result, loading, error, suggestion, reset, clearCache };
}
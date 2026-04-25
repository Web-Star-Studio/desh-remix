// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleSearch } from "@/hooks/search/useGoogleSearch";
import { useSerpSearch } from "@/hooks/search/useSerpSearch";
import { useSpeechRecognition } from "@/hooks/audio/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/audio/useSpeechSynthesis";
import { useSearchHistory, type SearchHistoryItem as HistoryItem } from "@/hooks/search/useSearchHistory";
import { useSearchPreferences } from "@/hooks/search/useSearchPreferences";
import { usePersonalizedSuggestions } from "@/hooks/search/usePersonalizedSuggestions";
import { useIsMobile } from "@/hooks/use-mobile";
import { getQuickAnswer, type QuickAnswer } from "@/utils/quickAnswers";
import { type RecencyValue } from "@/components/search/RecencyFilter";
import { toast } from "sonner";

import {
  SPECIALIZED_FILTERS, filterToApiValue, apiValueToFilter,
  serpEngineMap, cleanStreamingText, detectSpecializedEngine,
  type SearchResult,
} from "@/components/search/searchConstants";

const MAX_QUERY_LENGTH = 500;
const MAX_CONVERSATION_TURNS = 10;
const MAX_RETRIES = 2;
const RETRY_DELAY_BASE = 1500;

export function useSearchLogic() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();

  // ── Core search state ────────────────────────────────────────────────
  const [query, setQueryRaw] = useState(searchParams.get("q") || "");
  const [activeFilter, setActiveFilter] = useState("Web");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [streamingAnswer, setStreamingAnswer] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [searchIntent, setSearchIntent] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryCountRef = useRef(0);

  // ── Sanitized query setter ───────────────────────────────────────────
  const setQuery = useCallback((q: string) => {
    setQueryRaw(q.slice(0, MAX_QUERY_LENGTH));
  }, []);

  // ── Follow-up / conversation ─────────────────────────────────────────
  const [followUpQuery, setFollowUpQuery] = useState("");
  const [conversationHistory, setConversationHistory] = useState<{ role: string; content: string }[]>([]);
  const [lastSearchQuery, setLastSearchQuery] = useState("");

  // ── UI state ─────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeHistoryItemId, setActiveHistoryItemId] = useState<string | undefined>();
  const [recency, setRecency] = useState<RecencyValue>("");
  const [quickAnswer, setQuickAnswer] = useState<QuickAnswer | null>(null);
  const [deepResearchMode, setDeepResearchMode] = useState(false);
  const [deepResearchTopic, setDeepResearchTopic] = useState("");
  const [engineFilters, setEngineFilters] = useState<Record<string, Record<string, any>>>({});
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── External hooks ───────────────────────────────────────────────────
  const googleSearch = useGoogleSearch();
  const serpSearch = useSerpSearch();
  const tts = useSpeechSynthesis();
  const searchHistory = useSearchHistory();
  const { suggestions: personalSuggestions } = usePersonalizedSuggestions();
  const { prefs: searchPrefs, updatePrefs, resetPrefs } = useSearchPreferences();

  // ── Refs for stable callbacks ────────────────────────────────────────
  const stateRef = useRef({
    query, activeFilter, result, streamingAnswer, deepResearchMode,
    recency, engineFilters, conversationHistory, lastSearchQuery,
  });
  stateRef.current = {
    query, activeFilter, result, streamingAnswer, deepResearchMode,
    recency, engineFilters, conversationHistory, lastSearchQuery,
  };

  const searchPrefsRef = useRef(searchPrefs);
  searchPrefsRef.current = searchPrefs;

  // ── Speech recognition ───────────────────────────────────────────────
  const handleSearchStable = useRef<(q?: string, isFollowUp?: boolean) => void>(() => {});

  const { isListening, startListening, stopListening, supported: voiceSupported } = useSpeechRecognition((transcript) => {
    setQuery(transcript);
    handleSearchStable.current(transcript);
  });

  // ── Scroll-to-top visibility (throttled via RAF) ─────────────────────
  useEffect(() => {
    let ticking = false;
    const handler = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          setShowScrollTop(window.scrollY > 600);
          ticking = false;
        });
      }
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // ── Cleanup timer on unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  // ── Global `/` shortcut to focus search ──────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleReadAloud = useCallback(() => {
    if (!result?.answer) return;
    tts.speak(result.answer, 999);
  }, [result?.answer, tts]);

  const handleShare = useCallback(async () => {
    const q = stateRef.current.lastSearchQuery || stateRef.current.query;
    const url = `${window.location.origin}/search?q=${encodeURIComponent(q)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado para a área de transferência!");
    } catch {
      try {
        if (navigator.share) {
          await navigator.share({ title: `Busca: ${q}`, text: `Veja o resultado da busca "${q}"`, url });
        } else {
          toast.error("Não foi possível compartilhar.");
        }
      } catch {
        // user cancelled share dialog
      }
    }
  }, []);

  const handleSearch = useCallback(async (searchQuery?: string, isFollowUp = false, _retryAttempt = 0) => {
    const s = stateRef.current;
    const prefs = searchPrefsRef.current;
    const q = (searchQuery || s.query).trim().slice(0, MAX_QUERY_LENGTH);
    if (!q) return;
    setLastSearchQuery(q);
    tts.stop();
    setQuery(q);
    setActiveHistoryItemId(undefined);
    retryCountRef.current = _retryAttempt;
    setSearchIntent(null);

    if (s.deepResearchMode && !isFollowUp) {
      setResult(null); setStreamingAnswer(""); setIsStreaming(false); setLoading(false); setError(null);
      setDeepResearchTopic("");
      setTimeout(() => setDeepResearchTopic(q), 0);
      return;
    }

    if (!isFollowUp) {
      const qa = getQuickAnswer(q);
      setQuickAnswer(qa);
      if (qa) {
        setResult(null); setStreamingAnswer(""); setIsStreaming(false); setLoading(false); setError(null);
        return;
      }
    }

    if (s.activeFilter === "Meus Dados") {
      setLoading(false); setResult(null); setStreamingAnswer(""); setIsStreaming(false); setError(null);
      googleSearch.search(q);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true); setIsStreaming(false); setStreamingAnswer(""); setError(null); setResult(null);
    serpSearch.reset(); setElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
    const startTime = Date.now();
    timerRef.current = setInterval(() => setElapsed(Date.now() - startTime), 100);

    const filterVal = filterToApiValue(s.activeFilter);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Você precisa estar logado para pesquisar."); setLoading(false); return; }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const historyToSend = isFollowUp ? s.conversationHistory : [];

      // Specialized engines → SerpAPI only
      if (SPECIALIZED_FILTERS.has(filterVal)) {
        const engine = serpEngineMap[filterVal] || "google";
        const currentEngineFilters = s.engineFilters[engine] || {};
        serpSearch.search(q, engine, currentEngineFilters);
        setLoading(false);
        setResult({ answer: "", citations: [], images: [], location: null, related_queries: [], tldr: "", key_facts: [] });
        if (timerRef.current) clearInterval(timerRef.current);
        searchHistory.saveSearch({ query: q, filter: filterVal, answer: "", tldr: `Busca especializada: ${s.activeFilter}`, key_facts: [], citations: [], images: [], related_queries: [] });
        return;
      }

      // Smart detection: auto-fire specialized engine alongside normal search
      if (!isFollowUp && filterVal === "web") {
        const detectedEngine = detectSpecializedEngine(q);
        if (detectedEngine) serpSearch.search(q, detectedEngine);
      }

      // Fire SerpAPI in parallel
      const serpEngineMapLocal: Record<string, string> = { news: "google_news", images: "google_images", shopping: "google_shopping", web: "google" };
      const serpEngine = serpEngineMapLocal[filterVal] || "google";
      const shouldFireSerp = prefs.serpapi_enabled && !isFollowUp && !detectSpecializedEngine(q) && filterVal !== "academic" && (
        (filterVal === "web" && prefs.auto_serp_on_web) ||
        (filterVal === "news" && prefs.auto_serp_on_news) ||
        (filterVal === "images" && prefs.auto_serp_on_images) ||
        filterVal === "shopping"
      );
      if (shouldFireSerp) serpSearch.search(q, serpEngine);

      if (!prefs.perplexity_enabled) {
        setLoading(false);
        setResult({ answer: "", citations: [], images: [], location: null, related_queries: [], tldr: "", key_facts: [] });
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/search-web`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, apikey: supabaseKey },
        body: JSON.stringify({ query: q, filter: filterVal, lang: "pt", stream: true, conversation_history: historyToSend, ...(s.recency ? { recency: s.recency } : {}) }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        // Auto-retry on 5xx or network errors
        if (response.status >= 500 && _retryAttempt < MAX_RETRIES) {
          const delay = (1 + _retryAttempt) * RETRY_DELAY_BASE;
          await new Promise(r => setTimeout(r, delay));
          if (!controller.signal.aborted) {
            return handleSearch(q, isFollowUp, _retryAttempt + 1);
          }
          return;
        }
        if (response.status === 429) throw new Error("Muitas buscas simultâneas. Aguarde alguns segundos.");
        if (response.status === 402) throw new Error("Créditos insuficientes para realizar a busca.");
        if (response.status === 504) throw new Error("A busca demorou demais. Tente termos mais curtos ou específicos.");
        throw new Error(errData.error || `Erro ${response.status}`);
      }

      setLoading(false); setIsStreaming(true);
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedAnswer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;
          try {
            const event = JSON.parse(payload);
            if (event.type === "text") { accumulatedAnswer += event.content; setStreamingAnswer(accumulatedAnswer); }
            else if (event.type === "done") {
              const finalAnswer = event.answer || accumulatedAnswer;
              const finalResult: SearchResult = { answer: finalAnswer, citations: event.citations || [], images: event.images || [], location: event.location || null, related_queries: event.related_queries || [], tldr: event.tldr || "", key_facts: event.key_facts || [] };
              setResult(finalResult); setIsStreaming(false);
              if (event.intent) setSearchIntent(event.intent);
              setConversationHistory(prev => {
                const next = [...prev, { role: "user", content: q }, { role: "assistant", content: finalAnswer }];
                return next.length > MAX_CONVERSATION_TURNS * 2 ? next.slice(-MAX_CONVERSATION_TURNS * 2) : next;
              });
              searchHistory.saveSearch({ query: q, filter: filterVal, answer: finalAnswer, tldr: event.tldr || "", key_facts: event.key_facts || [], citations: event.citations || [], images: event.images || [], related_queries: event.related_queries || [] });
            } else if (event.type === "error") { throw new Error(event.error); }
          } catch (e: any) { if (e.message && !e.message.includes("JSON")) throw e; }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      console.error("Search error:", err);
      setError(err.message || "Erro ao buscar. Tente novamente.");
      setIsStreaming(false);
    } finally {
      setLoading(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [tts, googleSearch, serpSearch, searchHistory]);

  // Keep the stable ref updated
  handleSearchStable.current = handleSearch;

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort(); setIsStreaming(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (stateRef.current.streamingAnswer) {
      setResult({ answer: stateRef.current.streamingAnswer, citations: [], images: [], location: null, related_queries: [], tldr: "", key_facts: [] });
    }
  }, []);

  const handleSelectHistoryItem = useCallback((item: HistoryItem) => {
    setActiveHistoryItemId(item.id); setQuery(item.query); setActiveFilter(apiValueToFilter(item.filter));
    setConversationHistory([]); setFollowUpQuery("");
    if (item.answer) {
      setResult({ answer: item.answer, citations: item.citations || [], images: item.images || [], location: null, related_queries: item.related_queries || [], tldr: item.tldr || "", key_facts: item.key_facts || [] });
      setStreamingAnswer(""); setIsStreaming(false); setLoading(false); setError(null); setLastSearchQuery(item.query);
    } else { handleSearch(item.query); }
    if (isMobile) setSidebarOpen(false);
  }, [handleSearch, isMobile]);

  const clearSearchState = useCallback(() => {
    abortRef.current?.abort();
    setQuery("");
    setResult(null);
    setStreamingAnswer("");
    setIsStreaming(false);
    setError(null);
    setConversationHistory([]);
    setActiveHistoryItemId(undefined);
    setDeepResearchTopic("");
    setSearchIntent(null);
  }, []);

  // ── Auto-refire on filter change ─────────────────────────────────────
  const prevFilterRef = useRef(activeFilter);
  useEffect(() => {
    if (prevFilterRef.current !== activeFilter && query.trim() && (result || streamingAnswer)) {
      prevFilterRef.current = activeFilter;
      setConversationHistory([]);
      handleSearch(query);
    } else {
      prevFilterRef.current = activeFilter;
    }
  }, [activeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-search from URL param ───────────────────────────────────────
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) { setQuery(q); handleSearch(q); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived values (memoized) ────────────────────────────────────────
  const displayAnswer = useMemo(
    () => result?.answer || (streamingAnswer ? cleanStreamingText(streamingAnswer) : ""),
    [result?.answer, streamingAnswer]
  );

  const showSidePanels = useMemo(
    () => !loading && !result && !isStreaming && !error && !googleSearch.loading && googleSearch.results.length === 0,
    [loading, result, isStreaming, error, googleSearch.loading, googleSearch.results.length]
  );

  const autocompleteSuggestions = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    const lq = q.toLowerCase();
    const seen = new Set<string>();
    const results: string[] = [];

    // 1. Match from search history
    for (const h of searchHistory.history) {
      const hl = h.query.toLowerCase();
      if (hl.includes(lq) && hl !== lq && !seen.has(hl)) {
        seen.add(hl);
        results.push(h.query);
        if (results.length >= 3) break;
      }
    }

    // 2. Merge personalized suggestions that match
    for (const s of personalSuggestions) {
      if (results.length >= 6) break;
      const sl = s.text.toLowerCase();
      if (sl.includes(lq) && !seen.has(sl)) {
        seen.add(sl);
        results.push(s.text);
      }
    }

    return results;
  }, [query, searchHistory.history, personalSuggestions]);

  return {
    navigate,
    isMobile,
    query, setQuery,
    activeFilter, setActiveFilter,
    result,
    streamingAnswer,
    isStreaming,
    loading,
    error,
    elapsed,
    displayAnswer,
    showSidePanels,
    searchIntent,
    followUpQuery, setFollowUpQuery,
    conversationHistory, setConversationHistory,
    lastSearchQuery,
    sidebarOpen, setSidebarOpen,
    activeHistoryItemId,
    recency, setRecency,
    quickAnswer, setQuickAnswer,
    deepResearchMode, setDeepResearchMode,
    deepResearchTopic, setDeepResearchTopic,
    engineFilters, setEngineFilters,
    showScrollTop,
    showAutocomplete, setShowAutocomplete,
    searchInputRef,
    autocompleteSuggestions,
    googleSearch,
    serpSearch,
    tts,
    searchHistory,
    personalSuggestions,
    searchPrefs, updatePrefs, resetPrefs,
    voiceSupported, isListening, startListening, stopListening,
    handleSearch,
    handleShare,
    handleReadAloud,
    stopStreaming,
    handleSelectHistoryItem,
    clearSearchState,
  };
}

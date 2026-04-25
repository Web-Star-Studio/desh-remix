import { Search, X, Mic, MicOff, Clock, Mail, StickyNote, Users, ListTodo, FolderOpen, Sparkles, ArrowRight } from "lucide-react";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSpeechRecognition } from "@/hooks/audio/useSpeechRecognition";
import { useGlobalSearch, type GlobalSearchResult } from "@/hooks/search/useGlobalSearch";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

const MODULE_CONFIG: Record<string, { label: string; icon: React.ReactNode; seeAllPath: string }> = {
  emails: { label: "E-mails", icon: <Mail className="w-3.5 h-3.5" />, seeAllPath: "/email" },
  notes: { label: "Notas", icon: <StickyNote className="w-3.5 h-3.5" />, seeAllPath: "/notes" },
  contacts: { label: "Contatos", icon: <Users className="w-3.5 h-3.5" />, seeAllPath: "/contacts" },
  tasks: { label: "Tarefas", icon: <ListTodo className="w-3.5 h-3.5" />, seeAllPath: "/tasks" },
  files: { label: "Arquivos", icon: <FolderOpen className="w-3.5 h-3.5" />, seeAllPath: "/files" },
  conversations: { label: "Pandora", icon: <Sparkles className="w-3.5 h-3.5" />, seeAllPath: "/ai" },
};

const MODULE_ORDER = ["emails", "notes", "contacts", "tasks", "files", "conversations"] as const;

const GlobalSearchBar = () => {
  const [focused, setFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const mountedRef = useRef(true);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const { query, setQuery, results, loading, totalResults } = useGlobalSearch(3);

  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  const { isListening, startListening, stopListening, supported: voiceSupported } = useSpeechRecognition((transcript) => {
    setQuery(transcript);
    navigate(`/search?q=${encodeURIComponent(transcript)}`);
    setQuery("");
  });

  // Load recent searches
  const loadRecent = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("search_history")
        .select("query")
        .order("created_at", { ascending: false })
        .limit(5);
      if (data && mountedRef.current) {
        setRecentSearches([...new Set(data.map(d => d.query))]);
      }
    } catch {}
  }, [user]);

  useEffect(() => { loadRecent(); }, [loadRecent]);

  // Click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Ctrl+K / "/" to focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setFocused(true);
      }
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName) && !(e.target as HTMLElement)?.isContentEditable) {
        e.preventDefault();
        inputRef.current?.focus();
        setFocused(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Flatten results for keyboard nav (memoized to avoid recalc per keystroke)
  const flatItems = useMemo((): { item: GlobalSearchResult; moduleKey: string }[] => {
    const items: { item: GlobalSearchResult; moduleKey: string }[] = [];
    for (const mod of MODULE_ORDER) {
      for (const item of results[mod]) {
        items.push({ item, moduleKey: mod });
      }
    }
    return items;
  }, [results]);

  const handleSearch = useCallback(() => {
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setQuery("");
      setFocused(false);
    }
  }, [query, navigate, setQuery]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === "Enter") {
      if (selectedIndex >= 0 && selectedIndex < flatItems.length) {
        navigate(flatItems[selectedIndex].item.url);
        setQuery("");
        setFocused(false);
      } else {
        handleSearch();
      }
    } else if (e.key === "Escape") {
      setFocused(false);
      inputRef.current?.blur();
    }
  }, [flatItems, selectedIndex, navigate, handleSearch, setQuery]);

  // Reset selection when query changes
  useEffect(() => { setSelectedIndex(-1); }, [query]);

  const showDropdown = focused && (query.trim().length > 0 || recentSearches.length > 0);
  const hasResults = totalResults > 0;

  return (
    <div ref={wrapperRef} className="relative z-[40]">
      <div
        className={`glass-card rounded-xl px-3.5 py-2.5 transition-all duration-200 ${
          focused ? "ring-1 ring-primary/15" : ""
        }`}
      >
        <div className="flex items-center gap-3">
          <Search className={`w-4 h-4 transition-colors duration-200 ${focused ? "text-primary" : "text-muted-foreground"}`} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            placeholder="Pesquisar em tudo..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <AnimatePresence mode="popLayout">
            {!query && !focused && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="hidden sm:inline text-[10px] text-muted-foreground/50 bg-foreground/5 px-1.5 py-0.5 rounded font-mono"
              >
                ⌘K
              </motion.span>
            )}
          </AnimatePresence>
          {query && (
            <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
          {voiceSupported && (
            <button
              onClick={isListening ? stopListening : startListening}
              className={`transition-colors ${isListening ? "text-destructive animate-pulse" : "text-muted-foreground hover:text-foreground"}`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="absolute left-0 right-0 top-full mt-1.5 z-50 glass-card rounded-xl p-2 shadow-lg border border-foreground/10 max-h-[70vh] overflow-y-auto"
          >
            {/* Loading indicator */}
            {loading && query.trim() && (
              <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                Pesquisando...
              </div>
            )}

            {/* Results grouped by module */}
            {query.trim() && hasResults && (() => {
              let globalIdx = 0;
              return MODULE_ORDER.map(mod => {
                const items = results[mod];
                if (items.length === 0) return null;
                const config = MODULE_CONFIG[mod];
                return (
                  <div key={mod} className="mb-1.5 last:mb-0">
                    <div className="flex items-center justify-between px-2 pt-1.5 pb-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider">
                        {config.icon}
                        {config.label}
                      </div>
                      <button
                        onClick={() => {
                          navigate(config.seeAllPath);
                          setQuery("");
                          setFocused(false);
                        }}
                        className="text-[10px] text-primary/70 hover:text-primary transition-colors flex items-center gap-0.5"
                      >
                        Ver todos <ArrowRight className="w-2.5 h-2.5" />
                      </button>
                    </div>
                    {items.map((item) => {
                      const idx = globalIdx++;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            navigate(item.url);
                            setQuery("");
                            setFocused(false);
                          }}
                          className={`flex items-center gap-2.5 w-full text-left text-xs py-2 px-2 rounded-lg transition-colors ${
                            idx === selectedIndex
                              ? "bg-muted text-foreground"
                              : "text-foreground/80 hover:bg-foreground/5"
                          }`}
                        >
                          <span className="text-muted-foreground/60">{config.icon}</span>
                          <span className="flex-1 truncate">{item.title}</span>
                          {item.subtitle && (
                            <span className="text-[10px] text-muted-foreground/50 truncate max-w-[120px]">
                              {item.subtitle}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              });
            })()}

            {/* No local results — suggest web search */}
            {query.trim() && !loading && !hasResults && (
              <button
                onClick={handleSearch}
                className="flex items-center gap-2.5 w-full text-left text-xs text-foreground/70 py-2.5 px-2 rounded-lg hover:bg-foreground/5 transition-colors"
              >
                <Search className="w-3.5 h-3.5 text-primary" />
                <span>Pesquisar "<strong className="text-foreground">{query.trim()}</strong>" na web</span>
              </button>
            )}

            {/* Web search shortcut when there are results */}
            {query.trim() && hasResults && (
              <div className="border-t border-foreground/5 mt-1.5 pt-1.5">
                <button
                  onClick={handleSearch}
                  className="flex items-center gap-2.5 w-full text-left text-xs text-foreground/60 py-2 px-2 rounded-lg hover:bg-foreground/5 transition-colors"
                >
                  <Search className="w-3.5 h-3.5 text-primary/60" />
                  <span>Pesquisar na web</span>
                  <span className="ml-auto text-[10px] text-muted-foreground/40 font-mono">Enter ↵</span>
                </button>
              </div>
            )}

            {/* Recent searches (when empty query) */}
            {!query.trim() && recentSearches.length > 0 && (
              <>
                <p className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider px-2 pb-1.5">
                  Recentes
                </p>
                {recentSearches.map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      setQuery(item);
                      navigate(`/search?q=${encodeURIComponent(item)}`);
                      setFocused(false);
                    }}
                    className="flex items-center gap-2.5 w-full text-left text-xs text-foreground/80 py-2 px-2 rounded-lg hover:bg-foreground/5 transition-colors"
                  >
                    <Clock className="w-3 h-3 text-muted-foreground/50" /> {item}
                  </button>
                ))}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default React.memo(GlobalSearchBar);

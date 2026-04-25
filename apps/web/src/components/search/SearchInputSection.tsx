import GlassCard from "@/components/dashboard/GlassCard";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import RecencyFilter from "@/components/search/RecencyFilter";
import SerpEngineFilters from "@/components/search/SerpEngineFilters";
import AdaptiveSearchForm, { type StructuredParams } from "@/components/search/AdaptiveSearchForm";
import DOMPurify from "dompurify";
import { motion } from "framer-motion";
import { Search, Clock, X, Mic, MicOff, Loader2, Microscope } from "lucide-react";
import { type RecencyValue } from "@/components/search/RecencyFilter";

import {
  filters, SPECIALIZED_FILTERS, filterToApiValue,
  accentMap, bannerConfig, searchPlaceholders,
  serpEngineMap, filterEngineMap, ENGINES_WITH_FORM,
} from "@/components/search/searchConstants";

interface SearchInputSectionProps {
  query: string;
  setQuery: (v: string) => void;
  activeFilter: string;
  setActiveFilter: (v: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
  showAutocomplete: boolean;
  setShowAutocomplete: (v: boolean) => void;
  autocompleteSuggestions: string[];
  voiceSupported: boolean;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  loading: boolean;
  isStreaming: boolean;
  deepResearchMode: boolean;
  setDeepResearchMode: (v: boolean) => void;
  setDeepResearchTopic: (v: string) => void;
  recency: RecencyValue;
  setRecency: (v: RecencyValue) => void;
  engineFilters: Record<string, Record<string, any>>;
  setEngineFilters: (v: (prev: Record<string, Record<string, any>>) => Record<string, Record<string, any>>) => void;
  lastSearchQuery: string;
  handleSearch: (q?: string) => void;
  clearSearchState: () => void;
  serpSearch: any;
}

import { memo, useState as useLocalState } from "react";

const SearchInputSection = memo(({
  query, setQuery, activeFilter, setActiveFilter,
  searchInputRef, showAutocomplete, setShowAutocomplete, autocompleteSuggestions,
  voiceSupported, isListening, startListening, stopListening,
  loading, isStreaming, deepResearchMode, setDeepResearchMode, setDeepResearchTopic,
  recency, setRecency, engineFilters, setEngineFilters, lastSearchQuery,
  handleSearch, clearSearchState, serpSearch,
}: SearchInputSectionProps) => {
  const [acHighlight, setAcHighlight] = useLocalState(-1);

  return (
    <AnimatedItem index={0}>
      <GlassCard size="auto" className="mb-6 relative flex-none overflow-visible z-[100]">
        <div className="flex items-center gap-3">
          {deepResearchMode ? <Microscope className="w-6 h-6 text-primary" /> : <Search className="w-6 h-6 text-primary" />}
          <input
            ref={searchInputRef} type="text" value={query}
            onChange={e => { setQuery(e.target.value); setShowAutocomplete(true); setAcHighlight(-1); }}
            onKeyDown={e => {
              if (showAutocomplete && autocompleteSuggestions.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setAcHighlight(prev => (prev + 1) % autocompleteSuggestions.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setAcHighlight(prev => prev <= 0 ? autocompleteSuggestions.length - 1 : prev - 1);
                  return;
                }
                if (e.key === "Enter" && acHighlight >= 0) {
                  e.preventDefault();
                  const selected = autocompleteSuggestions[acHighlight];
                  setQuery(selected);
                  setShowAutocomplete(false);
                  setAcHighlight(-1);
                  handleSearch(selected);
                  return;
                }
              }
              if (e.key === "Enter") { setShowAutocomplete(false); handleSearch(); }
              if (e.key === "Escape") { setShowAutocomplete(false); setAcHighlight(-1); }
            }}
            onFocus={() => setShowAutocomplete(true)}
            onBlur={() => setTimeout(() => setShowAutocomplete(false), 150)}
            placeholder={deepResearchMode ? "Digite o tema para pesquisa profunda..." : (searchPlaceholders[activeFilter] || "O que você está buscando?")}
            className="flex-1 bg-transparent text-lg text-foreground placeholder:text-muted-foreground outline-none"
            maxLength={500}
            autoFocus
          />
          {query && (
            <button onClick={clearSearchState} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          )}
          {voiceSupported && (
            <button onClick={isListening ? stopListening : startListening} className={`transition-colors ${isListening ? "text-destructive animate-pulse" : "text-muted-foreground hover:text-foreground"}`} title={isListening ? "Parar gravação" : "Buscar por voz"}>
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
          {(loading || isStreaming) ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : (
            <button onClick={() => handleSearch()} className="text-primary hover:text-primary/80 transition-colors"><Search className="w-5 h-5" /></button>
          )}
        </div>

        {/* Autocomplete dropdown */}
        {showAutocomplete && autocompleteSuggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 glass-card rounded-xl p-1.5 shadow-lg border border-foreground/10 mt-1" role="listbox">
            {autocompleteSuggestions.map((ac, i) => (
              <button key={i}
                role="option"
                aria-selected={acHighlight === i}
                onMouseDown={() => { setQuery(ac); setShowAutocomplete(false); setAcHighlight(-1); handleSearch(ac); }}
                onMouseEnter={() => setAcHighlight(i)}
                className={`flex items-center gap-2 w-full text-left text-sm text-foreground/80 py-2 px-3 rounded-lg transition-colors ${acHighlight === i ? "bg-primary/10 text-primary" : "hover:bg-foreground/5"}`}>
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ac.replace(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<strong class="text-primary">$1</strong>')) }} />
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-1.5 mt-4 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
          {filters.map(f => {
            const isActive = activeFilter === f.label;
            const activeClass = accentMap[f.label] || "bg-primary/20 text-primary ring-primary/30";
            return (
              <button key={f.label} onClick={() => setActiveFilter(f.label)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all shrink-0 touch-target ${isActive ? `${activeClass} ring-1` : "text-muted-foreground hover:bg-foreground/5"}`}>
                <f.icon className="w-3.5 h-3.5" />
                <span className={isActive ? "" : "hidden sm:inline"}>{f.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mt-1">
          <RecencyFilter value={recency} onChange={setRecency} visible={!deepResearchMode && (activeFilter === "Web" || activeFilter === "Notícias")} />
          <button onClick={() => { setDeepResearchMode(!deepResearchMode); if (deepResearchMode) setDeepResearchTopic(""); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 ml-auto ${deepResearchMode ? "bg-primary/20 text-primary ring-1 ring-primary/30" : "text-muted-foreground hover:bg-foreground/5"}`}>
            <Microscope className="w-3.5 h-3.5" /> Deep Research
            {deepResearchMode && <span className="text-[9px] opacity-70">· 8 créditos</span>}
          </button>
        </div>
        {/* Engine-specific chip filters */}
        {(() => {
          const engineKey = filterEngineMap[activeFilter];
          if (!engineKey) return null;
          return (
            <SerpEngineFilters engine={engineKey} onChange={(params) => {
              setEngineFilters(prev => ({ ...prev, [engineKey]: params }));
              if (lastSearchQuery) serpSearch.searchDebounced(lastSearchQuery, engineKey, params);
            }} />
          );
        })()}

        {/* Adaptive structured form for specialized engines */}
        {ENGINES_WITH_FORM.has(activeFilter) && (
          <AdaptiveSearchForm
            engine={activeFilter}
            initialQuery={query}
            onSearch={(q: string, params: StructuredParams) => {
              const engine = serpEngineMap[filterToApiValue(activeFilter)] || "google";
              setQuery(q);
              serpSearch.search(q, engine, params);
            }}
          />
        )}
      </GlassCard>

      {/* Engine context banner */}
      {(() => {
        const config = bannerConfig[activeFilter];
        if (!config) return null;
        const Icon = config.icon;
        return (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-xl border ${config.bannerClass} px-4 py-2.5 mb-2 flex items-center gap-3`}>
            <Icon className={`w-4 h-4 ${config.iconClass} shrink-0`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${config.labelClass}`}>{config.label}</span>
                <span className="text-[10px] text-muted-foreground/60">· {config.credits} créditos</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{config.hint}</p>
            </div>
          </motion.div>
        );
      })()}
    </AnimatedItem>
  );
});

SearchInputSection.displayName = "SearchInputSection";

export default SearchInputSection;

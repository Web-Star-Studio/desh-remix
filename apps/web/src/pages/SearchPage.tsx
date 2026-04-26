import PageLayout from "@/components/dashboard/PageLayout";
import { usePageMeta } from "@/contexts/PageMetaContext";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import GlassCard from "@/components/dashboard/GlassCard";
import { ArrowLeft, Loader2, PanelLeftClose, PanelLeft, Square, RotateCcw, Target, ArrowUp, AlertTriangle, Wifi, CreditCard } from "lucide-react";
import SearchLoadingSkeleton from "@/components/search/SearchLoadingSkeleton";

import SearchInputSection from "@/components/search/SearchInputSection";
import { lazy, Suspense, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

import { useSearchLogic } from "@/hooks/search/useSearchLogic";
import {
  SPECIALIZED_FILTERS, filterToApiValue, emptyStateMap, detectSpecializedEngine,
} from "@/components/search/searchConstants";

// Lazy-load heavy sub-components
const DeepResearchPanel = lazy(() => import("@/components/search/DeepResearchPanel"));
const SearchMonitorDashboard = lazy(() => import("@/components/search/SearchMonitorDashboard"));
const SearchResultsPanel = lazy(() => import("@/components/search/SearchResultsPanel"));
const GoogleSearchResults = lazy(() => import("@/components/search/GoogleSearchResults"));
const SearchHistorySidebar = lazy(() => import("@/components/search/SearchHistorySidebar"));
const QuickAnswerCard = lazy(() => import("@/components/search/QuickAnswerCard"));
const SearchPreferencesPanel = lazy(() => import("@/components/search/SearchPreferencesPanel"));
const AnswerCard = lazy(() => import("@/components/search/AnswerCard"));
const SerpSnippetCard = lazy(() => import("@/components/search/SerpSnippetCard"));

// Classify error for better UX
function classifyError(error: string): { icon: typeof AlertTriangle; title: string; hint: string; retryable: boolean } {
  if (error.includes("Créditos insuficientes") || error.includes("402")) {
    return { icon: CreditCard, title: "Créditos insuficientes", hint: "Adquira mais créditos para continuar pesquisando.", retryable: false };
  }
  if (error.includes("Muitas buscas") || error.includes("429") || error.includes("Limite")) {
    return { icon: AlertTriangle, title: "Limite de requisições", hint: "Aguarde alguns segundos e tente novamente.", retryable: true };
  }
  if (error.includes("logado") || error.includes("Sessão")) {
    return { icon: AlertTriangle, title: "Sessão expirada", hint: "Faça login novamente para continuar.", retryable: false };
  }
  if (error.includes("demorou") || error.includes("504") || error.includes("timeout")) {
    return { icon: Wifi, title: "Tempo limite excedido", hint: "Tente com termos mais curtos ou específicos.", retryable: true };
  }
  return { icon: AlertTriangle, title: "Erro na busca", hint: "Verifique sua conexão e tente novamente.", retryable: true };
}

const SearchPage = () => {
  const s = useSearchLogic();
  usePageMeta({ title: "Buscar" });

  // Streaming word count
  const streamingWordCount = useMemo(() => {
    if (!s.isStreaming || !s.displayAnswer) return 0;
    return s.displayAnswer.trim().split(/\s+/).length;
  }, [s.isStreaming, s.displayAnswer]);

  const sidebarContent = useMemo(() => (
    <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}>
      <SearchHistorySidebar
        history={s.searchHistory.history} projects={s.searchHistory.projects} loading={s.searchHistory.loading}
        hasMore={s.searchHistory.hasMore} onLoadMore={s.searchHistory.loadMore} onSelectItem={s.handleSelectHistoryItem}
        onToggleFavorite={s.searchHistory.toggleFavorite} onMoveToProject={s.searchHistory.moveToProject}
        onDeleteItem={s.searchHistory.deleteItem} onClearHistory={s.searchHistory.clearHistory}
        onCreateProject={s.searchHistory.createProject} onUpdateProject={s.searchHistory.updateProject}
        onDeleteProject={s.searchHistory.deleteProject} activeItemId={s.activeHistoryItemId}
      />
    </Suspense>
  ), [s.searchHistory, s.handleSelectHistoryItem, s.activeHistoryItemId]);

  return (
    <PageLayout maxWidth="full">
      <div className="flex gap-4 h-full">
        {/* Desktop sidebar */}
        {!s.isMobile && s.sidebarOpen && (
          <>
            <div className="fixed inset-0 z-[109]" onClick={() => s.setSidebarOpen(false)} />
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 320, opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="fixed top-0 left-0 h-screen w-[320px] glass-card overflow-hidden z-[110] shadow-2xl" style={{ borderRadius: '0 1rem 1rem 0' }}>
              {sidebarContent}
            </motion.div>
          </>
        )}

        {/* Mobile sidebar */}
        {s.isMobile && (
          <Sheet open={s.sidebarOpen} onOpenChange={s.setSidebarOpen}>
            <SheetContent side="left" className="w-[85vw] max-w-[360px] p-0">
              <SheetTitle className="sr-only">Histórico de Buscas</SheetTitle>
              {sidebarContent}
            </SheetContent>
          </Sheet>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="flex items-center justify-end mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <button onClick={() => s.setSidebarOpen(!s.sidebarOpen)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all" title={s.sidebarOpen ? "Fechar histórico" : "Abrir histórico"}>
                  {s.sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
                  {!s.isMobile && <span>Histórico</span>}
                </button>
                <Suspense fallback={null}>
                  <SearchPreferencesPanel prefs={s.searchPrefs} onUpdate={s.updatePrefs} onReset={s.resetPrefs} />
                </Suspense>
              </div>
            </div>
          </motion.div>

          {/* Search Input */}
          <SearchInputSection
            query={s.query} setQuery={s.setQuery}
            activeFilter={s.activeFilter} setActiveFilter={s.setActiveFilter}
            searchInputRef={s.searchInputRef}
            showAutocomplete={s.showAutocomplete} setShowAutocomplete={s.setShowAutocomplete}
            autocompleteSuggestions={s.autocompleteSuggestions}
            voiceSupported={s.voiceSupported} isListening={s.isListening}
            startListening={s.startListening} stopListening={s.stopListening}
            loading={s.loading} isStreaming={s.isStreaming}
            deepResearchMode={s.deepResearchMode} setDeepResearchMode={s.setDeepResearchMode}
            setDeepResearchTopic={s.setDeepResearchTopic}
            recency={s.recency} setRecency={s.setRecency}
            engineFilters={s.engineFilters} setEngineFilters={s.setEngineFilters}
            lastSearchQuery={s.lastSearchQuery}
            handleSearch={s.handleSearch} clearSearchState={s.clearSearchState}
            serpSearch={s.serpSearch}
          />

          {/* Deep Research */}
          {s.deepResearchMode && s.deepResearchTopic && (
            <AnimatedItem index={1}>
              <Suspense fallback={null}>
                <DeepResearchPanel topic={s.deepResearchTopic} autoStart={true} onCancel={() => { s.setDeepResearchMode(false); s.setDeepResearchTopic(""); }} onComplete={() => {}} />
              </Suspense>
            </AnimatedItem>
          )}

          {/* Quick Answer */}
          <AnimatePresence>
            {s.quickAnswer && !s.result && !s.loading && !s.isStreaming && (
              <Suspense fallback={null}>
                <QuickAnswerCard answer={s.quickAnswer} onDismiss={() => { s.setQuickAnswer(null); s.handleSearch(s.quickAnswer!.query); }} />
              </Suspense>
            )}
          </AnimatePresence>

          {/* Loading skeleton */}
          {(s.loading || s.serpSearch.loading) && <SearchLoadingSkeleton activeFilter={s.activeFilter} />}

          {/* Empty state for specialized engines */}
          {!s.loading && !s.serpSearch.loading && s.result && !s.result.answer && s.serpSearch.result && SPECIALIZED_FILTERS.has(filterToApiValue(s.activeFilter)) && (() => {
            const filterVal = filterToApiValue(s.activeFilter);
            const hasData = (
              (filterVal === "academic" && s.serpSearch.result?.scholar_results?.length)
            );
            if (hasData) return null;
            const cfg = emptyStateMap[filterVal];
            if (!cfg) return null;
            const Icon = cfg.icon;
            return (
              <AnimatedItem index={1}>
                <GlassCard size="auto" className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-foreground/5 mb-3">
                    <Icon className={`w-6 h-6 ${cfg.colorClass}`} />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">{cfg.title}</p>
                  <p className="text-xs text-muted-foreground mb-3">{cfg.subtitle}</p>
                  {cfg.examples && (
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {cfg.examples.map((ex, i) => (
                        <button key={i} onClick={() => { s.setQuery(ex); s.handleSearch(ex); }} className="text-[10px] px-2.5 py-1 rounded-full bg-foreground/5 hover:bg-foreground/10 text-foreground/70 hover:text-foreground transition-all">{ex}</button>
                      ))}
                    </div>
                  )}
                </GlassCard>
              </AnimatedItem>
            );
          })()}

          {/* Google services results */}
          {s.activeFilter === "Meus Dados" && (s.googleSearch.loading || s.googleSearch.results.length > 0 || (!s.loading && s.query)) && (
            <AnimatedItem index={1}><Suspense fallback={null}><GoogleSearchResults items={s.googleSearch.results} loading={s.googleSearch.loading} query={s.query} /></Suspense></AnimatedItem>
          )}

          {/* Enhanced error with classification */}
          {s.error && (
            <AnimatedItem index={1}>
              {(() => {
                const errInfo = classifyError(s.error);
                const ErrIcon = errInfo.icon;
                return (
                  <GlassCard size="auto" className="mb-4 border-destructive/20">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                        <ErrIcon className="w-5 h-5 text-destructive" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-destructive">{errInfo.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.error}</p>
                        <p className="text-[11px] text-foreground/60 mt-1.5 bg-foreground/[0.03] rounded-lg px-3 py-1.5 border border-foreground/5">
                          💡 {errInfo.hint}
                        </p>
                        {errInfo.retryable && (
                          <button onClick={() => s.handleSearch(s.lastSearchQuery || s.query)} className="flex items-center gap-1.5 px-3 py-1.5 mt-3 rounded-full text-xs font-medium bg-destructive/10 hover:bg-destructive/20 text-destructive transition-all">
                            <RotateCcw className="w-3 h-3" /> Tentar novamente
                          </button>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                );
              })()}
            </AnimatedItem>
          )}

          {/* Streaming answer with progress */}
          {s.isStreaming && s.displayAnswer && (
            <div className="space-y-3">
              <Suspense fallback={null}><AnswerCard answer={s.displayAnswer} streaming={true} citations={[]} /></Suspense>
              
              {/* Streaming progress bar */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-between px-1"
              >
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-[10px] text-muted-foreground/70">Gerando resposta...</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/50 font-mono">
                    {streamingWordCount} palavras · {(s.elapsed / 1000).toFixed(1)}s
                  </span>
                </div>
              </motion.div>

              {s.serpSearch.result && s.searchPrefs.serpapi_enabled && (
                <>
                  {s.searchPrefs.serp_show_knowledge_graph && (
                    <Suspense fallback={null}><SerpSnippetCard featured_snippet={s.serpSearch.result.featured_snippet} answer_box={s.serpSearch.result.answer_box} knowledge_graph={s.serpSearch.result.knowledge_graph} /></Suspense>
                  )}
                </>
              )}
              {s.serpSearch.loading && s.searchPrefs.serpapi_enabled && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /><span>Carregando dados do Google...</span>
                </div>
              )}
              <div className="flex justify-center">
                <button onClick={s.stopStreaming} className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium bg-foreground/10 hover:bg-foreground/15 text-foreground/80 hover:text-foreground transition-all border border-foreground/10">
                  <Square className="w-3 h-3 fill-current" /> Parar geração
                </button>
              </div>
            </div>
          )}

          {/* Final results */}
          {s.result && (
            <Suspense fallback={<SearchLoadingSkeleton activeFilter={s.activeFilter} />}>
              <SearchResultsPanel
                result={s.result}
                serpSearch={s.serpSearch}
                searchPrefs={s.searchPrefs}
                lastSearchQuery={s.lastSearchQuery}
                query={s.query}
                elapsed={s.elapsed}
                followUpQuery={s.followUpQuery}
                setFollowUpQuery={s.setFollowUpQuery}
                conversationHistory={s.conversationHistory}
                setConversationHistory={s.setConversationHistory}
                handleSearch={s.handleSearch}
                handleReadAloud={s.handleReadAloud}
                handleShare={s.handleShare}
                tts={s.tts}
                activeFilter={s.activeFilter}
                setActiveFilter={s.setActiveFilter}
                setQuery={s.setQuery}
              />
            </Suspense>
          )}

          {/* Side panels: suggestions + monitors */}
          {s.showSidePanels && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatedItem index={1}>
                  <GlassCard size="auto">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-4 h-4 text-primary" />
                      <p className="widget-title">Sugestões para Você</p>
                    </div>
                    <div className="space-y-1">
                      {s.personalSuggestions.map((item, i) => (
                        <button key={i} onClick={() => { s.setQuery(item.text); s.handleSearch(item.text); }} className="flex items-center gap-2 w-full text-left text-sm text-foreground/80 py-1.5 px-2 rounded-md hover:bg-foreground/5 transition-colors">
                          <span className="text-sm shrink-0">{item.icon}</span>
                          <span className="truncate">{item.text}</span>
                          <span className="ml-auto text-[10px] text-muted-foreground/60 shrink-0">
                            {item.source === "task" ? "tarefa" : item.source === "event" ? "agenda" : item.source === "habit" ? "hábito" : "recente"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </GlassCard>
                </AnimatedItem>
              </div>
              <AnimatedItem index={2}>
                <Suspense fallback={null}>
                  <SearchMonitorDashboard onSearchQuery={(q) => { s.setQuery(q); s.handleSearch(q); }} />
                </Suspense>
              </AnimatedItem>
            </div>
          )}
        </div>
      </div>

      {/* Scroll to top */}
      <AnimatePresence>
        {s.showScrollTop && (
          <motion.button initial={{ opacity: 0, scale: 0.8, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: 10 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
          >
            <ArrowUp className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </PageLayout>
  );
};

export default SearchPage;

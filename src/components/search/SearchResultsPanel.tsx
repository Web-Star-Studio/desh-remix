import GlassCard from "@/components/dashboard/GlassCard";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import SerpSpecializedResults from "@/components/search/SerpSpecializedResults";
import SerpSnippetCard from "@/components/search/SerpSnippetCard";
import SerpPeopleAlsoAsk from "@/components/search/SerpPeopleAlsoAsk";
import SerpOrganicResults from "@/components/search/SerpOrganicResults";
import SerpNewsResults from "@/components/search/SerpNewsResults";
import SerpImageResults from "@/components/search/SerpImageResults";
import SearchSourceCard from "@/components/search/SearchSourceCard";
import SearchImageGallery from "@/components/search/SearchImageGallery";
import SearchMapPreview from "@/components/search/SearchMapPreview";
import SearchRelatedQueries from "@/components/search/SearchRelatedQueries";
import SearchExportButton from "@/components/search/SearchExportButton";
import TldrCard from "@/components/search/TldrCard";
import KeyFactsCard from "@/components/search/KeyFactsCard";
import AnswerCard from "@/components/search/AnswerCard";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Search, Globe, Loader2, ImageIcon, MapPin, Database,
  MessageSquarePlus, Sparkles, RotateCcw, BookOpen, Eraser,
  Zap, Timer
} from "lucide-react";
import {
  SPECIALIZED_FILTERS, filterToApiValue, staggerItem, detectSpecializedEngine,
} from "@/components/search/searchConstants";
import { type SearchResult } from "@/components/search/searchConstants";

interface SearchResultsPanelProps {
  result: SearchResult;
  serpSearch: any;
  searchPrefs: any;
  lastSearchQuery: string;
  query: string;
  elapsed: number;
  followUpQuery: string;
  setFollowUpQuery: (v: string) => void;
  conversationHistory: { role: string; content: string }[];
  setConversationHistory: (v: any) => void;
  handleSearch: (q?: string, isFollowUp?: boolean) => void;
  handleReadAloud: () => void;
  handleShare: () => void;
  tts: any;
  activeFilter: string;
  setActiveFilter: (v: string) => void;
  setQuery: (v: string) => void;
}

import { memo } from "react";

const SearchResultsPanel = memo(({
  result, serpSearch, searchPrefs, lastSearchQuery, query, elapsed,
  followUpQuery, setFollowUpQuery, conversationHistory, setConversationHistory,
  handleSearch, handleReadAloud, handleShare, tts,
  activeFilter, setActiveFilter, setQuery,
}: SearchResultsPanelProps) => {
  return (
    <motion.div className="space-y-4" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}>
      {/* Análise IA */}
      {(result.tldr || result.key_facts.length > 0) && (
        <motion.div variants={staggerItem} className="flex items-center gap-2 pt-1">
          <Sparkles className="w-3.5 h-3.5 text-primary/60" />
          <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Análise IA</span>
          <div className="flex-1 h-px bg-foreground/5" />
        </motion.div>
      )}
      {result.tldr && <TldrCard tldr={result.tldr} />}
      {result.key_facts.length > 0 && <KeyFactsCard facts={result.key_facts} />}


      {/* Dados Estruturados */}
      {serpSearch.result && (() => {
        const r = serpSearch.result;
        const hasSpecialized = r.scholar_results?.length ||
          r.featured_snippet || r.answer_box || r.knowledge_graph ||
          r.news_results?.length || r.image_results?.length ||
          r.organic_results?.length || r.people_also_ask?.length;
        if (!hasSpecialized) return null;
        return (
          <motion.div variants={staggerItem} className="flex items-center gap-2 pt-1">
            <Database className="w-3.5 h-3.5 text-primary/60" />
            <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Dados Estruturados</span>
            <div className="flex-1 h-px bg-foreground/5" />
          </motion.div>
        );
      })()}

      {/* Specialized SerpAPI Engine Cards */}
      {serpSearch.result && (
        <>
          <SerpSpecializedResults
            serpResult={serpSearch.result} prefs={searchPrefs}
          />
        </>
      )}

      {/* SerpAPI Structured Data */}
      {serpSearch.result && searchPrefs.serpapi_enabled && (
        <>
          {searchPrefs.serp_show_knowledge_graph && !serpSearch.result.scholar_results?.length && (
            <SerpSnippetCard featured_snippet={serpSearch.result.featured_snippet} answer_box={serpSearch.result.answer_box} knowledge_graph={serpSearch.result.knowledge_graph} />
          )}
          {searchPrefs.serp_show_people_also_ask && serpSearch.result.people_also_ask && serpSearch.result.people_also_ask.length > 0 && (
            <motion.div variants={staggerItem}><SerpPeopleAlsoAsk items={serpSearch.result.people_also_ask} onSearch={handleSearch} /></motion.div>
          )}
          {searchPrefs.serp_show_news && serpSearch.result.news_results && serpSearch.result.news_results.length > 0 && (
            <motion.div variants={staggerItem}><SerpNewsResults items={serpSearch.result.news_results} /></motion.div>
          )}
          {searchPrefs.serp_show_images && serpSearch.result.image_results && serpSearch.result.image_results.length > 0 && (
            <motion.div variants={staggerItem}><SerpImageResults items={serpSearch.result.image_results} /></motion.div>
          )}
        </>
      )}

      {/* SerpAPI error */}
      {serpSearch.error && searchPrefs.serpapi_enabled && (
        <motion.div variants={staggerItem}>
          <GlassCard size="auto" className={serpSearch.suggestion ? "border-amber-500/20 bg-amber-500/[0.02]" : "border-destructive/20 bg-destructive/[0.02]"}>
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${serpSearch.suggestion ? "bg-amber-500/15" : "bg-destructive/15"}`}>
                <Sparkles className={`w-4 h-4 ${serpSearch.suggestion ? "text-amber-500" : "text-destructive"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${serpSearch.suggestion ? "text-amber-500" : "text-destructive"}`}>
                  {serpSearch.suggestion ? "Sua busca precisa de ajuste" : "Erro na busca estruturada"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{serpSearch.error}</p>
                {serpSearch.suggestion && (
                  <div className="mt-3 space-y-2.5">
                    {serpSearch.suggestion.explanation && (
                      <p className="text-[11px] text-foreground/70 bg-foreground/[0.03] rounded-lg px-3 py-2 border border-foreground/5">💡 {serpSearch.suggestion.explanation}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Tente uma dessas buscas:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {serpSearch.suggestion.corrected_queries.map((q: string, i: number) => (
                        <motion.button key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.06 }} onClick={() => { setQuery(q); handleSearch(q); }} className="text-[11px] px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/15 hover:border-primary/30 transition-all hover:shadow-sm">{q}</motion.button>
                      ))}
                    </div>
                  </div>
                )}
                {!serpSearch.suggestion && (serpSearch.error.includes("identificar") || serpSearch.error.includes("Missing") || serpSearch.error.includes("preciso")) && (
                  <p className="text-[10px] text-muted-foreground/70 mt-2">💡 Tente ser mais específico na sua busca. A IA tentará extrair os parâmetros necessários.</p>
                )}
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={() => handleSearch(lastSearchQuery || query)} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-foreground/[0.06] hover:bg-foreground/10 text-foreground/70 hover:text-foreground transition-all">
                    <RotateCcw className="w-3 h-3" /> Tentar novamente
                  </button>
                  {SPECIALIZED_FILTERS.has(filterToApiValue(activeFilter)) && (
                    <button onClick={() => { setActiveFilter("Web"); serpSearch.search(lastSearchQuery || query, "google"); }} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-foreground/[0.06] hover:bg-foreground/10 text-foreground/70 hover:text-foreground transition-all">
                      <Globe className="w-3 h-3" /> Buscar na Web
                    </button>
                  )}
                </div>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Resposta Completa */}
      {result.answer && (
        <motion.div variants={staggerItem} className="flex items-center gap-2 pt-1">
          <BookOpen className="w-3.5 h-3.5 text-primary/60" />
          <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Resposta Completa</span>
          <div className="flex-1 h-px bg-foreground/5" />
        </motion.div>
      )}
      {result.answer && (
        <AnswerCard answer={result.answer} streaming={false} citations={result.citations} onReadAloud={tts.supported ? handleReadAloud : undefined} isReading={tts.speakingId === 999} onShare={handleShare} exportButton={<SearchExportButton data={{ query: lastSearchQuery || query, answer: result.answer, tldr: result.tldr, key_facts: result.key_facts, citations: result.citations }} />} />
      )}

      {/* SerpAPI-only mode notice */}
      {!searchPrefs.perplexity_enabled && !result.answer && serpSearch.result && (
        <motion.div variants={staggerItem}>
          <GlassCard size="auto">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Globe className="w-3.5 h-3.5 text-primary" />
              <span>Modo SerpAPI — ative o Perplexity nas preferências para respostas sintetizadas com IA.</span>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* SerpAPI still loading */}
      {searchPrefs.serpapi_enabled && serpSearch.loading && (
        <motion.div variants={staggerItem}>
          <div className="flex items-center gap-3 text-xs text-muted-foreground py-3 px-4 rounded-xl bg-foreground/[0.02] border border-foreground/5">
            <div className="relative">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <div className="absolute inset-0 w-4 h-4 rounded-full bg-primary/20 animate-ping" />
            </div>
            <div className="flex-1">
              <span className="font-medium text-foreground/70">Buscando dados estruturados</span>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">Consultando Google para resultados enriquecidos...</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Search metadata */}
      {(elapsed > 0 || serpSearch.result?.search_metadata) && (
        <motion.div variants={staggerItem} className="flex items-center justify-end gap-2 flex-wrap">
          {elapsed > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 px-2 py-0.5 rounded-full bg-foreground/[0.03]">
              <Timer className="w-3 h-3" /> {(elapsed / 1000).toFixed(1)}s total
            </span>
          )}
          {serpSearch.result?.search_metadata?.request_duration_ms && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 px-2 py-0.5 rounded-full bg-foreground/[0.03]">
              <Zap className="w-3 h-3" /> SerpAPI {(serpSearch.result.search_metadata.request_duration_ms / 1000).toFixed(1)}s
            </span>
          )}
          {serpSearch.result?.search_metadata?.engine && serpSearch.result.search_metadata.engine !== "google" && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 px-2 py-0.5 rounded-full bg-foreground/[0.03]">
              <Globe className="w-3 h-3" /> {serpSearch.result.search_metadata.engine.replace("google_", "").replace(/_/g, " ")}
            </span>
          )}
          {result.citations.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 px-2 py-0.5 rounded-full bg-foreground/[0.03]">
              <Globe className="w-3 h-3" /> {result.citations.length} fontes
            </span>
          )}
        </motion.div>
      )}

      {result.location && (
        <motion.div variants={staggerItem}>
          <GlassCard size="auto">
            <p className="widget-title mb-3 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-primary" /> Localização</p>
            <SearchMapPreview location={result.location} />
          </GlassCard>
        </motion.div>
      )}

      {result.images.length > 0 && (
        <motion.div variants={staggerItem}>
          <GlassCard size="auto">
            <p className="widget-title mb-3 flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5 text-primary" /> Imagens</p>
            <SearchImageGallery images={result.images} />
          </GlassCard>
        </motion.div>
      )}

      {result.citations.length > 0 && (
        <motion.div variants={staggerItem}>
          <GlassCard size="auto">
            <p className="widget-title mb-3">Fontes ({result.citations.length})</p>
            <div className="max-h-[400px] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {result.citations.map((url, i) => <SearchSourceCard key={i} url={url} index={i} />)}
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Resultados Web */}
      {searchPrefs.serpapi_enabled && searchPrefs.serp_show_organic && serpSearch.result?.organic_results && serpSearch.result.organic_results.length > 0 && (
        <>
          <motion.div variants={staggerItem} className="flex items-center gap-2 pt-1">
            <Globe className="w-3.5 h-3.5 text-primary/60" />
            <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Resultados Web</span>
            <div className="flex-1 h-px bg-foreground/5" />
          </motion.div>
          <motion.div variants={staggerItem}><SerpOrganicResults items={serpSearch.result.organic_results} /></motion.div>
        </>
      )}

      {(() => {
        const allRelated = [...result.related_queries, ...(serpSearch.result?.related_searches || [])].filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);
        if (!allRelated.length) return null;
        return (
          <motion.div variants={staggerItem}>
            <GlassCard size="auto">
              <p className="widget-title mb-3">Explorar Mais</p>
              <SearchRelatedQueries queries={allRelated} onSearch={handleSearch} />
            </GlassCard>
          </motion.div>
        );
      })()}

      {/* Smart follow-up suggestions based on intent */}
      {result.answer && !followUpQuery && conversationHistory.length === 0 && (
        <motion.div variants={staggerItem}>
          <div className="flex flex-wrap gap-1.5">
            {(() => {
              const topic = (lastSearchQuery || query).slice(0, 30);
              const intentSuggestions: Record<string, string[]> = {
                comparison: [
                  `Qual tem melhor custo-benefício?`,
                  `Existe uma terceira opção?`,
                  `Compare para uso profissional vs pessoal`,
                ],
                howto: [
                  `Quais erros comuns evitar?`,
                  `Existe uma forma mais rápida?`,
                  `Preciso de alguma ferramenta específica?`,
                ],
                pricing: [
                  `Existe versão gratuita ou trial?`,
                  `Como economizar nessa compra?`,
                  `Quais as formas de pagamento?`,
                ],
                review: [
                  `Quais são os pontos fracos?`,
                  `O que os especialistas dizem?`,
                  `Existe alternativa mais barata?`,
                ],
                definition: [
                  `Dê exemplos práticos`,
                  `Qual a origem histórica?`,
                  `Como se aplica no dia a dia?`,
                ],
              };
              const defaults = [
                `Explique com mais detalhes sobre "${topic}..."`,
                `Quais são as alternativas?`,
                `Compare os prós e contras`,
              ];
              // Use searchIntent from parent if available
              const suggestions = (serpSearch?.result?.search_metadata as any)?.intent
                ? intentSuggestions[(serpSearch.result.search_metadata as any).intent] || defaults
                : defaults;
              return suggestions;
            })().map((suggestion, i) => (
              <button key={i} onClick={() => { handleSearch(suggestion, true); }}
                className="text-[11px] px-3 py-1.5 rounded-full bg-primary/5 hover:bg-primary/10 text-primary/70 hover:text-primary border border-primary/10 hover:border-primary/20 transition-all">
                {suggestion.length > 50 ? suggestion.slice(0, 47) + "..." : suggestion}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Follow-up question */}
      <motion.div variants={staggerItem}>
        <GlassCard size="auto">
          <div className="flex items-center gap-3">
            <MessageSquarePlus className="w-4 h-4 text-primary shrink-0" />
            <input type="text" value={followUpQuery} onChange={e => setFollowUpQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && followUpQuery.trim()) { handleSearch(followUpQuery.trim(), true); setFollowUpQuery(""); } }}
              placeholder="Fazer uma pergunta de acompanhamento..." className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              maxLength={500}
            />
            {conversationHistory.length > 0 && (
              <button onClick={() => { setConversationHistory([]); toast.success("Contexto da conversa limpo"); }} className="text-muted-foreground hover:text-foreground transition-colors" title="Limpar contexto da conversa">
                <Eraser className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => { if (followUpQuery.trim()) { handleSearch(followUpQuery.trim(), true); setFollowUpQuery(""); } }} disabled={!followUpQuery.trim()} className="text-primary hover:text-primary/80 disabled:opacity-30 transition-colors">
              <Search className="w-4 h-4" />
            </button>
          </div>
          {conversationHistory.length > 0 && (
            <div className="flex items-center gap-2 mt-2 ml-7">
              <Badge variant="secondary" className="text-[10px] px-2 py-0.5 gap-1">
                <MessageSquarePlus className="w-3 h-3" />
                {Math.floor(conversationHistory.length / 2)} pergunta{Math.floor(conversationHistory.length / 2) !== 1 ? "s" : ""} de acompanhamento
              </Badge>
            </div>
          )}
        </GlassCard>
      </motion.div>
    </motion.div>
  );
});

SearchResultsPanel.displayName = "SearchResultsPanel";

export default SearchResultsPanel;

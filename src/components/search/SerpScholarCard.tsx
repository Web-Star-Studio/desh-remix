import { GraduationCap, FileText, Users, Quote, ChevronDown, ChevronUp, Award } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";

interface ScholarResult {
  title: string;
  link: string;
  snippet: string;
  publication_info: string;
  authors: Array<{ name: string; link: string }>;
  cited_by: number;
  cited_by_link: string;
  related_link: string;
  versions_link: string;
  versions_total: number;
  resources: Array<{ title: string; file_format: string; link: string }>;
  year: string;
}

interface ScholarData {
  scholar_results: ScholarResult[];
  total_results: number;
  profiles: Array<{ name: string; link: string; affiliations: string; thumbnail: string }>;
}

interface Props {
  data: ScholarData;
}

const citationColor = (count: number) => {
  if (count >= 100) return "bg-amber-500/10 text-amber-500";
  if (count >= 10) return "bg-foreground/10 text-foreground/70";
  return "bg-foreground/5 text-muted-foreground";
};

const stagger = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

type SortKey = "relevance" | "citations" | "year";

const SerpScholarCard = ({ data }: Props) => {
  const { scholar_results, total_results, profiles } = data;
  const [showAll, setShowAll] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("relevance");

  if (!scholar_results.length) return null;

  // Stats
  const stats = useMemo(() => {
    const totalCitations = scholar_results.reduce((s, r) => s + (r.cited_by || 0), 0);
    const highImpact = scholar_results.filter(r => r.cited_by >= 100).length;
    const mostCited = scholar_results.reduce((best, r) => (r.cited_by || 0) > (best.cited_by || 0) ? r : best, scholar_results[0]);
    return { totalCitations, highImpact, mostCitedTitle: mostCited?.title, mostCitedCount: mostCited?.cited_by || 0 };
  }, [scholar_results]);

  const sorted = sortBy === "relevance"
    ? scholar_results
    : [...scholar_results].sort((a, b) => {
        if (sortBy === "citations") return (b.cited_by || 0) - (a.cited_by || 0);
        return (parseInt(b.year) || 0) - (parseInt(a.year) || 0);
      });

  const visible = showAll ? sorted : sorted.slice(0, 8);

  const sortOptions: Array<{ key: SortKey; label: string }> = [
    { key: "relevance", label: "Relevância" },
    { key: "citations", label: "Citações" },
    { key: "year", label: "Mais recente" },
  ];

  return (
    <motion.div variants={stagger} className="space-y-3">
      {/* Author Profiles */}
      {profiles.length > 0 && (
        <GlassCard size="auto">
          <div className="flex items-center gap-1.5 mb-2">
            <Users className="w-3.5 h-3.5 text-foreground/70" />
            <p className="widget-title">Pesquisadores</p>
          </div>
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
            {profiles.map((p, i) => (
              <a key={i} href={p.link} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-foreground/5 hover:bg-foreground/5 transition-colors shrink-0">
                {p.thumbnail ? (
                  <img src={p.thumbnail} alt={p.name} className="w-7 h-7 rounded-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-bold text-foreground">
                    {p.name[0]}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-foreground truncate max-w-[120px]">{p.name}</p>
                  {p.affiliations && <p className="text-[9px] text-muted-foreground truncate max-w-[120px]">{p.affiliations}</p>}
                </div>
              </a>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Results */}
      <GlassCard size="auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-foreground/70" />
            <p className="widget-title">Artigos Acadêmicos</p>
            {total_results > 0 && (
              <span className="text-[10px] text-muted-foreground">({total_results.toLocaleString()})</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {sortOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={`px-2 py-0.5 rounded-full text-[9px] font-medium transition-all ${
                  sortBy === opt.key ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-3 mb-3 px-2 py-1.5 rounded-lg bg-foreground/[0.03]">
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <FileText className="w-3 h-3" /> {scholar_results.length} artigos
          </span>
          {stats.totalCitations > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-foreground/70">
              <Quote className="w-3 h-3" /> {stats.totalCitations.toLocaleString()} citações
            </span>
          )}
          {stats.highImpact > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-500">
              <Award className="w-3 h-3" /> {stats.highImpact} alta influência
            </span>
          )}
        </div>

        <div className="space-y-0.5 max-h-[500px] overflow-y-auto scrollbar-thin pr-1">
          {visible.map((article, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="px-2 sm:px-3 py-2.5 rounded-xl hover:bg-foreground/[0.03] transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <a href={article.link} target="_blank" rel="noopener noreferrer"
                      className="text-xs sm:text-sm font-medium text-foreground hover:text-primary transition-colors line-clamp-2 leading-snug">
                      {article.title}
                    </a>
                    {article.cited_by >= 100 && (
                      <Badge variant="secondary" className="text-[7px] px-1 py-0 bg-amber-500/10 text-amber-500 border-0 shrink-0">Alta influência</Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{article.publication_info}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {article.resources.length > 0 && (
                    <a href={article.resources[0].link} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                      title={article.resources[0].file_format || "PDF"}>
                      <FileText className="w-3 h-3" />
                      {article.resources[0].file_format || "PDF"}
                    </a>
                  )}
                  {article.cited_by > 0 && (
                    <a href={article.cited_by_link} target="_blank" rel="noopener noreferrer"
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${citationColor(article.cited_by)} hover:opacity-80 transition-opacity`}
                      title={`Citado por ${article.cited_by}`}>
                      <Quote className="w-2.5 h-2.5" /> {article.cited_by}
                    </a>
                  )}
                </div>
              </div>
              {article.snippet && (
                <p className="text-[10px] text-foreground/50 mt-1 line-clamp-2">{article.snippet}</p>
              )}
              {article.authors.length > 0 && (
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {article.authors.slice(0, 4).map((a, j) => (
                    <a key={j} href={a.link} target="_blank" rel="noopener noreferrer"
                      className="text-[9px] text-primary/70 hover:text-primary hover:underline">
                      {a.name}
                    </a>
                  ))}
                  {article.year && <span className="text-[9px] text-muted-foreground/40">· {article.year}</span>}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {scholar_results.length > 8 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full flex items-center justify-center gap-1 text-[11px] text-primary hover:text-primary/80 mt-2 pt-2 border-t border-foreground/5"
          >
            {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showAll ? "Mostrar menos" : `Ver todos (${scholar_results.length})`}
          </button>
        )}
      </GlassCard>
    </motion.div>
  );
};

export default SerpScholarCard;

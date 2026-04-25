import { memo } from "react";
import { Newspaper, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import SourceReliabilityBadge from "./SourceReliabilityBadge";
import { motion } from "framer-motion";
import { useState, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface NewsItem {
  title: string;
  link: string;
  source: string;
  date: string;
  snippet?: string;
  thumbnail?: string;
}

interface Props {
  items: NewsItem[];
}

type SortKey = "relevance" | "date";

const relativeDate = (raw: string) => {
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return formatDistanceToNow(d, { addSuffix: true, locale: ptBR });
  } catch {
    return raw;
  }
};

const SerpNewsResults = memo(({ items }: Props) => {
  const [showAll, setShowAll] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("relevance");

  const sorted = useMemo(() => {
    if (!items.length) return [];
    if (sortBy === "date") {
      return [...items].sort((a, b) => {
        const da = new Date(a.date).getTime() || 0;
        const db = new Date(b.date).getTime() || 0;
        return db - da;
      });
    }
    return items;
  }, [items, sortBy]);

  if (!sorted.length) return null;

  const visible = showAll ? sorted : sorted.slice(0, 6);

  const sortOptions: Array<{ key: SortKey; label: string }> = [
    { key: "relevance", label: "Relevância" },
    { key: "date", label: "Mais recente" },
  ];

  return (
    <GlassCard size="auto">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-primary" />
          <p className="widget-title">Notícias ({items.length})</p>
        </div>
        <div className="flex items-center gap-1">
          {sortOptions.map(opt => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={`px-2 py-0.5 rounded-full text-[9px] font-medium transition-all ${
                sortBy === opt.key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-foreground/5"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1 max-h-[400px] overflow-y-auto scrollbar-thin pr-1">
        {visible.map((item, i) => (
          <motion.a
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-3 px-3 py-2.5 rounded-xl hover:bg-foreground/5 transition-colors group"
          >
            {item.thumbnail && (
              <img src={item.thumbnail} alt="" className="w-16 h-12 rounded-lg object-cover shrink-0 border border-foreground/5" loading="lazy" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">{item.title}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[10px] text-primary/60 font-medium">{item.source}</span>
                <SourceReliabilityBadge url={item.link} />
                <span className="text-[10px] text-muted-foreground/50">· {relativeDate(item.date)}</span>
              </div>
              {item.snippet && <p className="text-xs text-foreground/50 line-clamp-1 mt-0.5">{item.snippet}</p>}
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
          </motion.a>
        ))}
      </div>
      {items.length > 6 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full flex items-center justify-center gap-1 text-[11px] text-primary hover:text-primary/80 mt-2 pt-2 border-t border-foreground/5"
        >
          {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {showAll ? "Mostrar menos" : `Ver todas (${items.length})`}
        </button>
      )}
    </GlassCard>
  );
});

SerpNewsResults.displayName = "SerpNewsResults";

export default SerpNewsResults;

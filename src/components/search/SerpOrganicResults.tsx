import { memo } from "react";
import { Globe, ExternalLink, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import SourceReliabilityBadge from "./SourceReliabilityBadge";
import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface OrganicResult {
  position: number;
  title: string;
  link: string;
  snippet: string;
  displayed_link?: string;
  favicon?: string;
  date?: string;
}

interface Props {
  items: OrganicResult[];
}

const SerpOrganicResults = memo(({ items }: Props) => {
  const [showAll, setShowAll] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleCopyLink = useCallback((link: string, idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(link);
    setCopiedIdx(idx);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedIdx(null), 2000);
  }, []);

  if (!items.length) return null;

  const visible = showAll ? items : items.slice(0, 8);

  return (
    <GlassCard size="auto">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          <p className="widget-title">Resultados Web</p>
          <span className="text-[10px] text-muted-foreground">({items.length})</span>
        </div>
      </div>
      <div className="space-y-1 max-h-[500px] overflow-y-auto scrollbar-thin pr-1">
        {visible.map((item, i) => (
          <motion.a
            key={i}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-3 px-3 py-2.5 rounded-xl hover:bg-foreground/5 transition-colors group relative"
          >
            <div className="shrink-0 mt-0.5">
              {item.favicon ? (
                <img src={item.favicon} alt="" className="w-4 h-4 rounded" loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-4 h-4 rounded bg-primary/20 flex items-center justify-center text-[8px] font-bold text-primary">
                  {item.position}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                {item.title}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {item.displayed_link && (
                  <p className="text-[10px] text-primary/60 truncate">{item.displayed_link}</p>
                )}
                <SourceReliabilityBadge url={item.link} />
              </div>
              <p className="text-xs text-foreground/60 line-clamp-2 mt-0.5">{item.snippet}</p>
              {item.date && (
                <span className="text-[10px] text-muted-foreground/50 mt-0.5 inline-block">{item.date}</span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0 mt-1">
              <button
                onClick={(e) => handleCopyLink(item.link, i, e)}
                className="p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-foreground/10 hover:text-foreground transition-all"
                title="Copiar link"
              >
                {copiedIdx === i ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
              </button>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </motion.a>
        ))}
      </div>
      {items.length > 8 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full flex items-center justify-center gap-1 text-[11px] text-primary hover:text-primary/80 mt-2 pt-2 border-t border-foreground/5"
        >
          {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {showAll ? "Mostrar menos" : `Ver todos (${items.length})`}
        </button>
      )}
    </GlassCard>
  );
});

SerpOrganicResults.displayName = "SerpOrganicResults";

export default SerpOrganicResults;

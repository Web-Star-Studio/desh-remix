import { memo } from "react";
import { HelpCircle, ExternalLink, ChevronDown, Search, Sparkles } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

interface PAA {
  question: string;
  snippet?: string;
  link?: string;
}

interface Props {
  items: PAA[];
  onSearch?: (query: string) => void;
}

const SerpPeopleAlsoAsk = memo(({ items, onSearch }: Props) => {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (!items.length) return null;

  return (
    <GlassCard size="auto">
      <div className="flex items-center gap-2 mb-3">
        <HelpCircle className="w-4 h-4 text-primary" />
        <p className="widget-title">Pessoas também perguntam</p>
        <span className="text-[10px] text-muted-foreground">({items.length})</span>
      </div>
      <div className="space-y-1.5">
        {items.map((item, i) => {
          const isExpanded = expandedIdx === i;
          return (
            <div key={i} className={`rounded-xl border overflow-hidden transition-all ${
              isExpanded ? "border-primary/20 bg-primary/[0.02] shadow-sm" : "border-foreground/5 hover:border-foreground/10"
            }`}>
              <button
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                className="flex items-center justify-between w-full px-3.5 py-3 text-left text-sm text-foreground hover:bg-foreground/[0.03] transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Sparkles className={`w-3 h-3 shrink-0 transition-colors ${isExpanded ? "text-primary" : "text-muted-foreground/40"}`} />
                  <span className={`font-medium transition-colors ${isExpanded ? "text-primary" : ""}`}>{item.question}</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0 ml-2 ${isExpanded ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3.5 pb-3 pt-0 ml-5">
                      {item.snippet && (
                        <p className="text-xs text-foreground/70 leading-relaxed mb-2.5 border-l-2 border-primary/20 pl-3 py-1">{item.snippet}</p>
                      )}
                      <div className="flex items-center gap-3">
                        {item.link && (
                          <a href={item.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium">
                            <ExternalLink className="w-3 h-3" /> Ver fonte
                          </a>
                        )}
                        {onSearch && (
                          <button
                            onClick={() => onSearch(item.question)}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
                          >
                            <Search className="w-3 h-3" /> Pesquisar
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
});

SerpPeopleAlsoAsk.displayName = "SerpPeopleAlsoAsk";

export default SerpPeopleAlsoAsk;

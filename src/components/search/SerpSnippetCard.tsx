import { Sparkles, ExternalLink, Globe, ChevronDown, ChevronUp } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import { motion } from "framer-motion";
import { useState } from "react";

interface Props {
  featured_snippet?: {
    title: string;
    content: string;
    link: string;
  };
  answer_box?: {
    type: string;
    answer?: string;
    snippet?: string;
    title?: string;
    link?: string;
  };
  knowledge_graph?: {
    title: string;
    type?: string;
    description?: string;
    image?: string;
    attributes?: Record<string, string>;
    source?: { name: string; link: string };
  };
}

const stagger = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const SerpSnippetCard = ({ featured_snippet, answer_box, knowledge_graph }: Props) => {
  const [showAllAttrs, setShowAllAttrs] = useState(false);

  if (!featured_snippet && !answer_box && !knowledge_graph) return null;

  const attrEntries = knowledge_graph?.attributes ? Object.entries(knowledge_graph.attributes) : [];
  const visibleAttrs = showAllAttrs ? attrEntries : attrEntries.slice(0, 6);

  return (
    <motion.div variants={stagger} className="space-y-3">
      {/* Answer Box */}
      {answer_box?.answer && (
        <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-primary uppercase tracking-wider">Resposta Direta</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{answer_box.answer}</p>
          {answer_box.snippet && <p className="text-sm text-foreground/70 mt-1">{answer_box.snippet}</p>}
          {answer_box.link && (
            <a href={answer_box.link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-2 inline-flex items-center gap-1">
              Fonte <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* Featured Snippet */}
      {featured_snippet && !answer_box?.answer && (
        <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-primary uppercase tracking-wider">Snippet em Destaque</span>
          </div>
          <p className="text-sm font-medium text-foreground mb-1">{featured_snippet.title}</p>
          <p className="text-sm text-foreground/80 leading-relaxed">{featured_snippet.content}</p>
          <a href={featured_snippet.link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-2 inline-flex items-center gap-1">
            Ver fonte <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Knowledge Graph */}
      {knowledge_graph && (
        <GlassCard size="auto">
          <div className="flex gap-4">
            {knowledge_graph.image && (
              <img
                src={knowledge_graph.image}
                alt={knowledge_graph.title}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0 border border-foreground/5"
                loading="lazy"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-base sm:text-lg font-semibold text-foreground">{knowledge_graph.title}</p>
              {knowledge_graph.type && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{knowledge_graph.type}</span>
              )}
              {knowledge_graph.description && (
                <p className="text-xs sm:text-sm text-foreground/70 mt-1.5 leading-relaxed line-clamp-4">{knowledge_graph.description}</p>
              )}
              {knowledge_graph.source && (
                <a href={knowledge_graph.source.link} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline mt-2">
                  <Globe className="w-3 h-3" />
                  {knowledge_graph.source.name}
                </a>
              )}
            </div>
          </div>
          {attrEntries.length > 0 && (
            <div className="mt-3 pt-3 border-t border-foreground/5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                {visibleAttrs.map(([key, value]) => (
                  <div key={key} className="flex items-baseline gap-1.5 text-xs">
                    <span className="text-muted-foreground capitalize shrink-0">{key.replace(/_/g, " ")}:</span>
                    <span className="text-foreground truncate">{value}</span>
                  </div>
                ))}
              </div>
              {attrEntries.length > 6 && (
                <button
                  onClick={() => setShowAllAttrs(!showAllAttrs)}
                  className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 mt-2"
                >
                  {showAllAttrs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showAllAttrs ? "Mostrar menos" : `Ver todos (${attrEntries.length})`}
                </button>
              )}
            </div>
          )}
        </GlassCard>
      )}
    </motion.div>
  );
};

export default SerpSnippetCard;

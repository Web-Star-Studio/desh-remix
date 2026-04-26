import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, BookOpen, ChevronDown, ChevronUp, Volume2, VolumeX, Share2, Copy, Check, Maximize2, Minimize2 } from "lucide-react";
import { Streamdown } from "streamdown";
import GlassCard from "@/components/dashboard/GlassCard";
import { markdownComponents } from "./SearchMarkdownComponents";
import { staggerItem, getReadingTime } from "./searchConstants";
import { toast } from "sonner";

interface AnswerCardProps {
  answer: string;
  streaming: boolean;
  citations?: string[];
  onReadAloud?: () => void;
  isReading?: boolean;
  onShare?: () => void;
  exportButton?: React.ReactNode;
}

const AnswerCard = ({ answer, streaming, citations, onReadAloud, isReading, onShare, exportButton }: AnswerCardProps) => {
  const endRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const readingInfo = !streaming ? getReadingTime(answer) : null;

  useEffect(() => {
    if (streaming && endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [answer, streaming]);

  const handleCopy = () => {
    navigator.clipboard.writeText(answer);
    setCopied(true);
    toast.success("Resposta copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Citation rewriter — maps `[1]` `[2]` etc. in plain text to clickable
  // links pointing at the citation URLs. Streamdown handles rendering;
  // we just pre-process the markdown string before handing it over.
  const processedAnswer = citations?.length
    ? answer.replace(/\[(\d+)\]/g, (match, num: string) => {
        const idx = parseInt(num) - 1;
        const url = citations[idx];
        return url ? `[[${num}]](${url})` : match;
      })
    : answer;

  return (
    <motion.div variants={staggerItem}>
      <GlassCard size="auto">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="widget-title flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Resultado Detalhado
          </p>
          {!streaming && (
            <div className="flex items-center gap-1">
              {readingInfo && (
                <span className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground/60 mr-1">
                  <BookOpen className="w-3 h-3" /> {readingInfo.minutes} min · {readingInfo.words} palavras
                </span>
              )}
              <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all" title={collapsed ? "Expandir" : "Recolher"}>
                {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
              {onReadAloud && (
                <button onClick={onReadAloud} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all" title={isReading ? "Parar leitura" : "Ler em voz alta"}>
                  {isReading ? <VolumeX className="w-3.5 h-3.5 text-primary" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
              )}
              {onShare && (
                <button onClick={onShare} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all" title="Compartilhar">
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              )}
              {exportButton}
              <button onClick={handleCopy} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all" title={copied ? "Copiado" : "Copiar"}>
                {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>
        {readingInfo && (
          <div className="flex sm:hidden items-center gap-1 text-[10px] text-muted-foreground/60 mb-2 -mt-1">
            <BookOpen className="w-3 h-3" /> {readingInfo.minutes} min · {readingInfo.words} palavras
          </div>
        )}
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className={`${expanded ? "" : "min-h-[40vh] sm:min-h-[60vh] max-h-[80vh] overflow-y-auto"} scrollbar-thin pr-1`}>
                <Streamdown components={markdownComponents}>{processedAnswer}</Streamdown>
                {streaming && <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />}
                <div ref={endRef} />
              </div>
              {!streaming && (
                <div className="flex justify-center mt-3 pt-3 border-t border-foreground/5">
                  <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all"
                  >
                    {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    {expanded ? "Recolher conteúdo" : "Expandir conteúdo"}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {collapsed && (
          <p className="text-xs text-muted-foreground italic">Resposta recolhida — clique para expandir</p>
        )}
      </GlassCard>
    </motion.div>
  );
};

export default AnswerCard;

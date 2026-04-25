import { useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ListChecks, ChevronUp, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "./SearchMarkdownComponents";
import { staggerItem, FACT_COLORS } from "./searchConstants";

const KeyFactsCard = memo(({ facts }: { facts: string[] }) => {
  const [expanded, setExpanded] = useState(true);
  if (!facts.length) return null;
  return (
    <motion.div variants={staggerItem}>
      <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center justify-between w-full mb-2">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">Pontos-Chave</span>
          </div>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>
        <AnimatePresence>
          {expanded && (
            <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-1.5 overflow-hidden">
              {facts.map((fact, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 mt-0.5 ${FACT_COLORS[i % FACT_COLORS.length]}`}>{i + 1}</span>
                  <span className="leading-relaxed prose prose-sm dark:prose-invert max-w-none [&_strong]:text-foreground [&_p]:m-0 [&_p]:inline">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{fact}</ReactMarkdown>
                  </span>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

KeyFactsCard.displayName = "KeyFactsCard";

export default KeyFactsCard;

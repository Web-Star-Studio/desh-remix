import { memo } from "react";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "./SearchMarkdownComponents";
import { staggerItem } from "./searchConstants";

const TldrCard = memo(({ tldr }: { tldr: string }) => {
  if (!tldr) return null;
  return (
    <motion.div variants={staggerItem}>
      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-primary uppercase tracking-wider">Resumo Rápido</span>
        </div>
        <div className="text-sm text-foreground/90 leading-relaxed prose prose-sm dark:prose-invert max-w-none [&_strong]:text-foreground [&_p]:m-0 [&_p]:leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{tldr}</ReactMarkdown>
        </div>
      </div>
    </motion.div>
  );
});

TldrCard.displayName = "TldrCard";

export default TldrCard;

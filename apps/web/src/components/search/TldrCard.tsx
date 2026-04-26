import { memo } from "react";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { Streamdown } from "streamdown";
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
        <div className="text-sm">
          <Streamdown components={markdownComponents}>{tldr}</Streamdown>
        </div>
      </div>
    </motion.div>
  );
});

TldrCard.displayName = "TldrCard";

export default TldrCard;

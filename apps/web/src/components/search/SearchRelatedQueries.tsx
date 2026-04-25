import { Search, TrendingUp, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface SearchRelatedQueriesProps {
  queries: string[];
  onSearch: (query: string) => void;
}

const SearchRelatedQueries = ({ queries, onSearch }: SearchRelatedQueriesProps) => {
  if (!queries.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {queries.map((q, i) => (
        <motion.button
          key={i}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.03, duration: 0.2 }}
          onClick={() => onSearch(q)}
          className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-foreground/[0.04] hover:bg-primary/10 text-foreground/70 hover:text-primary transition-all border border-foreground/5 hover:border-primary/20 hover:shadow-sm"
        >
          <Search className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="truncate max-w-[200px]">{q}</span>
        </motion.button>
      ))}
    </div>
  );
};

export default SearchRelatedQueries;

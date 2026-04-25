/**
 * ChatSearchBar — In-chat search with match count, navigation (up/down), and highlight index.
 */
import { memo, useState, useEffect, useCallback } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";

interface ChatSearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  totalMatches: number;
  currentMatchIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export const ChatSearchBar = memo(function ChatSearchBar({
  query, onQueryChange, totalMatches, currentMatchIndex, onNext, onPrev, onClose,
}: ChatSearchBarProps) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="overflow-hidden border-b border-foreground/5"
    >
      <div className="p-2 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar nesta conversa..."
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.shiftKey ? onPrev() : onNext();
              }
              if (e.key === "Escape") onClose();
            }}
            className="w-full bg-foreground/5 rounded-lg pl-7 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none"
            autoFocus
          />
        </div>
        {query && (
          <>
            <span className="text-[10px] text-muted-foreground flex-shrink-0 tabular-nums min-w-[60px] text-center">
              {totalMatches > 0 ? `${currentMatchIndex + 1} / ${totalMatches}` : "0 resultados"}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={onPrev}
                disabled={totalMatches === 0}
                className="p-1 rounded hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onNext}
                disabled={totalMatches === 0}
                className="p-1 rounded hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
});

/** Highlight matching text within a message */
export function highlightText(text: string, query: string, isActiveMatch: boolean): React.ReactNode {
  if (!query || query.length < 2) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark
        key={i}
        className={`rounded-sm px-0.5 ${isActiveMatch ? "bg-primary/60 text-primary-foreground" : "bg-yellow-400/40 text-inherit"}`}
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

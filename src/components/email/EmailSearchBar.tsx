import { Search, Brain, Sparkles, MailOpen, X, Loader2 } from "lucide-react";
import { AI_CATEGORY_STYLES } from "./types";

interface EmailSearchBarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  aiSmartSearch: string;
  setAiSmartSearch: (q: string) => void;
  smartSearchLoading: boolean;
  onSmartSearch: () => Promise<string | null>;
  availableAiCategories: Array<{ cat: string; count: number; unreadCount: number }>;
  filterAiCategory: string | null;
  setFilterAiCategory: (cat: string | null) => void;
  filterRequiresAction: boolean;
  setFilterRequiresAction: (v: boolean | ((prev: boolean) => boolean)) => void;
  filterUnread: boolean;
  setFilterUnread: (v: boolean | ((prev: boolean) => boolean)) => void;
  folderActionCount: number;
  hasActiveFilter: boolean;
  clearAllFilters: () => void;
}

const EmailSearchBar = ({
  searchQuery, setSearchQuery, aiSmartSearch, setAiSmartSearch,
  smartSearchLoading, onSmartSearch, availableAiCategories,
  filterAiCategory, setFilterAiCategory, filterRequiresAction, setFilterRequiresAction,
  filterUnread, setFilterUnread, folderActionCount, hasActiveFilter, clearAllFilters,
}: EmailSearchBarProps) => {
  return (
    <div className="p-3 border-b border-foreground/5 space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input type="text" placeholder="Buscar e-mails..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          className="w-full bg-foreground/5 rounded-lg pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
      </div>
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Brain className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary/50" />
          <input type="text" placeholder="Busca inteligente com IA..."
            value={aiSmartSearch} onChange={e => setAiSmartSearch(e.target.value)}
            onKeyDown={async e => { if (e.key === "Enter") { const q = await onSmartSearch(); if (q) setSearchQuery(q); } }}
            className="w-full bg-primary/5 border border-primary/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none" />
        </div>
        <button onClick={async () => { const q = await onSmartSearch(); if (q) setSearchQuery(q); }}
          disabled={smartSearchLoading || !aiSmartSearch.trim()}
          className="px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-xs hover:bg-primary/20 transition-colors disabled:opacity-50">
          {smartSearchLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
        </button>
      </div>
      {availableAiCategories.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
          <button onClick={() => setFilterRequiresAction(v => !v)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all shrink-0 min-h-[44px] ${
              filterRequiresAction ? "bg-orange-500/15 text-orange-400 border-orange-500/30" : "bg-foreground/5 text-foreground/55 border-foreground/10 hover:bg-orange-500/10 hover:text-orange-400"
            }`}>
            <span>⚡</span> Ações necessárias
          </button>
          <button onClick={() => setFilterUnread(v => !v)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all shrink-0 min-h-[44px] ${
              filterUnread ? "bg-primary/15 text-primary border-primary/30" : "bg-foreground/5 text-foreground/55 border-foreground/10 hover:bg-primary/10"
            }`}>
            <MailOpen className="w-3 h-3" /> Não lidos
          </button>
          {availableAiCategories.map(({ cat, count, unreadCount }) => {
            const style = AI_CATEGORY_STYLES[cat];
            if (!style) return null;
            return (
              <button key={cat} onClick={() => setFilterAiCategory(filterAiCategory === cat ? null : cat)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all shrink-0 min-h-[44px] ${
                  filterAiCategory === cat ? `${style.badge} ring-1 ring-current/20` : `bg-foreground/5 text-foreground/55 border-foreground/10`
                }`}>
                {style.label}
                {unreadCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
              </button>
            );
          })}
          {hasActiveFilter && (
            <button onClick={clearAllFilters} className="px-2.5 py-1.5 rounded-full text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 min-h-[44px]"><X className="w-3 h-3" /></button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmailSearchBar;

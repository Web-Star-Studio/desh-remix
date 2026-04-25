import { Search, ArrowDownAZ, ArrowDown01 } from "lucide-react";
import { CleanerGroup } from "../InboxCleanerPanel";

export type ActionFilter = "all" | "trash" | "archive";
export type TypeFilter = "all" | "newsletter" | "other";
export type SortBy = "count" | "name";

interface CleanerFiltersProps {
  groups: CleanerGroup[];
  actionFilter: ActionFilter;
  typeFilter: TypeFilter;
  searchQuery: string;
  sortBy: SortBy;
  onActionFilterChange: (f: ActionFilter) => void;
  onTypeFilterChange: (f: TypeFilter) => void;
  onSearchChange: (q: string) => void;
  onSortChange: (s: SortBy) => void;
}

const CleanerFilters = ({
  groups, actionFilter, typeFilter, searchQuery, sortBy,
  onActionFilterChange, onTypeFilterChange, onSearchChange, onSortChange,
}: CleanerFiltersProps) => {
  const trashCount = groups.filter(g => g.action === "trash").length;
  const archiveCount = groups.filter(g => g.action === "archive").length;
  const newsletterCount = groups.filter(g => g.isNewsletter).length;
  const otherCount = groups.length - newsletterCount;

  const pillClass = (active: boolean) =>
    `px-2 py-1 rounded-md text-[10px] font-medium transition-colors whitespace-nowrap ${
      active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
    }`;

  return (
    <div className="space-y-2 mb-3">
      {/* Action + Type filters row */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Action filters */}
        <div className="flex items-center rounded-lg bg-foreground/5 border border-foreground/10 p-0.5">
          <button onClick={() => onActionFilterChange("all")} className={pillClass(actionFilter === "all")}>
            Todos ({groups.length})
          </button>
          <button onClick={() => onActionFilterChange("trash")} className={pillClass(actionFilter === "trash")}>
            🗑️ Excluir ({trashCount})
          </button>
          <button onClick={() => onActionFilterChange("archive")} className={pillClass(actionFilter === "archive")}>
            📦 Arquivar ({archiveCount})
          </button>
        </div>

        {/* Type filters */}
        <div className="flex items-center rounded-lg bg-foreground/5 border border-foreground/10 p-0.5">
          <button onClick={() => onTypeFilterChange("all")} className={pillClass(typeFilter === "all")}>
            Todos
          </button>
          <button onClick={() => onTypeFilterChange("newsletter")} className={pillClass(typeFilter === "newsletter")}>
            📰 News ({newsletterCount})
          </button>
          <button onClick={() => onTypeFilterChange("other")} className={pillClass(typeFilter === "other")}>
            Outros ({otherCount})
          </button>
        </div>

        {/* Sort toggle */}
        <button
          onClick={() => onSortChange(sortBy === "count" ? "name" : "count")}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors border border-foreground/10"
          title={sortBy === "count" ? "Ordenar por nome" : "Ordenar por quantidade"}
        >
          {sortBy === "count" ? <ArrowDown01 className="w-3 h-3" /> : <ArrowDownAZ className="w-3 h-3" />}
          {sortBy === "count" ? "Qtd" : "A-Z"}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Buscar remetente..."
          className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-foreground/5 border border-foreground/10 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
      </div>
    </div>
  );
};

export default CleanerFilters;

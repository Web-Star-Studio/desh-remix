import { memo } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { EVENT_CATEGORY_COLORS, EVENT_CATEGORY_LABELS, type EventCategory } from "@/contexts/DashboardContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CATEGORIES: EventCategory[] = ["trabalho", "pessoal", "saúde", "educação", "lazer", "outro"];

interface CalendarFiltersBarProps {
  calView: "month" | "week";
  setCalView: (v: "month" | "week") => void;
  filterCategory: EventCategory | "all";
  setFilterCategory: (c: EventCategory | "all") => void;
  filterPending: boolean;
  setFilterPending: (fn: (prev: boolean) => boolean) => void;
  pendingCount: number;
  aiLoading: string | null;
  onAiSummary: (action: "daily_summary" | "weekly_summary") => void;
}

const CalendarFiltersBar = ({
  calView, setCalView, filterCategory, setFilterCategory,
  filterPending, setFilterPending, pendingCount,
  aiLoading, onAiSummary,
}: CalendarFiltersBarProps) => {
  return (
    <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-none max-sm:flex-wrap max-sm:gap-1 no-scrollbar">
      {/* View toggle */}
      <div className="flex items-center gap-0.5 p-0.5 bg-muted/50 rounded-xl mr-2">
        <button
          onClick={() => setCalView("month")}
          className={`px-2.5 py-1.5 sm:py-1 rounded-lg text-xs font-medium transition-all min-h-[44px] sm:min-h-0 ${calView === "month" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Mês
        </button>
        <button
          onClick={() => setCalView("week")}
          className={`px-2.5 py-1.5 sm:py-1 rounded-lg text-xs font-medium transition-all min-h-[44px] sm:min-h-0 ${calView === "week" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Semana
        </button>
      </div>

      {/* Category filters */}
      <button
        onClick={() => { setFilterCategory("all"); setFilterPending(() => false); }}
        className={`px-2.5 py-1.5 sm:py-1 rounded-full text-xs font-medium transition-colors min-h-[44px] sm:min-h-0 ${filterCategory === "all" && !filterPending ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground hover:text-foreground"}`}>
        Todos
      </button>
      <button
        onClick={() => { setFilterPending(p => !p); setFilterCategory("all"); }}
        className={`px-2.5 py-1.5 sm:py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 min-h-[44px] sm:min-h-0 ${filterPending ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-muted/50 text-muted-foreground hover:text-foreground"}`}>
        Pendentes
        {pendingCount > 0 && (
          <span className={`px-1.5 rounded-full text-xs font-bold ${filterPending ? "bg-amber-500/30 text-amber-300" : "bg-amber-500/20 text-amber-400"}`}>
            {pendingCount}
          </span>
        )}
      </button>
      {CATEGORIES.map(cat => (
        <button key={cat} onClick={() => { setFilterCategory(cat); setFilterPending(() => false); }}
          className={`px-2.5 py-1.5 sm:py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 min-h-[44px] sm:min-h-0 ${filterCategory === cat && !filterPending ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground hover:text-foreground"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${EVENT_CATEGORY_COLORS[cat]}`} />
          {EVENT_CATEGORY_LABELS[cat]}
        </button>
      ))}

      {/* AI dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            disabled={!!aiLoading}
            className="ml-auto flex items-center gap-1 px-2.5 py-1.5 sm:py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50 min-h-[44px] sm:min-h-0"
          >
            {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            IA ✨
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onAiSummary("daily_summary")} className="text-xs gap-2">
            <Sparkles className="w-3 h-3 text-primary" />
            Resumo do dia
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAiSummary("weekly_summary")} className="text-xs gap-2">
            <Sparkles className="w-3 h-3 text-primary" />
            Resumo semanal
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default memo(CalendarFiltersBar);

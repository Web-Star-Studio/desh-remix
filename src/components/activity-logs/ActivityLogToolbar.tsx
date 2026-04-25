import { Search, Filter, ChevronDown, RefreshCw, Trash2, Download, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORY_CONFIG } from "./activityLogConstants";
import { exportToCsv } from "@/lib/exportCsv";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export type TimePeriod = "all" | "hour" | "today" | "week" | "month";

const TIME_OPTIONS: { value: TimePeriod; label: string }[] = [
  { value: "all", label: "Tudo" },
  { value: "hour", label: "Última hora" },
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mês" },
];

interface ActivityLog {
  id: string;
  action: string;
  category: string;
  details: Record<string, unknown>;
  created_at: string;
}

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  filterCategory: string;
  onFilterChange: (v: string) => void;
  timePeriod: TimePeriod;
  onTimePeriodChange: (v: TimePeriod) => void;
  categories: string[];
  onRefresh: () => void;
  onClearAll: () => void;
  logs: ActivityLog[];
  hasLogs: boolean;
}

const ActivityLogToolbar = ({
  search, onSearchChange, filterCategory, onFilterChange,
  timePeriod, onTimePeriodChange,
  categories, onRefresh, onClearAll, logs, hasLogs,
}: Props) => {

  const handleExportCsv = () => {
    const headers = ["Data/Hora", "Ação", "Categoria", "Detalhes"];
    const rows = logs.map(l => [
      format(new Date(l.created_at), "dd/MM/yyyy HH:mm:ss"),
      l.action,
      CATEGORY_CONFIG[l.category]?.label || l.category,
      JSON.stringify(l.details || {}),
    ]);
    exportToCsv("logs-atividade", headers, rows);
  };

  return (
    <div className="space-y-2 mb-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Buscar nos logs..."
            className="pl-9 rounded-xl bg-card/60 border-border/30 h-9 text-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <select
              value={filterCategory}
              onChange={e => onFilterChange(e.target.value)}
              className="pl-8 pr-6 h-9 rounded-xl bg-card/60 border border-border/30 text-sm text-foreground appearance-none cursor-pointer"
            >
              <option value="all">Todas categorias</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {CATEGORY_CONFIG[cat]?.label || cat}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
          <Button size="sm" variant="outline" className="rounded-xl h-9 px-3" onClick={onRefresh} title="Atualizar">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          {hasLogs && (
            <>
              <Button size="sm" variant="outline" className="rounded-xl h-9 px-3" onClick={handleExportCsv} title="Exportar CSV">
                <Download className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="destructive" className="rounded-xl h-9 px-3" onClick={onClearAll}>
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Limpar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Time period pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        {TIME_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onTimePeriodChange(opt.value)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-medium transition-all",
              timePeriod === opt.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ActivityLogToolbar;

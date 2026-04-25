import { Star, Trash2, FolderInput, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import type { SearchHistoryItem as HistoryItemType } from "@/hooks/search/useSearchHistory";

interface Props {
  item: HistoryItemType;
  onSelect: (item: HistoryItemType) => void;
  onToggleFavorite: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
  onMoveToProject?: (id: string) => void;
  active?: boolean;
}

const filterLabels: Record<string, string> = {
  web: "Web",
  news: "Notícias",
  academic: "Acadêmico",
  code: "Código",
  images: "Imagens",
};

export default function SearchHistoryItemCard({ item, onSelect, onToggleFavorite, onDelete, onMoveToProject, active }: Props) {
  const tldrPreview = item.tldr ? (item.tldr.length > 80 ? item.tldr.slice(0, 80) + "…" : item.tldr) : null;

  return (
    <div
      onClick={() => onSelect(item)}
      className={`group relative p-2.5 rounded-lg cursor-pointer transition-all hover:bg-foreground/5 ${active ? "bg-primary/10 ring-1 ring-primary/20" : ""}`}
    >
      <div className="flex items-start gap-2">
        <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground truncate font-medium">{item.query}</p>
          {tldrPreview && (
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{tldrPreview}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] text-muted-foreground/60">
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
            </span>
            {item.filter !== "web" && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                {filterLabels[item.filter] || item.filter}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(item.id, item.favorited); }}
          className={`p-1 rounded-md transition-colors ${item.favorited ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-500"}`}
          title={item.favorited ? "Remover favorito" : "Favoritar"}
        >
          <Star className={`w-3 h-3 ${item.favorited ? "fill-current" : ""}`} />
        </button>
        {onMoveToProject && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveToProject(item.id); }}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
            title="Mover para projeto"
          >
            <FolderInput className="w-3 h-3" />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
          className="p-1 rounded-md text-muted-foreground hover:text-destructive transition-colors"
          title="Excluir"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

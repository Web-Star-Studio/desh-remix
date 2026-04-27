import React, { useMemo, useState, useRef, useCallback } from "react";
import { Eye, EyeOff, X, GripVertical, Search } from "lucide-react";
import type { WidgetConfig } from "@/hooks/ui/useWidgetLayout";

interface WidgetManagerProps {
  widgets: WidgetConfig[];
  validWidgetIds: Set<string>;
  onToggle: (id: string) => void;
  onMoveById: (fromId: string, toId: string) => void;
  onClose: () => void;
}

const WidgetManager = ({ widgets, validWidgetIds, onToggle, onMoveById, onClose }: WidgetManagerProps) => {
  const [dragId, setDragId] = useState<string | null>(null);
  const dragOverId = useRef<string | null>(null);
  const [search, setSearch] = useState("");

  const handleDragEnd = useCallback(() => {
    setDragId(null);
    dragOverId.current = null;
  }, []);

  const validWidgets = useMemo(
    () => widgets.filter((w) => validWidgetIds.has(w.id)),
    [widgets, validWidgetIds],
  );

  const filtered = useMemo(
    () =>
      search
        ? validWidgets.filter((w) => w.label.toLowerCase().includes(search.toLowerCase()))
        : validWidgets,
    [validWidgets, search],
  );

  const visibleCount = useMemo(() => validWidgets.filter((w) => w.visible).length, [validWidgets]);
  const totalCount = validWidgets.length;

  return (
    <div className="p-3">
      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-foreground/5">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">Gerenciar widgets</p>
          <span className="text-[10px] text-muted-foreground/60 bg-foreground/5 px-2 py-0.5 rounded-full shrink-0 tabular-nums">
            {visibleCount}/{totalCount}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="focusable rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors shrink-0"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {totalCount > 4 && (
        <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-xl bg-foreground/[0.04] border border-foreground/5">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar…"
            className="flex-1 min-w-0 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded"
              aria-label="Limpar filtro"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      <div className="max-h-[min(22rem,55vh)] overflow-y-auto scrollbar-thin space-y-1">
        {filtered.map((w) => (
          <div
            key={w.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", w.id);
              setDragId(w.id);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              dragOverId.current = w.id;
            }}
            onDrop={(e) => {
              e.preventDefault();
              const src = e.dataTransfer.getData("text/plain");
              if (src && src !== w.id) onMoveById(src, w.id);
              setDragId(null);
              dragOverId.current = null;
            }}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-2 px-2 py-2 rounded-xl text-xs transition-colors cursor-grab active:cursor-grabbing touch-target ${
              w.visible
                ? "bg-foreground/[0.05] text-foreground"
                : "bg-foreground/[0.02] text-muted-foreground"
            } ${dragId === w.id ? "opacity-50" : ""}`}
          >
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
            <button
              type="button"
              onClick={() => onToggle(w.id)}
              className="focusable hover:opacity-80 transition-opacity shrink-0"
              aria-label={w.visible ? "Ocultar widget" : "Mostrar widget"}
            >
              {w.visible ? (
                <Eye className="w-3.5 h-3.5 text-primary" />
              ) : (
                <EyeOff className="w-3.5 h-3.5" />
              )}
            </button>
            <span className="flex-1 truncate font-medium text-left">{w.label}</span>
            {w.id === "health" && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold shrink-0">
                Em breve
              </span>
            )}
          </div>
        ))}
      </div>

      {search && filtered.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-3">Nenhum widget encontrado</p>
      )}
    </div>
  );
};

export default React.memo(WidgetManager);

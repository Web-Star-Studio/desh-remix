import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, X, GripVertical, Search } from "lucide-react";
import { useState, useRef, useCallback } from "react";
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
    () => widgets.filter(w => validWidgetIds.has(w.id)),
    [widgets, validWidgetIds]
  );

  const filtered = useMemo(
    () => search ? validWidgets.filter(w => w.label.toLowerCase().includes(search.toLowerCase())) : validWidgets,
    [validWidgets, search]
  );

  const visibleCount = useMemo(() => validWidgets.filter(w => w.visible).length, [validWidgets]);
  const totalCount = validWidgets.length;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="overflow-hidden"
    >
      <div className="glass-card p-4 mt-3 sm:mt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">Gerenciar Widgets</p>
            <span className="text-[10px] text-muted-foreground">{visibleCount}/{totalCount} ativos</span>
          </div>
          <button onClick={onClose} className="focusable text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search filter */}
        {totalCount > 8 && (
          <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg bg-foreground/5">
            <Search className="w-3 h-3 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filtrar widgets..."
              className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
          {filtered.map((w) => (
            <div
              key={w.id}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData("text/plain", w.id); setDragId(w.id); }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; dragOverId.current = w.id; }}
              onDrop={(e) => { e.preventDefault(); const src = e.dataTransfer.getData("text/plain"); if (src && src !== w.id) onMoveById(src, w.id); setDragId(null); dragOverId.current = null; }}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs transition-all cursor-grab active:cursor-grabbing touch-target ${
                w.visible ? "bg-primary/10 text-foreground" : "bg-foreground/5 text-muted-foreground"
              } ${dragId === w.id ? "opacity-40 scale-95" : ""}`}
            >
              <GripVertical className="w-3 h-3 text-muted-foreground/40 shrink-0" />
              <button onClick={() => onToggle(w.id)} className="focusable hover:scale-110 transition-transform shrink-0">
                {w.visible ? <Eye className="w-3.5 h-3.5 text-primary" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
              <span className="flex-1 truncate font-medium">{w.label}</span>
              {w.id === "health" && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold shrink-0">Em Breve</span>
              )}
            </div>
          ))}
        </div>

        {search && filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">Nenhum widget encontrado</p>
        )}
      </div>
    </motion.div>
  );
};

export default React.memo(WidgetManager);

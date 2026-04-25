import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, CheckCircle2, ArrowRight, Star, X } from "lucide-react";
import DeshTooltip from "@/components/ui/DeshTooltip";
import type { DbTask } from "@/types/tasks";

interface TaskBulkBarProps {
  count: number;
  onBatchStatus: (status: DbTask["status"]) => void;
  onBatchPriority: (priority: DbTask["priority"]) => void;
  onBatchDelete: () => void;
  onSelectAll: () => void;
  onClear: () => void;
  totalCount: number;
}

const TaskBulkBar = memo(({ count, onBatchStatus, onBatchPriority, onBatchDelete, onSelectAll, onClear, totalCount }: TaskBulkBarProps) => {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-background/95 backdrop-blur-xl border border-foreground/10 rounded-2xl shadow-2xl px-4 py-2.5"
        >
          <span className="text-sm font-medium text-foreground mr-1">{count} selecionada{count > 1 ? "s" : ""}</span>

          {count < totalCount && (
            <button onClick={onSelectAll} className="text-[10px] text-primary hover:underline mr-1">Selecionar todas</button>
          )}

          <div className="w-px h-5 bg-foreground/10" />

          <DeshTooltip label="Concluir">
            <button onClick={() => onBatchStatus("done")} className="p-1.5 rounded-lg text-muted-foreground hover:text-green-400 hover:bg-green-400/10 transition-colors">
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </DeshTooltip>
          <DeshTooltip label="Em andamento">
            <button onClick={() => onBatchStatus("in_progress")} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
              <ArrowRight className="w-4 h-4" />
            </button>
          </DeshTooltip>

          <div className="w-px h-5 bg-foreground/10" />

          <DeshTooltip label="Prioridade alta">
            <button onClick={() => onBatchPriority("high")} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors">
              <Star className="w-4 h-4" />
            </button>
          </DeshTooltip>

          <div className="w-px h-5 bg-foreground/10" />

          <DeshTooltip label="Excluir selecionadas">
            <button onClick={onBatchDelete} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </DeshTooltip>

          <div className="w-px h-5 bg-foreground/10" />

          <DeshTooltip label="Limpar seleção">
            <button onClick={onClear} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </DeshTooltip>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

TaskBulkBar.displayName = "TaskBulkBar";
export default TaskBulkBar;

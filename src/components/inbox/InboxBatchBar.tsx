import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCheck, Timer, Trash2, ChevronDown, X, Archive } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

interface InboxBatchBarProps {
  selectedCount: number;
  totalCount: number;
  hasTaskSelected: boolean;
  onBatchComplete: () => void;
  onBatchSnooze: (minutes: number) => void;
  onBatchDismiss: () => void;
  onSelectAll: () => void;
  onClear: () => void;
}

const SNOOZE_OPTIONS = [
  { label: "15 min", minutes: 15 },
  { label: "1 hora", minutes: 60 },
  { label: "3 horas", minutes: 180 },
  { label: "Amanhã", minutes: 1440 },
];

const InboxBatchBar = ({
  selectedCount, totalCount, hasTaskSelected,
  onBatchComplete, onBatchSnooze, onBatchDismiss, onSelectAll, onClear,
}: InboxBatchBarProps) => {
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);

  if (selectedCount === 0) return null;

  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="mb-4"
    >
      <div className="glass-card rounded-xl px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3 border border-primary/20">
        <span className="text-xs font-medium text-primary whitespace-nowrap">
          {allSelected ? "Todos" : selectedCount} selecionado(s)
        </span>

        <div className="flex items-center gap-1 sm:gap-1.5 ml-auto flex-wrap">
          {/* Complete tasks */}
          {hasTaskSelected && (
            <button
              onClick={onBatchComplete}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Concluir</span>
            </button>
          )}

          {/* Snooze with dropdown */}
          <Popover open={showSnoozeMenu} onOpenChange={setShowSnoozeMenu}>
            <PopoverTrigger asChild>
              <button
                onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
              >
                <Timer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Adiar</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={4}
              className="w-auto min-w-[110px] p-1.5 rounded-xl border border-foreground/10 bg-background/95 backdrop-blur-xl shadow-xl"
            >
              {SNOOZE_OPTIONS.map(opt => (
                <button
                  key={opt.minutes}
                  onClick={() => { onBatchSnooze(opt.minutes); setShowSnoozeMenu(false); }}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-[11px] text-foreground hover:bg-foreground/5 transition-colors"
                >
                  {opt.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Dismiss/Archive */}
          <button
            onClick={onBatchDismiss}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
            title="Arquivar / descartar itens selecionados"
          >
            <Archive className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Arquivar</span>
          </button>

          {/* Divider */}
          <div className="w-px h-4 bg-foreground/10 mx-0.5" />

          {/* Select all / clear */}
          <button
            onClick={allSelected ? onClear : onSelectAll}
            className="px-2 sm:px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
          >
            {allSelected ? "Desmarcar" : "Todos"}
          </button>
          <button
            onClick={onClear}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
            title="Limpar seleção"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default InboxBatchBar;

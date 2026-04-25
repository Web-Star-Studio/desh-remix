import { Archive, BellOff, Eye, Pin, Trash2, X, CheckSquare } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import { motion } from "framer-motion";

interface ConversationBatchBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onPin: () => void;
  onMute: () => void;
  onArchive: () => void;
  onMarkRead: () => void;
  onDelete: () => void;
  onClear: () => void;
}

const ConversationBatchBar = ({
  selectedCount, totalCount, onSelectAll, onPin, onMute, onArchive, onMarkRead, onDelete, onClear,
}: ConversationBatchBarProps) => (
  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
    <GlassCard size="auto" className="mb-1 mx-2 mt-2 py-1.5 px-2.5">
      <div className="flex items-center gap-1.5">
        <button onClick={onClear} className="p-0.5 rounded hover:bg-foreground/10 text-muted-foreground transition-colors flex-shrink-0">
          <X className="w-3 h-3" />
        </button>
        <span className="text-[10px] text-foreground font-medium flex-shrink-0">{selectedCount} sel.</span>
        <div className="flex items-center gap-1 ml-auto flex-shrink-0">
          <button onClick={onSelectAll} className="px-1.5 py-0.5 rounded text-[10px] bg-foreground/5 text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors">
            <CheckSquare className="w-2.5 h-2.5 inline mr-0.5" />
            {selectedCount === totalCount ? "Nenhum" : "Todos"}
          </button>
          <button onClick={onPin} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-foreground/5 text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors">
            <Pin className="w-2.5 h-2.5" /> Fixar
          </button>
          <button onClick={onMute} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-foreground/5 text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors">
            <BellOff className="w-2.5 h-2.5" /> Silenciar
          </button>
          <button onClick={onArchive} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-foreground/5 text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors">
            <Archive className="w-2.5 h-2.5" /> Arquivar
          </button>
          <button onClick={onMarkRead} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-foreground/5 text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors">
            <Eye className="w-2.5 h-2.5" /> Lida
          </button>
          <button onClick={onDelete} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
            <Trash2 className="w-2.5 h-2.5" /> Excluir
          </button>
        </div>
      </div>
    </GlassCard>
  </motion.div>
);

export default ConversationBatchBar;

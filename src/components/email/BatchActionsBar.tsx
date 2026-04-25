import { Archive, CheckSquare, ChevronDown, Eye, EyeOff, FolderInput, Loader2, MailX, Star, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { motion } from "framer-motion";
import { LabelColor, LABEL_DOT } from "./types";

interface BatchActionsBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onMarkRead: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onMarkUnread: () => void;
  onStar: () => void;
  onUnsubscribeAndDelete?: () => void;
  onMoveToLabel?: (labelId: string, labelName: string) => void;
  gmailConnected: boolean;
  gmailLabels: Array<{ id: string; gmailId: string; name: string; color: LabelColor }>;
  /** Whether a batch operation is in progress */
  isProcessing?: boolean;
}

const BatchActionsBar = ({
  selectedCount, totalCount, onSelectAll, onMarkRead, onArchive, onDelete, onMarkUnread, onStar,
  onUnsubscribeAndDelete, onMoveToLabel, gmailConnected, gmailLabels, isProcessing,
}: BatchActionsBarProps) => (
  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
    className="mx-3 sm:mx-4 lg:mx-6 mb-1.5">
    <div className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-foreground/5 border border-foreground/10 backdrop-blur-sm ${isProcessing ? "opacity-70 pointer-events-none" : ""}`}>
      {isProcessing && <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />}
      <span className="text-xs text-foreground font-medium whitespace-nowrap">{selectedCount} sel.</span>
      <div className="w-px h-4 bg-foreground/10" />
      <div className="flex items-center gap-0.5 overflow-x-auto flex-nowrap scrollbar-hide">
        <button onClick={onSelectAll} className="shrink-0 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors flex items-center gap-1">
          <CheckSquare className="w-3 h-3" />
          <span className="hidden sm:inline">{selectedCount === totalCount ? "Desmarcar" : "Todos"}</span>
        </button>
        <button onClick={onMarkRead} className="shrink-0 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors flex items-center gap-1">
          <Eye className="w-3 h-3" />
          <span className="hidden sm:inline">Lido</span>
        </button>
        <button onClick={onArchive} className="shrink-0 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors flex items-center gap-1">
          <Archive className="w-3 h-3" />
          <span className="hidden sm:inline">Arquivar</span>
        </button>
        <button onClick={onDelete} className="shrink-0 px-2 py-1 rounded text-xs text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1">
          <Trash2 className="w-3 h-3" />
          <span className="hidden sm:inline">Excluir</span>
        </button>
        {gmailConnected && onUnsubscribeAndDelete && (
          <button onClick={onUnsubscribeAndDelete} className="shrink-0 px-2 py-1 rounded text-xs text-orange-400 hover:bg-orange-500/10 transition-colors flex items-center gap-1">
            <MailX className="w-3 h-3" />
            <span className="hidden sm:inline">Descadastrar</span>
          </button>
        )}
        <button onClick={onMarkUnread} className="shrink-0 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors flex items-center gap-1">
          <EyeOff className="w-3 h-3" />
          <span className="hidden sm:inline">Não lido</span>
        </button>
        <button onClick={onStar} className="shrink-0 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors flex items-center gap-1">
          <Star className="w-3 h-3" />
          <span className="hidden sm:inline">Favoritar</span>
        </button>
        {gmailConnected && gmailLabels.length > 0 && onMoveToLabel && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="shrink-0 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors flex items-center gap-1">
                <FolderInput className="w-3 h-3" />
                <span className="hidden sm:inline">Mover</span>
                <ChevronDown className="w-2.5 h-2.5 hidden sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {gmailLabels.map(gl => (
                <DropdownMenuItem key={gl.id} onClick={() => onMoveToLabel(gl.gmailId, gl.name)}>
                  <div className={`w-2 h-2 rounded-full ${LABEL_DOT[gl.color]} mr-2`} />
                  {gl.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  </motion.div>
);

export default BatchActionsBar;

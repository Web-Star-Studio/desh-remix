import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Hash, Plus, Star, Trash2, X } from "lucide-react";
import { DeshContextMenu } from "@/components/ui/DeshContextMenu";

interface NotebookSidebarProps {
  // Data
  notebooks: [string, number][];
  allTags: string[];
  activeNotesCount: number;
  trashedNotesCount: number;

  // Filter state
  filterNotebook: string;
  filterTag: string;
  filterFavorite: boolean;
  showTrash: boolean;

  // New notebook form
  showNewNotebook: boolean;
  newNotebookName: string;

  // Mobile overlay
  showNotebooks: boolean;

  // Callbacks
  onFilterNotebook: (v: string) => void;
  onFilterTag: (v: string) => void;
  onFilterFavorite: (v: boolean) => void;
  onShowTrash: (v: boolean) => void;
  onShowNewNotebook: (v: boolean) => void;
  onNewNotebookName: (v: string) => void;
  onShowNotebooks: (v: boolean) => void;
  onCreateNotebook: () => void;
  onDeleteNotebook: (nb: string) => void;
}

// ── Shared sidebar content ───────────────────────────────────────────────────
const SidebarContent = memo(({
  notebooks, allTags, activeNotesCount, trashedNotesCount,
  filterNotebook, filterTag, filterFavorite, showTrash,
  showNewNotebook, newNotebookName,
  onFilterNotebook, onFilterTag, onFilterFavorite,
  onShowTrash, onShowNewNotebook, onNewNotebookName,
  onCreateNotebook, onDeleteNotebook,
  onClose,
}: NotebookSidebarProps & { onClose?: () => void }) => (
  <>
    <div className="flex items-center justify-between mb-2">
      <p className="text-xs uppercase tracking-wider text-muted-foreground/70 px-2 font-medium">Cadernos</p>
      <div className="flex items-center gap-1">
        <button onClick={() => onShowNewNotebook(!showNewNotebook)} className="p-1.5 rounded-xl hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
          <Plus className="w-3.5 h-3.5" />
        </button>
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-muted/50 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>

    {showNewNotebook && (
      <div className="flex items-center gap-1 px-1 mb-1">
        <input
          autoFocus
          value={newNotebookName}
          onChange={e => onNewNotebookName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onCreateNotebook(); if (e.key === "Escape") { onShowNewNotebook(false); onNewNotebookName(""); } }}
          placeholder="Nome do caderno"
          className="flex-1 h-7 px-2 rounded-lg bg-muted/50 border border-border/30 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button onClick={onCreateNotebook} disabled={!newNotebookName.trim()} className="p-1 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    )}

    <button
      onClick={() => { onFilterNotebook("all"); onShowTrash(false); onClose?.(); }}
      className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors ${filterNotebook === "all" && !showTrash ? "bg-primary/15 text-primary font-medium" : "text-foreground/60 hover:text-foreground hover:bg-muted/50"}`}
    >
      <span className="flex items-center gap-2"><BookOpen className="w-3.5 h-3.5" /> Todas</span>
      <span className="text-xs bg-muted/50 px-1.5 py-0.5 rounded-full">{activeNotesCount}</span>
    </button>

    {notebooks.map(([nb, count]) => (
      <DeshContextMenu key={nb} actions={[
        { id: "delete-nb", label: "Excluir caderno", icon: Trash2, destructive: true, onClick: () => onDeleteNotebook(nb) },
      ]}>
        <button
          onClick={() => { onFilterNotebook(nb); onShowTrash(false); onClose?.(); }}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors ${filterNotebook === nb ? "bg-primary/15 text-primary font-medium" : "text-foreground/60 hover:text-foreground hover:bg-muted/50"}`}
        >
          <span className="flex items-center gap-2 truncate"><BookOpen className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">{nb}</span></span>
          <span className="text-xs bg-muted/50 px-1.5 py-0.5 rounded-full flex-shrink-0">{count}</span>
        </button>
      </DeshContextMenu>
    ))}

    {allTags.length > 0 && (
      <>
        <p className="text-xs uppercase tracking-wider text-muted-foreground/70 px-2 mt-4 mb-1 font-medium">Tags</p>
        {allTags.slice(0, 15).map(tag => (
          <button key={tag}
            onClick={() => { onFilterTag(filterTag === tag ? "all" : tag); onClose?.(); }}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs transition-colors ${filterTag === tag ? "bg-primary/15 text-primary font-medium" : "text-foreground/60 hover:text-foreground hover:bg-muted/50"}`}
          >
            <Hash className="w-3 h-3 flex-shrink-0" /><span className="truncate">{tag}</span>
          </button>
        ))}
      </>
    )}

    <div className="mt-auto pt-3 border-t border-border/30 space-y-1">
      <button onClick={() => { onFilterFavorite(!filterFavorite); onClose?.(); }}
        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs transition-colors ${filterFavorite ? "bg-yellow-500/15 text-yellow-500 font-medium" : "text-foreground/60 hover:text-foreground hover:bg-muted/50"}`}>
        <Star className="w-3.5 h-3.5" /> Favoritas
      </button>
      <button onClick={() => { onShowTrash(true); onFilterNotebook("all"); onFilterTag("all"); onFilterFavorite(false); onClose?.(); }}
        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors ${showTrash ? "bg-destructive/15 text-destructive font-medium" : "text-foreground/60 hover:text-foreground hover:bg-muted/50"}`}>
        <span className="flex items-center gap-2"><Trash2 className="w-3.5 h-3.5" /> Lixeira</span>
        {trashedNotesCount > 0 && <span className="text-xs bg-muted/50 px-1.5 py-0.5 rounded-full">{trashedNotesCount}</span>}
      </button>
    </div>
  </>
));

SidebarContent.displayName = "SidebarContent";

// ── Main component: renders both mobile overlay and desktop sidebar ──────────
const NotebookSidebar = memo((props: NotebookSidebarProps) => {
  const sidebarProps = { ...props, onClose: undefined as (() => void) | undefined };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {props.showNotebooks && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
              onClick={() => props.onShowNotebooks(false)}
            />
            <motion.aside
              initial={{ x: -280, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -280, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-3 top-20 bottom-24 z-50 w-64 glass-card overflow-y-auto p-3 gap-1 flex flex-col lg:hidden"
            >
              <SidebarContent {...props} onClose={() => props.onShowNotebooks(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 glass-card overflow-y-auto flex-shrink-0 p-3 gap-1">
        <SidebarContent {...props} />
      </aside>
    </>
  );
});

NotebookSidebar.displayName = "NotebookSidebar";

export default NotebookSidebar;

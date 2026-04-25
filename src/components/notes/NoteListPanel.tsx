import { useState, memo } from "react";
import { Note } from "@/contexts/DashboardContext";
import DeshTooltip from "@/components/ui/DeshTooltip";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import WorkspaceBadge from "@/components/dashboard/WorkspaceBadge";
import { DeshContextMenu, type DeshContextAction } from "@/components/ui/DeshContextMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { highlightMatch, getTextStats, getSnippet } from "@/lib/notesPageUtils";
import { NoteCardBadges, NoteRelativeTime, TaskProgressBar } from "@/components/notes/NoteCardBadges";
import { useNoteSearchHistory } from "@/hooks/notes/useNoteSearchHistory";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Pin, Trash2, X, Star, Eye, Copy, Download, Printer,
  ClipboardCopy, Filter, SortAsc, SortDesc, BookOpen, Clock,
  AlignLeft, StickyNote, Plus, CheckCheck, History
} from "lucide-react";

interface NoteListPanelProps {
  selectedId: string | null;
  sorted: Note[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  showFilters: boolean;
  setShowFilters: (v: boolean) => void;
  sortBy: "date" | "name";
  setSortBy: (v: "date" | "name") => void;
  sortDir: "asc" | "desc";
  setSortDir: (v: (d: "asc" | "desc") => "asc" | "desc") => void;
  activeFiltersCount: number;
  filterNotebook: string;
  setFilterNotebook: (v: string) => void;
  filterTag: string;
  setFilterTag: (v: string) => void;
  filterFavorite: boolean;
  setFilterFavorite: (v: boolean) => void;
  showNotebooks: boolean;
  setShowNotebooks: (v: boolean) => void;
  showTrash: boolean;
  setShowTrash: (v: boolean) => void;
  trashedNotes: Note[];
  bulkSelected: Set<string>;
  bulkMode: boolean;
  toggleBulkSelect: (id: string) => void;
  openNote: (note: Note) => void;
  handleDuplicateNote: (note: Note) => void;
  handleExportNote: (note: Note) => void;
  handlePrintNote: (note: Note) => void;
  togglePin: (id: string) => void;
  toggleFavorite: (id: string) => void;
  deleteNote: (id: string) => void;
  restoreNote: (id: string) => void;
  permanentlyDeleteNote: (id: string) => void;
  emptyTrash: () => void;
  setSelectedId: (v: string | null) => void;
  handleAddNote: () => void;
  confirm: (opts: any) => Promise<boolean>;
}

const NoteListPanel = memo(({
  selectedId, sorted, searchQuery, setSearchQuery,
  showFilters, setShowFilters, sortBy, setSortBy, sortDir, setSortDir,
  activeFiltersCount, filterNotebook, setFilterNotebook, filterTag, setFilterTag,
  filterFavorite, setFilterFavorite, showNotebooks, setShowNotebooks,
  showTrash, setShowTrash, trashedNotes, bulkSelected, bulkMode,
  toggleBulkSelect, openNote, handleDuplicateNote, handleExportNote,
  handlePrintNote, togglePin, toggleFavorite, deleteNote, restoreNote,
  permanentlyDeleteNote, emptyTrash, setSelectedId, handleAddNote, confirm,
}: NoteListPanelProps) => {
  const { history, addToHistory, clearHistory, removeFromHistory } = useNoteSearchHistory();
  const [showHistory, setShowHistory] = useState(false);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      addToHistory(searchQuery.trim());
      setShowHistory(false);
    }
    if (e.key === "Escape") {
      setSearchQuery("");
      setShowHistory(false);
    }
  };

  return (
    <div className={`flex flex-col transition-all duration-300 glass-card relative ${selectedId ? "hidden md:flex md:w-72 lg:w-80" : "flex-1"} min-h-0`}>
      {/* Search bar */}
      <div className="p-3 border-b border-border/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNotebooks(true)}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors lg:hidden"
            aria-label="Cadernos"
          >
            <BookOpen className="w-4 h-4" />
          </button>
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar notas..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => !searchQuery && history.length > 0 && setShowHistory(true)}
              onBlur={() => setTimeout(() => setShowHistory(false), 200)}
              onKeyDown={handleSearchKeyDown}
              className="pl-8 h-9 text-xs rounded-xl bg-muted/50 border-border/30"
            />
            {/* Search history dropdown */}
            <AnimatePresence>
              {showHistory && history.length > 0 && !searchQuery && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30">
                    <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                      <History className="w-3 h-3" /> Buscas recentes
                    </span>
                    <button onClick={clearHistory} className="text-[10px] text-muted-foreground hover:text-destructive transition-colors">Limpar</button>
                  </div>
                  {history.map(q => (
                    <div key={q} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors group">
                      <button
                        className="flex-1 text-left text-xs text-foreground/80 truncate"
                        onMouseDown={() => { setSearchQuery(q); setShowHistory(false); }}
                      >
                        {q}
                      </button>
                      <button
                        onMouseDown={() => removeFromHistory(q)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-all"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-xl transition-colors relative ${showFilters ? "bg-muted/70 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
            aria-label="Filtros"
          >
            <Filter className="w-3.5 h-3.5" />
            {activeFiltersCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground rounded-full text-xs flex items-center justify-center font-medium">{activeFiltersCount}</span>}
          </button>
          <button onClick={() => { setSortDir(d => d === "asc" ? "desc" : "asc"); }} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" aria-label="Ordenação">
            {sortDir === "asc" ? <SortAsc className="w-3.5 h-3.5" /> : <SortDesc className="w-3.5 h-3.5" />}
          </button>
        </div>
        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="flex flex-wrap gap-1.5 mt-2">
                <button onClick={() => setSortBy("date")} className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${sortBy === "date" ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground hover:text-foreground"}`}>Data</button>
                <button onClick={() => setSortBy("name")} className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${sortBy === "name" ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground hover:text-foreground"}`}>Nome</button>
                {activeFiltersCount > 0 && (
                  <button onClick={() => { setFilterNotebook("all"); setFilterTag("all"); setFilterFavorite(false); }}
                    className="px-2.5 py-1 rounded-full text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors">Limpar</button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {showTrash ? (
          <>
            {trashedNotes.length > 0 && (
              <div className="flex items-center justify-between px-2 py-2 mb-1">
                <span className="text-xs text-muted-foreground">Notas excluídas são removidas após 30 dias</span>
                <Button
                  size="sm"
                  variant="destructive"
                  className="rounded-xl text-xs h-7 px-2.5"
                  onClick={async () => {
                    const ok = await confirm({ title: "Esvaziar lixeira?", description: `${trashedNotes.length} nota${trashedNotes.length > 1 ? "s" : ""} será${trashedNotes.length > 1 ? "ão" : ""} excluída${trashedNotes.length > 1 ? "s" : ""} definitivamente.`, confirmLabel: "Esvaziar" });
                    if (ok) { emptyTrash(); toast({ title: "Lixeira esvaziada" }); }
                  }}
                >
                  <Trash2 className="w-3 h-3 mr-1" /> Esvaziar
                </Button>
              </div>
            )}
            {trashedNotes.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-center px-4">
                <Trash2 className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Lixeira vazia</p>
                <button onClick={() => setShowTrash(false)} className="mt-3 text-xs text-primary hover:underline">Voltar às notas</button>
              </div>
            )}
            {trashedNotes.map((note, i) => {
              const snippet = getSnippet(note.content);
              const deletedDate = new Date(note.deleted_at!);
              const daysAgo = Math.floor((Date.now() - deletedDate.getTime()) / (1000 * 60 * 60 * 24));
              const daysLeft = Math.max(0, 30 - daysAgo);
              return (
                <AnimatedItem key={note.id} index={i}>
                  <div className="rounded-xl border-l-2 border-l-destructive/40 p-3 bg-card/60 border border-border/30 space-y-2.5">
                    <p className="text-sm font-semibold text-foreground truncate">{note.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{snippet}</p>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">Excluída há {daysAgo} dia{daysAgo !== 1 ? "s" : ""}</span>
                        <span className={`text-[11px] font-medium ${daysLeft <= 5 ? "text-destructive" : daysLeft <= 15 ? "text-yellow-500" : "text-muted-foreground"}`}>
                          {daysLeft} dia{daysLeft !== 1 ? "s" : ""} restante{daysLeft !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <Progress
                        value={(daysLeft / 30) * 100}
                        className={`h-1.5 ${daysLeft <= 5 ? "[&>div]:bg-destructive" : daysLeft <= 15 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-primary"}`}
                      />
                    </div>
                    <div className="flex items-center gap-1 justify-end pt-0.5">
                      <Button size="sm" variant="outline" className="rounded-xl text-xs h-7 px-2" onClick={() => { restoreNote(note.id); toast({ title: "Nota restaurada" }); }}>
                        Restaurar
                      </Button>
                      <Button size="sm" variant="destructive" className="rounded-xl text-xs h-7 px-2" onClick={async () => {
                        const ok = await confirm({ title: "Excluir definitivamente?", description: `"${note.title}" será removida permanentemente.`, confirmLabel: "Excluir" });
                        if (ok) { permanentlyDeleteNote(note.id); toast({ title: "Nota excluída definitivamente" }); }
                      }}>
                        Excluir
                      </Button>
                    </div>
                  </div>
                </AnimatedItem>
              );
            })}
          </>
        ) : (
          <>
            {sorted.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-center px-4">
                <StickyNote className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">{searchQuery ? "Nenhuma nota encontrada" : "Nenhuma nota ainda"}</p>
                {!searchQuery && (
                  <button onClick={handleAddNote} className="mt-3 text-xs text-primary hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Criar primeira nota
                  </button>
                )}
              </div>
            )}
            {sorted.map((note, i) => {
              const { words, readMin } = getTextStats(note.content);
              const isSelected = selectedId === note.id;
              const isBulkSelected = bulkSelected.has(note.id);
              const snippet = getSnippet(note.content);
              return (
                <AnimatedItem key={note.id} index={i}>
                  <DeshContextMenu actions={[
                    { id: "open", label: "Abrir nota", icon: Eye, onClick: () => openNote(note) },
                    { id: "duplicate", label: "Duplicar", icon: Copy, onClick: () => handleDuplicateNote(note) },
                    { id: "export", label: "Exportar como .md", icon: Download, onClick: () => handleExportNote(note) },
                    { id: "print", label: "Imprimir", icon: Printer, onClick: () => handlePrintNote(note) },
                    { id: "copy_content", label: "Copiar conteúdo", icon: ClipboardCopy, onClick: () => { navigator.clipboard.writeText(note.content); toast({ title: "Conteúdo copiado" }); } },
                    { id: "pin", label: note.pinned ? "Desafixar" : "Fixar", icon: Pin, onClick: () => togglePin(note.id) },
                    { id: "favorite", label: note.favorited ? "Desfavoritar" : "Favoritar", icon: Star, onClick: () => toggleFavorite(note.id) },
                    { id: "delete", label: "Excluir", icon: Trash2, onClick: () => { deleteNote(note.id); if (selectedId === note.id) setSelectedId(null); } },
                  ]}>
                    <div
                      onClick={(e) => {
                        if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
                          e.preventDefault();
                          toggleBulkSelect(note.id);
                        } else if (bulkMode) {
                          toggleBulkSelect(note.id);
                        } else {
                          openNote(note);
                        }
                      }}
                      className={`group rounded-xl border-l-4 ${note.color || "border-l-primary"} p-3 cursor-pointer transition-all duration-200 relative
                        ${isSelected ? "bg-primary/10 ring-1 ring-primary/30" : isBulkSelected ? "bg-primary/5 ring-1 ring-primary/20" : "bg-card/60 hover:bg-card/80 border border-border/30"}
                      `}
                    >
                      {bulkMode && (
                        <div className="absolute left-1 top-1/2 -translate-y-1/2 -translate-x-1">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${isBulkSelected ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                            {isBulkSelected && <CheckCheck className="w-3 h-3 text-primary-foreground" />}
                          </div>
                        </div>
                      )}
                      <div className={`${bulkMode ? "ml-4" : ""}`}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <NoteCardBadges note={note} />
                            <p className="text-sm font-semibold text-foreground truncate">{highlightMatch(note.title, searchQuery)}</p>
                          </div>
                          {!bulkMode && (
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" onClick={e => e.stopPropagation()}>
                              <DeshTooltip label="Duplicar">
                                <button onClick={() => handleDuplicateNote(note)} className="p-1 rounded-xl hover:bg-muted/70 transition-colors text-muted-foreground hover:text-foreground" aria-label="Duplicar">
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </DeshTooltip>
                              <DeshTooltip label="Exportar .md">
                                <button onClick={() => handleExportNote(note)} className="p-1 rounded-xl hover:bg-muted/70 transition-colors text-muted-foreground hover:text-foreground" aria-label="Exportar">
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              </DeshTooltip>
                              <button onClick={() => toggleFavorite(note.id)} className="p-1 rounded-xl hover:bg-muted/70 transition-colors" aria-label="Favoritar">
                                <Star className={`w-3.5 h-3.5 ${note.favorited ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground hover:text-yellow-400"}`} />
                              </button>
                              <button onClick={() => togglePin(note.id)} className="p-1 rounded-xl hover:bg-muted/70 transition-colors" aria-label="Fixar">
                                <Pin className={`w-3.5 h-3.5 ${note.pinned ? "text-primary fill-primary" : "text-muted-foreground hover:text-primary"}`} />
                              </button>
                              <button onClick={async () => {
                                const ok = await confirm({ title: "Excluir nota?", description: `"${note.title}" será excluída permanentemente.`, confirmLabel: "Excluir" });
                                if (!ok) return;
                                deleteNote(note.id);
                                if (selectedId === note.id) setSelectedId(null);
                              }} className="p-1 rounded-xl hover:bg-muted/70 text-muted-foreground hover:text-destructive transition-colors" aria-label="Excluir">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2">{searchQuery ? highlightMatch(snippet, searchQuery) : snippet}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <WorkspaceBadge workspaceId={note.workspace_id} />
                          {note.notebook && (
                            <span className="text-xs flex items-center gap-1 bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                              <BookOpen className="w-2.5 h-2.5" />{note.notebook}
                            </span>
                          )}
                          {note.tags?.slice(0, 2).map(tag => (
                            <span key={tag} className="text-xs bg-muted/50 text-muted-foreground px-1.5 py-0.5 rounded-full">{tag}</span>
                          ))}
                          <span className="text-xs text-muted-foreground/60 ml-auto flex items-center gap-1">
                            <AlignLeft className="w-3 h-3" />{words}
                          </span>
                          <NoteRelativeTime dateStr={note.updated_at} />
                        </div>
                        <TaskProgressBar content={note.content} />
                      </div>
                    </div>
                  </DeshContextMenu>
                </AnimatedItem>
              );
            })}
          </>
        )}
      </div>

      {/* Bottom hint */}
      {sorted.length > 0 && !bulkMode && (
        <div className="px-3 py-2 border-t border-border/20 flex-shrink-0">
          <p className="text-xs text-muted-foreground/50 text-center">⌘+clique para selecionar múltiplas · Arraste .md para importar</p>
        </div>
      )}
    </div>
  );
});

NoteListPanel.displayName = "NoteListPanel";

export default NoteListPanel;

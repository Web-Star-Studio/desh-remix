import { lazy, Suspense } from "react";
import PageLayout from "@/components/dashboard/PageLayout";
import PageHeader from "@/components/dashboard/PageHeader";
import GlassCard from "@/components/dashboard/GlassCard";
import DeshTooltip from "@/components/ui/DeshTooltip";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import NoteListPanel from "@/components/notes/NoteListPanel";
import { getNoteTemplates } from "@/lib/notesPageUtils";
import { useNotesLogic } from "@/hooks/notes/useNotesLogic";
import { useNoteListKeyboard } from "@/hooks/notes/useNoteListKeyboard";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, X, Star, Mic,
  BookOpen, StickyNote, LayoutList, LayoutGrid,
  CheckCheck, Download, Pin, Trash2, Upload, Layers, Loader2
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { colorOptions } from "@/lib/notesPageUtils";
import { FileUp } from "lucide-react";

// Lazy-load heavy panes
const NoteEditorPane = lazy(() => import("@/components/notes/NoteEditorPane"));
const NotebookSidebar = lazy(() => import("@/components/notes/NotebookSidebar"));
const TranscriptionPanel = lazy(() => import("@/components/notes/TranscriptionPanel").then(m => ({ default: m.TranscriptionPanel })));

const NotesPage = () => {
  const n = useNotesLogic();
  useNoteListKeyboard({ notes: n.sorted, selectedId: n.selectedId, onSelect: n.openNote, enabled: !n.selectedId && !n.bulkMode });

  return (
    <PageLayout maxWidth="full" noPadding>
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <input ref={n.fileInputRef} type="file" accept=".md,.markdown,.txt" multiple className="hidden" onChange={n.handleFileInput} />
        {n.confirmDialog}

        {/* ── Top bar ─────────────────────────────────────── */}
        <div className="px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4 flex-shrink-0">
          <PageHeader
            title="Notas"
            icon={<StickyNote className="w-5 h-5 text-primary" />}
            subtitle={
              <span className="text-xs text-muted-foreground">
                {n.showTrash
                  ? `${n.trashedNotes.length} nota${n.trashedNotes.length !== 1 ? "s" : ""} na lixeira`
                  : `${n.activeNotes.length} nota${n.activeNotes.length !== 1 ? "s" : ""}`}
                {n.bulkMode && !n.showTrash && <span className="ml-2 text-primary font-medium">· {n.bulkSelected.size} selecionada{n.bulkSelected.size > 1 ? "s" : ""}</span>}
              </span>
            }
            actions={
              <div className="flex items-center gap-2">
                <button
                  onClick={() => n.setViewMode(n.viewMode === "grid" ? "list" : "grid")}
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  aria-label={n.viewMode === "grid" ? "Visualização em lista" : "Visualização em grade"}
                >
                  {n.viewMode === "grid" ? <LayoutList className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
                </button>

                {n.bulkMode && (
                  <div className="flex items-center gap-1.5">
                    <DeshTooltip label={n.bulkSelected.size === n.sorted.length ? "Desmarcar tudo" : "Selecionar tudo (⌘A)"}>
                      <button onClick={n.handleSelectAll} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                        <CheckCheck className="w-4 h-4" />
                      </button>
                    </DeshTooltip>
                    <DeshTooltip label="Cancelar seleção (Esc)">
                      <button onClick={() => n.setBulkSelected(new Set())} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </DeshTooltip>
                  </div>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="rounded-xl gap-1.5">
                      <Plus className="w-4 h-4" /> Nova nota
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onClick={n.handleAddNote}>
                      <StickyNote className="w-4 h-4 mr-2" /> Nota em branco
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <p className="text-xs text-muted-foreground px-2 py-1 font-medium">Templates</p>
                    {getNoteTemplates().map(tpl => (
                      <DropdownMenuItem key={tpl.label} onClick={() => n.handleTemplateNote(tpl)}>
                        <span className="mr-2">{tpl.icon}</span>{tpl.label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => n.fileInputRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-2" /> Importar .md
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => n.setShowTranscription(true)}>
                      <Mic className="w-4 h-4 mr-2" /> Transcrever Reunião
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            }
          />
        </div>

        {/* ── Bulk actions bar ──────────────────────────── */}
        <AnimatePresence>
          {n.bulkMode && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden flex-shrink-0 px-3 sm:px-4 lg:px-6">
              <div className="flex items-center gap-1 sm:gap-1.5 py-2 px-3 rounded-xl bg-muted/50 border border-border/40 flex-wrap">
                <span className="text-xs font-medium text-primary mr-1">{n.bulkSelected.size} sel.</span>
                <div className="w-px h-4 bg-border/40 hidden sm:block" />
                <DeshTooltip label="Selecionar tudo (⌘A)">
                  <button onClick={n.handleSelectAll} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors">
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{n.bulkSelected.size === n.sorted.length ? "Nenhum" : "Todos"}</span>
                  </button>
                </DeshTooltip>
                <button onClick={n.handleBulkPin} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors">
                  <Pin className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Fixar</span>
                </button>
                <button onClick={n.handleBulkFavorite} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors">
                  <Star className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Favoritar</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors">
                      <BookOpen className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Caderno</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44 z-50 bg-popover">
                    <DropdownMenuItem onClick={() => n.handleBulkNotebook("")}>
                      <X className="w-3.5 h-3.5 mr-2" /> Remover caderno
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {n.notebooks.map(([nb]) => (
                      <DropdownMenuItem key={nb} onClick={() => n.handleBulkNotebook(nb)}>
                        <BookOpen className="w-3.5 h-3.5 mr-2" /> {nb}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors">
                      <Layers className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Cor</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-36 z-50 bg-popover">
                    {colorOptions.map(c => (
                      <DropdownMenuItem key={c.value} onClick={() => n.handleBulkColor(c.value)}>
                        <div className={`w-3 h-3 rounded-full ${c.dot} mr-2`} /> {c.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="w-px h-4 bg-border/40 hidden sm:block" />
                <button onClick={n.handleBulkExport} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors">
                  <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Exportar</span>
                </button>
                <button onClick={n.handleBulkDelete} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-destructive hover:bg-destructive/10 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Excluir</span>
                </button>
                <DeshTooltip label="Cancelar (Esc)">
                  <button onClick={() => n.setBulkSelected(new Set())} className="ml-auto p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </DeshTooltip>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Transcription panel ─────────────────────── */}
        <AnimatePresence>
          {n.showTranscription && (
            <Suspense fallback={<div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>}>
              <div className="px-3 sm:px-4 lg:px-6 pb-2 flex-shrink-0">
                <TranscriptionPanel
                  onComplete={n.handleTranscriptionComplete}
                  onCancel={() => n.setShowTranscription(false)}
                />
              </div>
            </Suspense>
          )}
        </AnimatePresence>

        {/* ── Body: sidebar + main ────────────────────── */}
        <div
          className={`flex flex-1 min-h-0 overflow-hidden gap-3 px-3 sm:px-4 lg:px-6 pb-24 md:pb-6 pt-3 ${n.isDragOver ? "ring-2 ring-primary/40 ring-inset rounded-xl" : ""}`}
          onDragOver={e => { e.preventDefault(); n.setIsDragOver(true); }}
          onDragLeave={() => n.setIsDragOver(false)}
          onDrop={n.handleDrop}
        >
          {/* Drag overlay */}
          <AnimatePresence>
            {n.isDragOver && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-xl pointer-events-none">
                <div className="flex flex-col items-center gap-2 text-primary">
                  <FileUp className="w-10 h-10" />
                  <p className="text-sm font-medium">Solte arquivos .md para importar</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Suspense fallback={null}>
            <NotebookSidebar
              notebooks={n.notebooks}
              allTags={n.allTags}
              activeNotesCount={n.activeNotes.length}
              trashedNotesCount={n.trashedNotes.length}
              filterNotebook={n.filterNotebook}
              filterTag={n.filterTag}
              filterFavorite={n.filterFavorite}
              showTrash={n.showTrash}
              showNewNotebook={n.showNewNotebook}
              newNotebookName={n.newNotebookName}
              showNotebooks={n.showNotebooks}
              onFilterNotebook={n.setFilterNotebook}
              onFilterTag={n.setFilterTag}
              onFilterFavorite={n.setFilterFavorite}
              onShowTrash={n.setShowTrash}
              onShowNewNotebook={n.setShowNewNotebook}
              onNewNotebookName={n.setNewNotebookName}
              onShowNotebooks={n.setShowNotebooks}
              onCreateNotebook={n.handleCreateNotebook}
              onDeleteNotebook={n.handleDeleteNotebook}
            />
          </Suspense>

          {/* ── Notes list + editor ────────────────────── */}
          <div className="flex flex-1 min-h-0 overflow-hidden gap-3">
            <NoteListPanel
              selectedId={n.selectedId}
              sorted={n.sorted}
              searchQuery={n.searchQuery}
              setSearchQuery={n.setSearchQuery}
              showFilters={n.showFilters}
              setShowFilters={n.setShowFilters}
              sortBy={n.sortBy}
              setSortBy={n.setSortBy}
              sortDir={n.sortDir}
              setSortDir={n.setSortDir}
              activeFiltersCount={n.activeFiltersCount}
              filterNotebook={n.filterNotebook}
              setFilterNotebook={n.setFilterNotebook}
              filterTag={n.filterTag}
              setFilterTag={n.setFilterTag}
              filterFavorite={n.filterFavorite}
              setFilterFavorite={n.setFilterFavorite}
              showNotebooks={n.showNotebooks}
              setShowNotebooks={n.setShowNotebooks}
              showTrash={n.showTrash}
              setShowTrash={n.setShowTrash}
              trashedNotes={n.trashedNotes}
              bulkSelected={n.bulkSelected}
              bulkMode={n.bulkMode}
              toggleBulkSelect={n.toggleBulkSelect}
              openNote={n.openNote}
              handleDuplicateNote={n.handleDuplicateNote}
              handleExportNote={n.handleExportNote}
              handlePrintNote={n.handlePrintNote}
              togglePin={n.togglePin}
              toggleFavorite={n.toggleFavorite}
              deleteNote={n.deleteNote}
              restoreNote={n.restoreNote}
              permanentlyDeleteNote={n.permanentlyDeleteNote}
              emptyTrash={n.emptyTrash}
              setSelectedId={n.setSelectedId}
              handleAddNote={n.handleAddNote}
              confirm={n.confirm}
            />

            {/* ── Editor pane ─────────────────────────────── */}
            <AnimatePresence>
              {n.selectedId && n.selectedNote && (
                <Suspense fallback={<div className="flex-1 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}>
                  <NoteEditorPane
                    selectedId={n.selectedId}
                    selectedNote={n.selectedNote}
                    editTitle={n.editTitle}
                    setEditTitle={n.setEditTitle}
                    editNotebook={n.editNotebook}
                    setEditNotebook={n.setEditNotebook}
                    editColor={n.editColor}
                    setEditColor={n.setEditColor}
                    editTags={n.editTags}
                    setEditTags={n.setEditTags}
                    tagInput={n.tagInput}
                    setTagInput={n.setTagInput}
                    editContentState={n.editContentState}
                    focusMode={n.focusMode}
                    setFocusMode={n.setFocusMode}
                    showLinksPanel={n.showLinksPanel}
                    setShowLinksPanel={n.setShowLinksPanel}
                    showVoiceRecording={n.showVoiceRecording}
                    setShowVoiceRecording={n.setShowVoiceRecording}
                    showDrawing={n.showDrawing}
                    setShowDrawing={n.setShowDrawing}
                    drawingFullscreen={n.drawingFullscreen}
                    setDrawingFullscreen={n.setDrawingFullscreen}
                    audioBlocks={n.audioBlocks}
                    setAudioBlocks={n.setAudioBlocks}
                    stats={n.stats}
                    lastSaved={n.lastSaved}
                    notebooks={n.notebooks}
                    allTags={n.allTags}
                    aiLoading={n.aiLoading}
                    closeEditor={n.closeEditor}
                    handleDuplicateNote={n.handleDuplicateNote}
                    handleExportNote={n.handleExportNote}
                    handleExportTxt={n.handleExportTxt}
                    handleExportSrt={n.handleExportSrt}
                    handlePrintNote={n.handlePrintNote}
                    isTranscriptionNote={n.isTranscriptionNote}
                    addTag={n.addTag}
                    handleRichTextChange={n.handleRichTextChange}
                    handleAiAction={n.handleAiAction}
                    openNote={n.openNote}
                    notes={n.state.notes}
                  />
                </Suspense>
              )}
            </AnimatePresence>

            {/* Empty state when no note selected */}
            {!n.selectedId && (
              <div className="hidden md:flex flex-col flex-1 items-center justify-center text-center p-8 glass-card">
                <StickyNote className="w-12 h-12 text-muted-foreground/20 mb-4" />
                <p className="text-sm text-muted-foreground mb-2">Selecione uma nota para editar</p>
                <p className="text-xs text-muted-foreground/50 mb-4">⌘B negrito · ⌘I itálico · ⌘U sublinhado · ⌘P imprimir</p>
                <button onClick={n.handleAddNote} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Nova nota
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </PageLayout>
  );
};

export default NotesPage;

import { useRef, memo, lazy, Suspense, useState } from "react";
import { Note } from "@/contexts/DashboardContext";
import DeshTooltip from "@/components/ui/DeshTooltip";
import { RichTextEditor } from "@/components/notes/RichTextEditor";
import { BacklinksPanel } from "@/components/notes/BacklinksPanel";
import { NoteReadingProgress } from "@/components/notes/NoteReadingProgress";
import { NoteLinksPanel } from "@/components/notes/NoteLinksPanel";
import NoteVersionHistory from "@/components/notes/NoteVersionHistory";
import NoteTableOfContents from "@/components/notes/NoteTableOfContents";
import NoteWordGoal from "@/components/notes/NoteWordGoal";
import RelatedNotes from "@/components/notes/RelatedNotes";
import { AudioMiniPlayer } from "@/components/notes/VoiceRecordingBlock";
import { NoteShareDialog, NotePresenceBar } from "@/components/notes/NoteShareDialog";
import { useNoteSharing } from "@/hooks/notes/useNoteSharing";

// Lazy-load heavy conditional panels
const DrawingCanvas = lazy(() => import("@/components/notes/DrawingCanvas").then(m => ({ default: m.DrawingCanvas })));
const VoiceRecordingBlock = lazy(() => import("@/components/notes/VoiceRecordingBlock").then(m => ({ default: m.VoiceRecordingBlock })));
import MoveToWorkspace from "@/components/dashboard/MoveToWorkspace";
import { removeAudioBlock, type AudioBlock } from "@/lib/noteAudioUtils";
import { colorOptions } from "@/lib/notesPageUtils";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import {
  X, Copy, Download, Printer, ZoomIn, Save, Tag,
  BookOpen, Clock, Hash, AlignLeft, Layers, Mic,
  Link2, FileDown, FileText, Star, Pin, List, Loader2, Share2
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NoteEditorPaneProps {
  selectedId: string;
  selectedNote: Note;
  editTitle: string;
  setEditTitle: (v: string) => void;
  editNotebook: string;
  setEditNotebook: (v: string) => void;
  editColor: string;
  setEditColor: (v: string) => void;
  editTags: string[];
  setEditTags: (v: string[] | ((prev: string[]) => string[])) => void;
  tagInput: string;
  setTagInput: (v: string) => void;
  editContentState: any;
  focusMode: boolean;
  setFocusMode: (v: boolean) => void;
  showLinksPanel: boolean;
  setShowLinksPanel: (v: boolean | ((v: boolean) => boolean)) => void;
  showVoiceRecording: boolean;
  setShowVoiceRecording: (v: boolean) => void;
  showDrawing: boolean;
  setShowDrawing: (v: boolean) => void;
  drawingFullscreen: boolean;
  setDrawingFullscreen: (v: boolean | ((v: boolean) => boolean)) => void;
  audioBlocks: AudioBlock[];
  setAudioBlocks: (v: AudioBlock[] | ((prev: AudioBlock[]) => AudioBlock[])) => void;
  stats: { words: number; chars: number; lines: number; readMin: number };
  lastSaved: Date | null;
  notebooks: [string, number][];
  allTags: string[];
  aiLoading: string | null;
  closeEditor: () => void;
  handleDuplicateNote: (note: Note) => void;
  handleExportNote: (note: Note) => void;
  handleExportTxt: (note: Note) => void;
  handleExportSrt: (note: Note) => void;
  handlePrintNote: (note: Note) => void;
  isTranscriptionNote: (note: Note) => boolean;
  addTag: () => void;
  handleRichTextChange: (html: string) => void;
  handleAiAction: (action: string, extra?: Record<string, string>) => void;
  openNote: (note: Note) => void;
  notes: Note[];
}

const NoteEditorPane = ({
  selectedId, selectedNote, editTitle, setEditTitle, editNotebook, setEditNotebook,
  editColor, setEditColor, editTags, setEditTags, tagInput, setTagInput,
  editContentState, focusMode, setFocusMode, showLinksPanel, setShowLinksPanel,
  showVoiceRecording, setShowVoiceRecording, showDrawing, setShowDrawing,
  drawingFullscreen, setDrawingFullscreen, audioBlocks, setAudioBlocks,
  stats, lastSaved, notebooks, allTags, aiLoading,
  closeEditor, handleDuplicateNote, handleExportNote, handleExportTxt, handleExportSrt,
  handlePrintNote, isTranscriptionNote, addTag, handleRichTextChange, handleAiAction,
  openNote, notes,
}: NoteEditorPaneProps) => {
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const sharing = useNoteSharing(selectedId);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.25 }}
      className={`flex flex-row flex-1 min-h-0 glass-card overflow-hidden ${
        focusMode ? "fixed inset-0 z-50 bg-background/95 rounded-none" : ""
      }`}
    >
      {/* Main editor column */}
      <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
        {/* Editor header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30 flex-shrink-0">
          <button onClick={closeEditor} className="text-muted-foreground hover:text-foreground transition-colors md:hidden p-1" aria-label="Voltar">
            <X className="w-4 h-4" />
          </button>
          <input
            type="text"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            className="flex-1 text-base font-semibold text-foreground bg-transparent outline-none placeholder:text-muted-foreground/40"
            placeholder="Título da nota"
          />
          <NotePresenceBar presence={sharing.otherViewers} editLock={sharing.editLock} />
          <div className="flex items-center gap-1">
            <DeshTooltip label="Compartilhar">
              <button onClick={() => setShowShareDialog(true)} className={`p-2 rounded-xl transition-colors ${sharing.shares.length > 0 ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"}`} aria-label="Compartilhar">
                <Share2 className="w-3.5 h-3.5" />
              </button>
            </DeshTooltip>
            <DeshTooltip label="Duplicar nota">
              <button onClick={() => handleDuplicateNote(selectedNote)} className="p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors" aria-label="Duplicar">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </DeshTooltip>
            {isTranscriptionNote(selectedNote) ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors" aria-label="Exportar">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[160px]">
                  <DropdownMenuItem onClick={() => handleExportNote(selectedNote)}>
                    <FileDown className="w-4 h-4 mr-2" /> Exportar .md
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportTxt(selectedNote)}>
                    <FileText className="w-4 h-4 mr-2" /> Exportar .txt
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportSrt(selectedNote)}>
                    <FileDown className="w-4 h-4 mr-2" /> Exportar .srt
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <DeshTooltip label="Exportar .md">
                <button onClick={() => handleExportNote(selectedNote)} className="p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors" aria-label="Exportar">
                  <Download className="w-3.5 h-3.5" />
                </button>
              </DeshTooltip>
            )}
            <DeshTooltip label="Imprimir (⌘P)">
              <button onClick={() => handlePrintNote(selectedNote)} className="p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors" aria-label="Imprimir">
                <Printer className="w-3.5 h-3.5" />
              </button>
            </DeshTooltip>
            <span className="w-px h-4 bg-border/30 mx-0.5" />
            <DeshTooltip label="Modo foco">
              <button onClick={() => setFocusMode(!focusMode)} className={`p-2 rounded-xl transition-colors ${focusMode ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`} aria-label="Modo foco">
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </DeshTooltip>
            <DeshTooltip label="Painel de Links">
              <button onClick={() => setShowLinksPanel(v => !v)} className={`p-2 rounded-xl transition-colors ${showLinksPanel ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`} aria-label="Painel de Links">
                <Link2 className="w-3.5 h-3.5" />
              </button>
            </DeshTooltip>
            <NoteTableOfContents content={editContentState.value} />
            <NoteVersionHistory
              noteId={selectedId}
              currentContent={editContentState.value}
              currentTitle={editTitle}
              onRestore={(content) => editContentState.set(content)}
            />
            <DeshTooltip label="Salvar (⌘S)">
              <button onClick={closeEditor} className="p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors" aria-label="Salvar e fechar">
                <Save className="w-3.5 h-3.5" />
              </button>
            </DeshTooltip>
          </div>
        </div>

        {/* Meta: notebook + color */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/20 flex-shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={editNotebook}
              onChange={e => setEditNotebook(e.target.value)}
              placeholder="Caderno..."
              className="bg-muted/50 rounded-xl px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none w-28 border border-border/30 focus:border-primary/40 transition-colors"
              list="notebooks-list"
            />
            <datalist id="notebooks-list">
              {notebooks.map(([nb]) => <option key={nb} value={nb} />)}
            </datalist>
          </div>
          <span className="w-px h-4 bg-border/30" />
          <div className="flex items-center gap-1.5">
            {colorOptions.map(c => (
              <button key={c.value} onClick={() => setEditColor(c.value)}
                className={`w-4 h-4 rounded-full ${c.dot} transition-transform ${editColor === c.value ? "ring-2 ring-primary ring-offset-1 ring-offset-background scale-110" : "opacity-50 hover:opacity-100"}`}
                title={c.label}
                aria-label={`Cor ${c.label}`}
              />
            ))}
          </div>
          {/* Stats */}
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground/60">
            <span className="flex items-center gap-1"><AlignLeft className="w-3 h-3" />{stats.words}</span>
            <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{stats.chars}</span>
            <span className="flex items-center gap-1 hidden sm:flex"><Layers className="w-3 h-3" />{stats.lines}L</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />~{stats.readMin}min</span>
            <NoteWordGoal currentWords={stats.words} />
            {lastSaved && (
              <span className="flex items-center gap-1 text-primary/70">
                <Save className="w-3 h-3" />Salvo
              </span>
            )}
          </div>
        </div>

        {/* Voice Recording Block */}
        {showVoiceRecording && (
          <Suspense fallback={<div className="px-4 py-2 border-b border-border/20 flex-shrink-0"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground mx-auto" /></div>}>
            <div className="px-4 py-2 border-b border-border/20 flex-shrink-0">
              <VoiceRecordingBlock
                onInsertText={(html) => editContentState.set(editContentState.value + html)}
                onInsertAudio={(base64, dur) => {
                  setAudioBlocks(prev => [...prev, { id: `audio_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, src: base64, duration: dur }]);
                }}
                onClose={() => setShowVoiceRecording(false)}
              />
            </div>
          </Suspense>
        )}

        {/* Drawing Canvas Block */}
        {showDrawing && (
          <Suspense fallback={<div className="px-4 py-2 flex-shrink-0"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground mx-auto" /></div>}>
            <div className={`${drawingFullscreen ? "" : "px-4 py-2 border-b border-border/20"} flex-shrink-0`}>
              <DrawingCanvas
                fullscreen={drawingFullscreen}
                onToggleFullscreen={() => setDrawingFullscreen(f => !f)}
                onSave={(dataUrl, jsonData) => {
                  const drawingHtml = `<div data-drawing="true"><img src="${dataUrl}" alt="Desenho" style="max-width:100%;border-radius:8px;border:1px solid hsl(var(--border)/0.3)" /><input type="hidden" data-drawing-json='${jsonData}' /></div>`;
                  editContentState.set(editContentState.value + drawingHtml);
                  setShowDrawing(false);
                  setDrawingFullscreen(false);
                  toast({ title: "Desenho salvo na nota" });
                }}
                onClose={() => { setShowDrawing(false); setDrawingFullscreen(false); }}
                height={drawingFullscreen ? undefined : 350}
              />
            </div>
          </Suspense>
        )}

        {/* Reading progress */}
        <NoteReadingProgress containerRef={editorScrollRef} />

        {/* Rich-text editor */}
        <RichTextEditor
          content={editContentState.value}
          onChange={handleRichTextChange}
          focusMode={focusMode}
          onAiAction={handleAiAction}
          aiLoading={aiLoading}
          onMicClick={() => setShowVoiceRecording(!showVoiceRecording)}
          onDrawClick={() => setShowDrawing(!showDrawing)}
        />

        {/* Audio blocks */}
        {audioBlocks.length > 0 && (
          <div className="px-4 py-2 border-t border-border/20 flex-shrink-0 space-y-2">
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <Mic className="w-3 h-3" /> Áudios anexados ({audioBlocks.length})
            </p>
            {audioBlocks.map((block) => (
              <AudioMiniPlayer
                key={block.id}
                src={block.src}
                duration={block.duration}
                onDelete={() => setAudioBlocks(prev => removeAudioBlock(prev, block.id))}
              />
            ))}
          </div>
        )}

        {/* Related notes */}
        <RelatedNotes
          currentNote={selectedNote}
          allNotes={notes}
          onOpenNote={openNote}
        />

        {/* Backlinks panel */}
        {selectedId && (
          <BacklinksPanel
            currentNoteId={selectedId}
            onNavigateToNote={(noteId) => {
              const note = notes.find(n => n.id === noteId);
              if (note) openNote(note);
            }}
          />
        )}

        {/* Tags footer */}
        <div className="px-4 py-3 border-t border-border/30 flex-shrink-0 bg-foreground/5">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {editTags.map(tag => (
              <span key={tag} className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20 font-medium">
                {tag}
                <button onClick={() => setEditTags(editTags.filter(t => t !== tag))} className="hover:text-destructive transition-colors" aria-label={`Remover tag ${tag}`}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
              placeholder="Adicionar tag..."
              className="flex-1 bg-muted/50 rounded-xl px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none border border-border/30 focus:border-primary/40 transition-colors"
              list="tags-autocomplete"
            />
            <datalist id="tags-autocomplete">
              {allTags.filter(t => !editTags.includes(t)).map(t => <option key={t} value={t} />)}
            </datalist>
            <button onClick={addTag} className="p-2 rounded-xl bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors" aria-label="Adicionar tag">
              <Tag className="w-3.5 h-3.5" />
            </button>
            <MoveToWorkspace table="user_data" itemId={selectedId} currentWorkspaceId={selectedNote.workspace_id} onMoved={() => {}} />
          </div>
        </div>
      </div>

      {/* Links side panel */}
      {showLinksPanel && (
        <NoteLinksPanel
          content={editContentState.value}
          onClose={() => setShowLinksPanel(false)}
        />
      )}

      {/* Share dialog */}
      <NoteShareDialog
        open={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        shares={sharing.shares}
        loading={sharing.loading}
        onShare={sharing.shareNote}
        onRemove={sharing.removeShare}
        onUpdatePermission={sharing.updatePermission}
      />
    </motion.div>
  );
};

export default NoteEditorPane;

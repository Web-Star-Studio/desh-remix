import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import { useDashboard, Note } from "@/contexts/DashboardContext";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { useUndoable } from "@/hooks/common/useUndoable";
import { toast } from "@/hooks/use-toast";
import { extractAudioBlocks, mergeAudioBlocks, createAudioMarker, removeAudioBlock, type AudioBlock } from "@/lib/noteAudioUtils";
import { useNoteAutoSave } from "@/hooks/notes/useNoteAutoSave";
import { getPlainTextFromHtml, markdownToHtml } from "@/components/notes/RichTextEditor";
import {
  colorOptions, getNoteTemplates, getTextStats,
  parseMdFile, getSnippet
} from "@/lib/notesPageUtils";

export function useNotesLogic() {
  const { invoke } = useEdgeFn();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const { state, addNote, updateNote, deleteNote, restoreNote, permanentlyDeleteNote, emptyTrash } = useDashboard();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Editor state ────────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editColor, setEditColor] = useState("border-l-primary");
  const [editNotebook, setEditNotebook] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const editContentState = useUndoable("");

  // ── Filters / search ────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterNotebook, setFilterNotebook] = useState<string>("all");
  const [filterTag, setFilterTag] = useState<string>("all");
  const [filterFavorite, setFilterFavorite] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "name">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showNotebooks, setShowNotebooks] = useState(false);
  const [showNewNotebook, setShowNewNotebook] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState("");
  const [showTranscription, setShowTranscription] = useState(false);
  const [showVoiceRecording, setShowVoiceRecording] = useState(false);
  const [showDrawing, setShowDrawing] = useState(false);
  const [drawingFullscreen, setDrawingFullscreen] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [showLinksPanel, setShowLinksPanel] = useState(false);
  const [audioBlocks, setAudioBlocks] = useState<AudioBlock[]>([]);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const bulkMode = bulkSelected.size > 0;

  // ── AI state ────────────────────────────────────────────────────────────
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  // Listen for slash command drawing event
  useEffect(() => {
    const handler = () => setShowDrawing(true);
    window.addEventListener("notes:toggle-drawing", handler);
    return () => window.removeEventListener("notes:toggle-drawing", handler);
  }, []);

  // ── Auto-save indicator ─────────────────────────────────────────────────
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Visibility-aware auto-save (saves on tab blur / beforeunload)
  useNoteAutoSave({
    selectedId,
    getEditState: useCallback(() => ({
      title: editTitle,
      content: mergeAudioBlocks(editContentState.value, audioBlocks),
      tags: editTags,
      color: editColor,
      notebook: editNotebook,
    }), [editTitle, editContentState.value, editTags, editColor, editNotebook, audioBlocks]),
    updateNote,
    autoSaveTimer,
  });

  const selectedNote = state.notes.find(n => n.id === selectedId);

  // Active notes (not in trash)
  const activeNotes = useMemo(() => state.notes.filter(n => !n.deleted_at), [state.notes]);
  // Trashed notes
  const trashedNotes = useMemo(() => state.notes.filter(n => !!n.deleted_at), [state.notes]);

  // Auto-cleanup: permanently delete notes trashed > 30 days ago (run once on mount)
  const autoCleanupRan = useRef(false);
  useEffect(() => {
    if (autoCleanupRan.current || trashedNotes.length === 0) return;
    autoCleanupRan.current = true;
    const now = Date.now();
    const expired = trashedNotes.filter(n => {
      const deletedMs = new Date(n.deleted_at!).getTime();
      return now - deletedMs > 30 * 24 * 60 * 60 * 1000;
    });
    expired.forEach(n => permanentlyDeleteNote(n.id));
  }, [trashedNotes, permanentlyDeleteNote]);

  // Notebooks + tags (only active notes)
  const notebooks = useMemo(() => {
    const map: Record<string, number> = {};
    activeNotes.forEach(n => { if (n.notebook) map[n.notebook] = (map[n.notebook] || 0) + 1; });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])) as [string, number][];
  }, [activeNotes]);

  const allTags = useMemo(() => {
    const set = new Set(activeNotes.flatMap(n => n.tags || []));
    return Array.from(set).sort();
  }, [activeNotes]);

  const activeFiltersCount = [filterNotebook !== "all", filterTag !== "all", filterFavorite].filter(Boolean).length;

  // Filtered + sorted notes (only active)
  const sorted = useMemo(() => {
    let result = activeNotes;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags?.some(t => t.includes(q))
      );
    }
    if (filterNotebook !== "all") result = result.filter(n => n.notebook === filterNotebook);
    if (filterTag !== "all") result = result.filter(n => n.tags?.includes(filterTag));
    if (filterFavorite) result = result.filter(n => n.favorited);

    const pinned = result.filter(n => n.pinned);
    const unpinned = result.filter(n => !n.pinned);
    const sortFn = (a: Note, b: Note) => {
      if (sortBy === "name") { const c = a.title.localeCompare(b.title); return sortDir === "asc" ? c : -c; }
      const da = new Date(a.updated_at || a.created_at || 0).getTime();
      const db = new Date(b.updated_at || b.created_at || 0).getTime();
      return sortDir === "asc" ? da - db : db - da;
    };
    return [...pinned.sort(sortFn), ...unpinned.sort(sortFn)];
  }, [activeNotes, searchQuery, filterNotebook, filterTag, filterFavorite, sortBy, sortDir]);

  // Text stats
  const stats = useMemo(() => getTextStats(editContentState.value), [editContentState.value]);

  // Auto-save on content/title change
  useEffect(() => {
    if (!selectedId) return;
    const noteExists = state.notes.some(n => n.id === selectedId);
    if (!noteExists) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const fullContent = mergeAudioBlocks(editContentState.value, audioBlocks);
      updateNote(selectedId, {
        title: editTitle,
        content: fullContent,
        tags: editTags,
        color: editColor,
        notebook: editNotebook || undefined,
      });
      setLastSaved(new Date());
    }, 1000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editContentState.value, editTitle, editTags, editColor, editNotebook, selectedId, audioBlocks, updateNote]);

  const openNote = useCallback((note: Note) => {
    setSelectedId(note.id);
    setEditTitle(note.title);
    const htmlContent = markdownToHtml(note.content);
    const { cleanHtml, audioBlocks: blocks } = extractAudioBlocks(htmlContent);
    editContentState.reset(cleanHtml);
    setAudioBlocks(blocks);
    setEditTags(note.tags || []);
    setEditColor(note.color || "border-l-primary");
    setEditNotebook(note.notebook || "");
    setTagInput("");
    setPreviewMode(false);
    setLastSaved(null);
  }, [editContentState.reset]);

  // ── Open note from URL query param (?id=xxx) ───────────────────────────
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const noteIdFromUrl = searchParams.get("id");
    if (noteIdFromUrl && noteIdFromUrl !== selectedId) {
      const note = state.notes.find(n => n.id === noteIdFromUrl);
      if (note) {
        openNote(note);
        searchParams.delete("id");
        setSearchParams(searchParams, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, state.notes, openNote]);

  const closeEditor = useCallback(() => {
    if (!selectedId) return;
    const fullContent = mergeAudioBlocks(editContentState.value, audioBlocks);
    updateNote(selectedId, {
      title: editTitle,
      content: fullContent,
      tags: editTags,
      color: editColor,
      notebook: editNotebook || undefined,
    });
    setSelectedId(null);
    setFocusMode(false);
    setAudioBlocks([]);
  }, [selectedId, editTitle, editContentState.value, editTags, editColor, editNotebook, audioBlocks]);

  const handleAddNote = () => {
    const note = addNote("Nova nota", "");
    openNote(note);
  };

  // ── Transcription complete handler ──────────────────────────────────────
  const handleTranscriptionComplete = (data: { title: string; summary: string; transcript: string; segments?: { speaker: string; text: string; timestamp?: number }[] }) => {
    const fmtTs = (s: number) => {
      const m = Math.floor(s / 60).toString().padStart(2, "0");
      const sec = (s % 60).toString().padStart(2, "0");
      return `${m}:${sec}`;
    };
    const transcriptHtml = data.segments && data.segments.length > 0
      ? data.segments.map(s => `<p><span style="color:var(--muted-foreground);font-size:0.75rem;font-family:monospace">${fmtTs(s.timestamp ?? 0)}</span> <strong>[${s.speaker}]:</strong> ${s.text.trim()}</p>`).join("")
      : `<p>${data.transcript.replace(/\n/g, "</p><p>")}</p>`;

    const content = data.summary
      ? `${data.summary}<hr><h3>Transcrição Completa</h3>${transcriptHtml}`
      : `<h2>${data.title}</h2><h3>Transcrição Completa</h3>${transcriptHtml}`;
    const note = addNote(data.title, content);
    updateNote(note.id, { tags: ["transcrição", "reunião"], notebook: "Reuniões" });
    openNote({ ...note, tags: ["transcrição", "reunião"], notebook: "Reuniões" });
    setShowTranscription(false);
    toast({ title: "Transcrição concluída!", description: "Resumo gerado pela IA." });
  };

  // ── Create from template ────────────────────────────────────────────────
  const handleTemplateNote = (tpl: ReturnType<typeof getNoteTemplates>[0]) => {
    const note = addNote(tpl.title, tpl.content);
    updateNote(note.id, { tags: tpl.tags, notebook: tpl.notebook });
    openNote({ ...note, tags: tpl.tags, notebook: tpl.notebook });
    toast({ title: `Nota criada: ${tpl.label}` });
  };

  // ── Import .md files ────────────────────────────────────────────────────
  const handleImportFiles = useCallback(async (files: FileList | File[]) => {
    let imported = 0;
    for (const file of Array.from(files)) {
      if (!file.name.endsWith(".md") && !file.name.endsWith(".markdown") && !file.name.endsWith(".txt")) continue;
      try {
        const raw = await file.text();
        const parsed = parseMdFile(raw);
        const note = addNote(parsed.title, parsed.content);
        if (parsed.tags.length || parsed.notebook) {
          updateNote(note.id, { tags: parsed.tags, notebook: parsed.notebook });
        }
        imported++;
      } catch { /* skip bad files */ }
    }
    if (imported > 0) toast({ title: `${imported} nota${imported > 1 ? "s" : ""} importada${imported > 1 ? "s" : ""}` });
  }, [addNote, updateNote]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleImportFiles(e.target.files);
    e.target.value = "";
  };

  // Drag & drop import
  const [isDragOver, setIsDragOver] = useState(false);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length) handleImportFiles(e.dataTransfer.files);
  }, [handleImportFiles]);

  // ── Duplicate note ──────────────────────────────────────────────────────
  const handleDuplicateNote = (srcNote: Note) => {
    const dup = addNote(`${srcNote.title} (cópia)`, srcNote.content);
    updateNote(dup.id, { tags: srcNote.tags, color: srcNote.color, notebook: srcNote.notebook });
    openNote({ ...dup, tags: srcNote.tags, color: srcNote.color, notebook: srcNote.notebook });
    toast({ title: "Nota duplicada" });
  };

  // ── Export note as .md ──────────────────────────────────────────────────
  const handleExportNote = (note: Note) => {
    const frontmatter = [
      "---",
      `title: "${note.title}"`,
      note.notebook ? `notebook: "${note.notebook}"` : null,
      note.tags?.length ? `tags: [${note.tags.map(t => `"${t}"`).join(", ")}]` : null,
      note.created_at ? `created: ${note.created_at}` : null,
      "---",
      "",
    ].filter(Boolean).join("\n");
    const content = frontmatter + note.content;
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${note.title.replace(/[^a-zA-Z0-9À-ú\s-]/g, "").replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Nota exportada como .md" });
  };

  // ── Export transcription as .txt ────────────────────────────────────────
  const handleExportTxt = (note: Note) => {
    const plain = getPlainTextFromHtml(note.content);
    const blob = new Blob([plain], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${note.title.replace(/[^a-zA-Z0-9À-ú\s-]/g, "").replace(/\s+/g, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exportado como .txt" });
  };

  // ── Export transcription as .srt ────────────────────────────────────────
  const handleExportSrt = (note: Note) => {
    const div = document.createElement("div");
    div.innerHTML = note.content;
    const allElements = Array.from(div.querySelectorAll("h3, p"));
    let inTranscript = false;
    const entries: { timestamp: number; text: string }[] = [];
    for (const el of allElements) {
      if (el.tagName === "H3" && el.textContent?.includes("Transcrição Completa")) { inTranscript = true; continue; }
      if (inTranscript && el.tagName === "P" && el.textContent?.trim()) {
        const text = el.textContent.trim();
        const tsMatch = text.match(/^(\d{2}):(\d{2})\s/);
        const timestamp = tsMatch ? parseInt(tsMatch[1]) * 60 + parseInt(tsMatch[2]) : -1;
        entries.push({ timestamp, text });
      }
    }
    if (entries.length === 0) {
      const plain = getPlainTextFromHtml(note.content);
      plain.split("\n").filter(l => l.trim()).forEach((line, i) => {
        entries.push({ timestamp: i * 5, text: line });
      });
    }
    const fmt = (sec: number) => {
      const h = Math.floor(sec / 3600).toString().padStart(2, "0");
      const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
      const ss = (sec % 60).toString().padStart(2, "0");
      return `${h}:${m}:${ss},000`;
    };
    const srtLines = entries.map((entry, i) => {
      const startSec = entry.timestamp >= 0 ? entry.timestamp : i * 5;
      const nextTs = entries[i + 1]?.timestamp;
      const endSec = nextTs && nextTs > startSec ? nextTs : startSec + 5;
      return `${i + 1}\n${fmt(startSec)} --> ${fmt(endSec)}\n${entry.text}\n`;
    });
    const blob = new Blob([srtLines.join("\n")], { type: "text/srt;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${note.title.replace(/[^a-zA-Z0-9À-ú\s-]/g, "").replace(/\s+/g, "-").toLowerCase()}.srt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exportado como .srt (legendas)" });
  };

  const isTranscriptionNote = (note: Note) => note.tags?.includes("transcrição");

  // ── Print note ──────────────────────────────────────────────────────────
  const handlePrintNote = (note: Note) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const mdToHtml = (md: string) => {
      return md
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/~~(.+?)~~/g, '<del>$1</del>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/^- \[x\] (.+)$/gm, '<li style="list-style:none">☑ $1</li>')
        .replace(/^- \[ \] (.+)$/gm, '<li style="list-style:none">☐ $1</li>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
        .replace(/\n/g, '<br>');
    };
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${note.title}</title>
      <style>body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;color:#222;line-height:1.6}
      h1{font-size:1.5em;border-bottom:1px solid #ddd;padding-bottom:8px}
      h2{font-size:1.2em;margin-top:24px}h3{font-size:1.1em;margin-top:20px}
      code{background:#f4f4f4;padding:2px 6px;border-radius:4px;font-size:0.9em}
      pre{background:#f4f4f4;padding:12px;border-radius:8px;overflow-x:auto}
      blockquote{border-left:3px solid #ddd;margin-left:0;padding-left:16px;color:#666}
      li{margin:2px 0}del{color:#999}
      .meta{color:#888;font-size:0.85em;margin-bottom:16px}</style></head><body>
      <h1>${note.title}</h1>
      <div class="meta">${note.notebook ? `📓 ${note.notebook} · ` : ""}${note.tags?.length ? note.tags.map(t => `#${t}`).join(" ") + " · " : ""}${new Date(note.updated_at || note.created_at || Date.now()).toLocaleDateString("pt-BR")}</div>
      <div>${mdToHtml(note.content)}</div></body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  // ── Bulk operations ─────────────────────────────────────────────────────
  const toggleBulkSelect = (id: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const count = bulkSelected.size;
    for (const id of bulkSelected) {
      deleteNote(id);
      if (selectedId === id) setSelectedId(null);
    }
    setBulkSelected(new Set());
    toast({ title: `${count} nota${count > 1 ? "s" : ""} movida${count > 1 ? "s" : ""} para a lixeira` });
  };

  const handleBulkExport = () => {
    for (const id of bulkSelected) {
      const note = state.notes.find(n => n.id === id);
      if (note) handleExportNote(note);
    }
    setBulkSelected(new Set());
  };

  const handleSelectAll = () => {
    if (bulkSelected.size === sorted.length) {
      setBulkSelected(new Set());
    } else {
      setBulkSelected(new Set(sorted.map(n => n.id)));
    }
  };

  const handleBulkPin = () => {
    const notes = state.notes.filter(n => bulkSelected.has(n.id));
    const allPinned = notes.every(n => n.pinned);
    for (const n of notes) updateNote(n.id, { pinned: !allPinned });
    toast({ title: allPinned ? "Notas desafixadas" : "Notas fixadas" });
    setBulkSelected(new Set());
  };

  const handleBulkFavorite = () => {
    const notes = state.notes.filter(n => bulkSelected.has(n.id));
    const allFav = notes.every(n => n.favorited);
    for (const n of notes) updateNote(n.id, { favorited: !allFav });
    toast({ title: allFav ? "Favoritos removidos" : "Notas favoritadas" });
    setBulkSelected(new Set());
  };

  const handleBulkNotebook = (notebook: string) => {
    for (const id of bulkSelected) updateNote(id, { notebook: notebook || undefined });
    toast({ title: notebook ? `Movidas para "${notebook}"` : "Caderno removido" });
    setBulkSelected(new Set());
  };

  const handleBulkColor = (color: string) => {
    for (const id of bulkSelected) updateNote(id, { color });
    toast({ title: "Cor alterada" });
    setBulkSelected(new Set());
  };

  const togglePin = (id: string) => { const n = state.notes.find(x => x.id === id); if (n) updateNote(id, { pinned: !n.pinned }); };
  const toggleFavorite = (id: string) => { const n = state.notes.find(x => x.id === id); if (n) updateNote(id, { favorited: !n.favorited }); };

  const handleDeleteNotebook = async (notebook: string) => {
    const ok = await confirm({ title: "Excluir caderno?", description: `Todas as notas do caderno "${notebook}" ficarão sem caderno. Nenhuma nota será excluída.`, confirmLabel: "Excluir caderno" });
    if (!ok) return;
    state.notes.filter(n => n.notebook === notebook).forEach(n => updateNote(n.id, { notebook: undefined }));
    if (filterNotebook === notebook) setFilterNotebook("all");
    toast({ title: `Caderno "${notebook}" removido` });
  };

  const handleCreateNotebook = () => {
    const name = newNotebookName.trim();
    if (!name) return;
    if (notebooks.some(([nb]) => nb.toLowerCase() === name.toLowerCase())) {
      toast({ title: "Caderno já existe", description: `O caderno "${name}" já existe.` });
      return;
    }
    const note = addNote("Sem título", "");
    updateNote(note.id, { notebook: name });
    setNewNotebookName("");
    setShowNewNotebook(false);
    setFilterNotebook(name);
    setShowTrash(false);
    toast({ title: `Caderno "${name}" criado` });
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !editTags.includes(tag)) setEditTags(prev => [...prev, tag]);
    setTagInput("");
  };

  // Rich text content change handler
  const handleRichTextChange = useCallback((html: string) => {
    editContentState.set(html);
  }, [editContentState]);

  // AI actions
  const handleAiAction = useCallback(async (action: string, extra?: Record<string, string>) => {
    setAiLoading(action);
    try {
      const plainText = getPlainTextFromHtml(editContentState.value);
      const body: Record<string, string> = { action, text: plainText, title: editTitle, ...extra };
      const { data, error } = await invoke<any>({
        fn: "ai-router",
        body: { module: "notes", ...body },
      });
      if (error) throw new Error(error);
      if (action === "suggest_tags" && data.result?.tags) {
        setEditTags(prev => [...new Set([...prev, ...data.result.tags])]);
        toast({ title: "Tags sugeridas!", description: data.result.tags.join(", ") });
      } else if (action === "continue_writing" && data.result?.text) {
        editContentState.set(editContentState.value + data.result.text);
        toast({ title: "Texto continuado pela IA" });
      } else if (data.result?.text) {
        if (extra?.selectedText) {
          const plainContent = getPlainTextFromHtml(editContentState.value);
          if (plainContent.includes(extra.selectedText)) {
            const div = document.createElement("div");
            div.innerHTML = editContentState.value;
            const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
            let found = false;
            while (walker.nextNode() && !found) {
              const node = walker.currentNode;
              const idx = node.textContent?.indexOf(extra.selectedText) ?? -1;
              if (idx !== -1 && node.textContent) {
                const before = node.textContent.slice(0, idx);
                const after = node.textContent.slice(idx + extra.selectedText.length);
                const wrapper = document.createElement("span");
                wrapper.innerHTML = data.result.text;
                const parent = node.parentNode!;
                if (before) parent.insertBefore(document.createTextNode(before), node);
                parent.insertBefore(wrapper, node);
                if (after) parent.insertBefore(document.createTextNode(after), node);
                parent.removeChild(node);
                found = true;
              }
            }
            if (found) {
              editContentState.set(div.innerHTML);
            } else {
              editContentState.set(editContentState.value + data.result.text);
            }
          } else {
            editContentState.set(editContentState.value + data.result.text);
          }
          toast({ title: "IA substituiu o trecho selecionado" });
        } else {
          editContentState.set(data.result.text);
          toast({ title: "IA aplicou com sucesso" });
        }
      }
    } catch (err: any) {
      toast({ title: "Erro na IA", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setAiLoading(null);
    }
  }, [editContentState, editTitle]);

  // Use refs for values accessed in keyboard shortcuts to avoid stale closures
  const editStateRef = useRef({ editTitle, editContentState, editTags, editColor, editNotebook, audioBlocks });
  editStateRef.current = { editTitle, editContentState, editTags, editColor, editNotebook, audioBlocks };

  const handleBulkDeleteRef = useRef(handleBulkDelete);
  handleBulkDeleteRef.current = handleBulkDelete;

  // Keyboard shortcuts (combined into single effect)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "Escape" && focusMode) { setFocusMode(false); return; }
      if (e.key === "Escape" && bulkMode) { setBulkSelected(new Set()); return; }

      // Delete key for bulk
      if ((e.key === "Delete" || e.key === "Backspace") && bulkMode && !selectedId) {
        e.preventDefault();
        handleBulkDeleteRef.current();
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "a" && !selectedId) { e.preventDefault(); handleSelectAll(); return; }
      if (!selectedId) return;

      const st = editStateRef.current;
      if (e.key === "z" && !e.shiftKey) { e.preventDefault(); st.editContentState.undo(); }
      if (e.key === "z" && e.shiftKey) { e.preventDefault(); st.editContentState.redo(); }
      if (e.key === "s") {
        e.preventDefault();
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        const fullContent = mergeAudioBlocks(st.editContentState.value, st.audioBlocks);
        updateNote(selectedId, { title: st.editTitle, content: fullContent, tags: st.editTags, color: st.editColor, notebook: st.editNotebook || undefined });
        setLastSaved(new Date());
        toast({ title: "Nota salva" });
      }
      if (e.key === "p") { e.preventDefault(); if (selectedNote) handlePrintNote(selectedNote); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focusMode, selectedId, bulkMode, selectedNote, updateNote]);

  return {
    // Refs
    textareaRef, fileInputRef,

    // Editor state
    selectedId, setSelectedId,
    editTitle, setEditTitle,
    editTags, setEditTags,
    editColor, setEditColor,
    editNotebook, setEditNotebook,
    tagInput, setTagInput,
    previewMode, setPreviewMode,
    focusMode, setFocusMode,
    editContentState,
    selectedNote,

    // Filters / search
    searchQuery, setSearchQuery,
    showFilters, setShowFilters,
    filterNotebook, setFilterNotebook,
    filterTag, setFilterTag,
    filterFavorite, setFilterFavorite,
    sortBy, setSortBy,
    sortDir, setSortDir,
    viewMode, setViewMode,
    showNotebooks, setShowNotebooks,
    showNewNotebook, setShowNewNotebook,
    newNotebookName, setNewNotebookName,
    showTranscription, setShowTranscription,
    showVoiceRecording, setShowVoiceRecording,
    showDrawing, setShowDrawing,
    drawingFullscreen, setDrawingFullscreen,
    showTrash, setShowTrash,
    showLinksPanel, setShowLinksPanel,
    audioBlocks, setAudioBlocks,
    bulkSelected, setBulkSelected,
    bulkMode,

    // AI
    aiLoading,

    // Auto-save
    lastSaved, autoSaveTimer,

    // Derived data
    activeNotes, trashedNotes,
    notebooks, allTags,
    activeFiltersCount, sorted, stats,

    // Dialogs
    confirm, confirmDialog,

    // Data operations
    state, deleteNote, restoreNote, permanentlyDeleteNote, emptyTrash,

    // Handlers
    openNote, closeEditor, handleAddNote,
    handleTranscriptionComplete, handleTemplateNote,
    handleImportFiles, handleFileInput,
    isDragOver, setIsDragOver, handleDrop,
    handleDuplicateNote, handleExportNote, handleExportTxt, handleExportSrt,
    isTranscriptionNote, handlePrintNote,
    toggleBulkSelect, handleBulkDelete, handleBulkExport,
    handleSelectAll, handleBulkPin, handleBulkFavorite,
    handleBulkNotebook, handleBulkColor,
    togglePin, toggleFavorite,
    handleDeleteNotebook, handleCreateNotebook,
    addTag, handleRichTextChange, handleAiAction,
  };
}

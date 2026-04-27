import React, { useState, useMemo, useCallback } from "react";

// Strip HTML tags from TipTap rich-text content for plain-text preview
function stripHtml(html: string): string {
  if (!html) return "";
  // Remove audio block markers
  let text = html.replace(/<!--AUDIO_BLOCK:.*?-->/g, "");
  try {
    // Insert newlines before closing block tags so paragraphs are preserved
    text = text
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, "\n")
      .replace(/<(p|div|h[1-6]|li|tr|blockquote)[^>]*>/gi, "");
    const doc = new DOMParser().parseFromString(text, "text/html");
    const plain = doc.body.textContent || "";
    // Collapse multiple blank lines but keep single line breaks
    return plain
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch {
    return text
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
}
import DeshTooltip from "@/components/ui/DeshTooltip";
import GlassCard from "./GlassCard";
import WidgetEmptyState from "./WidgetEmptyState";
import WidgetTitle from "./WidgetTitle";
import WorkspaceBadge from "./WorkspaceBadge";
import {
  StickyNote,
  Plus,
  X,
  Trash2,
  Pin,
  Search,
  ExternalLink,
  Star,
  Tag,
  Sparkles,
  Hash,
  ArrowUpDown,
  Clock,
  Palette,
  ChevronRight,
  Copy,
  FileText,
  Wand2,
  BookOpen,
  MoreHorizontal,
  Check,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "@/contexts/DashboardContext";
import { toast } from "sonner";
import { AI_SHORTCUT_PENDING_HERMES_TOOLS } from "@/lib/aiShortcuts";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const NOTE_COLORS = [
  { value: "border-l-primary", label: "Azul", dot: "bg-primary" },
  { value: "border-l-accent", label: "Acento", dot: "bg-accent" },
  { value: "border-l-yellow-400", label: "Amarelo", dot: "bg-yellow-400" },
  { value: "border-l-green-400", label: "Verde", dot: "bg-green-400" },
  { value: "border-l-destructive", label: "Vermelho", dot: "bg-destructive" },
  { value: "border-l-purple-400", label: "Roxo", dot: "bg-purple-400" },
  { value: "border-l-muted-foreground", label: "Cinza", dot: "bg-muted-foreground" },
];

type SortMode = "recent" | "alpha" | "color";

const NotesWidget = () => {
  const navigate = useNavigate();
  const { state, addNote, updateNote, deleteNote } = useDashboard();
  // Filter out soft-deleted (trashed) notes to stay in sync with the notes module
  const notes = useMemo(() => state.notes.filter((n) => !n.deleted_at), [state.notes]);

  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [colorPicker, setColorPicker] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState<string | null>(null);
  const [popupEditing, setPopupEditing] = useState<string | null>(null);
  const [popupEditTitle, setPopupEditTitle] = useState("");
  const [popupEditContent, setPopupEditContent] = useState("");

  // All unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => n.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [notes]);

  // Stats
  const stats = useMemo(
    () => ({
      total: notes.length,
      pinned: notes.filter((n) => n.pinned).length,
      favorited: notes.filter((n) => n.favorited).length,
      withTags: notes.filter((n) => n.tags && n.tags.length > 0).length,
    }),
    [notes],
  );

  // Filter and sort
  const filtered = useMemo(() => {
    let list = [...notes];
    if (showFavoritesOnly) list = list.filter((n) => n.favorited);
    if (filterTag) list = list.filter((n) => n.tags?.includes(filterTag));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          stripHtml(n.content).toLowerCase().includes(q) ||
          n.tags?.some((t) => t.toLowerCase().includes(q)),
      );
    }
    // Sort: pinned first always
    list.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      if (sortMode === "alpha") return a.title.localeCompare(b.title);
      if (sortMode === "color") return a.color.localeCompare(b.color);
      // recent: by updated_at desc
      return (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || "");
    });
    return list;
  }, [notes, searchQuery, sortMode, filterTag, showFavoritesOnly]);

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    addNote(newTitle.trim(), newContent.trim());
    setNewTitle("");
    setNewContent("");
    setAdding(false);
    toast.success("Nota criada");
  };

  const togglePin = (id: string, current?: boolean) => updateNote(id, { pinned: !current });
  const toggleFavorite = (id: string, current?: boolean) => updateNote(id, { favorited: !current });

  const addTagToNote = (id: string) => {
    if (!tagInput.trim()) return;
    const note = notes.find((n) => n.id === id);
    const currentTags = note?.tags || [];
    if (currentTags.includes(tagInput.trim())) {
      setTagInput("");
      return;
    }
    updateNote(id, { tags: [...currentTags, tagInput.trim()] });
    setTagInput("");
    setShowTagInput(null);
  };

  const removeTag = (id: string, tag: string) => {
    const note = notes.find((n) => n.id === id);
    updateNote(id, { tags: (note?.tags || []).filter((t) => t !== tag) });
  };

  const duplicateNote = (id: string) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    addNote(`${note.title} (cópia)`, note.content);
    toast.success("Nota duplicada");
  };

  const copyContent = (content: string) => {
    navigator.clipboard.writeText(stripHtml(content));
    toast.success("Conteúdo copiado");
  };

  // AI actions
  const runAI = useCallback(
    async (noteId: string, action: string, extra?: Record<string, string>) => {
      const note = notes.find((n) => n.id === noteId);
      if (!note) return;
      void action;
      void extra;
      setAiLoading(null);
      toast.error(AI_SHORTCUT_PENDING_HERMES_TOOLS);
    },
    [notes],
  );

  const startPopupEdit = (note: (typeof notes)[0]) => {
    setPopupEditing(note.id);
    setPopupEditTitle(note.title);
    setPopupEditContent(stripHtml(note.content));
  };

  const savePopupEdit = (id: string) => {
    // Wrap plain-text lines back into <p> tags for TipTap compatibility
    const htmlContent = popupEditContent
      .split("\n")
      .map((line) => `<p>${line || "<br>"}</p>`)
      .join("");
    updateNote(id, { title: popupEditTitle, content: htmlContent });
    setPopupEditing(null);
    toast.success("Nota salva");
  };

  const formatDate = (d?: string) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Compact card note
  const NoteCardCompact = ({ note }: { note: (typeof notes)[0] }) => (
    <div
      className={`p-2.5 rounded-lg bg-foreground/5 border-l-2 ${note.color} cursor-pointer hover:bg-foreground/10 transition-colors group relative`}
      onClick={() => setEditing(editing === note.id ? null : note.id)}
    >
      {/* Action buttons */}
      <div className="absolute top-1.5 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(note.id, note.favorited);
          }}
          className={`p-0.5 transition-colors ${note.favorited ? "text-yellow-400" : "text-muted-foreground hover:text-yellow-400"}`}
        >
          <Star className="w-3 h-3" fill={note.favorited ? "currentColor" : "none"} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePin(note.id, note.pinned);
          }}
          className={`p-0.5 transition-colors ${note.pinned ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
        >
          <Pin className="w-3 h-3" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            deleteNote(note.id);
          }}
          className="p-0.5 text-destructive/60 hover:text-destructive transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {editing === note.id ? (
        <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
          <input
            value={note.title}
            onChange={(e) => updateNote(note.id, { title: e.target.value })}
            className="w-full bg-transparent text-sm font-medium text-foreground/90 outline-none"
          />
          <textarea
            value={stripHtml(note.content)}
            readOnly
            className="w-full bg-transparent text-xs text-muted-foreground outline-none resize-none cursor-text"
            rows={3}
          />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1 pr-16">
            {note.pinned && <Pin className="w-2.5 h-2.5 text-primary flex-shrink-0" />}
            {note.favorited && (
              <Star className="w-2.5 h-2.5 text-yellow-400 flex-shrink-0" fill="currentColor" />
            )}
            <p className="text-sm font-medium text-foreground/90 truncate">{note.title}</p>
            <WorkspaceBadge workspaceId={note.workspace_id} />
          </div>
          <p className="text-xs text-muted-foreground truncate">{stripHtml(note.content)}</p>
          {note.tags && note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {note.tags.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary"
                >
                  {t}
                </span>
              ))}
              {note.tags.length > 3 && (
                <span className="text-[10px] text-muted-foreground">+{note.tags.length - 3}</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );

  // Full note card for popup
  const NoteCardFull = ({ note }: { note: (typeof notes)[0] }) => {
    const isEditing = popupEditing === note.id;
    const isAiWorking = aiLoading === note.id;

    return (
      <div
        className={`p-4 rounded-xl bg-foreground/5 border-l-3 ${note.color} group relative transition-all hover:bg-foreground/[0.07]`}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {note.pinned && <Pin className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
            {note.favorited && (
              <Star className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" fill="currentColor" />
            )}
            {isEditing ? (
              <input
                value={popupEditTitle}
                onChange={(e) => setPopupEditTitle(e.target.value)}
                className="flex-1 bg-foreground/5 rounded px-2 py-1 text-sm font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary/40"
                autoFocus
              />
            ) : (
              <p className="text-sm font-semibold text-foreground truncate">{note.title}</p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {isEditing ? (
              <button
                onClick={() => savePopupEdit(note.id)}
                className="p-1 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => startPopupEdit(note)}
                className="p-1 text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
              >
                <FileText className="w-3.5 h-3.5" />
              </button>
            )}
            {/* AI menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-1 text-muted-foreground hover:text-primary transition-colors"
                  disabled={isAiWorking}
                >
                  {isAiWorking ? (
                    <span className="w-3.5 h-3.5 border-2 border-primary/40 border-t-primary rounded-full animate-spin inline-block" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => runAI(note.id, "summarize")}>
                  📝 Resumir
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => runAI(note.id, "expand")}>
                  📖 Expandir
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => runAI(note.id, "correct")}>
                  ✏️ Corrigir
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => runAI(note.id, "translate")}>
                  🌍 Traduzir
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => runAI(note.id, "continue_writing")}>
                  ✍️ Continuar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => runAI(note.id, "suggest_tags")}>
                  🏷️ Sugerir tags
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => runAI(note.id, "generate_outline")}>
                  📋 Gerar outline
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => runAI(note.id, "change_tone", { tone: "formal" })}>
                  🎩 Tom formal
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => runAI(note.id, "change_tone", { tone: "casual" })}>
                  😄 Tom casual
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => runAI(note.id, "change_tone", { tone: "concise" })}
                >
                  ⚡ Tom conciso
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* More actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => togglePin(note.id, note.pinned)}>
                  <Pin className="w-3 h-3 mr-2" />
                  {note.pinned ? "Desafixar" : "Fixar"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toggleFavorite(note.id, note.favorited)}>
                  <Star className="w-3 h-3 mr-2" />
                  {note.favorited ? "Desfavoritar" : "Favoritar"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => duplicateNote(note.id)}>
                  <Copy className="w-3 h-3 mr-2" />
                  Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => copyContent(note.content)}>
                  <Copy className="w-3 h-3 mr-2" />
                  Copiar texto
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setColorPicker(colorPicker === note.id ? null : note.id)}
                >
                  <Palette className="w-3 h-3 mr-2" />
                  Cor
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => deleteNote(note.id)} className="text-destructive">
                  <Trash2 className="w-3 h-3 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Color picker */}
        {colorPicker === note.id && (
          <div className="flex gap-1.5 mb-2 p-1.5 rounded-lg bg-foreground/5">
            {NOTE_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => {
                  updateNote(note.id, { color: c.value });
                  setColorPicker(null);
                }}
                className={`w-5 h-5 rounded-full ${c.dot} ring-2 ${note.color === c.value ? "ring-foreground" : "ring-transparent"} hover:ring-foreground/50 transition-all`}
                title={c.label}
              />
            ))}
          </div>
        )}

        {/* Content */}
        {isEditing ? (
          <textarea
            value={popupEditContent}
            onChange={(e) => setPopupEditContent(e.target.value)}
            className="w-full bg-foreground/5 rounded-lg px-3 py-2 text-xs text-foreground leading-relaxed outline-none focus:ring-1 focus:ring-primary/40 resize-none min-h-[80px]"
            rows={5}
          />
        ) : (
          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap mb-2">
            {stripHtml(note.content) || <span className="italic">Sem conteúdo</span>}
          </p>
        )}

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-1 mt-2">
          {note.tags?.map((t) => (
            <Badge
              key={t}
              variant="secondary"
              className="text-[10px] px-1.5 py-0 gap-1 cursor-default"
            >
              <Hash className="w-2.5 h-2.5" />
              {t}
              <button
                onClick={() => removeTag(note.id, t)}
                className="ml-0.5 hover:text-destructive"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </Badge>
          ))}
          {showTagInput === note.id ? (
            <div className="flex items-center gap-1">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Tag..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTagToNote(note.id);
                  if (e.key === "Escape") setShowTagInput(null);
                }}
                className="w-20 text-[10px] bg-foreground/5 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-primary/30"
                autoFocus
              />
              <button onClick={() => addTagToNote(note.id)} className="text-primary">
                <Check className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setShowTagInput(note.id);
                setTagInput("");
              }}
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              <Tag className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Meta */}
        {note.updated_at && (
          <p className="text-[10px] text-muted-foreground/60 mt-2 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {formatDate(note.updated_at)}
          </p>
        )}
      </div>
    );
  };

  // ===== POPUP CONTENT =====
  const popupContent = (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <StickyNote className="w-3 h-3" />
          {stats.total} notas
        </span>
        <span className="flex items-center gap-1">
          <Pin className="w-3 h-3" />
          {stats.pinned} fixadas
        </span>
        <span className="flex items-center gap-1">
          <Star className="w-3 h-3" />
          {stats.favorited} favoritas
        </span>
        <span className="flex items-center gap-1">
          <Tag className="w-3 h-3" />
          {allTags.length} tags
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar notas, tags..."
              className="w-full bg-foreground/5 rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
        </div>
        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`p-1.5 rounded-lg transition-colors ${showFavoritesOnly ? "bg-yellow-400/20 text-yellow-500" : "text-muted-foreground hover:text-foreground bg-foreground/5"}`}
        >
          <Star className="w-3.5 h-3.5" fill={showFavoritesOnly ? "currentColor" : "none"} />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground bg-foreground/5 transition-colors">
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => setSortMode("recent")}
              className={sortMode === "recent" ? "font-medium" : ""}
            >
              Recentes
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSortMode("alpha")}
              className={sortMode === "alpha" ? "font-medium" : ""}
            >
              A → Z
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSortMode("color")}
              className={sortMode === "color" ? "font-medium" : ""}
            >
              Cor
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          onClick={() => setAdding(!adding)}
          className="px-2.5 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Nova
        </button>
      </div>

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setFilterTag(null)}
            className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${!filterTag ? "bg-primary/20 text-primary" : "bg-foreground/5 text-muted-foreground hover:text-foreground"}`}
          >
            Todas
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => setFilterTag(filterTag === t ? null : t)}
              className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${filterTag === t ? "bg-primary/20 text-primary" : "bg-foreground/5 text-muted-foreground hover:text-foreground"}`}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="p-3 rounded-xl bg-foreground/5 border-l-2 border-l-primary space-y-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Título da nota..."
            className="w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none"
            autoFocus
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Conteúdo..."
            className="w-full bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground outline-none resize-none"
            rows={3}
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors"
            >
              Salvar
            </button>
            <button
              onClick={() => setAdding(false)}
              className="px-3 py-1.5 rounded-lg bg-foreground/5 text-muted-foreground text-xs hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Notes list */}
      <div className="space-y-3">
        {filtered.map((note) => (
          <NoteCardFull key={note.id} note={note} />
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground italic text-center py-8">
            {searchQuery || filterTag || showFavoritesOnly
              ? "Nenhuma nota encontrada com esses filtros"
              : "Nenhuma nota ainda"}
          </p>
        )}
      </div>

      {/* Open full page */}
      <button
        onClick={() => navigate("/notes")}
        className="w-full py-2 rounded-lg bg-foreground/5 text-xs text-muted-foreground hover:text-primary hover:bg-foreground/10 transition-colors flex items-center justify-center gap-1.5"
      >
        <BookOpen className="w-3.5 h-3.5" /> Abrir editor completo{" "}
        <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );

  return (
    <GlassCard className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <WidgetTitle
          label="Notas"
          icon={<StickyNote className="w-3.5 h-3.5 text-yellow-400" />}
          popupIcon={<StickyNote className="w-5 h-5 text-primary" />}
          popupContent={popupContent}
        />
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setShowSearch(!showSearch);
              setSearchQuery("");
            }}
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setAdding(!adding)}
            className="text-primary hover:scale-110 transition-transform"
          >
            {adding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
          <DeshTooltip label="Ver tudo">
            <button
              onClick={() => navigate("/notes")}
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </DeshTooltip>
        </div>
      </div>

      {showSearch && (
        <div className="mb-3">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar notas..."
            className="w-full bg-foreground/5 rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50"
            autoFocus
          />
        </div>
      )}

      {adding && (
        <div className="mb-3 p-2.5 rounded-lg bg-foreground/5 border-l-2 border-l-primary space-y-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Título..."
            className="w-full bg-transparent text-sm font-medium text-foreground/90 placeholder:text-muted-foreground outline-none"
            autoFocus
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Conteúdo..."
            className="w-full bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground outline-none resize-none"
            rows={2}
          />
          <button
            onClick={handleAdd}
            className="px-3 py-1 rounded-lg bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors"
          >
            Salvar
          </button>
        </div>
      )}

      <div className="space-y-2 flex-1 overflow-y-auto min-h-0 scrollbar-thin">
        {filtered.map((note) => (
          <NoteCardCompact key={note.id} note={note} />
        ))}
        {filtered.length === 0 && state.loaded && (
          <WidgetEmptyState
            icon={StickyNote}
            title={searchQuery ? "Nenhuma nota encontrada" : "Nenhuma nota ainda"}
            description={!searchQuery ? "Crie sua primeira nota acima" : undefined}
          />
        )}
      </div>
    </GlassCard>
  );
};

export default React.memo(NotesWidget);

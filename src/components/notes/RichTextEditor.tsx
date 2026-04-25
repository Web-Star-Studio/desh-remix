import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
// Side-effect imports: merge command type augmentations into ChainedCommands.
import "@tiptap/extension-bold";
import "@tiptap/extension-italic";
import "@tiptap/extension-strike";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { useEffect, useCallback, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { SlashCommands } from "./SlashCommandExtension";
import { DeshMention } from "./MentionExtension";
import { DeshLinkNode } from "./DeshLinkExtension";
import { DeshLinkPicker, type DeshLinkType } from "./DeshLinkPicker";
import { LinkInputPopover } from "./LinkInputPopover";
import { uploadNoteImage } from "@/lib/noteImageUpload";
import { toast } from "@/hooks/use-toast";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Quote, Code, Minus, Link as LinkIcon, Highlighter,
  Table as TableIcon, Undo2, Redo2, Sparkles, Mic,
  CheckCircle, RefreshCw, FileText, Wand2, Scissors, Languages,
  ChevronDown, Loader2, PenTool, ImageIcon
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AIWritingToolsPanel } from "./AIWritingToolsPanel";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  onReady?: () => void;
  focusMode?: boolean;
  onAiAction?: (action: string, extra?: Record<string, string>) => void;
  aiLoading?: string | null;
  onMicClick?: () => void;
  onDrawClick?: () => void;
}

export function RichTextEditor({ content, onChange, onReady, focusMode, onAiAction, aiLoading, onMicClick, onDrawClick }: RichTextEditorProps) {
  const [bubbleAiExpanded, setBubbleAiExpanded] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [linkPickerType, setLinkPickerType] = useState<DeshLinkType | null>(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageFiles = useCallback(async (files: File[], view: any) => {
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "Imagem muito grande", description: "Máximo 10MB", variant: "destructive" });
        continue;
      }
      setImageUploading(true);
      try {
        const url = await uploadNoteImage(file);
        const node = view.state.schema.nodes.image.create({ src: url, alt: file.name });
        const tr = view.state.tr.replaceSelectionWith(node);
        view.dispatch(tr);
      } catch (err: any) {
        toast({ title: "Erro ao enviar imagem", description: err.message, variant: "destructive" });
      } finally {
        setImageUploading(false);
      }
    }
  }, []);

  const editor = useEditor({
    extensions: ([
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder: "Comece a escrever..." }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline cursor-pointer" } }),
      Highlight.configure({ multicolor: false }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: "rounded-xl max-w-full h-auto my-4 border border-border/20 shadow-sm",
        },
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      SlashCommands,
      DeshMention,
      DeshLinkNode,
    ] as unknown as never[]),
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: `outline-none min-h-[300px] p-6 prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-p:text-foreground/80 prose-code:text-primary prose-strong:text-foreground prose-a:text-primary prose-img:rounded-xl prose-img:max-w-full ${focusMode ? "max-w-2xl mx-auto" : ""}`,
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved || !event.dataTransfer?.files.length) return false;
        const file = event.dataTransfer.files[0];
        if (file?.type.startsWith("image/")) {
          event.preventDefault();
          handleImageFiles([file], view);
          return true;
        }
        return false;
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) handleImageFiles([file], view);
            return true;
          }
        }
        return false;
      },
    },
  });

  // Sync content from outside (e.g. when switching notes)
  // Use queueMicrotask to avoid corrupting TipTap's internal transaction state
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      queueMicrotask(() => {
        // Set content without emitting update to avoid loops
        editor.commands.setContent(content, { emitUpdate: false });
      });
    }
  }, [content]);

  useEffect(() => {
    if (editor && onReady) onReady();
  }, [editor]);

  // Reset bubble AI expanded state when selection changes
  useEffect(() => {
    if (!editor) return;
    const handler = () => setBubbleAiExpanded(false);
    editor.on("selectionUpdate", handler);
    return () => { editor.off("selectionUpdate", handler); };
  }, [editor]);

  // ⌘K keyboard shortcut for link insertion
  useEffect(() => {
    if (!editor) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowLinkInput(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editor]);

  // Listen for deep link picker events from slash commands
  useEffect(() => {
    if (!editor) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type) setLinkPickerType(detail.type as DeshLinkType);
    };
    window.addEventListener("notes:open-link-picker", handler);
    return () => window.removeEventListener("notes:open-link-picker", handler);
  }, [editor]);

  // Listen for slash command image insert event
  useEffect(() => {
    if (!editor) return;
    const handler = () => imageInputRef.current?.click();
    window.addEventListener("notes:insert-image", handler);
    return () => window.removeEventListener("notes:insert-image", handler);
  }, [editor]);

  const getSelectedText = useCallback(() => {
    if (!editor) return "";
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, " ");
  }, [editor]);

  const handleBubbleAiAction = useCallback((action: string, extra?: Record<string, string>) => {
    if (!onAiAction) return;
    const selected = getSelectedText();
    if (selected) {
      onAiAction(action, { ...extra, selectedText: selected });
    } else {
      onAiAction(action, extra);
    }
  }, [onAiAction, getSelectedText]);

  const addLink = useCallback(() => {
    if (!editor) return;
    setShowLinkInput(true);
  }, [editor]);

  const handleLinkSubmit = useCallback((url: string) => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const handleLinkRemove = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
  }, [editor]);

  const addTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  if (!editor) return null;

  const hasContent = editor.getText().trim().length > 0;
  const hasSelection = !editor.state.selection.empty;

  const ToolBtn = ({ active, onClick, title, children, disabled }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode; disabled?: boolean }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`p-2 rounded-xl transition-colors ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"} disabled:opacity-20`}
    >
      {children}
    </button>
  );

  const bubbleAiActions = [
    { key: "proofread", label: "Revisar", icon: <CheckCircle className="w-3.5 h-3.5" /> },
    { key: "rewrite", label: "Reescrever", icon: <RefreshCw className="w-3.5 h-3.5" /> },
    { key: "summarize", label: "Resumir", icon: <FileText className="w-3.5 h-3.5" /> },
  ];

  const bubbleAiMoreActions = [
    { key: "expand", label: "Expandir", icon: <Wand2 className="w-3.5 h-3.5" /> },
    { key: "change_tone", label: "Conciso", icon: <Scissors className="w-3.5 h-3.5" />, extra: { tone: "concise" } },
    { key: "translate", label: "Traduzir", icon: <Languages className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-border/20 flex-shrink-0 flex-wrap bg-foreground/5">
        <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Desfazer (⌘Z)" disabled={!editor.can().undo()}>
          <Undo2 className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Refazer (⌘⇧Z)" disabled={!editor.can().redo()}>
          <Redo2 className="w-3.5 h-3.5" />
        </ToolBtn>
        <span className="w-px h-4 bg-border/30 mx-1" />
        <ToolBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito (⌘B)">
          <Bold className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico (⌘I)">
          <Italic className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Sublinhado (⌘U)">
          <UnderlineIcon className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Tachado">
          <Strikethrough className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()} title="Destaque">
          <Highlighter className="w-3.5 h-3.5" />
        </ToolBtn>
        <span className="w-px h-4 bg-border/30 mx-1" />
        <ToolBtn active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Título H1">
          <Heading1 className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Título H2">
          <Heading2 className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Título H3">
          <Heading3 className="w-3.5 h-3.5" />
        </ToolBtn>
        <span className="w-px h-4 bg-border/30 mx-1" />
        <ToolBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista">
          <List className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Checklist">
          <CheckSquare className="w-3.5 h-3.5" />
        </ToolBtn>
        <span className="w-px h-4 bg-border/30 mx-1" />
        <ToolBtn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citação">
          <Quote className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Bloco de código">
          <Code className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Separador">
          <Minus className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("link")} onClick={addLink} title="Link (⌘K)">
          <LinkIcon className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn onClick={addTable} title="Inserir tabela">
          <TableIcon className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => imageInputRef.current?.click()} title="Inserir imagem" disabled={imageUploading}>
          {imageUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
        </ToolBtn>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && editor) {
              handleImageFiles([file], editor.view);
            }
            e.target.value = "";
          }}
        />

        {/* Separator before Draw/AI/Mic buttons */}
        {(onAiAction || onMicClick || onDrawClick) && <span className="w-px h-4 bg-border/30 mx-1" />}

        {/* Draw button */}
        {onDrawClick && (
          <ToolBtn onClick={onDrawClick} title="Desenhar (Handwriting)">
            <PenTool className="w-3.5 h-3.5" />
          </ToolBtn>
        )}

        {/* Mic button */}
        {onMicClick && (
          <ToolBtn onClick={onMicClick} title="Gravar áudio (Mic)">
            <Mic className="w-3.5 h-3.5" />
          </ToolBtn>
        )}

        {/* AI Writing Tools modal trigger */}
        {onAiAction && (
          <>
            <button
              title="Ferramentas de Escrita IA"
              aria-label="Ferramentas de Escrita IA"
              onClick={() => setShowAiPanel(true)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-medium transition-colors text-primary bg-primary/10 hover:bg-primary/20"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">IA</span>
            </button>

            {/* Fixed centered AI panel overlay — portal to body to escape overflow */}
            {showAiPanel && createPortal(
              <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={() => setShowAiPanel(false)}>
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                <div
                  onClick={e => e.stopPropagation()}
                  className="relative w-80 max-h-[80vh] overflow-y-auto rounded-2xl border border-border/50 bg-popover shadow-2xl shadow-black/30 animate-in fade-in-0 zoom-in-95 duration-150"
                >
                  <AIWritingToolsPanel
                    onAction={(action, extra) => {
                      onAiAction(action, extra);
                      setShowAiPanel(false);
                    }}
                    loading={aiLoading ?? null}
                    hasContent={hasContent}
                    hasSelection={hasSelection}
                  />
                </div>
              </div>,
              document.body
            )}
          </>
        )}
      </div>

      {/* Enhanced Bubble menu — Apple Notes style AI quick actions */}
      {onAiAction && (
        <BubbleMenu editor={editor}>
          <div className="flex flex-col rounded-2xl bg-popover/95 backdrop-blur-xl border border-border/50 shadow-2xl shadow-black/20 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
            {/* Formatting row */}
            <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-border/20">
              <BubbleBtn
                active={editor.isActive("bold")}
                onClick={() => editor.chain().focus().toggleBold().run()}
                title="Negrito"
              >
                <Bold className="w-3.5 h-3.5" />
              </BubbleBtn>
              <BubbleBtn
                active={editor.isActive("italic")}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                title="Itálico"
              >
                <Italic className="w-3.5 h-3.5" />
              </BubbleBtn>
              <BubbleBtn
                active={editor.isActive("underline")}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                title="Sublinhado"
              >
                <UnderlineIcon className="w-3.5 h-3.5" />
              </BubbleBtn>
              <BubbleBtn
                active={editor.isActive("strike")}
                onClick={() => editor.chain().focus().toggleStrike().run()}
                title="Tachado"
              >
                <Strikethrough className="w-3.5 h-3.5" />
              </BubbleBtn>
              <BubbleBtn
                active={editor.isActive("highlight")}
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                title="Destaque"
              >
                <Highlighter className="w-3.5 h-3.5" />
              </BubbleBtn>
              <span className="w-px h-4 bg-border/20 mx-0.5" />
              <BubbleBtn
                active={editor.isActive("link")}
                onClick={addLink}
                title="Link"
              >
                <LinkIcon className="w-3.5 h-3.5" />
              </BubbleBtn>
            </div>

            {/* AI actions row */}
            <div className="flex items-center gap-0.5 px-1.5 py-1">
              <span className="flex items-center gap-1 px-1.5 text-primary">
                <Sparkles className="w-3 h-3" />
              </span>
              {bubbleAiActions.map(a => (
                <BubbleAiBtn
                  key={a.key}
                  icon={a.icon}
                  label={a.label}
                  loading={aiLoading === a.key}
                  disabled={!!aiLoading}
                  onClick={() => handleBubbleAiAction(a.key)}
                />
              ))}
              {/* Expand more actions */}
              <button
                onClick={() => setBubbleAiExpanded(v => !v)}
                className={`p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all ${bubbleAiExpanded ? "rotate-180 text-primary" : ""}`}
                title="Mais ações de IA"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Expanded AI actions */}
            {bubbleAiExpanded && (
              <div className="flex items-center gap-0.5 px-1.5 py-1 border-t border-border/20 bg-foreground/5">
                {bubbleAiMoreActions.map(a => (
                  <BubbleAiBtn
                    key={a.key}
                    icon={a.icon}
                    label={a.label}
                    loading={aiLoading === a.key}
                    disabled={!!aiLoading}
                    onClick={() => handleBubbleAiAction(a.key, a.extra)}
                  />
                ))}
              </div>
            )}
          </div>
        </BubbleMenu>
      )}

      {/* Editor content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <EditorContent editor={editor} className="h-full" />
      </div>

      {/* DeshLink Picker */}
      {linkPickerType && editor && (
        <DeshLinkPicker
          linkType={linkPickerType}
          editor={editor}
          onClose={() => setLinkPickerType(null)}
        />
      )}

      {/* Link Input Popover */}
      {showLinkInput && editor && (
        <LinkInputPopover
          initialUrl={editor.getAttributes("link").href || ""}
          onSubmit={handleLinkSubmit}
          onRemove={editor.isActive("link") ? handleLinkRemove : undefined}
          onClose={() => setShowLinkInput(false)}
        />
      )}
    </div>
  );
}

/* ── Bubble menu button helpers ───────────────────────────────── */

function BubbleBtn({ active, onClick, title, children }: {
  active?: boolean; onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-lg transition-colors ${
        active
          ? "bg-primary/15 text-primary"
          : "text-foreground/70 hover:text-foreground hover:bg-muted/50"
      }`}
    >
      {children}
    </button>
  );
}

function BubbleAiBtn({ icon, label, onClick, disabled, loading }: {
  icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-foreground/70 hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {label}
    </button>
  );
}

// Helper to get plain text from HTML for stats/search
export function getPlainTextFromHtml(html: string): string {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

// Simple markdown to HTML converter for migrating old content
export function markdownToHtml(md: string): string {
  if (!md) return "";
  // If it already looks like HTML, return as-is
  if (md.startsWith("<") && md.includes("</")) return md;
  
  let html = md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^- \[x\] (.+)$/gm, '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span>$1</span></label></li></ul>')
    .replace(/^- \[ \] (.+)$/gm, '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>$1</span></label></li></ul>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\n/g, '<br>');
  
  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>.*?<\/li>(<br>)?)+/g, (match) => {
    const items = match.replace(/<br>/g, '');
    return `<ul>${items}</ul>`;
  });
  
  return html;
}

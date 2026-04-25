import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Extension } from "@tiptap/core";
// Side-effect imports: merge StarterKit extensions' command type augmentations
// into ChainedCommands so toggleHeading/Blockquote/CodeBlock/etc. are typed.
import "@tiptap/extension-heading";
import "@tiptap/extension-paragraph";
import "@tiptap/extension-blockquote";
import "@tiptap/extension-code-block";
import "@tiptap/extension-horizontal-rule";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { type SuggestionOptions, type SuggestionProps, type SuggestionKeyDownProps } from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import {
  Heading1, Heading2, Heading3, Type, List, ListOrdered, CheckSquare,
  Table, Quote, Code, Minus, AlertTriangle, Link, Highlighter, PenTool, ImageIcon,
  User, Calendar, Mail, MessageSquare, FileText, FolderOpen, DollarSign, MapPin, Search, StickyNote,
} from "lucide-react";
import type { Editor } from "@tiptap/core";

// ── Command definitions ────────────────────────────────────────────────

export interface SlashCommandItem {
  id: string;
  label: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  command: (editor: Editor) => void;
}

/** Helper to dispatch link-picker events */
function openLinkPicker(type: string) {
  window.dispatchEvent(new CustomEvent("notes:open-link-picker", { detail: { type } }));
}

const SLASH_COMMANDS: SlashCommandItem[] = [
  // Texto
  { id: "h1", label: "Título Grande", description: "Cabeçalho H1", category: "Texto", icon: <Heading1 className="w-4 h-4" />, command: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { id: "h2", label: "Título Médio", description: "Cabeçalho H2", category: "Texto", icon: <Heading2 className="w-4 h-4" />, command: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { id: "h3", label: "Título Pequeno", description: "Cabeçalho H3", category: "Texto", icon: <Heading3 className="w-4 h-4" />, command: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { id: "paragraph", label: "Parágrafo", description: "Texto simples", category: "Texto", icon: <Type className="w-4 h-4" />, command: (e) => e.chain().focus().setParagraph().run() },
  // Listas
  { id: "bullet", label: "Lista com marcadores", description: "Lista não ordenada", category: "Listas", icon: <List className="w-4 h-4" />, command: (e) => e.chain().focus().toggleBulletList().run() },
  { id: "numbered", label: "Lista numerada", description: "Lista ordenada", category: "Listas", icon: <ListOrdered className="w-4 h-4" />, command: (e) => e.chain().focus().toggleOrderedList().run() },
  { id: "checklist", label: "Checklist / To-do", description: "Lista de tarefas", category: "Listas", icon: <CheckSquare className="w-4 h-4" />, command: (e) => e.chain().focus().toggleTaskList().run() },
  // Conteúdo
  { id: "table", label: "Tabela", description: "Tabela 3×3", category: "Conteúdo", icon: <Table className="w-4 h-4" />, command: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { id: "quote", label: "Citação", description: "Bloco de citação", category: "Conteúdo", icon: <Quote className="w-4 h-4" />, command: (e) => e.chain().focus().toggleBlockquote().run() },
  { id: "code", label: "Bloco de código", description: "Código formatado", category: "Conteúdo", icon: <Code className="w-4 h-4" />, command: (e) => e.chain().focus().toggleCodeBlock().run() },
  { id: "divider", label: "Separador horizontal", description: "Linha divisória", category: "Conteúdo", icon: <Minus className="w-4 h-4" />, command: (e) => e.chain().focus().setHorizontalRule().run() },
  { id: "callout", label: "Callout / Destaque", description: "Nota em destaque", category: "Conteúdo", icon: <AlertTriangle className="w-4 h-4" />, command: (e) => e.chain().focus().toggleBlockquote().run() },
  { id: "highlight", label: "Destaque (highlight)", description: "Texto destacado", category: "Conteúdo", icon: <Highlighter className="w-4 h-4" />, command: (e) => e.chain().focus().toggleHighlight().run() },
  { id: "link", label: "Link", description: "Inserir link", category: "Conteúdo", icon: <Link className="w-4 h-4" />, command: () => { window.dispatchEvent(new CustomEvent("notes:open-link-input")); } },
  { id: "drawing", label: "Desenho / Handwriting", description: "Inserir canvas de desenho", category: "Conteúdo", icon: <PenTool className="w-4 h-4" />, command: () => { window.dispatchEvent(new CustomEvent("notes:toggle-drawing")); } },
  { id: "image", label: "Imagem", description: "Inserir imagem (upload)", category: "Conteúdo", icon: <ImageIcon className="w-4 h-4" />, command: () => { window.dispatchEvent(new CustomEvent("notes:insert-image")); } },
  // ── Vincular (Deep Links) ────────────────────────────────────────
  { id: "link_task",    label: "Tarefa",     description: "Vincular a uma tarefa",         category: "Vincular", icon: <CheckSquare className="w-4 h-4" />,   command: () => openLinkPicker("task") },
  { id: "link_contact", label: "Contato",    description: "Vincular a um contato",         category: "Vincular", icon: <User className="w-4 h-4" />,          command: () => openLinkPicker("contact") },
  { id: "link_note",    label: "Nota",       description: "Vincular a outra nota",         category: "Vincular", icon: <StickyNote className="w-4 h-4" />,    command: () => openLinkPicker("note") },
  { id: "link_event",   label: "Evento",     description: "Vincular a um evento",          category: "Vincular", icon: <Calendar className="w-4 h-4" />,      command: () => openLinkPicker("event") },
  { id: "link_email",   label: "E-mail",     description: "Link direto para e-mail",       category: "Vincular", icon: <Mail className="w-4 h-4" />,          command: () => openLinkPicker("email") },
  { id: "link_message", label: "Mensagem",   description: "Vincular conversa WhatsApp",    category: "Vincular", icon: <MessageSquare className="w-4 h-4" />, command: () => openLinkPicker("message") },
  { id: "link_file",    label: "Arquivo",    description: "Vincular a um arquivo",         category: "Vincular", icon: <FileText className="w-4 h-4" />,      command: () => openLinkPicker("file") },
  { id: "link_folder",  label: "Pasta",      description: "Vincular a uma pasta",          category: "Vincular", icon: <FolderOpen className="w-4 h-4" />,    command: () => openLinkPicker("folder") },
  { id: "link_finance", label: "Financeiro", description: "Vincular meta financeira",      category: "Vincular", icon: <DollarSign className="w-4 h-4" />,    command: () => openLinkPicker("finance") },
  
  { id: "link_search",  label: "Busca",      description: "Link direto para busca",        category: "Vincular", icon: <Search className="w-4 h-4" />,        command: () => openLinkPicker("search") },
];

// ── Category color mapping ─────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Texto: "text-muted-foreground",
  Listas: "text-muted-foreground",
  "Conteúdo": "text-muted-foreground",
  Vincular: "text-primary/70",
};

// ── Popup component ────────────────────────────────────────────────────

interface CommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

export interface CommandListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

export const CommandList = forwardRef<CommandListRef, CommandListProps>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => { setSelectedIndex(0); }, [items]);

  useEffect(() => {
    const el = itemRefs.current[selectedIndex];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((i) => (i - 1 + items.length) % Math.max(1, items.length));
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((i) => (i + 1) % Math.max(1, items.length));
        return true;
      }
      if (event.key === "Enter") {
        if (items[selectedIndex]) command(items[selectedIndex]);
        return true;
      }
      return false;
    },
  }));

  if (!items.length) {
    return (
      <div className="w-[280px] rounded-xl border border-border bg-popover text-popover-foreground shadow-xl backdrop-blur-xl p-3">
        <p className="text-xs text-muted-foreground text-center py-2">Nenhum comando encontrado</p>
      </div>
    );
  }

  const grouped: Record<string, SlashCommandItem[]> = {};
  for (const cmd of items) {
    if (!grouped[cmd.category]) grouped[cmd.category] = [];
    grouped[cmd.category].push(cmd);
  }

  let flatIndex = 0;

  return (
    <div className="w-[280px] max-h-[320px] overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-xl backdrop-blur-xl">
      <div className="px-3 py-2 border-b border-border/30">
        <p className="text-xs text-muted-foreground">
          <span className="font-mono bg-muted/50 px-1 rounded">/</span>
          <span className="ml-1">Buscar comando...</span>
        </p>
      </div>

      {Object.entries(grouped).map(([category, cmds]) => {
        const catColor = CATEGORY_COLORS[category] || "text-muted-foreground";
        return (
          <div key={category}>
            <p className={`text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5 ${catColor}`}>{category}</p>
            {cmds.map(cmd => {
              const idx = flatIndex++;
              return (
                <button
                  key={cmd.id}
                  ref={el => { itemRefs.current[idx] = el; }}
                  onClick={() => command(cmd)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                    idx === selectedIndex ? "bg-primary/10 text-foreground" : "text-foreground/80 hover:bg-muted/40"
                  }`}
                >
                  <span className="flex-shrink-0 text-muted-foreground">{cmd.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{cmd.label}</p>
                    <p className="text-xs truncate text-muted-foreground">{cmd.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
});

CommandList.displayName = "CommandList";

// ── TipTap Extension ───────────────────────────────────────────────────

export const SlashCommands = Extension.create({
  name: "slashCommands",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        command: ({ editor, range, props }: { editor: Editor; range: any; props: SlashCommandItem }) => {
          editor.chain().focus().deleteRange(range).run();
          props.command(editor);
        },
        items: ({ query }: { query: string }) => {
          const q = query.toLowerCase();
          if (!q) return SLASH_COMMANDS;
          return SLASH_COMMANDS.filter(
            cmd => cmd.label.toLowerCase().includes(q) || cmd.description.toLowerCase().includes(q) || cmd.category.toLowerCase().includes(q)
          );
        },
        render: () => {
          let component: ReactRenderer<CommandListRef> | null = null;
          let popup: TippyInstance[] | null = null;

          return {
            onStart: (props: SuggestionProps) => {
              component = new ReactRenderer(CommandList, {
                props,
                editor: props.editor,
              });

              if (!props.clientRect) return;

              popup = tippy("body", {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
              });
            },

            onUpdate(props: SuggestionProps) {
              component?.updateProps(props);
              if (!props.clientRect) return;
              popup?.[0]?.setProps({
                getReferenceClientRect: props.clientRect as () => DOMRect,
              });
            },

            onKeyDown(props: SuggestionKeyDownProps) {
              if (props.event.key === "Escape") {
                popup?.[0]?.hide();
                return true;
              }
              return component?.ref?.onKeyDown(props) ?? false;
            },

            onExit() {
              popup?.[0]?.destroy();
              component?.destroy();
            },
          };
        },
      } as Partial<SuggestionOptions>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

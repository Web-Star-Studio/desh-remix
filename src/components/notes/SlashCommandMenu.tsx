import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heading1, Heading2, Heading3, Type, List, ListOrdered, CheckSquare,
  Table, Quote, Code, Minus, AlertTriangle, Image
} from "lucide-react";

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  insert: string;
  cursorOffset?: number; // offset from end of insert
}

const SLASH_COMMANDS: SlashCommand[] = [
  // Texto
  { id: "h1", label: "Título Grande", description: "Cabeçalho H1", category: "Texto", icon: <Heading1 className="w-4 h-4" />, insert: "# " },
  { id: "h2", label: "Título Médio", description: "Cabeçalho H2", category: "Texto", icon: <Heading2 className="w-4 h-4" />, insert: "## " },
  { id: "h3", label: "Título Pequeno", description: "Cabeçalho H3", category: "Texto", icon: <Heading3 className="w-4 h-4" />, insert: "### " },
  { id: "paragraph", label: "Parágrafo", description: "Texto simples", category: "Texto", icon: <Type className="w-4 h-4" />, insert: "" },
  // Listas
  { id: "bullet", label: "Lista com marcadores", description: "Lista não ordenada", category: "Listas", icon: <List className="w-4 h-4" />, insert: "- " },
  { id: "numbered", label: "Lista numerada", description: "Lista ordenada", category: "Listas", icon: <ListOrdered className="w-4 h-4" />, insert: "1. " },
  { id: "checklist", label: "Checklist / To-do", description: "Lista de tarefas", category: "Listas", icon: <CheckSquare className="w-4 h-4" />, insert: "- [ ] " },
  // Conteúdo
  { id: "table", label: "Tabela", description: "Tabela 3×3", category: "Conteúdo", icon: <Table className="w-4 h-4" />, insert: "| Coluna 1 | Coluna 2 | Coluna 3 |\n|----------|----------|----------|\n|          |          |          |\n|          |          |          |\n|          |          |          |\n" },
  { id: "quote", label: "Citação", description: "Bloco de citação", category: "Conteúdo", icon: <Quote className="w-4 h-4" />, insert: "> " },
  { id: "code", label: "Bloco de código", description: "Código formatado", category: "Conteúdo", icon: <Code className="w-4 h-4" />, insert: "```\n\n```", cursorOffset: 4 },
  { id: "divider", label: "Separador horizontal", description: "Linha divisória", category: "Conteúdo", icon: <Minus className="w-4 h-4" />, insert: "\n---\n" },
  { id: "callout", label: "Callout / Destaque", description: "Nota em destaque", category: "Conteúdo", icon: <AlertTriangle className="w-4 h-4" />, insert: "> **💡 Nota:** " },
  // Mídia
  { id: "image", label: "Imagem (URL)", description: "Inserir imagem", category: "Mídia", icon: <Image className="w-4 h-4" />, insert: "![descrição](url)", cursorOffset: 4 },
];

// Calculate caret coordinates in a textarea using a mirror div
function getCaretCoordinates(textarea: HTMLTextAreaElement, position: number): { top: number; left: number } {
  const mirror = document.createElement("div");
  const style = window.getComputedStyle(textarea);

  const props = [
    "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing",
    "lineHeight", "textTransform", "wordSpacing", "textIndent", "padding",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "borderWidth", "boxSizing", "whiteSpace", "wordWrap", "overflowWrap", "tabSize",
  ];

  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.overflow = "hidden";
  mirror.style.width = `${textarea.offsetWidth}px`;
  mirror.style.height = "auto";
  for (const prop of props) {
    (mirror.style as any)[prop] = style.getPropertyValue(prop.replace(/([A-Z])/g, "-$1").toLowerCase());
  }
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";

  const textBefore = textarea.value.substring(0, position);
  const textNode = document.createTextNode(textBefore);
  const span = document.createElement("span");
  span.textContent = "|";

  mirror.appendChild(textNode);
  mirror.appendChild(span);
  document.body.appendChild(mirror);

  const top = span.offsetTop - textarea.scrollTop;
  const left = span.offsetLeft;

  document.body.removeChild(mirror);
  return { top, left };
}

interface SlashCommandMenuProps {
  textarea: HTMLTextAreaElement | null;
  content: string;
  onInsert: (slashStart: number, slashEnd: number, insert: string, cursorOffset?: number) => void;
  onClose: () => void;
  isOpen: boolean;
  slashIndex: number; // position of `/` in content
}

export function SlashCommandMenu({ textarea, content, onInsert, onClose, isOpen, slashIndex }: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Query text after the /
  const query = useMemo(() => {
    if (!isOpen || slashIndex < 0) return "";
    const afterSlash = content.substring(slashIndex + 1);
    const match = afterSlash.match(/^([a-zA-ZÀ-ú0-9 ]{0,30})/);
    return match ? match[1].toLowerCase() : "";
  }, [isOpen, slashIndex, content]);

  // Filter commands
  const filtered = useMemo(() => {
    if (!query) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter(
      cmd => cmd.label.toLowerCase().includes(query) || cmd.description.toLowerCase().includes(query) || cmd.category.toLowerCase().includes(query)
    );
  }, [query]);

  // Reset selection when filtered changes
  useEffect(() => { setSelectedIndex(0); }, [filtered]);

  // Scroll selected into view
  useEffect(() => {
    const item = itemRefs.current[selectedIndex];
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Position
  const [pos, setPos] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (!isOpen || !textarea) return;
    const coords = getCaretCoordinates(textarea, slashIndex);
    const rect = textarea.getBoundingClientRect();
    const menuWidth = 280;
    const menuHeight = 320;
    
    let left = coords.left;
    let top = coords.top + 24; // below the line

    // Keep within textarea bounds
    if (left + menuWidth > textarea.offsetWidth) left = textarea.offsetWidth - menuWidth - 8;
    if (left < 8) left = 8;
    
    // If menu would go below textarea, show above
    if (top + menuHeight > textarea.offsetHeight) {
      top = coords.top - menuHeight - 4;
    }

    setPos({ top, left });
  }, [isOpen, textarea, slashIndex, content]);

  // Keyboard handler (attached to window to intercept before textarea)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); setSelectedIndex(i => (i + 1) % Math.max(1, filtered.length)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); setSelectedIndex(i => (i - 1 + filtered.length) % Math.max(1, filtered.length)); return; }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault(); e.stopPropagation();
        if (filtered[selectedIndex]) {
          const cmd = filtered[selectedIndex];
          const slashEnd = slashIndex + 1 + query.length;
          onInsert(slashIndex, slashEnd, cmd.insert, cmd.cursorOffset);
        }
        onClose();
        return;
      }
    };
    window.addEventListener("keydown", handler, true); // capture phase
    return () => window.removeEventListener("keydown", handler, true);
  }, [isOpen, filtered, selectedIndex, slashIndex, query, onInsert, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  if (!isOpen || filtered.length === 0) return null;

  // Group by category
  const grouped: Record<string, SlashCommand[]> = {};
  for (const cmd of filtered) {
    if (!grouped[cmd.category]) grouped[cmd.category] = [];
    grouped[cmd.category].push(cmd);
  }

  let flatIndex = 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: -4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.97 }}
          transition={{ duration: 0.12 }}
          className="absolute z-50 w-[280px] max-h-[320px] overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-xl backdrop-blur-xl"
          style={{ top: pos.top, left: pos.left }}
        >
          {/* Search hint */}
          <div className="px-3 py-2 border-b border-border/30">
            <p className="text-xs text-muted-foreground">
              <span className="font-mono bg-muted/50 px-1 rounded">/</span>
              {query ? <span className="ml-1 text-foreground">{query}</span> : <span className="ml-1">Buscar comando...</span>}
            </p>
          </div>

          {Object.entries(grouped).map(([category, cmds]) => (
            <div key={category}>
              <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider px-3 py-1.5">{category}</p>
              {cmds.map(cmd => {
                const idx = flatIndex++;
                return (
                  <button
                    key={cmd.id}
                    ref={el => { itemRefs.current[idx] = el; }}
                    onClick={() => {
                      const slashEnd = slashIndex + 1 + query.length;
                      onInsert(slashIndex, slashEnd, cmd.insert, cmd.cursorOffset);
                      onClose();
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                      idx === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted/50"
                    }`}
                  >
                    <span className="flex-shrink-0 text-muted-foreground">{cmd.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{cmd.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{cmd.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { SLASH_COMMANDS, getCaretCoordinates };


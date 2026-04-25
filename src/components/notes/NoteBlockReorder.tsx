import { useState, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { GripVertical, Heading1, Heading2, Heading3, List, CheckSquare, Code, Quote, Table, Minus, Type, Image } from "lucide-react";

interface NoteBlockReorderProps {
  content: string;
  onReorder: (newContent: string) => void;
  onClose: () => void;
}

interface Block {
  id: string;
  raw: string;
  type: "heading" | "paragraph" | "list" | "checklist" | "code" | "quote" | "table" | "divider" | "image";
  level?: number; // for headings
  preview: string;
}

/** Split markdown content into logical blocks for reordering */
function splitIntoBlocks(content: string): Block[] {
  const lines = content.split("\n");
  const blocks: Block[] = [];
  let buffer: string[] = [];
  let inCode = false;
  let inTable = false;
  let blockIdx = 0;

  const flushBuffer = () => {
    if (buffer.length === 0) return;
    const raw = buffer.join("\n");
    const trimmed = raw.trim();
    if (!trimmed) { buffer = []; return; }

    let type: Block["type"] = "paragraph";
    let level: number | undefined;
    let preview = trimmed.slice(0, 120);

    if (trimmed.startsWith("```")) {
      type = "code";
      const lang = trimmed.match(/^```(\w*)/)?.[1];
      preview = lang ? `Bloco de código (${lang})` : "Bloco de código";
    } else if (trimmed.startsWith("#")) {
      type = "heading";
      const match = trimmed.match(/^(#{1,6})\s+(.*)$/m);
      if (match) { level = match[1].length; preview = match[2]; }
    } else if (/^\|.+\|/.test(trimmed) && trimmed.includes("---")) {
      type = "table";
      const firstRow = trimmed.split("\n")[0];
      const cols = firstRow.split("|").filter(c => c.trim()).length;
      preview = `Tabela (${cols} colunas)`;
    } else if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      type = "divider";
      preview = "Separador";
    } else if (/^!\[/.test(trimmed)) {
      type = "image";
      const alt = trimmed.match(/!\[([^\]]*)\]/)?.[1];
      preview = alt ? `Imagem: ${alt}` : "Imagem";
    } else if (/^[-*]\s\[[ x]\]\s/.test(trimmed)) {
      type = "checklist";
      const items = trimmed.split("\n").filter(l => /^[-*]\s\[[ x]\]/.test(l)).length;
      preview = `Checklist (${items} item${items > 1 ? "s" : ""})`;
    } else if (/^[-*+]/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
      type = "list";
      const items = trimmed.split("\n").filter(l => /^[-*+\d]/.test(l.trim())).length;
      preview = `Lista (${items} item${items > 1 ? "s" : ""})`;
    } else if (/^>\s/.test(trimmed)) {
      type = "quote";
      preview = trimmed.replace(/^>\s?/gm, "").slice(0, 100);
    }

    blocks.push({
      id: `block-${blockIdx++}`,
      raw,
      type,
      level,
      preview: preview.slice(0, 100),
    });
    buffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle code blocks (multi-line)
    if (line.trim().startsWith("```")) {
      if (inCode) {
        buffer.push(line);
        inCode = false;
        flushBuffer();
        continue;
      } else {
        flushBuffer();
        buffer.push(line);
        inCode = true;
        continue;
      }
    }

    if (inCode) {
      buffer.push(line);
      continue;
    }

    // Handle table rows (keep together)
    if (/^\|/.test(line.trim())) {
      if (!inTable) {
        flushBuffer();
        inTable = true;
      }
      buffer.push(line);
      continue;
    } else if (inTable) {
      inTable = false;
      flushBuffer();
    }

    // Headings start a new block
    if (/^#{1,6}\s/.test(line)) {
      flushBuffer();
      buffer.push(line);
      flushBuffer();
      continue;
    }

    // Dividers
    if (/^(---|___|\*\*\*)$/.test(line.trim())) {
      flushBuffer();
      buffer.push(line);
      flushBuffer();
      continue;
    }

    // Empty line = paragraph break
    if (line.trim() === "") {
      if (buffer.length > 0) {
        flushBuffer();
      }
      // Preserve blank line spacing
      buffer.push(line);
      flushBuffer();
      continue;
    }

    buffer.push(line);
  }
  flushBuffer();

  // Filter out pure whitespace blocks but keep them as spacers internally
  return blocks.filter(b => b.raw.trim().length > 0);
}

function reassembleBlocks(blocks: Block[]): string {
  return blocks.map(b => b.raw).join("\n\n");
}

const blockIcon: Record<Block["type"], React.ReactNode> = {
  heading: <Heading1 className="w-3.5 h-3.5" />,
  paragraph: <Type className="w-3.5 h-3.5" />,
  list: <List className="w-3.5 h-3.5" />,
  checklist: <CheckSquare className="w-3.5 h-3.5" />,
  code: <Code className="w-3.5 h-3.5" />,
  quote: <Quote className="w-3.5 h-3.5" />,
  table: <Table className="w-3.5 h-3.5" />,
  divider: <Minus className="w-3.5 h-3.5" />,
  image: <Image className="w-3.5 h-3.5" />,
};

const blockLabel: Record<Block["type"], string> = {
  heading: "Título",
  paragraph: "Parágrafo",
  list: "Lista",
  checklist: "Checklist",
  code: "Código",
  quote: "Citação",
  table: "Tabela",
  divider: "Separador",
  image: "Imagem",
};

export function NoteBlockReorder({ content, onReorder, onClose }: NoteBlockReorderProps) {
  const initialBlocks = useMemo(() => splitIntoBlocks(content), [content]);
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);

  const handleApply = useCallback(() => {
    onReorder(reassembleBlocks(blocks));
    onClose();
  }, [blocks, onReorder, onClose]);

  const hasChanges = useMemo(() => {
    return blocks.some((b, i) => b.id !== initialBlocks[i]?.id);
  }, [blocks, initialBlocks]);

  if (blocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <Type className="w-8 h-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">Nenhum bloco para reordenar</p>
        <button onClick={onClose} className="mt-3 text-xs text-primary hover:underline">Voltar ao editor</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 flex-shrink-0 bg-foreground/5">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Reordenar blocos</span>
          <span className="text-xs text-muted-foreground">({blocks.length} bloco{blocks.length > 1 ? "s" : ""})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleApply}
            disabled={!hasChanges}
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Aplicar ordem
          </button>
        </div>
      </div>

      {/* Reorderable block list */}
      <div className="flex-1 overflow-y-auto p-3">
        <Reorder.Group axis="y" values={blocks} onReorder={setBlocks} className="space-y-1.5">
          {blocks.map((block) => (
            <Reorder.Item
              key={block.id}
              value={block}
              className="cursor-grab active:cursor-grabbing"
            >
              <motion.div
                layout
                className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-card/80 border border-border/30 hover:border-border/60 hover:bg-card transition-colors group"
                whileDrag={{
                  scale: 1.02,
                  boxShadow: "0 8px 25px -5px rgba(0,0,0,0.15)",
                  zIndex: 50,
                }}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground flex-shrink-0 mt-0.5 transition-colors" />
                <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                  <span className="text-muted-foreground/60">{blockIcon[block.type]}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
                      {blockLabel[block.type]}
                      {block.level && <span className="ml-0.5">H{block.level}</span>}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80 truncate leading-snug">
                    {block.preview}
                  </p>
                </div>
              </motion.div>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-border/20 flex-shrink-0">
        <p className="text-xs text-muted-foreground/50 text-center">
          Arraste os blocos para reordenar · Os blocos são separados por linhas em branco
        </p>
      </div>
    </div>
  );
}

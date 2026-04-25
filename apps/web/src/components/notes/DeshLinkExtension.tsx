import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  CheckSquare, User, Calendar, Mail, MessageSquare,
  FileText, FolderOpen, DollarSign, MapPin, Search, StickyNote,
  ExternalLink,
} from "lucide-react";

// ── Icon + color mapping per link type ─────────────────────────

const LINK_TYPE_CONFIG: Record<string, { icon: React.ElementType; colorClass: string; label: string }> = {
  task:    { icon: CheckSquare,   colorClass: "bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/25",     label: "Tarefa" },
  contact: { icon: User,          colorClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25", label: "Contato" },
  event:   { icon: Calendar,      colorClass: "bg-purple-500/15 text-purple-400 border-purple-500/30 hover:bg-purple-500/25",   label: "Evento" },
  email:   { icon: Mail,          colorClass: "bg-orange-500/15 text-orange-400 border-orange-500/30 hover:bg-orange-500/25",   label: "E-mail" },
  message: { icon: MessageSquare, colorClass: "bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/25",     label: "Mensagem" },
  file:    { icon: FileText,      colorClass: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/25",       label: "Arquivo" },
  folder:  { icon: FolderOpen,    colorClass: "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25",     label: "Pasta" },
  finance: { icon: DollarSign,    colorClass: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/25",   label: "Financeiro" },
  
  search:  { icon: Search,        colorClass: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/25",   label: "Busca" },
  note:    { icon: StickyNote,    colorClass: "bg-pink-500/15 text-pink-400 border-pink-500/30 hover:bg-pink-500/25",       label: "Nota" },
};

// ── React NodeView component ───────────────────────────────────

function DeshLinkView({ node }: any) {
  const navigate = useNavigate();
  const [showTooltip, setShowTooltip] = useState(false);
  const { linkType, label, route } = node.attrs as { linkType: string; label: string; route: string };
  const config = LINK_TYPE_CONFIG[linkType] || LINK_TYPE_CONFIG.search;
  const Icon = config.icon;

  return (
    <NodeViewWrapper as="span" className="inline relative">
      <button
        type="button"
        onClick={() => navigate(route)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        contentEditable={false}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium cursor-pointer transition-all align-baseline select-none ${config.colorClass}`}
      >
        <Icon className="w-3 h-3 flex-shrink-0" />
        <span className="truncate max-w-[180px]">{label}</span>
        <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 flex-shrink-0 -mr-0.5" />
      </button>
      {/* Tooltip */}
      {showTooltip && (
        <span
          contentEditable={false}
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 px-2.5 py-1 rounded-lg bg-popover border border-border/50 shadow-lg text-xs text-foreground whitespace-nowrap z-50 pointer-events-none animate-in fade-in-0 zoom-in-95 duration-100"
        >
          <span className="text-muted-foreground">{config.label}:</span>{" "}
          <span className="font-medium">{label}</span>
        </span>
      )}
    </NodeViewWrapper>
  );
}

// ── TipTap Node Extension ──────────────────────────────────────

export const DeshLinkNode = Node.create({
  name: "deshLink",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      linkType: { default: "task" },
      itemId:   { default: "" },
      label:    { default: "" },
      route:    { default: "" },
    };
  },

  parseHTML() {
    return [{
      tag: 'span[data-desh-link]',
      getAttrs: (node) => {
        if (typeof node === "string") return false;
        const el = node as HTMLElement;
        return {
          linkType: el.getAttribute("data-type") || "task",
          itemId:   el.getAttribute("data-id") || "",
          route:    el.getAttribute("data-route") || "",
          label:    el.textContent || "",
        };
      },
    }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes({
        "data-desh-link": "true",
        "data-type": HTMLAttributes.linkType,
        "data-id": HTMLAttributes.itemId,
        "data-route": HTMLAttributes.route,
        class: "desh-link",
      }),
      HTMLAttributes.label || "",
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DeshLinkView);
  },
});

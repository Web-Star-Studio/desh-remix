import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckSquare, User, Calendar, Mail, MessageSquare,
  FileText, FolderOpen, DollarSign, MapPin, Search, StickyNote,
  Link2, X, ExternalLink, Sparkles,
} from "lucide-react";

interface ParsedLink {
  linkType: string;
  itemId: string;
  label: string;
  route: string;
}

const TYPE_META: Record<string, { label: string; icon: React.ElementType; colorClass: string; bgClass: string }> = {
  task:    { label: "Tarefas",      icon: CheckSquare,   colorClass: "text-blue-400",    bgClass: "bg-blue-500/10" },
  contact: { label: "Contatos",    icon: User,          colorClass: "text-emerald-400", bgClass: "bg-emerald-500/10" },
  event:   { label: "Eventos",     icon: Calendar,      colorClass: "text-purple-400",  bgClass: "bg-purple-500/10" },
  email:   { label: "E-mails",     icon: Mail,          colorClass: "text-orange-400",  bgClass: "bg-orange-500/10" },
  message: { label: "Mensagens",   icon: MessageSquare, colorClass: "text-green-400",   bgClass: "bg-green-500/10" },
  file:    { label: "Arquivos",    icon: FileText,      colorClass: "text-cyan-400",    bgClass: "bg-cyan-500/10" },
  folder:  { label: "Pastas",      icon: FolderOpen,    colorClass: "text-amber-400",   bgClass: "bg-amber-500/10" },
  finance: { label: "Financeiro",  icon: DollarSign,    colorClass: "text-yellow-400",  bgClass: "bg-yellow-500/10" },
  
  search:  { label: "Buscas",      icon: Search,        colorClass: "text-indigo-400",  bgClass: "bg-indigo-500/10" },
  note:    { label: "Notas",       icon: StickyNote,    colorClass: "text-pink-400",    bgClass: "bg-pink-500/10" },
};

function parseLinksFromHtml(html: string): ParsedLink[] {
  if (!html) return [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const nodes = doc.querySelectorAll("span[data-desh-link]");
    const links: ParsedLink[] = [];
    const seen = new Set<string>();

    nodes.forEach(el => {
      const linkType = el.getAttribute("data-type") || "";
      const itemId = el.getAttribute("data-id") || "";
      const route = el.getAttribute("data-route") || "";
      const label = el.textContent || "";
      const key = `${linkType}:${itemId}:${route}`;
      if (!seen.has(key)) {
        seen.add(key);
        links.push({ linkType, itemId, label, route });
      }
    });

    return links;
  } catch {
    return [];
  }
}

interface NoteLinksPanelProps {
  content: string;
  onClose: () => void;
}

export function NoteLinksPanel({ content, onClose }: NoteLinksPanelProps) {
  const navigate = useNavigate();

  const links = useMemo(() => parseLinksFromHtml(content), [content]);

  const grouped = useMemo(() => {
    const map: Record<string, ParsedLink[]> = {};
    for (const link of links) {
      if (!map[link.linkType]) map[link.linkType] = [];
      map[link.linkType].push(link);
    }
    return map;
  }, [links]);

  const totalLinks = links.length;
  const totalModules = Object.keys(grouped).length;

  return (
    <div className="w-72 flex flex-col border-l border-border/30 bg-background/95 min-h-0 overflow-hidden flex-shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20 flex-shrink-0">
        <Link2 className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground flex-1">Links</span>
        {totalLinks > 0 && (
          <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
            {totalLinks} link{totalLinks !== 1 ? "s" : ""} · {totalModules} módulo{totalModules !== 1 ? "s" : ""}
          </span>
        )}
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Links list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {totalLinks === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="p-3 rounded-2xl bg-foreground/5 mb-3">
              <Sparkles className="w-8 h-8 text-muted-foreground/20" />
            </div>
            <p className="text-sm font-medium text-muted-foreground/60 mb-1">Nenhum link inserido</p>
            <p className="text-xs text-muted-foreground/40 leading-relaxed max-w-[200px]">
              Use o comando <span className="font-mono bg-muted/50 px-1.5 py-0.5 rounded text-foreground/50">/</span> e escolha <strong>Vincular</strong> para conectar tarefas, contatos e mais.
            </p>
          </div>
        ) : (
          Object.entries(grouped).map(([type, items]) => {
            const meta = TYPE_META[type] || { label: type, icon: Link2, colorClass: "text-muted-foreground", bgClass: "bg-foreground/5" };
            const Icon = meta.icon;
            return (
              <div key={type}>
                <div className="flex items-center gap-2 px-1 mb-1.5">
                  <div className={`p-1 rounded-md ${meta.bgClass}`}>
                    <Icon className={`w-3 h-3 ${meta.colorClass}`} />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{meta.label}</span>
                  <span className="text-[10px] text-muted-foreground/50 ml-auto">{items.length}</span>
                </div>
                <div className="space-y-0.5">
                  {items.map((link, idx) => (
                    <button
                      key={`${link.itemId}-${idx}`}
                      onClick={() => navigate(link.route)}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-sm hover:bg-muted/40 transition-colors group"
                    >
                      <span className="truncate text-foreground/80 group-hover:text-foreground text-xs flex-1">{link.label}</span>
                      <ExternalLink className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground flex-shrink-0 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckSquare, User, Calendar, Mail, MessageSquare,
  FileText, FolderOpen, DollarSign, MapPin, Search, StickyNote, Loader2, X,
  ArrowUp, ArrowDown, CornerDownLeft,
} from "lucide-react";
import type { Editor } from "@tiptap/core";

export type DeshLinkType =
  | "task" | "contact" | "event" | "email"
  | "message" | "file" | "folder" | "finance" | "map" | "search" | "note";

interface PickerItem {
  id: string;
  label: string;
  description?: string;
  route: string;
}

interface DeshLinkPickerProps {
  linkType: DeshLinkType;
  editor: Editor;
  onClose: () => void;
}

const TYPE_META: Record<DeshLinkType, { title: string; icon: React.ElementType; placeholder: string; colorClass: string }> = {
  task:    { title: "Vincular Tarefa",      icon: CheckSquare,   placeholder: "Buscar tarefa...",   colorClass: "text-blue-400" },
  contact: { title: "Vincular Contato",     icon: User,          placeholder: "Buscar contato...",  colorClass: "text-emerald-400" },
  event:   { title: "Vincular Evento",      icon: Calendar,      placeholder: "Buscar evento...",   colorClass: "text-purple-400" },
  email:   { title: "Vincular E-mail",      icon: Mail,          placeholder: "Buscar e-mail...",   colorClass: "text-orange-400" },
  message: { title: "Vincular Mensagem",    icon: MessageSquare, placeholder: "Buscar conversa...", colorClass: "text-green-400" },
  file:    { title: "Vincular Arquivo",      icon: FileText,      placeholder: "Buscar arquivo...", colorClass: "text-cyan-400" },
  folder:  { title: "Vincular Pasta",        icon: FolderOpen,    placeholder: "Buscar pasta...",   colorClass: "text-amber-400" },
  finance: { title: "Vincular Financeiro",   icon: DollarSign,    placeholder: "Buscar meta...",    colorClass: "text-yellow-400" },
  map:     { title: "Vincular Mapa",         icon: MapPin,        placeholder: "",                   colorClass: "text-red-400" },
  search:  { title: "Vincular Busca",        icon: Search,        placeholder: "",                   colorClass: "text-indigo-400" },
  note:    { title: "Vincular Nota",         icon: StickyNote,    placeholder: "Buscar nota...",    colorClass: "text-pink-400" },
};

// ── Query functions per type ───────────────────────────────────

async function queryItems(type: DeshLinkType, q: string): Promise<PickerItem[]> {
  const search = `%${q}%`;

  switch (type) {
    case "task": {
      const query = supabase.from("tasks").select("id,title,status,priority").limit(12);
      if (q) query.ilike("title", search);
      const { data } = await query.order("created_at", { ascending: false });
      return (data || []).map(t => ({ id: t.id, label: t.title, description: `${t.status} · ${t.priority}`, route: `/tasks?id=${t.id}` }));
    }
    case "contact": {
      const query = supabase.from("contacts").select("id,name,email,company").limit(12);
      if (q) query.ilike("name", search);
      const { data } = await query.order("name");
      return (data || []).map(c => ({ id: c.id, label: c.name, description: [c.email, c.company].filter(Boolean).join(" · "), route: `/contacts?id=${c.id}` }));
    }
    case "message": {
      const query = supabase.from("whatsapp_conversations").select("id,title,external_contact_id").limit(12);
      if (q) query.ilike("title", search);
      const { data } = await query;
      return (data || []).map(m => ({ id: m.id, label: m.title || m.external_contact_id, description: "WhatsApp", route: `/messages?id=${m.id}` }));
    }
    case "file": {
      const query = supabase.from("user_files").select("id,name,mime_type").limit(12);
      if (q) query.ilike("name", search);
      const { data } = await query.order("created_at", { ascending: false });
      return (data || []).map(f => ({ id: f.id, label: f.name, description: f.mime_type, route: `/files?id=${f.id}` }));
    }
    case "folder": {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session?.access_token) return [];
        const searchQuery = q ? ` and name contains '${q.replace(/'/g, "\\'")}'` : "";
        const { data, error } = await supabase.functions.invoke("composio-proxy", {
          body: {
            service: "drive",
            path: "/files",
            params: {
              q: `mimeType='application/vnd.google-apps.folder' and trashed=false${searchQuery}`,
              fields: "files(id,name,parents)",
              pageSize: "20",
              orderBy: "modifiedTime desc",
            },
          },
        });
        if (error || !data?.files) return [];
        return (data.files as any[]).map((f: any) => ({
          id: f.id,
          label: f.name,
          description: "Pasta do Drive",
          route: `/files?folder=${f.id}`,
        }));
      } catch {
        return [];
      }
    }
    case "finance": {
      const query = supabase.from("finance_goals").select("id,name,target,current").limit(12);
      if (q) query.ilike("name", search);
      const { data } = await query;
      return (data || []).map(g => ({ id: g.id, label: g.name, description: `R$ ${Number(g.current).toFixed(0)} / ${Number(g.target).toFixed(0)}`, route: `/finances` }));
    }
    case "note": {
      const { data } = await supabase.from("user_data").select("id,data").eq("data_type", "note").limit(30);
      if (!data) return [];
      return data
        .map(n => {
          const d = n.data as any;
          const title = d?.title || "Sem título";
          return { id: n.id, label: title, description: "Nota", route: `/notes?id=${n.id}` };
        })
        .filter(n => !q || n.label.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 12);
    }
    case "event": {
      const { data } = await supabase.from("user_data").select("id,data").eq("data_type", "calendar_events").limit(30);
      if (!data) return [];
      return data
        .map(e => {
          const d = e.data as any;
          return { id: e.id, label: d?.title || d?.summary || "Evento", description: d?.date || "", route: `/calendar` };
        })
        .filter(e => !q || e.label.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 12);
    }
    default:
      return [];
  }
}

// ── Highlight matching text ────────────────────────────────────

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="bg-primary/20 text-primary rounded px-0.5">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

// ── Component ──────────────────────────────────────────────────

export function DeshLinkPicker({ linkType, editor, onClose }: DeshLinkPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const meta = TYPE_META[linkType];
  const Icon = meta.icon;

  // Direct-insert types (no search needed)
  const isDirectType = linkType === "search" || linkType === "email";

  useEffect(() => {
    if (isDirectType) {
      const directMap: Record<string, { label: string; route: string }> = {
        search: { label: "🔎 Abrir Busca", route: "/search" },
        email:  { label: "📧 Abrir E-mail", route: "/email" },
      };
      const d = directMap[linkType];
      insertDeshLink(d.label, "", d.route);
      return;
    }
    inputRef.current?.focus();
    loadResults("");
  }, []);

  const loadResults = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const items = await queryItems(linkType, q);
      setResults(items);
      setSelectedIdx(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [linkType]);

  // Debounced search
  useEffect(() => {
    if (isDirectType) return;
    const timer = setTimeout(() => loadResults(query), 250);
    return () => clearTimeout(timer);
  }, [query, loadResults, isDirectType]);

  const insertDeshLink = useCallback((label: string, itemId: string, route: string) => {
    editor.chain().focus().insertContent({
      type: "deshLink",
      attrs: { linkType, itemId, label, route },
    }).insertContent(" ").run();
    onClose();
  }, [editor, linkType, onClose]);

  const handleSelect = useCallback((item: PickerItem) => {
    insertDeshLink(item.label, item.id, item.route);
  }, [insertDeshLink]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[selectedIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && results[selectedIdx]) { e.preventDefault(); handleSelect(results[selectedIdx]); }
  }, [results, selectedIdx, handleSelect, onClose]);

  if (isDirectType) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-96 max-h-[70vh] rounded-2xl border border-border/50 bg-popover shadow-2xl shadow-black/30 animate-in fade-in-0 zoom-in-95 duration-150 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20">
          <div className={`p-1 rounded-lg ${meta.colorClass}`}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium text-foreground">{meta.title}</span>
          <button onClick={onClose} className="ml-auto p-1 rounded-lg hover:bg-muted/50 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search input */}
        <div className="px-4 py-2">
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={meta.placeholder}
            className="w-full px-3 py-2 rounded-xl bg-muted/50 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-2 pb-2 max-h-[320px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
              <div className={`p-2 rounded-xl bg-foreground/5 mb-2 ${meta.colorClass}`}>
                <Icon className="w-6 h-6 opacity-40" />
              </div>
              <p className="text-xs text-muted-foreground">
                {query ? `Nenhum resultado para "${query}"` : "Nenhum item disponível"}
              </p>
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="text-xs text-primary hover:underline mt-1"
                >
                  Limpar busca
                </button>
              )}
            </div>
          ) : (
            results.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-colors ${
                  idx === selectedIdx ? "bg-primary/10 text-foreground" : "text-foreground/80 hover:bg-muted/50"
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${meta.colorClass}`} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">
                    <HighlightMatch text={item.label} query={query} />
                  </p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  )}
                </div>
                {idx === selectedIdx && (
                  <CornerDownLeft className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer keyboard hints */}
        {results.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 border-t border-border/20 text-muted-foreground">
            <span className="flex items-center gap-1 text-[10px]">
              <kbd className="px-1 py-0.5 rounded bg-muted/50 border border-border/30 text-[10px]">↑↓</kbd>
              navegar
            </span>
            <span className="flex items-center gap-1 text-[10px]">
              <kbd className="px-1 py-0.5 rounded bg-muted/50 border border-border/30 text-[10px]">↵</kbd>
              selecionar
            </span>
            <span className="flex items-center gap-1 text-[10px]">
              <kbd className="px-1 py-0.5 rounded bg-muted/50 border border-border/30 text-[10px]">esc</kbd>
              fechar
            </span>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

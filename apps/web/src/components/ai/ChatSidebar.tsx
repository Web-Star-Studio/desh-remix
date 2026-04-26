import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Pin,
  Search,
  Trash2,
  MessageSquare,
  Clock,
  Pencil,
  Download,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  formatDistanceToNow,
  isToday,
  isYesterday,
  isThisWeek,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { ApiConversation } from "@/hooks/api/useConversations";

export interface ChatSidebarProps {
  conversations: ApiConversation[];
  activeId: string | null;
  loading: boolean;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

const PIN_KEY = "desh.pinned-conversations";

function loadPinned(): Set<string> {
  try {
    const raw = localStorage.getItem(PIN_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function persistPinned(set: Set<string>) {
  try {
    localStorage.setItem(PIN_KEY, JSON.stringify([...set]));
  } catch {
    /* quota — non-fatal */
  }
}

const ChatSidebar = ({
  conversations,
  activeId,
  loading,
  onNew,
  onSelect,
  onDelete,
  onRename,
}: ChatSidebarProps) => {
  const [search, setSearch] = useState("");
  const [pinned, setPinned] = useState<Set<string>>(() => loadPinned());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const startRename = (conv: ApiConversation) => {
    setRenamingId(conv.id);
    setRenameValue(conv.title ?? "");
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRename(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const togglePin = (id: string) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persistPinned(next);
      return next;
    });
  };

  const filtered = useMemo(() => {
    if (!search) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => (c.title ?? "").toLowerCase().includes(q));
  }, [conversations, search]);

  const sorted = [...filtered].sort((a, b) => {
    const ap = pinned.has(a.id) ? 1 : 0;
    const bp = pinned.has(b.id) ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return a.updatedAt < b.updatedAt ? 1 : -1;
  });

  const grouped = useMemo(() => {
    const groups: { label: string; convs: ApiConversation[] }[] = [];
    const pinnedConvs = sorted.filter((c) => pinned.has(c.id));
    const unpinned = sorted.filter((c) => !pinned.has(c.id));

    if (pinnedConvs.length > 0)
      groups.push({ label: "📌 Fixadas", convs: pinnedConvs });

    const today = unpinned.filter((c) => isToday(parseISO(c.updatedAt)));
    const yesterday = unpinned.filter((c) => isYesterday(parseISO(c.updatedAt)));
    const week = unpinned.filter((c) => {
      const d = parseISO(c.updatedAt);
      return isThisWeek(d, { weekStartsOn: 1 }) && !isToday(d) && !isYesterday(d);
    });
    const older = unpinned.filter((c) => {
      const d = parseISO(c.updatedAt);
      return !isThisWeek(d, { weekStartsOn: 1 });
    });

    if (today.length > 0) groups.push({ label: "Hoje", convs: today });
    if (yesterday.length > 0) groups.push({ label: "Ontem", convs: yesterday });
    if (week.length > 0) groups.push({ label: "Esta semana", convs: week });
    if (older.length > 0) groups.push({ label: "Anteriores", convs: older });
    return groups;
  }, [sorted, pinned]);

  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(parseISO(dateStr), { addSuffix: true, locale: ptBR });
    } catch {
      return "";
    }
  };

  const handleExportConversation = (conv: ApiConversation) => {
    // We don't keep messages locally in our hook (they live in the SSE stream).
    // Export the title + metadata; full transcript export lives in ChatPanel header.
    const text = `# ${conv.title ?? "Sem título"}\n# ${new Date(conv.updatedAt).toLocaleString("pt-BR")}\n\n(Use Exportar dentro da conversa para o transcript completo.)`;
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(conv.title ?? "conversa").replace(/[^a-zA-Z0-9]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Conversa exportada!");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header — new + search */}
      <div className="p-3 space-y-2 border-b border-border/30">
        <Button onClick={onNew} className="w-full rounded-xl gap-2" size="sm">
          <Plus className="w-4 h-4" /> Nova Conversa
        </Button>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversas..."
            className="pl-8 h-8 text-xs bg-muted/50 rounded-xl border-border/30"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Stats strip */}
      <div className="px-3 py-1.5 border-b border-border/20 flex items-center gap-3 text-xs text-muted-foreground">
        <span>{conversations.length} conversas</span>
        <span>{pinned.size} fixadas</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {loading && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-xs italic">Carregando…</p>
          </div>
        )}
        {!loading && sorted.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-xs font-medium mb-1">
              {search ? "Nenhum resultado" : "Nenhuma conversa"}
            </p>
            <p className="text-xs opacity-70">
              {search
                ? `Nenhuma conversa contém "${search}"`
                : 'Clique em "Nova Conversa" para começar'}
            </p>
          </div>
        )}
        {grouped.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold px-2 pt-2 pb-1">
              {group.label}
            </p>
            <AnimatePresence initial={false}>
              {group.convs.map((conv) => {
                const isActive = activeId === conv.id;
                const isRenaming = renamingId === conv.id;
                const isPinned = pinned.has(conv.id);
                return (
                  <motion.div
                    key={conv.id}
                    layout
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => onSelect(conv.id)}
                    className={`w-full text-left p-2 rounded-xl transition-all cursor-pointer ${
                      isActive
                        ? "bg-primary/10 text-foreground ring-1 ring-primary/20"
                        : "hover:bg-muted/50 text-foreground/80"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          {isPinned && (
                            <Pin className="w-3 h-3 text-primary shrink-0 fill-primary/30" />
                          )}
                          {isRenaming ? (
                            <input
                              ref={renameInputRef}
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onBlur={commitRename}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitRename();
                                if (e.key === "Escape") setRenamingId(null);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs font-medium bg-background border border-primary/30 rounded-xl px-1.5 py-0.5 w-full outline-none focus:ring-1 focus:ring-primary/40"
                            />
                          ) : (
                            <span
                              className="text-xs font-medium truncate block"
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                startRename(conv);
                              }}
                            >
                              {conv.title ?? "Sem título"}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs text-muted-foreground/50 flex items-center gap-0.5 ml-auto">
                            <Clock className="w-3 h-3" />
                            {formatTime(conv.updatedAt)}
                          </span>
                        </div>

                        <div className="flex items-center gap-0.5 mt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportConversation(conv);
                            }}
                            className="p-1 rounded-lg hover:bg-muted/70 text-muted-foreground"
                            title="Exportar"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startRename(conv);
                            }}
                            className="p-1 rounded-lg hover:bg-muted/70 text-muted-foreground"
                            title="Renomear"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePin(conv.id);
                            }}
                            className="p-1 rounded-lg hover:bg-muted/70"
                            title={isPinned ? "Desafixar" : "Fixar"}
                          >
                            <Pin
                              className={`w-3 h-3 ${
                                isPinned
                                  ? "text-primary fill-primary/30"
                                  : "text-muted-foreground"
                              }`}
                            />
                          </button>
                          {deletingId === conv.id ? (
                            <div
                              className="flex items-center gap-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => {
                                  onDelete(conv.id);
                                  setDeletingId(null);
                                }}
                                className="p-1 rounded-lg bg-destructive/15 text-destructive"
                                title="Confirmar"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setDeletingId(null)}
                                className="p-1 rounded-lg hover:bg-muted/70 text-muted-foreground text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingId(conv.id);
                              }}
                              className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                              title="Excluir"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatSidebar;

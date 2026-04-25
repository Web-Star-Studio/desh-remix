import { useState, useRef, useEffect, useMemo, forwardRef } from "react";
import { Plus, Pin, Search, Trash2, MessageSquare, Clock, Pencil, Download, CheckSquare, Square, X, Copy, ClipboardCopy } from "lucide-react";
import { DeshContextMenu } from "@/components/ui/DeshContextMenu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow, isToday, isYesterday, isThisWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { AIConversation } from "@/hooks/ai/useAIConversations";
import type { AIAgent } from "@/hooks/ai/useAIAgents";
import type { AIProject } from "@/hooks/ai/useAIProjects";

interface ConversationSidebarProps {
  conversations: AIConversation[];
  agents: AIAgent[];
  projects: AIProject[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onRename: (id: string, title: string) => void;
  filterProjectId: string | null;
  filterAgentId: string | null;
  onFilterProject: (id: string | null) => void;
  onFilterAgent: (id: string | null) => void;
}

/** Get a short preview of the last message */
function getLastMsgPreview(conv: AIConversation): string {
  if (conv.messages.length === 0) return "";
  const last = conv.messages[conv.messages.length - 1];
  const text = typeof last.content === "string" ? last.content : "(multimodal)";
  // Strip markdown bold/italic for cleaner preview
  const clean = text.replace(/\*\*/g, "").replace(/\*/g, "").replace(/#{1,6}\s/g, "");
  return clean.substring(0, 60) + (clean.length > 60 ? "…" : "");
}

const ConversationSidebar = ({
  conversations, agents, projects, activeId,
  onSelect, onNew, onDelete, onTogglePin, onRename,
  filterProjectId, filterAgentId, onFilterProject, onFilterAgent,
}: ConversationSidebarProps) => {
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const startRename = (conv: AIConversation) => {
    setRenamingId(conv.id);
    setRenameValue(conv.title);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRename(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  // Deep search: search in title AND message content
  const filtered = useMemo(() => {
    if (!search) return conversations;
    const q = search.toLowerCase();
    return conversations.filter(c => {
      if (c.title.toLowerCase().includes(q)) return true;
      return c.messages.some(m => {
        const text = typeof m.content === "string" ? m.content : "";
        return text.toLowerCase().includes(q);
      });
    });
  }, [conversations, search]);

  // Sort: pinned first, then by updated_at
  const sorted = [...filtered].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  // Group by date
  const grouped = useMemo(() => {
    const groups: { label: string; convs: typeof sorted }[] = [];
    const pinned = sorted.filter(c => c.pinned);
    const unpinned = sorted.filter(c => !c.pinned);

    if (pinned.length > 0) groups.push({ label: "📌 Fixadas", convs: pinned });

    const todayConvs = unpinned.filter(c => isToday(new Date(c.updated_at)));
    const yesterdayConvs = unpinned.filter(c => isYesterday(new Date(c.updated_at)));
    const weekConvs = unpinned.filter(c => {
      const d = new Date(c.updated_at);
      return isThisWeek(d, { weekStartsOn: 1 }) && !isToday(d) && !isYesterday(d);
    });
    const olderConvs = unpinned.filter(c => {
      const d = new Date(c.updated_at);
      return !isThisWeek(d, { weekStartsOn: 1 });
    });

    if (todayConvs.length > 0) groups.push({ label: "Hoje", convs: todayConvs });
    if (yesterdayConvs.length > 0) groups.push({ label: "Ontem", convs: yesterdayConvs });
    if (weekConvs.length > 0) groups.push({ label: "Esta semana", convs: weekConvs });
    if (olderConvs.length > 0) groups.push({ label: "Anteriores", convs: olderConvs });

    return groups;
  }, [sorted]);

  const getAgent = (id: string | null) => agents.find(a => a.id === id);
  const getProject = (id: string | null) => projects.find(p => p.id === id);

  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ptBR });
    } catch {
      return "";
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = () => {
    selectedIds.forEach(id => onDelete(id));
    setSelectedIds(new Set());
    setSelectMode(false);
    toast.success(`${selectedIds.size} conversa(s) excluída(s)`);
  };

  const handleExportConversation = (conv: AIConversation) => {
    const lines = conv.messages.map(m => `[${m.role === "user" ? "Você" : "IA"}] ${typeof m.content === "string" ? m.content : "(conteúdo multimodal)"}`);
    const text = `# ${conv.title}\n# Exportado em ${new Date().toLocaleString("pt-BR")}\n\n${lines.join("\n\n")}`;
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${conv.title.replace(/[^a-zA-Z0-9]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Conversa exportada!");
  };

  const getMsgCount = (conv: AIConversation) => conv.messages.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 space-y-2 border-b border-border/30">
        <div className="flex gap-1">
          <Button onClick={onNew} className="flex-1 rounded-xl gap-2" size="sm">
            <Plus className="w-4 h-4" /> Nova Conversa
          </Button>
          <button
            onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
            className={`p-2 rounded-xl text-xs transition-colors ${selectMode ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted/50"}`}
            title="Modo seleção"
          >
            <CheckSquare className="w-4 h-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar em conversas e mensagens..."
            className="pl-8 h-8 text-xs bg-muted/50 rounded-xl border-border/30" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {/* Filters */}
        <div className="flex gap-1.5">
          {projects.length > 0 && (
            <Select value={filterProjectId || "all"} onValueChange={v => onFilterProject(v === "all" ? null : v)}>
              <SelectTrigger className="h-7 text-xs rounded-xl border-border/30 bg-muted/50 flex-1 min-w-0">
                <SelectValue placeholder="Projeto" />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                <SelectItem value="all">Todos os projetos</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.icon} {p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {agents.length > 0 && (
            <Select value={filterAgentId || "all"} onValueChange={v => onFilterAgent(v === "all" ? null : v)}>
              <SelectTrigger className="h-7 text-xs rounded-xl border-border/30 bg-muted/50 flex-1 min-w-0">
                <SelectValue placeholder="Agente" />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                <SelectItem value="all">Todos os agentes</SelectItem>
                {agents.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Bulk action bar */}
        {selectMode && selectedIds.size > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-xl bg-destructive/10 border border-destructive/20">
            <span className="text-xs text-destructive font-medium flex-1">{selectedIds.size} selecionada(s)</span>
            <button onClick={handleBulkDelete} className="text-xs px-2.5 py-1 rounded-full bg-destructive text-destructive-foreground font-medium">
              Excluir
            </button>
            <button onClick={() => { setSelectedIds(new Set()); setSelectMode(false); }} className="text-xs text-muted-foreground">
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Stats strip */}
      <div className="px-3 py-1.5 border-b border-border/20 flex items-center gap-3 text-xs text-muted-foreground">
        <span>{conversations.length} conversas</span>
        <span>{conversations.reduce((s, c) => s + c.messages.length, 0)} msgs</span>
        <span>{conversations.filter(c => c.pinned).length} fixadas</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {sorted.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-xs font-medium mb-1">{search ? "Nenhum resultado" : "Nenhuma conversa"}</p>
            <p className="text-xs opacity-70">{search ? `Nenhuma conversa contém "${search}"` : 'Clique em "Nova Conversa" para começar'}</p>
          </div>
        )}
        {grouped.map(group => (
          <div key={group.label}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold px-2 pt-2 pb-1">{group.label}</p>
            <AnimatePresence initial={false}>
              {group.convs.map(conv => {
                const convAgent = getAgent(conv.agent_id);
                const convProject = getProject(conv.project_id);
                const isSelected = selectedIds.has(conv.id);
                const preview = getLastMsgPreview(conv);
                const lastMsg = conv.messages[conv.messages.length - 1];
                return (
                  <DeshContextMenu key={conv.id} actions={[
                    { id: "rename", label: "Renomear", icon: Pencil, onClick: () => startRename(conv) },
                    { id: "export", label: "Exportar como texto", icon: Download, onClick: () => handleExportConversation(conv) },
                    { id: "copy_last", label: "Copiar última resposta", icon: ClipboardCopy, onClick: () => {
                      const lastAi = [...conv.messages].reverse().find(m => m.role === "assistant");
                      if (lastAi) navigator.clipboard.writeText(typeof lastAi.content === "string" ? lastAi.content : "");
                    }},
                    { id: "pin", label: conv.pinned ? "Desafixar" : "Fixar", icon: Pin, onClick: () => onTogglePin(conv.id, !conv.pinned) },
                    { id: "delete", label: "Excluir conversa", icon: Trash2, destructive: true, dividerAfter: true, onClick: () => onDelete(conv.id) },
                  ]}>
                  <motion.div
                    layout
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => selectMode ? toggleSelect(conv.id) : onSelect(conv.id)}
                    className={`w-full text-left p-2 rounded-xl transition-all cursor-pointer ${
                      selectMode && isSelected ? "bg-primary/15 ring-1 ring-primary/30" :
                      activeId === conv.id ? "bg-primary/10 text-foreground ring-1 ring-primary/20" : "hover:bg-muted/50 text-foreground/80"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {selectMode && (
                        <div className="mt-0.5 shrink-0">
                          {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          {conv.pinned && <Pin className="w-3 h-3 text-primary shrink-0 fill-primary/30" />}
                          {renamingId === conv.id ? (
                            <input
                              ref={renameInputRef}
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onBlur={commitRename}
                              onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingId(null); }}
                              onClick={e => e.stopPropagation()}
                              className="text-xs font-medium bg-background border border-primary/30 rounded-xl px-1.5 py-0.5 w-full outline-none focus:ring-1 focus:ring-primary/40"
                            />
                          ) : (
                            <span
                              className="text-xs font-medium truncate block"
                              onDoubleClick={(e) => { e.stopPropagation(); startRename(conv); }}
                            >
                              {conv.title}
                            </span>
                          )}
                        </div>

                        {/* Last message preview */}
                        {preview && renamingId !== conv.id && (
                          <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5 leading-tight">
                            {lastMsg?.role === "user" ? "Você: " : ""}{preview}
                          </p>
                        )}

                        <div className="flex items-center gap-1.5 mt-0.5">
                          {convAgent && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground flex items-center gap-0.5">
                              <span>{convAgent.icon}</span> {convAgent.name}
                            </span>
                          )}
                          {convProject && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground flex items-center gap-0.5">
                              <span>{convProject.icon}</span> {convProject.name}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground/40 ml-auto">{getMsgCount(conv)}</span>
                          <span className="text-xs text-muted-foreground/50 flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            {formatTime(conv.updated_at)}
                          </span>
                        </div>
                        {!selectMode && (
                          <div className="flex items-center gap-0.5 mt-1">
                            <button onClick={(e) => { e.stopPropagation(); handleExportConversation(conv); }}
                              className="p-1 rounded-lg hover:bg-muted/70 text-muted-foreground" title="Exportar">
                              <Download className="w-3 h-3" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); startRename(conv); }}
                              className="p-1 rounded-lg hover:bg-muted/70 text-muted-foreground" title="Renomear">
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onTogglePin(conv.id, !conv.pinned); }}
                              className="p-1 rounded-lg hover:bg-muted/70" title={conv.pinned ? "Desafixar" : "Fixar"}>
                              <Pin className={`w-3 h-3 ${conv.pinned ? "text-primary fill-primary/30" : "text-muted-foreground"}`} />
                            </button>
                            {deletingId === conv.id ? (
                              <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                                <button onClick={() => { onDelete(conv.id); setDeletingId(null); }}
                                  className="p-1 rounded-lg bg-destructive/15 text-destructive" title="Confirmar">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                                <button onClick={() => setDeletingId(null)}
                                  className="p-1 rounded-lg hover:bg-muted/70 text-muted-foreground text-xs">✕</button>
                              </div>
                            ) : (
                              <button onClick={(e) => { e.stopPropagation(); setDeletingId(conv.id); }}
                                className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Excluir">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                  </DeshContextMenu>
                );
              })}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConversationSidebar;

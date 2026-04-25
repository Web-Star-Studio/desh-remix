/**
 * ConversationList — Memoized sidebar component showing filtered conversations.
 * Extracted from MessagesPage.tsx for maintainability.
 */
import { useState, useRef, useMemo, useCallback, memo } from "react";
import { Search, Archive, Pin, BellOff, Loader2, Users, X, CheckSquare, Instagram, Facebook, Twitter, MessageCircle, PenLine, ArrowUpDown, Clock, Bell, Type } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { ConversationContextMenu, ConversationDropdownMenu } from "@/components/messages/ConversationContextMenu";
import ConversationBatchBar from "@/components/messages/ConversationBatchBar";
import WorkspaceBadge from "@/components/dashboard/WorkspaceBadge";
import { LabelBadges } from "@/components/messages/ConversationLabels";
import { ConversationStats } from "@/components/messages/ConversationStats";
import type { Conversation } from "@/lib/messageUtils";
import { platformColors, platformLabels } from "@/lib/messageUtils";
import { useConversationSort, type SortMode } from "@/hooks/messages/useConversationSort";

export interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  platformFilter: string;
  setPlatformFilter: (p: string) => void;
  showArchived: boolean;
  setShowArchived: (v: boolean) => void;
  availablePlatforms: string[];
  isLoading: boolean;
  onSelectConvo: (id: string) => void;
  showContextMenu: string | null;
  setShowContextMenu: (id: string | null) => void;
  togglePin: (id: string) => void;
  toggleMute: (id: string) => void;
  toggleArchive: (id: string) => void;
  toggleReadStatus: (id: string, hasUnread: boolean) => void;
  onDeleteConvo: (id: string) => void;
  isUnsavedWhatsappContact: (c: Conversation) => boolean;
  openSaveContactDialog: (c: Conversation) => void;
  typingConvos?: Set<string>;
  bulkMode: boolean;
  selectedConvoIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onEnterBulkMode: (id: string) => void;
  onBulkMarkRead: () => void;
  hasDraft?: (convoId: string) => boolean;
}

export const ConversationListComponent = memo(function ConversationListComponent({
  conversations, selectedId, searchQuery, setSearchQuery,
  platformFilter, setPlatformFilter, showArchived, setShowArchived,
  availablePlatforms, isLoading, onSelectConvo,
  showContextMenu, setShowContextMenu, togglePin, toggleMute, toggleArchive, toggleReadStatus,
  onDeleteConvo, isUnsavedWhatsappContact, openSaveContactDialog, typingConvos,
  bulkMode, selectedConvoIds, onToggleSelect, onEnterBulkMode, onBulkMarkRead, hasDraft,
}: ConversationListProps) {
  // Debounced search
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(val), 300);
  }, [setSearchQuery]);

  const preFiltered = useMemo(() => {
    let result = conversations.filter(c => showArchived ? c.archived : !c.archived);
    if (platformFilter !== "all") result = result.filter(c => c.platform === platformFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q)
      );
    }
    return result;
  }, [conversations, searchQuery, platformFilter, showArchived]);

  const { sorted: filtered, cycleSortMode, sortLabel, sortIcon } = useConversationSort(preFiltered);

  // Social platform icon for Late conversations
  const getPlatformIcon = useCallback((platform: string) => {
    const iconClass = "w-2.5 h-2.5 text-white";
    switch (platform) {
      case "instagram": return <Instagram className={iconClass} />;
      case "facebook": return <Facebook className={iconClass} />;
      case "twitter": return <Twitter className={iconClass} />;
      default: return <MessageCircle className={iconClass} />;
    }
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-foreground/5 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar conversas..."
            value={localSearch}
            onChange={handleSearchChange}
            className="w-full bg-foreground/5 rounded-lg pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {availablePlatforms.map(p => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                platformFilter === p
                  ? "bg-primary/20 text-primary"
                  : "bg-foreground/5 text-muted-foreground hover:text-foreground hover:bg-foreground/10"
              }`}
            >
              {p !== "all" && (
                <span className={`inline-block w-2 h-2 rounded-full mr-1 ${platformColors[p] || "bg-muted"}`} />
              )}
              {platformLabels[p] || p}
            </button>
          ))}
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
              showArchived
                ? "bg-primary/20 text-primary"
                : "bg-foreground/5 text-muted-foreground hover:text-foreground hover:bg-foreground/10"
            }`}
          >
            <Archive className="w-2.5 h-2.5 inline mr-1" />
            Arquivadas
          </button>
          <button
            onClick={cycleSortMode}
            className="flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium bg-foreground/5 text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
            title={`Ordenar: ${sortLabel}`}
          >
            {sortIcon === "clock" ? <Clock className="w-2.5 h-2.5 inline mr-1" /> :
             sortIcon === "bell" ? <Bell className="w-2.5 h-2.5 inline mr-1" /> :
             <Type className="w-2.5 h-2.5 inline mr-1" />}
            {sortLabel}
          </button>
          {!bulkMode ? (
            <button
              onClick={() => {
                if (filtered.length > 0) {
                  onEnterBulkMode(filtered[0].id);
                }
              }}
              className="flex-shrink-0 ml-auto px-2.5 py-1 rounded-full text-[10px] font-medium bg-foreground/5 text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
              title="Selecionar conversas"
            >
              <CheckSquare className="w-2.5 h-2.5 inline mr-1" />
              Selecionar
            </button>
          ) : (
            <button
              onClick={() => onEnterBulkMode("")}
              className="flex-shrink-0 ml-auto px-2.5 py-1 rounded-full text-[10px] font-medium bg-primary/20 text-primary transition-colors"
            >
              <X className="w-2.5 h-2.5 inline mr-1" />
              Cancelar
            </button>
          )}
        </div>
      </div>
      <AnimatePresence>
        {bulkMode && selectedConvoIds.size > 0 && (
          <ConversationBatchBar
            selectedCount={selectedConvoIds.size}
            totalCount={filtered.length}
            onSelectAll={() => {
              if (selectedConvoIds.size === filtered.length) {
                onEnterBulkMode("");
              } else {
                filtered.forEach(c => { if (!selectedConvoIds.has(c.id)) onToggleSelect(c.id); });
              }
            }}
            onPin={() => { selectedConvoIds.forEach(id => togglePin(id)); onEnterBulkMode(""); }}
            onMute={() => { selectedConvoIds.forEach(id => toggleMute(id)); onEnterBulkMode(""); }}
            onArchive={() => { selectedConvoIds.forEach(id => toggleArchive(id)); onEnterBulkMode(""); }}
            onMarkRead={() => { onBulkMarkRead(); }}
            onDelete={() => { selectedConvoIds.forEach(id => onDeleteConvo(id)); onEnterBulkMode(""); }}
            onClear={() => { onEnterBulkMode(""); }}
          />
        )}
      </AnimatePresence>
      <ConversationStats conversations={conversations} />
      <div className="flex-1 overflow-y-auto">
        {isLoading && conversations.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {filtered.map(convo => (
          <ConversationContextMenu
            key={convo.id}
            pinned={convo.pinned}
            muted={convo.muted}
            archived={convo.archived}
            hasUnread={convo.unread > 0}
            showSaveContact={isUnsavedWhatsappContact(convo)}
            onTogglePin={() => togglePin(convo.id)}
            onToggleMute={() => toggleMute(convo.id)}
            onToggleArchive={() => toggleArchive(convo.id)}
            onToggleReadStatus={() => toggleReadStatus(convo.id, convo.unread > 0)}
            onSaveContact={() => openSaveContactDialog(convo)}
            onSelect={() => onEnterBulkMode(convo.id)}
            onDelete={() => onDeleteConvo(convo.id)}
          >
            <div className="relative group">
              <div
                role="button"
                tabIndex={0}
                onClick={() => bulkMode ? onToggleSelect(convo.id) : onSelectConvo(convo.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); bulkMode ? onToggleSelect(convo.id) : onSelectConvo(convo.id); } }}
                className={`w-full text-left p-3 border-b border-foreground/5 transition-colors cursor-pointer ${
                  selectedConvoIds.has(convo.id) ? "bg-primary/10" : selectedId === convo.id ? "bg-foreground/10" : "hover:bg-foreground/5"
                }`}
              >
                <div className="flex items-center gap-3">
                  {bulkMode && (
                    <Checkbox
                      checked={selectedConvoIds.has(convo.id)}
                      onCheckedChange={() => onToggleSelect(convo.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-shrink-0"
                    />
                  )}
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-foreground/10 flex items-center justify-center text-lg overflow-hidden">
                      {convo.avatar.startsWith("http") ? (
                        <img src={convo.avatar} alt={convo.name} className="w-full h-full object-cover" loading="lazy" onError={(e) => { const img = e.target as HTMLImageElement; img.style.display = 'none'; if (img.parentElement) img.parentElement.textContent = convo.name[0] || '📱'; }} />
                      ) : convo.avatar}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full ${platformColors[convo.platform] || "bg-muted"} border-2 border-background flex items-center justify-center`}>
                      {convo.isLateInbox ? getPlatformIcon(convo.platform) : null}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 min-w-0">
                        {convo.pinned && <Pin className="w-3 h-3 text-primary flex-shrink-0" />}
                        {convo.channelId.endsWith("@g.us") && <Users className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                        <span className="text-sm font-medium text-foreground truncate">{convo.name}</span>
                        {convo.muted && <BellOff className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                        <WorkspaceBadge workspaceId={(convo as any).workspaceId} />
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                        <span className="text-[10px] text-muted-foreground group-hover:hidden">{convo.time}</span>
                        <div className="hidden group-hover:block">
                          <ConversationDropdownMenu
                            pinned={convo.pinned}
                            muted={convo.muted}
                            archived={convo.archived}
                            hasUnread={convo.unread > 0}
                            showSaveContact={isUnsavedWhatsappContact(convo)}
                            onTogglePin={() => togglePin(convo.id)}
                            onToggleMute={() => toggleMute(convo.id)}
                            onToggleArchive={() => toggleArchive(convo.id)}
                            onToggleReadStatus={() => toggleReadStatus(convo.id, convo.unread > 0)}
                            onSaveContact={() => openSaveContactDialog(convo)}
                            onSelect={() => onEnterBulkMode(convo.id)}
                            onDelete={() => onDeleteConvo(convo.id)}
                          />
                        </div>
                      </div>
                    </div>
                    {/* Labels */}
                    <LabelBadges labels={(convo as any).labels || []} />
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-muted-foreground truncate">
                        {typingConvos?.has(convo.id) ? (
                          <span className="text-primary italic">digitando...</span>
                        ) : hasDraft?.(convo.id) ? (
                          <span className="text-accent-foreground italic flex items-center gap-1">
                            <PenLine className="w-2.5 h-2.5 inline" />
                            Rascunho
                          </span>
                        ) : convo.lastMessage ? convo.lastMessage : (
                          <span className="italic opacity-50">Sem mensagens</span>
                        )}
                      </p>
                      {convo.unread > 0 && !convo.muted && (
                        <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full flex-shrink-0 ml-1">{convo.unread}</span>
                      )}
                      {convo.unread > 0 && convo.muted && (
                        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full flex-shrink-0 ml-1">{convo.unread}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ConversationContextMenu>
        ))}
        {filtered.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-12 h-12 rounded-full bg-foreground/5 flex items-center justify-center mb-3">
              {showArchived ? <Archive className="w-5 h-5 text-muted-foreground/50" /> : <Search className="w-5 h-5 text-muted-foreground/50" />}
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              {showArchived ? "Nenhuma conversa arquivada" : searchQuery ? "Nenhum resultado" : "Nenhuma conversa"}
            </p>
            <p className="text-xs text-muted-foreground/60 text-center">
              {showArchived ? "Conversas arquivadas aparecerão aqui" : searchQuery ? "Tente buscar com outros termos" : "Suas conversas aparecerão aqui"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

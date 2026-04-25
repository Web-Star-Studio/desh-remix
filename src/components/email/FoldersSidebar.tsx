import { memo, useCallback, useState } from "react";
import {
  Inbox, Send, FileText, Trash2, Star, Plus, X, Edit3,
  MailX, FolderArchive, Mail, Users, Loader2, RefreshCw, Tag, CheckCircle2, Circle
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmailFolder, EmailLabel, LabelColor, LABEL_COLORS, LABEL_DOT, AI_CATEGORY_STYLES } from "./types";

interface FolderDef {
  id: string;
  label: string;
  icon: any;
  count: number;
  aiCounts: Record<string, number>;
}

interface AccountInfo {
  email: string;
  color: string;
}

interface GmailSidebarLabel {
  id: string;
  gmailId: string;
  name: string;
  color: LabelColor;
  messageCount: number;
  unreadCount?: number;
  connectionId?: string;
}

interface FolderSyncStatus {
  synced: boolean;
  totalSynced: number;
  lastSyncedAt: string | null;
}

interface FoldersSidebarProps {
  isMobileDrawer?: boolean;
  activeFolder: EmailFolder;
  setActiveFolder: (f: EmailFolder) => void;
  setSelectedId: (id: string | null) => void;
  setMobileDrawerOpen: (open: boolean) => void;
  filterStarred: boolean;
  setFilterStarred: (v: boolean) => void;
  filterLabel: string | null;
  setFilterLabel: (id: string | null) => void;
  filterAiCategory: string | null;
  setFilterAiCategory: (cat: string | null) => void;
  filterAccount: string | null;
  setFilterAccount: (id: string | null) => void;
  labels: EmailLabel[];
  setLabels: React.Dispatch<React.SetStateAction<EmailLabel[]>>;
  gmailConnected: boolean;
  gmailLabels: GmailSidebarLabel[];
  folders: FolderDef[];
  accountInfoMap: Map<string, AccountInfo>;
  labelCounts?: Record<string, number>;
  onDropEmailOnLabel?: (emailId: string, labelId: string) => void;
  // Label management
  onCreateGmailLabel?: (name: string) => Promise<any>;
  onRenameGmailLabel?: (gmailLabelId: string, newName: string) => Promise<void>;
  onDeleteGmailLabel?: (gmailLabelId: string) => Promise<void>;
  onRefreshLabels?: () => Promise<void>;
  labelsLoading?: boolean;
  // Folder sync status
  folderSyncStatuses?: Record<string, FolderSyncStatus>;
}

const FoldersSidebar = memo(({
  activeFolder, setActiveFolder, setSelectedId, setMobileDrawerOpen,
  filterStarred, setFilterStarred, filterLabel, setFilterLabel,
  filterAiCategory, setFilterAiCategory, filterAccount, setFilterAccount,
  labels, setLabels, gmailConnected, gmailLabels, folders, accountInfoMap, labelCounts = {},
  onDropEmailOnLabel, onCreateGmailLabel, onRenameGmailLabel, onDeleteGmailLabel, onRefreshLabels, labelsLoading,
  folderSyncStatuses = {},
}: FoldersSidebarProps) => {
  const [showAddLabel, setShowAddLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState<LabelColor>("blue");
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editLabelName, setEditLabelName] = useState("");
  const [editLabelColor, setEditLabelColor] = useState<LabelColor>("blue");
  const [dragOverLabel, setDragOverLabel] = useState<string | null>(null);
  const [creatingGmailLabel, setCreatingGmailLabel] = useState(false);
  const [editingGmailLabelId, setEditingGmailLabelId] = useState<string | null>(null);
  const [editGmailLabelName, setEditGmailLabelName] = useState("");

  const handleDragOver = useCallback((e: React.DragEvent, labelId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "link";
    setDragOverLabel(labelId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverLabel(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, labelId: string) => {
    e.preventDefault();
    setDragOverLabel(null);
    const emailId = e.dataTransfer.getData("text/plain");
    if (emailId && onDropEmailOnLabel) onDropEmailOnLabel(emailId, labelId);
  }, [onDropEmailOnLabel]);

  const addLabel = useCallback(async () => {
    if (!newLabelName.trim()) return;
    
    // If Gmail connected, create in Gmail
    if (gmailConnected && onCreateGmailLabel) {
      setCreatingGmailLabel(true);
      try {
        await onCreateGmailLabel(newLabelName.trim());
      } finally {
        setCreatingGmailLabel(false);
      }
    } else {
      const id = newLabelName.trim().toLowerCase().replace(/\s+/g, "-") + "-" + Date.now();
      setLabels(prev => [...prev, { id, name: newLabelName.trim(), color: newLabelColor }]);
    }
    setNewLabelName(""); setNewLabelColor("blue"); setShowAddLabel(false);
  }, [newLabelName, newLabelColor, setLabels, gmailConnected, onCreateGmailLabel]);

  const startEditLabel = useCallback((label: EmailLabel) => {
    setEditingLabelId(label.id); setEditLabelName(label.name); setEditLabelColor(label.color);
  }, []);

  const saveEditLabel = useCallback(() => {
    if (!editingLabelId || !editLabelName.trim()) return;
    setLabels(prev => prev.map(l => l.id === editingLabelId ? { ...l, name: editLabelName.trim(), color: editLabelColor } : l));
    setEditingLabelId(null);
  }, [editingLabelId, editLabelName, editLabelColor, setLabels]);

  const deleteLabel = useCallback((id: string) => {
    setLabels(prev => prev.filter(l => l.id !== id));
    if (filterLabel === id) setFilterLabel(null);
  }, [filterLabel, setFilterLabel, setLabels]);

  const startEditGmailLabel = useCallback((gl: GmailSidebarLabel) => {
    setEditingGmailLabelId(gl.id);
    setEditGmailLabelName(gl.name);
  }, []);

  const saveEditGmailLabel = useCallback(async (gl: GmailSidebarLabel) => {
    if (!editGmailLabelName.trim() || !onRenameGmailLabel) return;
    await onRenameGmailLabel(gl.gmailId, editGmailLabelName.trim());
    setEditingGmailLabelId(null);
  }, [editGmailLabelName, onRenameGmailLabel]);

  const handleDeleteGmailLabel = useCallback(async (gl: GmailSidebarLabel) => {
    if (!onDeleteGmailLabel) return;
    if (filterLabel === gl.id) setFilterLabel(null);
    await onDeleteGmailLabel(gl.gmailId);
  }, [onDeleteGmailLabel, filterLabel, setFilterLabel]);

  return (
    <div className="p-3 h-full overflow-y-auto">
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 px-2">Pastas</p>
      <TooltipProvider delayDuration={300}>
        {folders.map(f => {
          const syncStatus = folderSyncStatuses[f.id];
          return (
            <Tooltip key={f.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => { setActiveFolder(f.id as EmailFolder); setSelectedId(null); setMobileDrawerOpen(false); }}
                  className={`w-full flex items-center gap-2 px-2 py-2.5 sm:py-1.5 rounded-lg text-sm transition-colors mb-0.5 min-h-[44px] sm:min-h-0 ${
                    activeFolder === f.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                  }`}
                >
                  <f.icon className="w-3.5 h-3.5" />
                  <span className="flex-1 text-left">{f.label}</span>
                  <div className="flex items-center gap-1">
                    {f.count > 0 && <span className="text-xs bg-primary/20 text-primary px-1.5 rounded-full tabular-nums">{f.count}</span>}
                    {gmailConnected && syncStatus && (
                      syncStatus.synced
                        ? <CheckCircle2 className="w-2.5 h-2.5 text-green-500/60" />
                        : <Circle className="w-2.5 h-2.5 text-muted-foreground/30" />
                    )}
                  </div>
                </button>
              </TooltipTrigger>
              {gmailConnected && syncStatus && (
                <TooltipContent side="right" className="text-xs">
                  {syncStatus.synced
                    ? <span>{syncStatus.totalSynced} mensagens sincronizadas</span>
                    : <span>Pasta não sincronizada</span>
                  }
                </TooltipContent>
              )}
            </Tooltip>
          );
        })}
      </TooltipProvider>

      {/* Account selector */}
      {gmailConnected && accountInfoMap.size > 1 && (
        <div className="mt-4 pt-3 border-t border-foreground/5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2 px-2">Contas</p>
          <button onClick={() => { setFilterAccount(null); setMobileDrawerOpen(false); }}
            className={`w-full flex items-center gap-2 px-2 py-2.5 sm:py-1.5 rounded-lg text-sm transition-colors mb-0.5 min-h-[44px] sm:min-h-0 ${
              !filterAccount ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            }`}>
            <Users className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Todas as contas</span>
            <span className="text-xs opacity-60">{accountInfoMap.size}</span>
          </button>
          {Array.from(accountInfoMap.entries()).map(([id, info]) => (
            <button key={id} onClick={() => { setFilterAccount(filterAccount === id ? null : id); setMobileDrawerOpen(false); }}
              className={`w-full flex items-center gap-2 px-2 py-2.5 sm:py-1.5 rounded-lg text-sm transition-colors mb-0.5 min-h-[44px] sm:min-h-0 ${
                filterAccount === id ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
              }`}>
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: info.color }} />
              <span className="flex-1 text-left truncate text-xs">{info.email}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-foreground/5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2 px-2">Filtros</p>
        <button onClick={() => { setFilterStarred(!filterStarred); setMobileDrawerOpen(false); }}
          className={`w-full flex items-center gap-2 px-2 py-2.5 sm:py-1.5 rounded-lg text-sm transition-colors min-h-[44px] sm:min-h-0 ${
            filterStarred ? "bg-yellow-500/10 text-yellow-500" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
          }`}>
          <Star className={`w-3.5 h-3.5 ${filterStarred ? "fill-yellow-500" : ""}`} />
          <span className="flex-1 text-left">Favoritos</span>
        </button>
      </div>

      {/* Unified Etiquetas section (Gmail labels + custom labels) */}
      <div className="mt-4 pt-3 border-t border-foreground/5">
        <div className="flex items-center justify-between mb-2 px-2">
          <div className="flex items-center gap-1.5">
            <Tag className="w-3 h-3 text-muted-foreground" />
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Etiquetas</p>
          </div>
          <div className="flex items-center gap-1">
            {gmailConnected && onRefreshLabels && (
              <button onClick={onRefreshLabels} disabled={labelsLoading}
                className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-50">
                <RefreshCw className={`w-3 h-3 ${labelsLoading ? "animate-spin" : ""}`} />
              </button>
            )}
            <button onClick={() => { setShowAddLabel(!showAddLabel); setEditingLabelId(null); }}
              className="text-muted-foreground hover:text-primary transition-colors">
              {showAddLabel ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            </button>
          </div>
        </div>
        {showAddLabel && (
          <div className="px-2 mb-2 space-y-1.5">
            <input value={newLabelName} onChange={e => setNewLabelName(e.target.value)} placeholder={gmailConnected ? "Nova etiqueta Gmail" : "Nome da etiqueta"}
              onKeyDown={e => { if (e.key === "Enter") addLabel(); }}
              className="w-full bg-foreground/5 rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none" autoFocus />
            {!gmailConnected && (
              <div className="flex items-center gap-1 flex-wrap">
                {(Object.keys(LABEL_DOT) as LabelColor[]).map(c => (
                  <button key={c} onClick={() => setNewLabelColor(c)}
                    className={`w-5 h-5 rounded-full ${LABEL_DOT[c]} transition-all ${newLabelColor === c ? "ring-2 ring-foreground/30 scale-110" : "opacity-60 hover:opacity-100"}`} />
                ))}
              </div>
            )}
            <button onClick={addLabel} disabled={!newLabelName.trim() || creatingGmailLabel}
              className="w-full text-xs bg-primary/20 text-primary rounded-lg py-1 hover:bg-primary/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
              {creatingGmailLabel ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {gmailConnected ? "Criar no Gmail" : "Criar etiqueta"}
            </button>
          </div>
        )}

        {/* Gmail labels with real counts */}
        {gmailConnected && gmailLabels.map(gl => (
          <div key={gl.id} className="group flex items-center">
            {editingGmailLabelId === gl.id ? (
              <div className="flex-1 px-2 py-1 space-y-1">
                <input value={editGmailLabelName} onChange={e => setEditGmailLabelName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveEditGmailLabel(gl); }}
                  className="w-full bg-foreground/5 rounded px-2 py-1 text-xs text-foreground outline-none" autoFocus />
                <div className="flex items-center gap-1">
                  <button onClick={() => saveEditGmailLabel(gl)} className="text-xs text-primary">Salvar</button>
                  <button onClick={() => setEditingGmailLabelId(null)} className="text-xs text-muted-foreground">×</button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setFilterLabel(filterLabel === gl.id ? null : gl.id); setMobileDrawerOpen(false); }}
                onDragOver={e => handleDragOver(e, gl.id)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, gl.id)}
                className={`flex-1 flex items-center gap-2 px-2 py-2.5 sm:py-1.5 rounded-lg text-sm transition-colors mb-0.5 min-h-[44px] sm:min-h-0 ${
                  dragOverLabel === gl.id ? "ring-2 ring-primary bg-primary/15" :
                  filterLabel === gl.id ? LABEL_COLORS[gl.color] : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                }`}>
                <div className={`w-2.5 h-2.5 rounded-full ${LABEL_DOT[gl.color]}`} />
                <span className="flex-1 text-left truncate">{gl.name}</span>
                {(gl.unreadCount || 0) > 0 && (
                  <span className="text-[10px] tabular-nums bg-primary/15 text-primary px-1 rounded-full">{gl.unreadCount}</span>
                )}
                {gl.messageCount > 0 && !(gl.unreadCount && gl.unreadCount > 0) && (
                  <span className="text-xs tabular-nums opacity-40">{gl.messageCount}</span>
                )}
              </button>
            )}
            {editingGmailLabelId !== gl.id && (
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 pr-1">
                {onRenameGmailLabel && (
                  <button onClick={() => startEditGmailLabel(gl)} className="p-0.5 text-muted-foreground hover:text-foreground"><Edit3 className="w-3 h-3" /></button>
                )}
                {onDeleteGmailLabel && (
                  <button onClick={() => handleDeleteGmailLabel(gl)} className="p-0.5 text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Separator between Gmail labels and custom labels */}
        {gmailConnected && gmailLabels.length > 0 && labels.length > 0 && (
          <div className="mx-2 h-px bg-foreground/5 my-1.5" />
        )}

        {/* Custom labels */}
        {labels.map(label => (
          <div key={label.id} className="group flex items-center">
            {editingLabelId === label.id ? (
              <div className="flex-1 px-2 py-1 space-y-1">
                <input value={editLabelName} onChange={e => setEditLabelName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveEditLabel(); }}
                  className="w-full bg-foreground/5 rounded px-2 py-1 text-xs text-foreground outline-none" autoFocus />
                <div className="flex items-center gap-1">
                  {(Object.keys(LABEL_DOT) as LabelColor[]).map(c => (
                    <button key={c} onClick={() => setEditLabelColor(c)}
                      className={`w-4 h-4 rounded-full ${LABEL_DOT[c]} transition-all ${editLabelColor === c ? "ring-2 ring-foreground/30" : "opacity-50"}`} />
                  ))}
                  <button onClick={saveEditLabel} className="ml-auto text-xs text-primary">Salvar</button>
                  <button onClick={() => setEditingLabelId(null)} className="text-xs text-muted-foreground">×</button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setFilterLabel(filterLabel === label.id ? null : label.id); setMobileDrawerOpen(false); }}
                onDragOver={e => handleDragOver(e, label.id)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, label.id)}
                className={`flex-1 flex items-center gap-2 px-2 py-2.5 sm:py-1.5 rounded-lg text-sm transition-colors min-h-[44px] sm:min-h-0 ${
                  dragOverLabel === label.id ? "ring-2 ring-primary bg-primary/15" :
                  filterLabel === label.id ? LABEL_COLORS[label.color] : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                }`}>
                <div className={`w-2.5 h-2.5 rounded-full ${LABEL_DOT[label.color]}`} />
                <span className="flex-1 text-left truncate">{label.name}</span>
                {(labelCounts[label.id] || 0) > 0 && <span className="text-xs tabular-nums opacity-60">{labelCounts[label.id]}</span>}
              </button>
            )}
            {editingLabelId !== label.id && (
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 pr-1">
                <button onClick={() => startEditLabel(label)} className="p-0.5 text-muted-foreground hover:text-foreground"><Edit3 className="w-3 h-3" /></button>
                <button onClick={() => deleteLabel(label.id)} className="p-0.5 text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
              </div>
            )}
          </div>
        ))}

        {/* Empty state */}
        {gmailLabels.length === 0 && labels.length === 0 && !showAddLabel && (
          <p className="px-2 py-2 text-[11px] text-muted-foreground/50 text-center">
            Nenhuma etiqueta ainda
          </p>
        )}
      </div>
    </div>
  );
});

FoldersSidebar.displayName = "FoldersSidebar";

export default FoldersSidebar;

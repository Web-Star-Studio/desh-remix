import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useGoogleData } from "@/hooks/files/useGoogleData";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  FolderOpen, ChevronRight, Loader2, ArrowLeft, FolderInput,
  Home, FolderSymlink,
} from "lucide-react";

interface MoveToItem {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  connectionId?: string;
  workspaceId?: string;
}

interface Props {
  item: MoveToItem | null;
  onClose: () => void;
  onSuccess?: () => void;
}

interface FolderEntry {
  id: string;
  name: string;
}

interface BreadcrumbEntry {
  id: string | null;
  name: string;
}

export function MoveToDialog({ item, onClose, onSuccess }: Props) {
  const { fetchGoogleData } = useGoogleData();
  const { invoke } = useEdgeFn();
  const { workspaces } = useWorkspace();

  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(false);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([{ id: null, name: "Meu Drive" }]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // Cross-workspace mode
  const [mode, setMode] = useState<"same" | "cross">("same");
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedTargetWs, setSelectedTargetWs] = useState<string | null>(null);
  const [crossFolders, setCrossFolders] = useState<FolderEntry[]>([]);
  const [crossBreadcrumb, setCrossBreadcrumb] = useState<BreadcrumbEntry[]>([{ id: null, name: "Meu Drive" }]);
  const [crossFolderId, setCrossFolderId] = useState<string | null>(null);
  const [crossLoading, setCrossLoading] = useState(false);

  // Load connections for cross-workspace
  useEffect(() => {
    if (!item) return;
    Promise.resolve(supabase.from("connections").select("*").eq("category", "cloud_storage")).then(({ data }) => {
      if (data) setConnections(data);
    }).catch((err) => console.error("Load connections error:", err));
  }, [item]);

  const otherWorkspaces = workspaces.filter(ws => {
    if (ws.id === item?.workspaceId) return false;
    return connections.some(c => c.workspace_id === ws.id);
  });

  // Fetch folders for same-workspace mode
  const fetchFolders = useCallback(async (parentId: string | null) => {
    setLoading(true);
    try {
      const q = parentId
        ? `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
        : `'root' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const res = await fetchGoogleData<any>({
        service: "drive",
        path: "/files",
        params: { q, fields: "files(id,name)", pageSize: "100", orderBy: "name" },
        connectionId: item?.connectionId,
      });
      setFolders((res as any)?.files || []);
    } catch {
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, [fetchGoogleData, item?.connectionId]);

  // Fetch folders for cross-workspace mode
  const fetchCrossFolders = useCallback(async (parentId: string | null, connId: string) => {
    setCrossLoading(true);
    try {
      const q = parentId
        ? `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
        : `'root' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const res = await fetchGoogleData<any>({
        service: "drive",
        path: "/files",
        params: { q, fields: "files(id,name)", pageSize: "100", orderBy: "name" },
        connectionId: connId,
      });
      setCrossFolders((res as any)?.files || []);
    } catch {
      setCrossFolders([]);
    } finally {
      setCrossLoading(false);
    }
  }, [fetchGoogleData]);

  // Init
  useEffect(() => {
    if (!item) {
      setFolders([]);
      setBreadcrumb([{ id: null, name: "Meu Drive" }]);
      setCurrentFolderId(null);
      setMode("same");
      setSelectedTargetWs(null);
      return;
    }
    fetchFolders(null);
  }, [item]);

  // Navigate same-workspace
  const navigateTo = (folderId: string | null, name: string) => {
    if (folderId === null) {
      setBreadcrumb([{ id: null, name: "Meu Drive" }]);
    } else {
      const idx = breadcrumb.findIndex(b => b.id === folderId);
      if (idx >= 0) setBreadcrumb(breadcrumb.slice(0, idx + 1));
      else setBreadcrumb([...breadcrumb, { id: folderId, name }]);
    }
    setCurrentFolderId(folderId);
    fetchFolders(folderId);
  };

  // Navigate cross-workspace
  const navigateCrossTo = (folderId: string | null, name: string) => {
    const connId = connections.find(c => c.workspace_id === selectedTargetWs)?.id;
    if (!connId) return;
    if (folderId === null) {
      setCrossBreadcrumb([{ id: null, name: "Meu Drive" }]);
    } else {
      const idx = crossBreadcrumb.findIndex(b => b.id === folderId);
      if (idx >= 0) setCrossBreadcrumb(crossBreadcrumb.slice(0, idx + 1));
      else setCrossBreadcrumb([...crossBreadcrumb, { id: folderId, name }]);
    }
    setCrossFolderId(folderId);
    fetchCrossFolders(folderId, connId);
  };

  // Select target workspace
  const selectTargetWs = (wsId: string) => {
    setSelectedTargetWs(wsId);
    setCrossBreadcrumb([{ id: null, name: "Meu Drive" }]);
    setCrossFolderId(null);
    const connId = connections.find(c => c.workspace_id === wsId)?.id;
    if (connId) fetchCrossFolders(null, connId);
  };

  // Move to same workspace folder
  const handleMoveHere = async () => {
    if (!item) return;
    setMoving(true);
    const targetFolder = currentFolderId || "root";
    try {
      const currentParent = item.parents?.[0] || "root";
      await fetchGoogleData({
        service: "drive",
        path: `/files/${item.id}`,
        method: "PATCH",
        params: { addParents: targetFolder, removeParents: currentParent },
        connectionId: item.connectionId,
      });
      const folderName = breadcrumb[breadcrumb.length - 1]?.name || "Meu Drive";
      toast({ title: "Movido!", description: `"${item.name}" → ${folderName}` });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast({ title: "Erro ao mover", description: err?.message, variant: "destructive" });
    } finally {
      setMoving(false);
    }
  };

  // Move to cross-workspace folder
  const handleCrossMoveHere = async () => {
    if (!item || !selectedTargetWs) return;
    const targetConn = connections.find(c => c.workspace_id === selectedTargetWs);
    const sourceConn = item.connectionId
      ? { id: item.connectionId }
      : connections.find(c => c.workspace_id === item.workspaceId);
    if (!targetConn || !sourceConn) {
      toast({ title: "Erro", description: "Conexão não encontrada.", variant: "destructive" });
      return;
    }
    setMoving(true);
    try {
      const { data, error } = await invoke<any>({
        fn: "drive-cross-copy",
        body: {
          fileId: item.id,
          fileName: item.name,
          mimeType: item.mimeType,
          sourceConnectionId: sourceConn.id,
          targetConnectionId: targetConn.id,
          targetFolderId: crossFolderId || undefined,
        },
      });
      if (error) throw new Error(error);
      if (data?.error) throw new Error(data.error);
      const ws = workspaces.find(w => w.id === selectedTargetWs);
      const folderName = crossBreadcrumb[crossBreadcrumb.length - 1]?.name || "Meu Drive";
      toast({ title: "Transferido!", description: `"${item.name}" → ${ws?.icon} ${ws?.name} / ${folderName}` });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast({ title: "Erro ao transferir", description: err?.message, variant: "destructive" });
    } finally {
      setMoving(false);
    }
  };

  const renderBreadcrumb = (bc: BreadcrumbEntry[], onNav: (id: string | null, name: string) => void) => (
    <div className="flex items-center gap-0.5 text-[11px] text-muted-foreground flex-wrap mb-3">
      {bc.map((b, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {i > 0 && <ChevronRight className="w-3 h-3" />}
          <button onClick={() => onNav(b.id, b.name)} className="hover:text-foreground transition-colors px-1 py-0.5 rounded hover:bg-foreground/5">
            {i === 0 ? <Home className="w-3 h-3 inline mr-0.5" /> : null}
            {b.name}
          </button>
        </span>
      ))}
    </div>
  );

  const renderFolderList = (
    folderList: FolderEntry[],
    isLoadingList: boolean,
    onNavigate: (id: string, name: string) => void,
    excludeId?: string
  ) => (
    <div className="max-h-[280px] overflow-y-auto space-y-0.5">
      {isLoadingList ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : folderList.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">Nenhuma subpasta aqui</p>
      ) : (
        folderList.filter(f => f.id !== excludeId).map(f => (
          <button
            key={f.id}
            onClick={() => onNavigate(f.id, f.name)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-foreground/5 transition-colors text-left group"
          >
            <FolderOpen className="w-4 h-4 text-primary/70 flex-shrink-0" />
            <span className="text-sm text-foreground truncate flex-1">{f.name}</span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))
      )}
    </div>
  );

  return (
    <Dialog open={!!item} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FolderInput className="w-4 h-4 text-primary" />
            Mover para...
          </DialogTitle>
        </DialogHeader>

        {item && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground truncate">
              Item: <strong className="text-foreground">{item.name}</strong>
            </p>

            {/* Mode tabs */}
            {otherWorkspaces.length > 0 && (
              <div className="flex gap-1 p-0.5 rounded-lg bg-foreground/5">
                <button
                  onClick={() => setMode("same")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    mode === "same" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FolderOpen className="w-3.5 h-3.5" /> Mesma conta
                </button>
                <button
                  onClick={() => setMode("cross")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    mode === "cross" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FolderSymlink className="w-3.5 h-3.5" /> Outro perfil
                </button>
              </div>
            )}

            {mode === "same" ? (
              <>
                {renderBreadcrumb(breadcrumb, navigateTo)}
                {renderFolderList(folders, loading, (id, name) => navigateTo(id, name), item.id)}
                <button
                  onClick={handleMoveHere}
                  disabled={moving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {moving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderInput className="w-4 h-4" />}
                  Mover para "{breadcrumb[breadcrumb.length - 1]?.name}"
                </button>
              </>
            ) : (
              <>
                {!selectedTargetWs ? (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground mb-2">Selecione o perfil de destino:</p>
                    {otherWorkspaces.map(ws => (
                      <button
                        key={ws.id}
                        onClick={() => selectTargetWs(ws.id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-colors text-left"
                      >
                        <span className="w-8 h-8 rounded-lg flex items-center justify-center text-lg" style={{ background: `${ws.color}20` }}>
                          {ws.icon}
                        </span>
                        <span className="flex-1 text-sm font-medium text-foreground">{ws.name}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => { setSelectedTargetWs(null); setCrossFolders([]); setCrossBreadcrumb([{ id: null, name: "Meu Drive" }]); setCrossFolderId(null); }}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      {(() => { const ws = workspaces.find(w => w.id === selectedTargetWs); return ws ? `${ws.icon} ${ws.name}` : "Perfil"; })()}
                    </button>
                    {renderBreadcrumb(crossBreadcrumb, navigateCrossTo)}
                    {renderFolderList(crossFolders, crossLoading, (id, name) => navigateCrossTo(id, name))}
                    <button
                      onClick={handleCrossMoveHere}
                      disabled={moving}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {moving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderSymlink className="w-4 h-4" />}
                      Transferir para "{crossBreadcrumb[crossBreadcrumb.length - 1]?.name}"
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

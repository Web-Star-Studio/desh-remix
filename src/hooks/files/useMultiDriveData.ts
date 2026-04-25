import { useState, useEffect, useCallback, useRef } from "react";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { useComposioConnection } from "@/hooks/integrations/useComposioConnection";
import { useComposioWorkspaceId } from "@/hooks/integrations/useComposioWorkspaceId";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export interface MultiDriveItem {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  modifiedTime: string;
  webViewLink: string;
  iconLink: string;
  thumbnailLink: string;
  isFolder: boolean;
  parents?: string[];
  /** Which workspace this file belongs to */
  workspaceId: string;
  /** Which connection was used */
  connectionId: string;
}

interface WorkspaceDriveData {
  workspaceId: string;
  items: MultiDriveItem[];
  loading: boolean;
  error: string | null;
}

export function useMultiDriveData() {
  const { isConnected } = useComposioConnection();
  const { workspaces } = useWorkspace();
  const { invoke } = useEdgeFn();
  const composioWsId = useComposioWorkspaceId();
  const [workspaceData, setWorkspaceData] = useState<WorkspaceDriveData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const fetchedRef = useRef(false);

  const hasDrive = isConnected("googledrive");

  const fetchAll = useCallback(async () => {
    if (!hasDrive) {
      setWorkspaceData([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await invoke<any>({
        fn: "composio-proxy",
        body: {
          service: "drive",
          path: "/files",
          method: "GET",
          params: {
            pageSize: "100",
            q: "'root' in parents and trashed=false",
            fields: "files(id,name,mimeType,size,modifiedTime,webViewLink,iconLink,thumbnailLink,parents)",
            orderBy: "folder,modifiedTime desc",
          },
          workspace_id: composioWsId,
          default_workspace_id: composioWsId,
        },
      });

      if (error) throw new Error(error);

      const files = data?.files || data?.data?.files || [];
      const defaultWs = workspaces?.find(w => w.is_default);
      const wsId = defaultWs?.id || "default";

      const items: MultiDriveItem[] = files.map((f: any) => ({
        id: f.id,
        name: f.name || "Sem nome",
        mimeType: f.mimeType || "application/octet-stream",
        size: f.size ? parseInt(f.size, 10) : 0,
        modifiedTime: f.modifiedTime || "",
        webViewLink: f.webViewLink || "",
        iconLink: f.iconLink || "",
        thumbnailLink: f.thumbnailLink || "",
        isFolder: f.mimeType === "application/vnd.google-apps.folder",
        parents: f.parents || [],
        workspaceId: wsId,
        connectionId: "composio-googledrive",
      }));

      setWorkspaceData([{
        workspaceId: wsId,
        items,
        loading: false,
        error: null,
      }]);
    } catch (err: any) {
      setWorkspaceData([{
        workspaceId: "default",
        items: [],
        loading: false,
        error: err?.message || "Erro ao carregar",
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [hasDrive, invoke, workspaces]);

  useEffect(() => {
    if (!hasDrive) {
      setWorkspaceData([]);
      setIsLoading(false);
      fetchedRef.current = false;
      return;
    }
    fetchedRef.current = true;
    fetchAll();
  }, [hasDrive, fetchAll]);

  const allItems = workspaceData.flatMap(wd => wd.items);

  const connectedWorkspaceIds = workspaceData
    .filter(wd => wd.items.length > 0)
    .map(wd => wd.workspaceId);

  return {
    workspaceData,
    allItems,
    isLoading,
    connectedWorkspaceIds,
    driveConnections: hasDrive ? [{ id: "composio-googledrive" }] : [],
    refetch: () => { fetchedRef.current = false; fetchAll(); },
  };
}

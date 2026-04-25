// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";
import type { WorkspaceShare, WorkspaceShareModule, SharePermission } from "@/types/common";

export const MODULE_OPTIONS: { value: WorkspaceShareModule; label: string; group?: string }[] = [
  { value: "tasks", label: "Tarefas", group: "produtividade" },
  { value: "notes", label: "Notas", group: "produtividade" },
  { value: "calendar", label: "Calendário", group: "produtividade" },
  { value: "contacts", label: "Contatos", group: "produtividade" },
  { value: "habits", label: "Hábitos", group: "produtividade" },
  { value: "financegoals", label: "Metas", group: "financeiro" },
  { value: "transactions", label: "Transações", group: "financeiro" },
  { value: "recurring", label: "Recorrências", group: "financeiro" },
  { value: "budgets", label: "Orçamentos", group: "financeiro" },
];

const SHARE_COLUMNS = "id, owner_id, shared_with, workspace_id, permission, status, share_all, modules, created_at, updated_at";

export function useWorkspaceShares() {
  const { user } = useAuth();
  const { workspaces } = useWorkspace();
  const [myShares, setMyShares] = useState<WorkspaceShare[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<WorkspaceShare[]>([]);
  const [pendingInvites, setPendingInvites] = useState<WorkspaceShare[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);

  const workspacesRef = useRef(workspaces);
  workspacesRef.current = workspaces;

  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  const fetchAll = useCallback(async () => {
    if (!user || fetchingRef.current) return;
    fetchingRef.current = true;
    setIsLoading(true);

    try {
      const [ownedRes, receivedRes] = await Promise.all([
        supabase
          .from("workspace_shares" as any)
          .select(SHARE_COLUMNS)
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("workspace_shares" as any)
          .select(SHARE_COLUMNS)
          .eq("shared_with", user.id)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      if (!mountedRef.current) return;

      const owned = (ownedRes.data as any[]) || [];
      const received = (receivedRes.data as any[]) || [];

      const userIds = new Set<string>();
      owned.forEach(s => userIds.add(s.shared_with));
      received.forEach(s => userIds.add(s.owner_id));

      const wsIds = new Set<string>();
      received.forEach(s => wsIds.add(s.workspace_id));

      let profileMap: Record<string, { display_name: string; avatar_url: string | null; email: string | null }> = {};
      if (userIds.size > 0) {
        const { data: profiles } = await supabase.rpc("get_profiles_with_email", { _user_ids: Array.from(userIds) });
        if (!mountedRef.current) return;
        for (const p of (profiles as any[]) || []) {
          profileMap[p.user_id] = { display_name: p.display_name || "", avatar_url: p.avatar_url, email: p.email || null };
        }
      }

      const currentWorkspaces = workspacesRef.current;
      const wsMap: Record<string, { name: string; icon: string; color: string }> = {};
      currentWorkspaces.forEach(w => { wsMap[w.id] = { name: w.name, icon: w.icon, color: w.color }; });

      const missingWsIds = Array.from(wsIds).filter(id => !wsMap[id]);
      if (missingWsIds.length > 0) {
        const { data: wsData } = await supabase
          .from("workspaces")
          .select("id, name, icon, color")
          .in("id", missingWsIds);
        if (!mountedRef.current) return;
        for (const w of (wsData as any[]) || []) {
          wsMap[w.id] = { name: w.name, icon: w.icon, color: w.color };
        }
      }

      const mapShare = (s: any, isOwned: boolean): WorkspaceShare => {
        const profileKey = isOwned ? s.shared_with : s.owner_id;
        const profile = profileMap[profileKey];
        const name = profile?.display_name || profile?.email || "Usuário";
        const email = profile?.email || null;
        return {
          ...s,
          modules: s.modules || [],
          ...(isOwned
            ? { recipient_name: name, recipient_avatar: profile?.avatar_url, recipient_email: email }
            : { owner_name: name, owner_avatar: profile?.avatar_url, owner_email: email }),
          workspace_name: wsMap[s.workspace_id]?.name,
          workspace_icon: wsMap[s.workspace_id]?.icon,
          workspace_color: wsMap[s.workspace_id]?.color,
        };
      };

      if (!mountedRef.current) return;
      setMyShares(owned.map(s => mapShare(s, true)));
      setSharedWithMe(received.filter(s => s.status === "accepted").map(s => mapShare(s, false)));
      setPendingInvites(received.filter(s => s.status === "pending").map(s => mapShare(s, false)));
    } finally {
      fetchingRef.current = false;
      if (mountedRef.current) setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("workspace-shares-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_shares" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, fetchAll]);

  const createShare = useCallback(async (data: {
    shared_with: string;
    workspace_id: string;
    permission: SharePermission;
    share_all: boolean;
    modules: WorkspaceShareModule[];
  }) => {
    if (!user) return;
    const { error } = await supabase.rpc("create_workspace_share", {
      _shared_with: data.shared_with,
      _workspace_id: data.workspace_id,
      _permission: data.permission,
      _share_all: data.share_all,
      _modules: data.modules,
    });
    if (error) {
      if (error.message.includes("duplicate") || error.message.includes("unique")) {
        toast.error("Este workspace já foi compartilhado com esta pessoa");
      } else if (error.message.includes("not your friend")) {
        toast.error("Usuário não é seu amigo");
      } else {
        toast.error(error.message || "Erro ao compartilhar");
      }
      return;
    }
    toast.success("Workspace compartilhado! 🎉");
    fetchAll();
  }, [user, fetchAll]);

  // Secure RPCs — all validate auth.uid() server-side
  const acceptShare = useCallback(async (shareId: string) => {
    const { error } = await supabase.rpc("accept_workspace_share", { _share_id: shareId });
    if (error) { toast.error("Erro ao aceitar compartilhamento"); return; }
    toast.success("Compartilhamento aceito!");
    fetchAll();
  }, [fetchAll]);

  const rejectShare = useCallback(async (shareId: string) => {
    const { error } = await supabase.rpc("reject_workspace_share", { _share_id: shareId });
    if (error) { toast.error("Erro ao recusar compartilhamento"); return; }
    toast("Compartilhamento recusado");
    fetchAll();
  }, [fetchAll]);

  const revokeShare = useCallback(async (shareId: string) => {
    const { error } = await supabase.rpc("revoke_workspace_share", { _share_id: shareId });
    if (error) { toast.error("Erro ao revogar acesso"); return; }
    toast("Acesso revogado");
    fetchAll();
  }, [fetchAll]);

  const deleteShare = useCallback(async (shareId: string) => {
    const { error } = await supabase.rpc("delete_workspace_share", { _share_id: shareId });
    if (error) { toast.error("Erro ao excluir compartilhamento"); return; }
    fetchAll();
  }, [fetchAll]);

  const updatePermission = useCallback(async (shareId: string, permission: SharePermission) => {
    const { error } = await supabase.rpc("update_workspace_share_permission", {
      _share_id: shareId,
      _permission: permission,
    });
    if (error) { toast.error("Erro ao atualizar permissão"); return; }
    toast.success("Permissão atualizada");
    fetchAll();
  }, [fetchAll]);

  const updateModules = useCallback(async (shareId: string, share_all: boolean, modules: WorkspaceShareModule[]) => {
    const { error } = await supabase.rpc("update_workspace_share_modules", {
      _share_id: shareId,
      _share_all: share_all,
      _modules: modules,
    });
    if (error) { toast.error("Erro ao atualizar módulos"); return; }
    toast.success("Módulos atualizados");
    fetchAll();
  }, [fetchAll]);

  const getSharedData = useCallback(async (shareId: string) => {
    const { data, error } = await supabase.rpc("get_shared_workspace_data", { _share_id: shareId });
    if (error) { toast.error("Erro ao carregar dados compartilhados"); return null; }
    return data as Record<string, any[]>;
  }, []);

  return {
    myShares,
    sharedWithMe,
    pendingInvites,
    isLoading,
    createShare,
    acceptShare,
    rejectShare,
    revokeShare,
    deleteShare,
    updatePermission,
    updateModules,
    getSharedData,
    refresh: fetchAll,
  };
}

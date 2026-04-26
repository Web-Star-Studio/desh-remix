import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { exportToCsv } from "@/lib/exportCsv";
import { apiFetch } from "@/lib/api-client";
import { useWorkspaceFilter } from "@/hooks/workspace/useWorkspaceFilter";
import {
  Users, UserCheck, UserX, Download, Eye, Search,
  ShieldCheck, ShieldOff, Ban, ShieldAlert, Unlock, Wifi,
  TrendingUp, Clock, Database, CheckSquare, Copy, MoreHorizontal,
  ChevronDown, Loader2, AlertTriangle, Globe, Monitor, Smartphone,
  Archive, ArchiveRestore, Wallet, CreditCard, Plug, FileText,
} from "lucide-react";
import { format, subDays, isAfter, parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import UserDetailModal from "./UserDetailModal";
import AdminGrantCreditsModal from "./AdminGrantCreditsModal";

export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  data_count: number;
  suspended_at: string | null;
  suspended_reason: string | null;
  banned_at: string | null;
  banned_reason: string | null;
  archived_at: string | null;
  archived_reason: string | null;
  archive_expires_at: string | null;
  credits_balance: number;
  credits_spent: number;
  subscription_status: string | null;
  subscription_plan: string | null;
  workspaces_count: number;
  tasks_count: number;
  notes_count: number;
  connections_count: number;
}

interface Session {
  id: string;
  created_at: string;
  updated_at: string;
  user_agent: string | null;
  ip: string | null;
}

interface UsersTabProps {
  users: AdminUser[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onSetUserRole: (userId: string, role: "admin" | "user", email: string) => Promise<void>;
  onLogAction: (action: string, details?: Record<string, any>) => Promise<void>;
}

const USERS_PER_PAGE = 15;

const UsersTab = ({ users, loading, onRefresh, onSetUserRole, onLogAction }: UsersTabProps) => {
  const { user: currentUser } = useAuth();
  const { activeWorkspaceId } = useWorkspaceFilter();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "verified" | "unverified" | "inactive" | "suspended" | "banned" | "archived">("all");
  const [sortCol, setSortCol] = useState<"name" | "email" | "role" | "data" | "created" | "login">("created");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  // Dialogs
  const [roleDialog, setRoleDialog] = useState<{ userId: string; email: string; currentRole: string; newRole: "admin" | "user" } | null>(null);
  const [roleChanging, setRoleChanging] = useState(false);
  const [suspendDialog, setSuspendDialog] = useState<{ userId: string; email: string; action: "suspend" | "unsuspend" | "ban" | "unban" | "archive" | "unarchive" } | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendLoading, setSuspendLoading] = useState(false);
  const [sessionsDialog, setSessionsDialog] = useState<{ user: AdminUser; sessions: Session[] } | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [grantCreditsUser, setGrantCreditsUser] = useState<{ id: string; email: string; display_name: string | null } | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const thirtyDaysAgo = subDays(new Date(), 30);

  // KPIs
  const kpis = useMemo(() => {
    const verified = users.filter(u => u.email_confirmed_at).length;
    const active = users.filter(u => u.last_sign_in_at && isAfter(parseISO(u.last_sign_in_at), subDays(new Date(), 7))).length;
    const suspended = users.filter(u => u.suspended_at).length;
    const banned = users.filter(u => u.banned_at).length;
    const archived = users.filter(u => u.archived_at).length;
    const admins = users.filter(u => u.role === "admin").length;
    const avgData = users.length ? Math.round(users.reduce((s, u) => s + u.data_count, 0) / users.length) : 0;
    const totalCredits = users.reduce((s, u) => s + (u.credits_balance ?? 0), 0);
    const totalTasks = users.reduce((s, u) => s + (u.tasks_count ?? 0), 0);
    const totalNotes = users.reduce((s, u) => s + (u.notes_count ?? 0), 0);
    return { total: users.length, verified, active, suspended, banned, archived, admins, avgData, totalCredits, totalTasks, totalNotes };
  }, [users]);

  // Filtering & sorting
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const term = searchTerm.toLowerCase();
      const matchSearch = !term || (u.email?.toLowerCase() || "").includes(term) || (u.display_name?.toLowerCase() || "").includes(term) || u.id.includes(term);
      if (!matchSearch) return false;
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter === "verified" && !u.email_confirmed_at) return false;
      if (statusFilter === "unverified" && u.email_confirmed_at) return false;
      if (statusFilter === "inactive" && u.last_sign_in_at && isAfter(parseISO(u.last_sign_in_at), thirtyDaysAgo)) return false;
      if (statusFilter === "suspended" && !u.suspended_at) return false;
      if (statusFilter === "banned" && !u.banned_at) return false;
      if (statusFilter === "archived" && !u.archived_at) return false;
      return true;
    }).sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortCol) {
        case "name": return dir * (a.display_name || "").localeCompare(b.display_name || "");
        case "email": return dir * (a.email || "").localeCompare(b.email || "");
        case "role": return dir * a.role.localeCompare(b.role);
        case "data": return dir * (a.data_count - b.data_count);
        case "created": return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        case "login": return dir * ((a.last_sign_in_at ? new Date(a.last_sign_in_at).getTime() : 0) - (b.last_sign_in_at ? new Date(b.last_sign_in_at).getTime() : 0));
        default: return 0;
      }
    });
  }, [users, searchTerm, roleFilter, statusFilter, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginated = filteredUsers.slice((safePage - 1) * USERS_PER_PAGE, safePage * USERS_PER_PAGE);

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: typeof sortCol }) => (
    sortCol === col ? <span className="ml-0.5 text-primary">{sortDir === "asc" ? "↑" : "↓"}</span> : null
  );

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try { return format(new Date(d), "dd MMM yyyy, HH:mm", { locale: ptBR }); } catch { return d; }
  };

  const handleRoleChange = async () => {
    if (!roleDialog) return;
    setRoleChanging(true);
    try {
      await onSetUserRole(roleDialog.userId, roleDialog.newRole, roleDialog.email);
      toast({ title: "Role atualizada", description: `${roleDialog.email} → ${roleDialog.newRole}` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setRoleChanging(false);
      setRoleDialog(null);
    }
  };

  const handleSuspendAction = async () => {
    if (!suspendDialog) return;
    setSuspendLoading(true);
    try {
      const rpcMap = {
        suspend: "admin_suspend_user",
        unsuspend: "admin_unsuspend_user",
        ban: "admin_ban_user",
        unban: "admin_unban_user",
        archive: "admin_archive_user",
        unarchive: "admin_unarchive_user",
      } as const;

      const rpcName = rpcMap[suspendDialog.action];
      const params: any = { _target_user_id: suspendDialog.userId };
      if (suspendDialog.action === "suspend" || suspendDialog.action === "ban" || suspendDialog.action === "archive") {
        params._reason = suspendReason;
      }

      const { error } = await supabase.rpc(rpcName as any, params);
      if (error) throw error;

      // Send archive email notification via apps/api. The admin's active
      // workspace is used as the audit context; the target user resolves via
      // `targetUserId`. Server-side enforces that both are members of the
      // same workspace before sending.
      if (suspendDialog.action === "archive" && activeWorkspaceId) {
        try {
          await apiFetch(`/workspaces/${activeWorkspaceId}/notifications/send`, {
            method: "POST",
            body: JSON.stringify({
              type: "archive_notice",
              targetUserId: suspendDialog.userId,
              data: { reason: suspendReason },
            }),
          });
        } catch (e) {
          console.error("Failed to send archive email:", e);
        }
      }

      await onLogAction(suspendDialog.action, {
        target_user_id: suspendDialog.userId,
        target_email: suspendDialog.email,
        reason: suspendReason || undefined,
      });
      const actionLabels: Record<string, string> = {
        suspend: "suspenso", unsuspend: "reativado", ban: "banido", unban: "desbanido",
        archive: "arquivado", unarchive: "desarquivado",
      };
      toast({ title: "Sucesso", description: `Usuário ${actionLabels[suspendDialog.action]}.` });
      await onRefresh();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSuspendLoading(false);
      setSuspendDialog(null);
      setSuspendReason("");
    }
  };

  const handleViewSessions = async (u: AdminUser) => {
    setSessionsLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_get_user_sessions" as any, { _target_user_id: u.id });
      if (error) throw error;
      setSessionsDialog({ user: u, sessions: (data as Session[]) || [] });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSessionsLoading(false);
    }
  };

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast({ title: "ID copiado", description: id });
  };

  const exportUsers = () => {
    exportToCsv("usuarios",
      ["Nome", "Email", "Role", "Dados", "Créditos", "Plano", "Tarefas", "Notas", "Conexões", "Workspaces", "Verificado", "Status", "Último Login", "Cadastro"],
      filteredUsers.map(u => [
        u.display_name || "", u.email, u.role, String(u.data_count),
        String(u.credits_balance ?? 0), u.subscription_plan || "—",
        String(u.tasks_count ?? 0), String(u.notes_count ?? 0),
        String(u.connections_count ?? 0), String(u.workspaces_count ?? 0),
        u.email_confirmed_at ? "Sim" : "Não",
        u.banned_at ? "Banido" : u.archived_at ? "Arquivado" : u.suspended_at ? "Suspenso" : "Ativo",
        u.last_sign_in_at || "", u.created_at,
      ])
    );
    toast({ title: "Exportado", description: `${filteredUsers.length} usuários exportados` });
  };

  // Bulk actions
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selectedIds.size === paginated.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(paginated.map(u => u.id)));
  };

  const handleBulkAction = async (action: string) => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    const ids = [...selectedIds].filter(id => id !== currentUser?.id);
    try {
      if (action === "promote" || action === "demote") {
        const { error } = await supabase.rpc("admin_bulk_set_role" as any, {
          _user_ids: ids,
          _new_role: action === "promote" ? "admin" : "user",
        });
        if (error) throw error;
        await onLogAction("bulk_role_change", { user_ids: ids, new_role: action === "promote" ? "admin" : "user" });
      } else if (action === "suspend") {
        const { error } = await supabase.rpc("admin_bulk_suspend" as any, { _user_ids: ids, _reason: "Ação em massa" });
        if (error) throw error;
        await onLogAction("bulk_suspend", { user_ids: ids });
      }
      toast({ title: "Sucesso", description: `${ids.length} usuários atualizados` });
      setSelectedIds(new Set());
      await onRefresh();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setBulkLoading(false);
    }
  };

  const getUserStatus = (u: AdminUser) => {
    if (u.banned_at) return { label: "Banido", color: "bg-destructive/20 text-destructive", icon: Ban };
    if (u.archived_at) {
      const daysLeft = u.archive_expires_at ? Math.max(0, Math.ceil((new Date(u.archive_expires_at).getTime() - Date.now()) / 86400000)) : 0;
      return { label: `Arquivado (${daysLeft}d)`, color: "bg-orange-500/20 text-orange-400", icon: Archive };
    }
    if (u.suspended_at) return { label: "Suspenso", color: "bg-amber-500/20 text-amber-400", icon: ShieldAlert };
    if (!u.email_confirmed_at) return { label: "Não verificado", color: "bg-white/10 text-white/40", icon: UserX };
    if (u.last_sign_in_at && !isAfter(parseISO(u.last_sign_in_at), thirtyDaysAgo)) return { label: "Inativo", color: "bg-white/10 text-white/40", icon: Clock };
    return { label: "Ativo", color: "bg-emerald-500/20 text-emerald-400", icon: UserCheck };
  };

  const parseUA = (ua: string | null) => {
    if (!ua) return { device: "Desconhecido", browser: "" };
    const isMobile = /mobile|android|iphone/i.test(ua);
    const browser = /chrome/i.test(ua) ? "Chrome" : /firefox/i.test(ua) ? "Firefox" : /safari/i.test(ua) ? "Safari" : /edge/i.test(ua) ? "Edge" : "Outro";
    return { device: isMobile ? "Mobile" : "Desktop", browser };
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11 gap-2">
        <KpiCard icon={Users} label="Total" value={kpis.total} />
        <KpiCard icon={TrendingUp} label="Ativos (7d)" value={kpis.active} accent />
        <KpiCard icon={UserCheck} label="Verificados" value={kpis.verified} />
        <KpiCard icon={ShieldCheck} label="Admins" value={kpis.admins} />
        <KpiCard icon={Database} label="Média dados" value={kpis.avgData} />
        <KpiCard icon={Wallet} label="Créditos" value={kpis.totalCredits} accent />
        <KpiCard icon={CheckSquare} label="Tarefas" value={kpis.totalTasks} />
        <KpiCard icon={FileText} label="Notas" value={kpis.totalNotes} />
        <KpiCard icon={ShieldAlert} label="Suspensos" value={kpis.suspended} warn={kpis.suspended > 0} />
        <KpiCard icon={Ban} label="Banidos" value={kpis.banned} warn={kpis.banned > 0} />
        <KpiCard icon={Archive} label="Arquivados" value={kpis.archived} warn={kpis.archived > 0} />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
          <input
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
            placeholder="Buscar nome, email ou ID..."
            className="w-full bg-white/[0.06] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-primary/30 border border-white/10"
          />
        </div>
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value as any); setPage(1); }}
          className="bg-white/[0.06] rounded-xl px-3 py-2 text-xs text-white border border-white/10 outline-none focus:ring-2 focus:ring-primary/30">
          <option value="all">Todas roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }}
          className="bg-white/[0.06] rounded-xl px-3 py-2 text-xs text-white border border-white/10 outline-none focus:ring-2 focus:ring-primary/30">
          <option value="all">Todos status</option>
          <option value="verified">Verificados</option>
          <option value="unverified">Não verificados</option>
          <option value="inactive">Inativos (30d+)</option>
          <option value="suspended">Suspensos</option>
          <option value="banned">Banidos</option>
          <option value="archived">Arquivados</option>
        </select>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 ml-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20">
            <span className="text-[10px] text-primary font-semibold">{selectedIds.size} selecionado(s)</span>
            <button onClick={() => handleBulkAction("promote")} disabled={bulkLoading}
              className="px-2 py-1 rounded-lg text-[10px] font-medium bg-primary/20 text-primary hover:bg-primary/30 transition-colors disabled:opacity-50">
              Promover
            </button>
            <button onClick={() => handleBulkAction("demote")} disabled={bulkLoading}
              className="px-2 py-1 rounded-lg text-[10px] font-medium bg-white/10 text-white/60 hover:bg-white/15 transition-colors disabled:opacity-50">
              Rebaixar
            </button>
            <button onClick={() => handleBulkAction("suspend")} disabled={bulkLoading}
              className="px-2 py-1 rounded-lg text-[10px] font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors disabled:opacity-50">
              Suspender
            </button>
            <button onClick={() => setSelectedIds(new Set())}
              className="px-2 py-1 rounded-lg text-[10px] font-medium text-white/40 hover:text-white/60 transition-colors">
              Limpar
            </button>
          </div>
        )}

        <button onClick={exportUsers} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors ml-auto">
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="py-3 px-3 w-8">
                  <Checkbox checked={selectedIds.size === paginated.length && paginated.length > 0} onCheckedChange={toggleAll} />
                </th>
                <th onClick={() => toggleSort("name")} className="text-left py-3 px-3 font-medium text-white/50 cursor-pointer hover:text-white/80 select-none">Usuário<SortIcon col="name" /></th>
                <th onClick={() => toggleSort("role")} className="text-left py-3 px-3 font-medium text-white/50 cursor-pointer hover:text-white/80 select-none">Role<SortIcon col="role" /></th>
                <th className="text-left py-3 px-3 font-medium text-white/50">Status</th>
                <th onClick={() => toggleSort("data")} className="text-left py-3 px-3 font-medium text-white/50 cursor-pointer hover:text-white/80 select-none">Dados<SortIcon col="data" /></th>
                <th className="text-left py-3 px-3 font-medium text-white/50">Créditos</th>
                <th className="text-left py-3 px-3 font-medium text-white/50">Plano</th>
                <th onClick={() => toggleSort("login")} className="text-left py-3 px-3 font-medium text-white/50 cursor-pointer hover:text-white/80 select-none">Último Login<SortIcon col="login" /></th>
                <th className="text-right py-3 px-3 font-medium text-white/50">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(u => {
                const status = getUserStatus(u);
                return (
                  <tr key={u.id} className={`border-b border-white/5 hover:bg-white/[0.03] transition-colors ${u.banned_at ? "opacity-50" : u.suspended_at ? "opacity-70" : ""}`}>
                    <td className="py-3 px-3">
                      <Checkbox checked={selectedIds.has(u.id)} onCheckedChange={() => toggleSelect(u.id)} />
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5 min-w-[180px]">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-semibold text-primary shrink-0">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            (u.display_name || u.email || "?").charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate text-xs">{u.display_name || "—"}</p>
                          <p className="text-[10px] text-white/40 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        u.role === "admin" ? "bg-primary/20 text-primary" : "bg-white/10 text-white/60"
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${status.color}`}>
                        <status.icon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-white/60 font-mono text-[11px]">{u.data_count}</td>
                    <td className="py-3 px-3">
                      <span className={`font-mono text-[11px] ${(u.credits_balance ?? 0) > 0 ? "text-emerald-400" : "text-white/40"}`}>
                        {u.credits_balance ?? 0}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {u.subscription_plan ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 capitalize">
                          {u.subscription_plan}
                        </span>
                      ) : (
                        <span className="text-[10px] text-white/30">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-white/40 text-[11px]">{formatDate(u.last_sign_in_at)}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setSelectedUser(u)}
                          className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors" title="Detalhes">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => copyId(u.id)}
                          className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors" title="Copiar ID">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleViewSessions(u)} disabled={sessionsLoading}
                          className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors" title="Sessões">
                          <Wifi className="w-3.5 h-3.5" />
                        </button>

                        {u.id !== currentUser?.id && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors">
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[160px]">
                              <DropdownMenuItem onClick={() => setRoleDialog({
                                userId: u.id, email: u.email, currentRole: u.role,
                                newRole: u.role === "admin" ? "user" : "admin",
                              })}>
                                {u.role === "admin" ? <><ShieldOff className="w-3.5 h-3.5 mr-2" /> Rebaixar</> : <><ShieldCheck className="w-3.5 h-3.5 mr-2" /> Promover</>}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setGrantCreditsUser({ id: u.id, email: u.email, display_name: u.display_name })}>
                                <Wallet className="w-3.5 h-3.5 mr-2" /> Dar créditos
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {u.suspended_at ? (
                                <DropdownMenuItem onClick={() => setSuspendDialog({ userId: u.id, email: u.email, action: "unsuspend" })}>
                                  <Unlock className="w-3.5 h-3.5 mr-2" /> Reativar
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => setSuspendDialog({ userId: u.id, email: u.email, action: "suspend" })}
                                  className="text-amber-400 focus:text-amber-400">
                                  <ShieldAlert className="w-3.5 h-3.5 mr-2" /> Suspender
                                </DropdownMenuItem>
                              )}
                              {u.banned_at ? (
                                <DropdownMenuItem onClick={() => setSuspendDialog({ userId: u.id, email: u.email, action: "unban" })}>
                                  <Unlock className="w-3.5 h-3.5 mr-2" /> Desbanir
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => setSuspendDialog({ userId: u.id, email: u.email, action: "ban" })}
                                  className="text-destructive focus:text-destructive">
                                  <Ban className="w-3.5 h-3.5 mr-2" /> Banir
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {u.archived_at ? (
                                <DropdownMenuItem onClick={() => setSuspendDialog({ userId: u.id, email: u.email, action: "unarchive" })}>
                                  <ArchiveRestore className="w-3.5 h-3.5 mr-2" /> Desarquivar
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => setSuspendDialog({ userId: u.id, email: u.email, action: "archive" })}
                                  className="text-orange-400 focus:text-orange-400">
                                  <Archive className="w-3.5 h-3.5 mr-2" /> Arquivar (30d)
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginated.length === 0 && (
                <tr><td colSpan={9} className="py-12 text-center text-white/40 text-sm">
                  {loading ? "Carregando..." : searchTerm ? "Nenhum resultado encontrado" : "Nenhum usuário"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
            <span className="text-[10px] text-white/40">{filteredUsers.length} usuários · Página {safePage}/{totalPages}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}
                className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white/10 text-white/60 hover:bg-white/15 transition-colors disabled:opacity-40">Anterior</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .reduce<(number | "...")[]>((acc, p, i, arr) => { if (i > 0 && p - arr[i - 1] > 1) acc.push("..."); acc.push(p); return acc; }, [])
                .map((p, i) => p === "..." ? (
                  <span key={`e${i}`} className="px-1 text-[10px] text-white/40">…</span>
                ) : (
                  <button key={p} onClick={() => setPage(p as number)}
                    className={`w-7 h-7 rounded-lg text-[10px] font-medium transition-colors ${p === safePage ? "bg-primary text-primary-foreground" : "bg-white/10 text-white/60 hover:bg-white/15"}`}>{p}</button>
                ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white/10 text-white/60 hover:bg-white/15 transition-colors disabled:opacity-40">Próxima</button>
            </div>
          </div>
        )}
      </div>

      {/* Role change dialog */}
      <Dialog open={!!roleDialog} onOpenChange={o => !o && setRoleDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar alteração de role</DialogTitle>
            <DialogDescription>
              {roleDialog && <>Deseja {roleDialog.newRole === "admin" ? "promover" : "rebaixar"} <strong>{roleDialog.email}</strong> para <strong>{roleDialog.newRole}</strong>?</>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialog(null)} disabled={roleChanging}>Cancelar</Button>
            <Button variant={roleDialog?.newRole === "admin" ? "default" : "destructive"} onClick={handleRoleChange} disabled={roleChanging}>
              {roleChanging ? "Alterando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend/Ban dialog */}
      <Dialog open={!!suspendDialog} onOpenChange={o => !o && setSuspendDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {suspendDialog?.action === "suspend" && <><ShieldAlert className="w-5 h-5 text-amber-400" /> Suspender Usuário</>}
              {suspendDialog?.action === "unsuspend" && <><Unlock className="w-5 h-5 text-emerald-400" /> Reativar Usuário</>}
              {suspendDialog?.action === "ban" && <><Ban className="w-5 h-5 text-destructive" /> Banir Usuário</>}
              {suspendDialog?.action === "unban" && <><Unlock className="w-5 h-5 text-emerald-400" /> Desbanir Usuário</>}
              {suspendDialog?.action === "archive" && <><Archive className="w-5 h-5 text-orange-400" /> Arquivar Usuário</>}
              {suspendDialog?.action === "unarchive" && <><ArchiveRestore className="w-5 h-5 text-emerald-400" /> Desarquivar Usuário</>}
            </DialogTitle>
            <DialogDescription>
              {suspendDialog && <>
                {suspendDialog.action === "suspend" && "O usuário não poderá acessar o sistema temporariamente."}
                {suspendDialog.action === "ban" && "O usuário será permanentemente bloqueado."}
                {suspendDialog.action === "archive" && "A conta será marcada para exclusão definitiva em 30 dias. O usuário será notificado por e-mail."}
                {suspendDialog.action === "unarchive" && `Restaurar a conta de ${suspendDialog.email}. O processo de exclusão será cancelado.`}
                {(suspendDialog.action === "unsuspend" || suspendDialog.action === "unban") && `Remover restrição de ${suspendDialog.email}.`}
              </>}
            </DialogDescription>
          </DialogHeader>
          {(suspendDialog?.action === "suspend" || suspendDialog?.action === "ban" || suspendDialog?.action === "archive") && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Motivo {suspendDialog?.action === "archive" ? "(recomendado)" : "(opcional)"}</label>
              <Input value={suspendReason} onChange={e => setSuspendReason(e.target.value)} placeholder="Descreva o motivo..." />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendDialog(null)} disabled={suspendLoading}>Cancelar</Button>
            <Button
              variant={suspendDialog?.action === "ban" ? "destructive" : suspendDialog?.action === "suspend" ? "default" : "default"}
              onClick={handleSuspendAction}
              disabled={suspendLoading}
            >
              {suspendLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sessions dialog */}
      <Dialog open={!!sessionsDialog} onOpenChange={o => !o && setSessionsDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-primary" /> Sessões Ativas
            </DialogTitle>
            <DialogDescription>
              {sessionsDialog && <>{sessionsDialog.user.display_name || sessionsDialog.user.email} · {sessionsDialog.sessions.length} sessão(ões)</>}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {sessionsDialog?.sessions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma sessão ativa encontrada.</p>
            )}
            {sessionsDialog?.sessions.map(s => {
              const ua = parseUA(s.user_agent);
              return (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-foreground/[0.03] border border-border/30">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    {ua.device === "Mobile" ? <Smartphone className="w-4 h-4 text-primary" /> : <Monitor className="w-4 h-4 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{ua.browser} · {ua.device}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {s.ip && <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{s.ip}</span>}
                      <span>Atualizado {formatDistanceToNow(parseISO(s.updated_at), { locale: ptBR, addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* User detail modal */}
      <UserDetailModal user={selectedUser as any} open={!!selectedUser} onOpenChange={o => !o && setSelectedUser(null)} />

      {/* Grant credits modal */}
      {grantCreditsUser && (
        <AdminGrantCreditsModal
          open={!!grantCreditsUser}
          onOpenChange={o => !o && setGrantCreditsUser(null)}
          users={[grantCreditsUser]}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
};

const KpiCard = ({ icon: Icon, label, value, accent, warn }: { icon: React.ElementType; label: string; value: number; accent?: boolean; warn?: boolean }) => (
  <div className={`glass-card rounded-2xl p-3 transition-colors ${accent ? "ring-1 ring-primary/30" : warn ? "ring-1 ring-amber-500/30" : ""}`}>
    <div className="flex items-center gap-1.5 mb-1">
      <Icon className={`w-3.5 h-3.5 ${accent ? "text-primary" : warn ? "text-amber-400" : "text-white/50"}`} />
      <span className="text-[10px] text-white/50 font-medium">{label}</span>
    </div>
    <p className={`text-lg font-bold ${accent ? "text-primary" : warn ? "text-amber-400" : "text-white"}`}>{value}</p>
  </div>
);

export default UsersTab;

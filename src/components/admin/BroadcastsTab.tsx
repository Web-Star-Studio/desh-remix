import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  Megaphone, Plus, Trash2, ToggleLeft, ToggleRight, Send, Mail,
  Search, ChevronDown, ChevronUp, BarChart3, Eye, Clock, AlertTriangle,
  CheckCircle, Info, Edit2, X, Copy
} from "lucide-react";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { format, isAfter, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Broadcast {
  id: string;
  title: string;
  message: string;
  type: string;
  active: boolean;
  created_at: string;
  expires_at: string | null;
  action_url: string | null;
}

const ACTION_OPTIONS = [
  { value: "", label: "Sem ação" },
  { value: "/tasks", label: "Tarefas" },
  { value: "/calendar", label: "Calendário" },
  { value: "/finances", label: "Financeiro" },
  { value: "/email", label: "E-mail" },
  { value: "/messages", label: "Mensagens" },
  { value: "/contacts", label: "Contatos" },
  { value: "/files", label: "Arquivos" },
  { value: "/notes", label: "Notas" },
  { value: "/settings", label: "Configurações" },
  { value: "/integrations", label: "Integrações" },
];

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  info: { icon: Info, color: "bg-primary/20 text-primary", label: "Informativo" },
  warning: { icon: AlertTriangle, color: "bg-yellow-500/20 text-yellow-400", label: "Alerta" },
  success: { icon: CheckCircle, color: "bg-green-500/20 text-green-400", label: "Sucesso" },
};

const BroadcastsTab = () => {
  const { user } = useAuth();
  const { invoke } = useEdgeFn();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"info" | "warning" | "success">("info");
  const [expiresIn, setExpiresIn] = useState<"" | "1d" | "7d" | "30d" | "never">("never");
  const [actionUrl, setActionUrl] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "info" | "warning" | "success">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "expired">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchBroadcasts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("broadcasts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) setBroadcasts(data as Broadcast[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBroadcasts(); }, [fetchBroadcasts]);

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const active = broadcasts.filter(b => b.active && (!b.expires_at || isAfter(parseISO(b.expires_at), now)));
    const expired = broadcasts.filter(b => b.expires_at && !isAfter(parseISO(b.expires_at), now));
    const last7d = broadcasts.filter(b => isAfter(parseISO(b.created_at), subDays(now, 7)));
    return { total: broadcasts.length, active: active.length, expired: expired.length, recent: last7d.length };
  }, [broadcasts]);

  // Filtered
  const filtered = useMemo(() => {
    const now = new Date();
    return broadcasts.filter(b => {
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        if (!b.title.toLowerCase().includes(s) && !b.message.toLowerCase().includes(s)) return false;
      }
      if (typeFilter !== "all" && b.type !== typeFilter) return false;
      if (statusFilter === "active" && !b.active) return false;
      if (statusFilter === "inactive" && b.active) return false;
      if (statusFilter === "expired" && !(b.expires_at && !isAfter(parseISO(b.expires_at), now))) return false;
      return true;
    });
  }, [broadcasts, searchTerm, typeFilter, statusFilter]);

  const handleCreate = async () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: "Preencha título e mensagem", variant: "destructive" });
      return;
    }
    setSending(true);
    let expires_at: string | null = null;
    if (expiresIn === "1d") expires_at = new Date(Date.now() + 86400000).toISOString();
    else if (expiresIn === "7d") expires_at = new Date(Date.now() + 7 * 86400000).toISOString();
    else if (expiresIn === "30d") expires_at = new Date(Date.now() + 30 * 86400000).toISOString();

    const { error } = await supabase.from("broadcasts").insert({
      title: title.trim(),
      message: message.trim(),
      type,
      created_by: user!.id,
      expires_at,
      action_url: actionUrl.trim() || null,
    } as any);

    if (error) {
      toast({ title: "Erro ao criar aviso", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Aviso enviado", description: "Todos os usuários verão este aviso." });

      if (sendEmail) {
        invoke({
          fn: "email-system",
          body: {
            action: "send-notification",
            type: "broadcast",
            data: { title: title.trim(), message: message.trim(), broadcast_type: type },
          },
        }).then(({ data }) => {
          const sent = (data as any)?.sent || 0;
          toast({ title: `📧 E-mail enviado para ${sent} usuário(s)` });
        }).catch(() => {
          toast({ title: "Erro ao enviar e-mails", variant: "destructive" });
        });
      }

      setTitle(""); setMessage(""); setActionUrl(""); setSendEmail(false); setShowForm(false);
      fetchBroadcasts();
    }
    setSending(false);
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("broadcasts").update({ active: !active } as any).eq("id", id);
    fetchBroadcasts();
    toast({ title: active ? "Aviso desativado" : "Aviso ativado" });
  };

  const deleteBroadcast = async (id: string) => {
    await supabase.from("broadcasts").delete().eq("id", id);
    setDeleteConfirmId(null);
    fetchBroadcasts();
    toast({ title: "Aviso removido" });
  };

  const startEdit = (b: Broadcast) => {
    setEditingId(b.id);
    setEditTitle(b.title);
    setEditMessage(b.message);
  };

  const saveEdit = async () => {
    if (!editingId || !editTitle.trim() || !editMessage.trim()) return;
    await supabase.from("broadcasts").update({
      title: editTitle.trim(),
      message: editMessage.trim(),
    } as any).eq("id", editingId);
    setEditingId(null);
    fetchBroadcasts();
    toast({ title: "Aviso atualizado" });
  };

  const duplicateBroadcast = async (b: Broadcast) => {
    await supabase.from("broadcasts").insert({
      title: `${b.title} (cópia)`,
      message: b.message,
      type: b.type,
      created_by: user!.id,
      action_url: b.action_url,
    } as any);
    fetchBroadcasts();
    toast({ title: "Aviso duplicado" });
  };

  const formatDate = (d: string) => {
    try { return format(new Date(d), "dd MMM yyyy, HH:mm", { locale: ptBR }); }
    catch { return d; }
  };

  const isExpired = (b: Broadcast) => b.expires_at && !isAfter(parseISO(b.expires_at), new Date());

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Megaphone, label: "Total", value: stats.total, color: "text-primary" },
          { icon: CheckCircle, label: "Ativos", value: stats.active, color: "text-green-400" },
          { icon: Clock, label: "Expirados", value: stats.expired, color: "text-yellow-400" },
          { icon: BarChart3, label: "Últimos 7 dias", value: stats.recent, color: "text-cyan-400" },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-xl p-3 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center ${s.color}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-lg font-bold text-white leading-none">{s.value}</p>
              <p className="text-[10px] text-white/50">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Header + New */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-white">Avisos (Broadcasts)</h3>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Novo aviso
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="glass-card rounded-2xl p-4 sm:p-5 space-y-3">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Título do aviso"
            maxLength={120}
            className="w-full bg-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-primary/30 border border-white/10"
          />
          <div className="relative">
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Mensagem do aviso..."
              rows={3}
              maxLength={500}
              className="w-full bg-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-primary/30 border border-white/10 resize-none"
            />
            <span className="absolute bottom-2 right-3 text-[10px] text-white/30">{message.length}/500</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={type}
              onChange={e => setType(e.target.value as any)}
              className="bg-white/[0.06] rounded-xl px-3 py-2 text-xs text-white border border-white/10 outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="info">ℹ️ Informativo</option>
              <option value="warning">⚠️ Alerta</option>
              <option value="success">✅ Sucesso</option>
            </select>
            <select
              value={expiresIn}
              onChange={e => setExpiresIn(e.target.value as any)}
              className="bg-white/[0.06] rounded-xl px-3 py-2 text-xs text-white border border-white/10 outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="never">Sem expiração</option>
              <option value="1d">Expira em 1 dia</option>
              <option value="7d">Expira em 7 dias</option>
              <option value="30d">Expira em 30 dias</option>
            </select>
            <select
              value={actionUrl}
              onChange={e => setActionUrl(e.target.value)}
              className="bg-white/[0.06] rounded-xl px-3 py-2 text-xs text-white border border-white/10 outline-none focus:ring-2 focus:ring-primary/30"
            >
              {ACTION_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={e => setSendEmail(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-primary"
              />
              <Mail className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs text-white/70">E-mail</span>
            </label>
            <button
              onClick={handleCreate}
              disabled={sending || !title.trim() || !message.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 ml-auto"
            >
              <Send className="w-3.5 h-3.5" />
              {sending ? "Enviando..." : "Enviar aviso"}
            </button>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar avisos..."
            className="w-full bg-white/[0.06] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-primary/30 border border-white/10"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as any)}
          className="bg-white/[0.06] rounded-xl px-3 py-2 text-xs text-white border border-white/10 outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="all">Todos os tipos</option>
          <option value="info">Informativo</option>
          <option value="warning">Alerta</option>
          <option value="success">Sucesso</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
          className="bg-white/[0.06] rounded-xl px-3 py-2 text-xs text-white border border-white/10 outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
          <option value="expired">Expirados</option>
        </select>
        <span className="text-[10px] text-white/40 ml-auto">{filtered.length} aviso(s)</span>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="text-left py-3 px-4 font-medium text-white/50 w-8"></th>
                <th className="text-left py-3 px-4 font-medium text-white/50">Título</th>
                <th className="text-left py-3 px-4 font-medium text-white/50">Tipo</th>
                <th className="text-left py-3 px-4 font-medium text-white/50">Status</th>
                <th className="text-left py-3 px-4 font-medium text-white/50">Ação</th>
                <th className="text-left py-3 px-4 font-medium text-white/50">Criado em</th>
                <th className="text-left py-3 px-4 font-medium text-white/50">Expira em</th>
                <th className="text-left py-3 px-4 font-medium text-white/50">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => {
                const expired = isExpired(b);
                const cfg = TYPE_CONFIG[b.type] || TYPE_CONFIG.info;
                const TypeIcon = cfg.icon;
                const isExpanded = expandedId === b.id;
                const isEditing = editingId === b.id;

                return (
                  <tr key={b.id} className={`border-b border-white/5 hover:bg-white/[0.03] transition-colors ${expired ? "opacity-50" : ""}`}>
                    <td className="py-3 px-2">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : b.id)}
                        className="p-1 rounded-lg hover:bg-white/10 transition-colors text-white/40"
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <div className="space-y-1.5">
                          <input
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            className="w-full bg-white/[0.08] rounded-lg px-2 py-1 text-xs text-white border border-white/10 outline-none focus:ring-1 focus:ring-primary/30"
                          />
                          <textarea
                            value={editMessage}
                            onChange={e => setEditMessage(e.target.value)}
                            rows={2}
                            className="w-full bg-white/[0.08] rounded-lg px-2 py-1 text-xs text-white border border-white/10 outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                          />
                          <div className="flex gap-1">
                            <button onClick={saveEdit} className="px-2 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-medium hover:bg-primary/30">Salvar</button>
                            <button onClick={() => setEditingId(null)} className="px-2 py-0.5 rounded bg-white/10 text-white/60 text-[10px] font-medium hover:bg-white/20">Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="font-medium text-white">{b.title}</p>
                          <p className="text-white/40 truncate max-w-[250px]">{b.message}</p>
                          {isExpanded && (
                            <div className="mt-2 p-2 rounded-lg bg-white/[0.04] border border-white/5">
                              <p className="text-white/70 text-xs whitespace-pre-wrap">{b.message}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.color}`}>
                        <TypeIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {expired ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-500/20 text-yellow-400">Expirado</span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          b.active ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/50"
                        }`}>
                          {b.active ? "Ativo" : "Inativo"}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {b.action_url ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                          {ACTION_OPTIONS.find(o => o.value === b.action_url)?.label || b.action_url}
                        </span>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-white/40 whitespace-nowrap">{formatDate(b.created_at)}</td>
                    <td className="py-3 px-4 text-white/40 whitespace-nowrap">{b.expires_at ? formatDate(b.expires_at) : "—"}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => startEdit(b)}
                          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/50"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => duplicateBroadcast(b)}
                          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/50"
                          title="Duplicar"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleActive(b.id, b.active)}
                          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/50"
                          title={b.active ? "Desativar" : "Ativar"}
                        >
                          {b.active ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4" />}
                        </button>
                        {deleteConfirmId === b.id ? (
                          <div className="flex items-center gap-1 ml-1">
                            <button
                              onClick={() => deleteBroadcast(b.id)}
                              className="px-2 py-0.5 rounded bg-destructive/20 text-destructive text-[10px] font-medium hover:bg-destructive/30"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="p-1 rounded hover:bg-white/10 text-white/50"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(b.id)}
                            className="p-1.5 rounded-lg hover:bg-destructive/20 transition-colors text-white/50 hover:text-destructive"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-white/40">
                    {searchTerm || typeFilter !== "all" || statusFilter !== "all"
                      ? "Nenhum aviso encontrado com os filtros aplicados"
                      : "Nenhum aviso criado ainda"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BroadcastsTab;

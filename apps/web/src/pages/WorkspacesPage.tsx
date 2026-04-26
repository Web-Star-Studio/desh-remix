import { useState, useEffect, useCallback } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import { useWorkspace, Workspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";
import {
  Plus, Pencil, Trash2, Star, Check, X, ArrowLeft,
  Layers, GripVertical, Globe, ChevronRight,
  ListTodo, StickyNote, Users as UsersIcon,
  Wallet, Link2, BarChart3, Mail, Phone,
  Landmark, Share2, ExternalLink, Copy, Eye
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import GlassCard from "@/components/dashboard/GlassCard";

const emojis = [
  "🏠", "💼", "🏢", "🎨", "📚", "🎮", "🧪", "🌟", "🚀", "💡", "📊", "🛒",
  "🎯", "⚡", "🔬", "🌍", "🎓", "🏆", "🎵", "📱", "💎", "🔧", "🌈", "🐱",
  "🍀", "🔥", "❤️", "🧠", "📝", "🛡️", "🎪", "🏄", "🌙", "☀️", "🦊", "🐝",
];

const colors = [
  "hsl(220, 80%, 50%)", "hsl(280, 80%, 50%)", "hsl(340, 80%, 50%)",
  "hsl(160, 80%, 40%)", "hsl(30, 90%, 50%)", "hsl(200, 80%, 50%)",
  "hsl(0, 70%, 50%)", "hsl(45, 90%, 55%)", "hsl(90, 60%, 40%)",
  "hsl(315, 70%, 50%)", "hsl(180, 60%, 45%)", "hsl(250, 60%, 60%)",
];

interface WsStats {
  tasks: number;
  notes: number;
  contacts: number;
  transactions: number;
}

interface GoogleInfo {
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  scopes: string[];
}

interface WaInfo {
  status: string;
  instance_name: string | null;
}

interface BankInfo {
  institution_name: string | null;
  status: string | null;
  accounts_count: number;
}

interface ShareInfo {
  shared_with_count: number;
  shared_from_count: number;
}

interface WsEnrichedData {
  google: GoogleInfo | null;
  whatsapp: WaInfo | null;
  banks: BankInfo[];
  shares: ShareInfo;
}

const DraggableWorkspaceItem = ({ ws, children }: { ws: Workspace; children: React.ReactNode }) => {
  const controls = useDragControls();
  return (
    <Reorder.Item
      key={ws.id}
      value={ws}
      className="list-none"
      dragListener={false}
      dragControls={controls}
    >
      <div
        onPointerDown={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('.drag-handle')) {
            controls.start(e);
          }
        }}
      >
        {children}
      </div>
    </Reorder.Item>
  );
};

const WorkspacesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    workspaces, activeWorkspaceId, switchWorkspace,
    createWorkspace, updateWorkspace, deleteWorkspace, setDefaultWorkspace
  } = useWorkspace();

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editColor, setEditColor] = useState("");
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("💼");
  const [newColor, setNewColor] = useState("hsl(280, 80%, 50%)");
  const [stats, setStats] = useState<Record<string, WsStats>>({});
  const [enriched, setEnriched] = useState<Record<string, WsEnrichedData>>({});
  const [orderedWorkspaces, setOrderedWorkspaces] = useState<Workspace[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setOrderedWorkspaces(workspaces);
  }, [workspaces]);

  // Fetch stats + enriched data
  useEffect(() => {
    if (!user || workspaces.length === 0) return;
    const fetchAll = async () => {
      const wsIds = workspaces.map(w => w.id);

      const [tasksRes, notesRes, contactsRes, txRes, googleRes, waRes, finConnRes, finAccRes, sharesOutRes, sharesInRes] = await Promise.all([
        supabase.from("tasks").select("workspace_id").eq("user_id", user.id).in("workspace_id", wsIds),
        supabase.from("user_data").select("workspace_id").eq("user_id", user.id).eq("data_type", "note").in("workspace_id", wsIds),
        supabase.from("contacts").select("workspace_id").eq("user_id", user.id).in("workspace_id", wsIds),
        supabase.from("finance_transactions").select("workspace_id").eq("user_id", user.id).in("workspace_id", wsIds),
        // google_connections legacy query removed — Google is now via Composio (not workspace-scoped)
        Promise.resolve({ data: [] }),
        supabase.from("whatsapp_web_sessions").select("workspace_id, status, instance_name").eq("user_id", user.id),
        supabase.from("financial_connections").select("workspace_id, institution_name, status").eq("user_id", user.id),
        supabase.from("financial_accounts").select("workspace_id, id").eq("user_id", user.id),
        supabase.from("workspace_shares").select("workspace_id, id").eq("owner_id", user.id).eq("status", "accepted"),
        supabase.from("workspace_shares").select("workspace_id, id").eq("shared_with", user.id).eq("status", "accepted"),
      ]);

      // Build stats
      const s: Record<string, WsStats> = {};
      wsIds.forEach(id => { s[id] = { tasks: 0, notes: 0, contacts: 0, transactions: 0 }; });
      tasksRes.data?.forEach((r: any) => { if (s[r.workspace_id]) s[r.workspace_id].tasks++; });
      notesRes.data?.forEach((r: any) => { if (s[r.workspace_id]) s[r.workspace_id].notes++; });
      contactsRes.data?.forEach((r: any) => { if (s[r.workspace_id]) s[r.workspace_id].contacts++; });
      txRes.data?.forEach((r: any) => { if (s[r.workspace_id]) s[r.workspace_id].transactions++; });
      setStats(s);

      // Build enriched data
      const e: Record<string, WsEnrichedData> = {};
      wsIds.forEach(id => {
        e[id] = { google: null, whatsapp: null, banks: [], shares: { shared_with_count: 0, shared_from_count: 0 } };
      });

      // Google
      googleRes.data?.forEach((r: any) => {
        if (r.workspace_id && e[r.workspace_id]) {
          e[r.workspace_id].google = {
            email: r.email,
            display_name: r.display_name,
            avatar_url: r.avatar_url,
            scopes: r.scopes || [],
          };
        }
      });

      // WhatsApp
      waRes.data?.forEach((r: any) => {
        if (r.workspace_id && e[r.workspace_id]) {
          e[r.workspace_id].whatsapp = {
            status: r.status,
            instance_name: r.instance_name,
          };
        }
      });

      // Bank connections
      const accountsByWs: Record<string, number> = {};
      finAccRes.data?.forEach((r: any) => {
        if (r.workspace_id) accountsByWs[r.workspace_id] = (accountsByWs[r.workspace_id] || 0) + 1;
      });
      finConnRes.data?.forEach((r: any) => {
        if (r.workspace_id && e[r.workspace_id]) {
          e[r.workspace_id].banks.push({
            institution_name: r.institution_name,
            status: r.status,
            accounts_count: accountsByWs[r.workspace_id] || 0,
          });
        }
      });

      // Shares
      sharesOutRes.data?.forEach((r: any) => {
        if (r.workspace_id && e[r.workspace_id]) e[r.workspace_id].shares.shared_with_count++;
      });
      sharesInRes.data?.forEach((r: any) => {
        if (r.workspace_id && e[r.workspace_id]) e[r.workspace_id].shares.shared_from_count++;
      });

      setEnriched(e);
    };
    fetchAll();
  }, [user, workspaces]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const ws = await createWorkspace({ name: newName.trim(), icon: newIcon, color: newColor });
    if (ws) {
      toast.success(`Perfil "${ws.name}" criado!`);
      switchWorkspace(ws.id);
    }
    setNewName("");
    setNewIcon("💼");
    setNewColor("hsl(280, 80%, 50%)");
    setShowCreate(false);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    await updateWorkspace(editingId, { name: editName.trim(), icon: editIcon, color: editColor });
    toast.success("Perfil atualizado!");
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    const ws = workspaces.find(w => w.id === id);
    await deleteWorkspace(id);
    toast.success(`Perfil "${ws?.name}" excluído`);
    setConfirmDelete(null);
  };

  const handleReorder = useCallback(async (newOrder: Workspace[]) => {
    setOrderedWorkspaces(newOrder);
    await Promise.all(
      newOrder.map((ws, i) => updateWorkspace(ws.id, { sort_order: i }))
    );
  }, [updateWorkspace]);

  const startEdit = (ws: Workspace) => {
    setEditingId(ws.id);
    setEditName(ws.name);
    setEditIcon(ws.icon);
    setEditColor(ws.color);
  };

  const totalItems = (wsId: string) => {
    const s = stats[wsId];
    if (!s) return 0;
    return s.tasks + s.notes + s.contacts + s.transactions;
  };

  const integrationCount = (wsId: string) => {
    const e = enriched[wsId];
    if (!e) return 0;
    let c = 0;
    if (e.google) c++;
    if (e.whatsapp) c++;
    c += e.banks.length;
    return c;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const googleScopeLabels: Record<string, string> = {
    "gmail": "Gmail",
    "drive": "Drive",
    "calendar": "Calendar",
    "tasks": "Tasks",
    "contacts": "Contatos",
  };

  const getGoogleServices = (scopes: string[]) => {
    const services: string[] = [];
    const scopeStr = scopes.join(" ");
    if (scopeStr.includes("gmail") || scopeStr.includes("mail")) services.push("Gmail");
    if (scopeStr.includes("drive")) services.push("Drive");
    if (scopeStr.includes("calendar")) services.push("Calendar");
    if (scopeStr.includes("tasks")) services.push("Tasks");
    if (scopeStr.includes("contacts") || scopeStr.includes("people")) services.push("Contatos");
    return services;
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <PageHeader title="Gerenciar Perfis" />

      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {workspaces.length} perfil(is) · Arraste para reordenar
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Novo perfil
        </button>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Perfis", value: workspaces.length, icon: Layers },
          { label: "Total itens", value: Object.values(stats).reduce((a, s) => a + s.tasks + s.notes + s.contacts + s.transactions, 0), icon: BarChart3 },
          { label: "Integrações", value: Object.keys(enriched).reduce((a, k) => a + integrationCount(k), 0), icon: Link2 },
          { label: "Compartilhados", value: Object.values(enriched).reduce((a, e) => a + e.shares.shared_with_count + e.shares.shared_from_count, 0), icon: Share2 },
          { label: "Ativo", value: workspaces.find(w => w.id === activeWorkspaceId)?.name ?? "Todos", icon: Globe },
        ].map((s, i) => (
          <GlassCard key={i} size="auto" className="!p-3">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{s.label}</span>
            </div>
            <p className="text-lg font-bold text-foreground truncate">{s.value}</p>
          </GlassCard>
        ))}
      </div>

      {/* Workspace cards */}
      <Reorder.Group axis="y" values={orderedWorkspaces} onReorder={handleReorder} className="space-y-3">
        <AnimatePresence>
          {orderedWorkspaces.map(ws => {
            const wsData = enriched[ws.id];
            const isExpanded = expandedId === ws.id;

            return (
            <DraggableWorkspaceItem key={ws.id} ws={ws}>
              <motion.div
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <GlassCard size="auto" className="!p-0 overflow-hidden">
                  {editingId === ws.id ? (
                    /* Edit mode */
                    <div className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">Editar perfil</h3>
                        <button onClick={() => setEditingId(null)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                          <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>

                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Nome</label>
                        <input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          autoFocus
                        />
                      </div>

                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Ícone</label>
                        <div className="flex gap-1.5 flex-wrap">
                          {emojis.map(e => (
                            <button key={e} onClick={() => setEditIcon(e)} className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all ${editIcon === e ? "bg-primary/20 scale-110 ring-1 ring-primary" : "bg-muted hover:bg-muted/80"}`}>
                              {e}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Cor</label>
                        <div className="flex gap-2 flex-wrap">
                          {colors.map(c => (
                            <button key={c} onClick={() => setEditColor(c)} className={`w-6 h-6 rounded-full border-2 transition-all ${editColor === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"}`} style={{ background: c }} />
                          ))}
                          <label className="w-6 h-6 rounded-full cursor-pointer border-2 border-dashed border-border hover:border-muted-foreground transition-colors flex items-center justify-center overflow-hidden" style={{ background: colors.includes(editColor) ? 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' : editColor }}>
                            <input type="color" value={editColor.startsWith('#') ? editColor : '#8b5cf6'} onChange={e => setEditColor(e.target.value)} className="opacity-0 absolute w-0 h-0" />
                            {colors.includes(editColor) && <span className="text-[8px] text-white font-bold drop-shadow">+</span>}
                          </label>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button onClick={() => setEditingId(null)} className="flex-1 text-xs py-2 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
                          Cancelar
                        </button>
                        <button onClick={handleSaveEdit} disabled={!editName.trim()} className="flex-1 text-xs py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                          Salvar
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View mode */
                    <div>
                      <div className="flex items-stretch">
                        {/* Color bar */}
                        <div className="w-1.5 flex-shrink-0 rounded-l-xl" style={{ background: ws.color }} />

                        <div className="flex-1 p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <GripVertical className="w-4 h-4 text-muted-foreground/30 cursor-grab active:cursor-grabbing flex-shrink-0 drag-handle touch-none" />
                            <span className="text-2xl">{ws.icon}</span>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-foreground truncate">{ws.name}</h3>
                                {ws.is_default && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex-shrink-0">
                                    Padrão
                                  </span>
                                )}
                                {activeWorkspaceId === ws.id && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground font-medium flex-shrink-0">
                                    Ativo
                                  </span>
                                )}
                              </div>

                              {/* Email + subtitle */}
                              <div className="flex items-center gap-2 mt-0.5">
                                {wsData?.google?.email ? (
                                  <span className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                                    <Mail className="w-3 h-3 flex-shrink-0" />
                                    {wsData.google.email}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">
                                    {totalItems(ws.id)} itens · Criado em {new Date(ws.created_at).toLocaleDateString("pt-BR")}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => setExpandedId(isExpanded ? null : ws.id)}
                                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                                title="Detalhes"
                              >
                                <Eye className={`w-4 h-4 ${isExpanded ? "text-primary" : "text-muted-foreground/40"}`} />
                              </button>
                              <button
                                onClick={() => { if (!ws.is_default) { setDefaultWorkspace(ws.id); toast.success(`"${ws.name}" definido como padrão`); } }}
                                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                                title={ws.is_default ? "Perfil padrão" : "Definir como padrão"}
                              >
                                <Star className={`w-4 h-4 ${ws.is_default ? "fill-amber-500 text-amber-500" : "text-muted-foreground/40 hover:text-amber-500"}`} />
                              </button>
                              <button onClick={() => { switchWorkspace(ws.id); navigate("/dashboard"); }} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Ativar">
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              </button>
                              <button onClick={() => startEdit(ws)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Editar">
                                <Pencil className="w-4 h-4 text-muted-foreground" />
                              </button>
                              {!ws.is_default && (
                                confirmDelete === ws.id ? (
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => handleDelete(ws.id)} className="p-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 transition-colors" title="Confirmar exclusão">
                                      <Check className="w-4 h-4 text-destructive" />
                                    </button>
                                    <button onClick={() => setConfirmDelete(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                                      <X className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => setConfirmDelete(ws.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors" title="Excluir">
                                    <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                                  </button>
                                )
                              )}
                            </div>
                          </div>

                          {/* Stats row */}
                          <div className="flex gap-4 flex-wrap text-[11px] text-muted-foreground">
                            {[
                              { icon: ListTodo, label: "Tarefas", val: stats[ws.id]?.tasks ?? 0 },
                              { icon: StickyNote, label: "Notas", val: stats[ws.id]?.notes ?? 0 },
                              { icon: UsersIcon, label: "Contatos", val: stats[ws.id]?.contacts ?? 0 },
                              { icon: Wallet, label: "Transações", val: stats[ws.id]?.transactions ?? 0 },
                            ].map(s => (
                              <span key={s.label} className="flex items-center gap-1">
                                <s.icon className="w-3 h-3" /> {s.val} {s.label}
                              </span>
                            ))}
                          </div>

                          {/* Integration badges */}
                          <div className="flex gap-1.5 mt-2 flex-wrap">
                            {wsData?.google && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-1">
                                <Mail className="w-2.5 h-2.5" /> Google
                              </span>
                            )}
                            {wsData?.whatsapp && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${wsData.whatsapp.status === "CONNECTED" ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"}`}>
                                <Phone className="w-2.5 h-2.5" />
                                WhatsApp {wsData.whatsapp.status === "CONNECTED" ? "" : "(Offline)"}
                              </span>
                            )}
                            {wsData?.banks.map((b, i) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium flex items-center gap-1">
                                <Landmark className="w-2.5 h-2.5" /> {b.institution_name || "Banco"}
                              </span>
                            ))}
                            {(wsData?.shares.shared_with_count ?? 0) > 0 && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium flex items-center gap-1">
                                <Share2 className="w-2.5 h-2.5" /> {wsData!.shares.shared_with_count} compartilhamento(s)
                              </span>
                            )}
                            {!wsData?.google && !wsData?.whatsapp && wsData?.banks.length === 0 && (
                              <button
                                onClick={() => { switchWorkspace(ws.id); navigate("/integrations"); }}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium flex items-center gap-1 hover:bg-muted/80 transition-colors"
                              >
                                <Link2 className="w-2.5 h-2.5" /> Conectar serviços
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded details */}
                      <AnimatePresence>
                        {isExpanded && wsData && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 pt-1 border-t border-border space-y-3">
                              {/* Google details */}
                              {wsData.google && (
                                <div className="rounded-lg bg-muted/50 p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                                      <Mail className="w-3 h-3 text-primary" />
                                    </div>
                                    <span className="text-xs font-semibold text-foreground">Google</span>
                                  </div>
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                      <span className="text-foreground/70 min-w-[50px]">Email:</span>
                                      <span className="truncate">{wsData.google.email || "—"}</span>
                                      {wsData.google.email && (
                                        <button onClick={() => copyToClipboard(wsData.google!.email!)} className="p-0.5 rounded hover:bg-muted transition-colors flex-shrink-0">
                                          <Copy className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                    {wsData.google.display_name && (
                                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                        <span className="text-foreground/70 min-w-[50px]">Nome:</span>
                                        <span>{wsData.google.display_name}</span>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                      <span className="text-foreground/70 min-w-[50px]">Serviços:</span>
                                      <div className="flex gap-1 flex-wrap">
                                        {getGoogleServices(wsData.google.scopes).length > 0
                                          ? getGoogleServices(wsData.google.scopes).map(s => (
                                              <span key={s} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">{s}</span>
                                            ))
                                          : <span className="text-muted-foreground">Nenhum</span>
                                        }
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* WhatsApp details */}
                              {wsData.whatsapp && (
                                <div className="rounded-lg bg-muted/50 p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center">
                                      <Phone className="w-3 h-3 text-green-600" />
                                    </div>
                                    <span className="text-xs font-semibold text-foreground">WhatsApp</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${wsData.whatsapp.status === "CONNECTED" ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"}`}>
                                      {wsData.whatsapp.status === "CONNECTED" ? "Conectado" : wsData.whatsapp.status === "QR_PENDING" ? "Aguardando QR" : "Desconectado"}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Bank details */}
                              {wsData.banks.length > 0 && (
                                <div className="rounded-lg bg-muted/50 p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                      <Landmark className="w-3 h-3 text-emerald-600" />
                                    </div>
                                    <span className="text-xs font-semibold text-foreground">Bancos</span>
                                  </div>
                                  <div className="space-y-1">
                                    {wsData.banks.map((b, i) => (
                                      <div key={i} className="flex items-center justify-between text-[11px]">
                                        <span className="text-foreground/80">{b.institution_name || "Instituição"}</span>
                                        <div className="flex items-center gap-2">
                                          <span className="text-muted-foreground">{b.accounts_count} conta(s)</span>
                                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${b.status === "active" ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}>
                                            {b.status === "active" ? "Ativo" : b.status || "—"}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Sharing */}
                              {(wsData.shares.shared_with_count > 0 || wsData.shares.shared_from_count > 0) && (
                                <div className="rounded-lg bg-muted/50 p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
                                      <Share2 className="w-3 h-3 text-secondary-foreground" />
                                    </div>
                                    <span className="text-xs font-semibold text-foreground">Compartilhamento</span>
                                  </div>
                                  <div className="flex gap-4 text-[11px] text-muted-foreground">
                                    <span>Você compartilha: <strong className="text-foreground">{wsData.shares.shared_with_count}</strong></span>
                                    <span>Recebidos: <strong className="text-foreground">{wsData.shares.shared_from_count}</strong></span>
                                  </div>
                                </div>
                              )}

                              {/* No connections */}
                              {!wsData.google && !wsData.whatsapp && wsData.banks.length === 0 && (
                                <div className="rounded-lg bg-muted/50 p-3 flex items-center justify-between">
                                  <span className="text-[11px] text-muted-foreground">Nenhuma integração conectada a este perfil.</span>
                                  <button
                                    onClick={() => { switchWorkspace(ws.id); navigate("/integrations"); }}
                                    className="text-[11px] text-primary font-medium flex items-center gap-1 hover:underline"
                                  >
                                    Conectar <ExternalLink className="w-3 h-3" />
                                  </button>
                                </div>
                              )}

                              {/* Quick stats summary */}
                              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                                <span>Criado em {new Date(ws.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</span>
                                <span>{totalItems(ws.id)} itens no total</span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </GlassCard>
              </motion.div>
            </DraggableWorkspaceItem>
          );
          })}
        </AnimatePresence>
      </Reorder.Group>

      {/* Empty state */}
      {workspaces.length === 0 && (
        <GlassCard size="auto" className="flex flex-col items-center justify-center py-12">
          <Layers className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground mb-2">Nenhum perfil encontrado</p>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
            Criar primeiro perfil
          </button>
        </GlassCard>
      )}

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="glass-card p-5 w-96 max-w-[90vw] space-y-4"
            >
              <h3 className="text-sm font-semibold text-foreground">Novo Perfil</h3>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nome</label>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Ex: Empresa X"
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                  onKeyDown={e => { if (e.key === "Enter" && newName.trim()) handleCreate(); }}
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Ícone</label>
                <div className="flex gap-1.5 flex-wrap">
                  {emojis.map(e => (
                    <button key={e} onClick={() => setNewIcon(e)} className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-all ${newIcon === e ? "bg-primary/20 scale-110 ring-1 ring-primary" : "bg-muted hover:bg-muted/80"}`}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Cor</label>
                <div className="flex gap-2 flex-wrap">
                  {colors.map(c => (
                    <button key={c} onClick={() => setNewColor(c)} className={`w-7 h-7 rounded-full transition-all border-2 ${newColor === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"}`} style={{ background: c }} />
                  ))}
                  <label className="w-7 h-7 rounded-full cursor-pointer border-2 border-dashed border-border hover:border-muted-foreground transition-colors flex items-center justify-center overflow-hidden" style={{ background: colors.includes(newColor) ? 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' : newColor }}>
                    <input type="color" value={newColor.startsWith('#') ? newColor : '#8b5cf6'} onChange={e => setNewColor(e.target.value)} className="opacity-0 absolute w-0 h-0" />
                    {colors.includes(newColor) && <span className="text-[10px] text-white font-bold drop-shadow">+</span>}
                  </label>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowCreate(false)} className="flex-1 text-xs py-2 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleCreate} disabled={!newName.trim()} className="flex-1 text-xs py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                  Criar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WorkspacesPage;

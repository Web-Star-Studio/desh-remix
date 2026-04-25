import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useWorkspace, Workspace } from "@/contexts/WorkspaceContext";
import { ChevronDown, Plus, Layers, Check, Star, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import WorkspaceOnboardingWizard from "@/components/workspace/WorkspaceOnboardingWizard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DeshTooltip from "@/components/ui/DeshTooltip";
import { toast } from "sonner";

const WorkspaceSwitcher = () => {
  const {
    workspaces, activeWorkspace, activeWorkspaceId,
    switchWorkspace, setViewAll, createWorkspace, setDefaultWorkspace,
    loading,
  } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [showCreate, setShowCreate] = useState(false);
  const [onboardingWs, setOnboardingWs] = useState<Workspace | null>(null);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("💼");
  const [newColor, setNewColor] = useState("hsl(280, 80%, 50%)");
  const [newDesc, setNewDesc] = useState("");
  const [wsIntegrations, setWsIntegrations] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!user) return;
    const fetchIntegrations = async () => {
      const [waRes, finRes] = await Promise.all([
        supabase.from("whatsapp_web_sessions").select("workspace_id, status").eq("user_id", user.id).in("status", ["CONNECTED", "QR_PENDING"]),
        supabase.from("financial_connections").select("workspace_id").eq("user_id", user.id),
      ]);
      const map: Record<string, string[]> = {};
      const addBadge = (wsId: string | null, badge: string) => {
        if (!wsId) return;
        if (!map[wsId]) map[wsId] = [];
        if (!map[wsId].includes(badge)) map[wsId].push(badge);
      };
      waRes.data?.forEach((row: any) => addBadge(row.workspace_id, "whatsapp"));
      finRes.data?.forEach((row: any) => addBadge(row.workspace_id, "bank"));
      setWsIntegrations(map);
    };
    fetchIntegrations();
  }, [user, workspaces]);

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

  if (loading) return null;

  // Sort: primary (is_default) first, then by sort_order
  const sortedWorkspaces = [...workspaces].sort((a, b) => {
    if (a.is_default && !b.is_default) return -1;
    if (!a.is_default && b.is_default) return 1;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const ws = await createWorkspace({
      name: newName.trim(),
      icon: newIcon,
      color: newColor,
      description: newDesc.trim() || undefined,
    });
    if (ws) {
      switchWorkspace(ws.id);
      setOnboardingWs(ws); // Open wizard
    }
    setNewName("");
    setNewIcon("💼");
    setNewColor("hsl(280, 80%, 50%)");
    setNewDesc("");
    setShowCreate(false);
  };


  const label = activeWorkspace ? `${activeWorkspace.icon} ${activeWorkspace.name}` : "🌐 Todos";
  const borderColor = activeWorkspace?.color ?? "hsl(220, 10%, 50%)";
  const wsIcon = activeWorkspace?.icon ?? "🌐";

  return (
    <>
      <DropdownMenu>
        <DeshTooltip label="Trocar workspace">
          <DropdownMenuTrigger asChild>
            {isMobile ? (
              <button
                className="focusable glass-card w-9 h-9 rounded-full hover:bg-foreground/10 transition-colors flex items-center justify-center text-base border"
                style={{ borderColor, boxShadow: `0 0 8px ${borderColor}33` }}
              >
                <span>{wsIcon}</span>
              </button>
            ) : (
              <button
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-overlay-muted bg-foreground/10 backdrop-blur-sm hover:bg-foreground/15 transition-all border"
                style={{ borderColor, boxShadow: `0 0 8px ${borderColor}33` }}
              >
                <span className="truncate max-w-[120px]">{label}</span>
                <ChevronDown className="w-3 h-3 opacity-60 flex-shrink-0" />
              </button>
            )}
          </DropdownMenuTrigger>
        </DeshTooltip>
        <DropdownMenuContent align="start" className="w-64 z-[300]">
          {/* All mode */}
          <DropdownMenuItem onClick={setViewAll} className="gap-2">
            <Layers className="w-3.5 h-3.5" />
            <div className="flex-1">
              <span>Todos os perfis</span>
              <span className="text-[10px] text-muted-foreground ml-1.5">(somente leitura)</span>
            </div>
            {activeWorkspaceId === null && <Check className="w-3.5 h-3.5 text-primary" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />

          {/* Workspace list */}
          {sortedWorkspaces.map(ws => (
              <DropdownMenuItem key={ws.id} onClick={() => switchWorkspace(ws.id)} className="gap-2 group">
                <span>{ws.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="truncate text-sm">{ws.name}</span>
                  </div>
                  {ws.description && (
                    <span className="text-[10px] text-muted-foreground truncate block">{ws.description}</span>
                  )}
                </div>

                {/* Integration badges */}
                <div className="flex items-center gap-0.5">
                  {wsIntegrations[ws.id]?.includes("google") && (
                    <span className="text-[9px] text-muted-foreground" title="Google conectado">G</span>
                  )}
                  {wsIntegrations[ws.id]?.includes("whatsapp") && (
                    <span className="text-[9px] text-muted-foreground" title="WhatsApp conectado">W</span>
                  )}
                  {wsIntegrations[ws.id]?.includes("bank") && (
                    <span className="text-[9px] text-muted-foreground" title="Banco conectado">B</span>
                  )}
                </div>

                {/* Primary workspace star */}
                <DeshTooltip label={ws.is_default ? "Perfil principal" : "Definir como principal"}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!ws.is_default) {
                        setDefaultWorkspace(ws.id);
                        toast.success(`"${ws.name}" definido como perfil principal ⭐`);
                      }
                    }}
                    className="p-0.5 rounded hover:bg-foreground/10 transition-colors"
                  >
                    <Star className={`w-3 h-3 ${ws.is_default ? "fill-amber-500 text-amber-500" : "text-muted-foreground/40"}`} />
                  </button>
                </DeshTooltip>

                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: ws.color }} />
                {activeWorkspaceId === ws.id && <Check className="w-3.5 h-3.5 text-primary" />}
              </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowCreate(true)} className="gap-2 text-primary">
            <Plus className="w-3.5 h-3.5" />
            Novo perfil
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/workspaces")} className="gap-2 text-muted-foreground">
            <Settings2 className="w-3.5 h-3.5" />
            Gerenciar perfis
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create modal */}
      {showCreate && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="glass-card p-5 w-80 max-w-[90vw] space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-foreground">Novo Perfil</h3>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nome</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Ex: Empresa X"
                className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-foreground/10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Descrição (opcional)</label>
              <input
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Ex: Agência de marketing digital"
                className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-foreground/10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Ícone</label>
              <div className="flex gap-1.5 flex-wrap">
                {emojis.map(e => (
                  <button
                    key={e}
                    onClick={() => setNewIcon(e)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-all ${newIcon === e ? "bg-primary/20 scale-110 ring-1 ring-primary" : "bg-foreground/5 hover:bg-foreground/10"}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Cor</label>
              <div className="flex gap-2 flex-wrap">
                {colors.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={`w-7 h-7 rounded-full transition-all border-2 ${newColor === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"}`}
                    style={{ background: c }}
                  />
                ))}
                <label className="w-7 h-7 rounded-full cursor-pointer border-2 border-dashed border-foreground/20 hover:border-foreground/40 transition-colors flex items-center justify-center overflow-hidden" style={{ background: colors.includes(newColor) ? 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' : newColor }} title="Cor personalizada">
                  <input type="color" value={newColor.startsWith('#') ? newColor : '#8b5cf6'} onChange={e => setNewColor(e.target.value)} className="opacity-0 absolute w-0 h-0" />
                  {colors.includes(newColor) && <span className="text-[10px] text-white font-bold drop-shadow">+</span>}
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowCreate(false)} className="flex-1 text-xs py-2 rounded-lg bg-foreground/5 text-muted-foreground hover:bg-foreground/10 transition-colors">
                Cancelar
              </button>
              <button onClick={handleCreate} disabled={!newName.trim()} className="flex-1 text-xs py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                Criar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Onboarding Wizard */}
      {onboardingWs && (
        <WorkspaceOnboardingWizard
          workspace={onboardingWs}
          onComplete={() => setOnboardingWs(null)}
          onClose={() => setOnboardingWs(null)}
        />
      )}
    </>
  );
};

export default WorkspaceSwitcher;

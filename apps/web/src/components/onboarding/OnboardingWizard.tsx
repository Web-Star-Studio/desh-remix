import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { usePlatformIntegrationsContext } from "@/contexts/PlatformIntegrationsContext";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useThemeContext } from "@/contexts/ThemeContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useConnections } from "@/contexts/ConnectionsContext";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { useDemo } from "@/contexts/DemoContext";
import { wallpaperOptions, type WallpaperId } from "@/hooks/ui/useWallpaper";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import deshLogo from "@/assets/desh-logo-full.png";

import {
  Sparkles, CheckSquare, CalendarDays, DollarSign, Globe, LayoutGrid,
  ArrowLeft, ArrowRight, Check, Sun, Moon, Plus, Palette, User, Rocket,
  Plug, MessageSquare, Users, FolderOpen, ListTodo, Download, Bell, Volume2,
  Smartphone, BookOpen
} from "lucide-react";

const TOTAL_STEPS = 8;


const WORKSPACE_ICONS = ["🏠", "💼", "🎓", "🎮", "🏋️", "🎵", "📚", "🛒", "🌍", "🔬"];
const WORKSPACE_COLORS = [
  "hsl(220, 80%, 50%)", "hsl(150, 60%, 42%)", "hsl(0, 72%, 51%)",
  "hsl(270, 70%, 55%)", "hsl(25, 90%, 55%)", "hsl(340, 75%, 55%)",
  "hsl(45, 90%, 50%)", "hsl(190, 70%, 45%)",
];

const ONBOARDING_CATEGORIES = [
  { id: "calendar", label: "Calendário", description: "Google Calendar, Outlook", icon: CalendarDays, color: "hsl(215, 80%, 55%)", scopes: ["calendar_event_read", "calendar_event_write", "calendar_calendar_read", "calendar_calendar_write", "calendar_busy_read", "calendar_recording_read", "calendar_recording_write", "calendar_link_read", "calendar_link_write", "calendar_webinar_read", "calendar_webinar_write"], integrations: ["google_calendar", "outlook_calendar"], tutorial: "Sincronize reuniões, compromissos e lembretes. Veja tudo no widget de calendário do dashboard sem precisar abrir outro app." },
  { id: "messaging", label: "E-mail e Mensagens", description: "Gmail, Slack, Teams", icon: MessageSquare, color: "hsl(270, 70%, 55%)", scopes: ["messaging_message_read", "messaging_message_write", "messaging_channel_read", "messaging_channel_write", "messaging_event_read", "messaging_event_write"], integrations: ["gmail", "outlook_mail", "slack", "teams"], tutorial: "Leia e envie e-mails e mensagens direto pelo DESH. A IA pode resumir conversas longas e sugerir respostas rápidas." },
  { id: "crm", label: "Contatos e CRM", description: "HubSpot, Salesforce, Pipedrive", icon: Users, color: "hsl(150, 60%, 42%)", scopes: ["crm_contact_read", "crm_contact_write", "crm_company_read", "crm_company_write", "crm_deal_read", "crm_deal_write", "crm_lead_read", "crm_lead_write", "crm_pipeline_read", "crm_event_read", "crm_event_write"], integrations: ["hubspot", "salesforce", "pipedrive"], tutorial: "Importe seus contatos e dados de clientes. Acompanhe interações, empresas e pipeline de vendas em um só lugar." },
  { id: "storage", label: "Arquivos", description: "Google Drive, Dropbox", icon: FolderOpen, color: "hsl(25, 90%, 55%)", scopes: ["storage_file_read", "storage_file_write"], integrations: ["google_drive", "dropbox"], tutorial: "Acesse e gerencie seus arquivos na nuvem sem sair do DESH. Busque, visualize e compartilhe documentos rapidamente." },
  { id: "task", label: "Tarefas", description: "Todoist, Trello, Asana", icon: ListTodo, color: "hsl(340, 75%, 55%)", scopes: ["task_task_read", "task_task_write", "task_project_read", "task_project_write", "task_change_read", "task_comment_read", "task_comment_write"], integrations: ["todoist", "trello", "asana"], tutorial: "Sincronize suas tarefas e projetos. Crie, edite e conclua itens de qualquer plataforma direto pelo dashboard." },
  { id: "kms", label: "Base de Conhecimento", description: "Notion, Confluence", icon: BookOpen, color: "hsl(45, 90%, 50%)", scopes: ["kms_space_read", "kms_space_write", "kms_page_read", "kms_page_write", "kms_comment_read", "kms_comment_write"], integrations: ["notion", "confluence"], tutorial: "Conecte suas bases de conhecimento e wikis. Acesse documentos e páginas direto pelo DESH." },
  { id: "genai", label: "IA Generativa", description: "OpenAI, Anthropic", icon: Sparkles, color: "hsl(280, 80%, 60%)", scopes: ["genai_model_read", "genai_prompt_read", "genai_prompt_write", "genai_embedding_read", "genai_embedding_write"], integrations: ["openai", "anthropic"], tutorial: "Conecte seus modelos de IA favoritos e use-os diretamente no DESH para geração de texto, embeddings e mais." },
];

const slideVariants = {
  enter: (d: number) => ({ x: d > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d > 0 ? -300 : 300, opacity: 0 }),
};

interface Props {
  onComplete: () => void;
}

export default function OnboardingWizard({ onComplete }: Props) {
  const { invoke } = useEdgeFn();
  const { setDemoMode } = useDemo();
  const { user, profile, updateProfile } = useAuth();
  const { theme, setMode, setWallpaper, wallpaperId } = useThemeContext();
  const { workspaces, createWorkspace, updateWorkspace } = useWorkspace();
  const { addConnection, isConnected } = useConnections();
  const { isIntegrationEnabled } = usePlatformIntegrationsContext();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  // Step 1 - Profile
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || "");

  // Step 3 - Workspace
  const defaultWs = workspaces.find(w => w.is_default);
  const [wsName, setWsName] = useState(defaultWs?.name || "Principal");
  const [wsIcon, setWsIcon] = useState(defaultWs?.icon || "🏠");
  const [wsColor, setWsColor] = useState(defaultWs?.color || WORKSPACE_COLORS[0]);
  const [addSecond, setAddSecond] = useState(false);
  const [ws2Name, setWs2Name] = useState("Trabalho");
  const [ws2Icon, setWs2Icon] = useState("💼");
  const [ws2Color, setWs2Color] = useState(WORKSPACE_COLORS[1]);

  // Step 4 - Connections
  const [workspaceId, setWorkspaceId] = useState<string | null>("default");
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<typeof ONBOARDING_CATEGORIES[number] | null>(null);
  const [connectedInSession, setConnectedInSession] = useState<Set<string>>(new Set());

  const [saving, setSaving] = useState(false);

  const ONBOARDING_CATEGORY_TO_INTEGRATION: Record<string, string> = {
    calendar: "google",
    messaging: "whatsapp",
    crm: "google",
    storage: "google",
    task: "google",
  };

  const enabledOnboardingCategories = useMemo(
    () => ONBOARDING_CATEGORIES.filter(cat => {
      const integrationId = ONBOARDING_CATEGORY_TO_INTEGRATION[cat.id];
      return !integrationId || isIntegrationEnabled(integrationId);
    }),
    [isIntegrationEnabled]
  );


  // Handle connection callback from query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connCat = params.get("onboarding_connected");
    const connId = params.get("id");
    if (connCat && connId) {
      const cat = ONBOARDING_CATEGORIES.find(c => c.id === connCat);
      if (cat) {
        addConnection({
          id: connId,
          integrationId: connId,
          name: cat.label,
          category: connCat,
          status: "active",
          platform: cat.integrations[0],
        });
        setConnectedInSession(prev => new Set(prev).add(connCat));
        toast({ title: "Conectado!", description: `${cat.label} foi conectado com sucesso.` });
      }
      window.history.replaceState({}, "", "/");
    }
  }, [addConnection]);

  const go = useCallback((delta: number) => {
    setDirection(delta);
    setStep(s => Math.max(0, Math.min(TOTAL_STEPS - 1, s + delta)));
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Avatar upload deferred until S3 ships — preview-only for now.
      if (displayName.trim()) {
        await updateProfile({ display_name: displayName.trim() });
      }

      if (defaultWs && (wsName !== defaultWs.name || wsIcon !== defaultWs.icon || wsColor !== defaultWs.color)) {
        await updateWorkspace(defaultWs.id, { name: wsName, icon: wsIcon, color: wsColor });
      }

      if (addSecond && ws2Name.trim()) {
        await createWorkspace({ name: ws2Name, icon: ws2Icon, color: ws2Color });
      }

      await updateProfile({ onboarding_completed: true });
      onComplete();
    } catch (err) {
      console.error("Onboarding save error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = useCallback((cat: typeof ONBOARDING_CATEGORIES[number]) => {
    if (!workspaceId) {
      toast({ title: "Erro", description: "Configuração não carregada. Tente novamente.", variant: "destructive" });
      return;
    }
    setSelectedCategory(cat);
    setShowConnectModal(true);
  }, [workspaceId]);

  const initials = (displayName || user?.email || "?").slice(0, 2).toUpperCase();

  const renderStep = () => {
    switch (step) {
      case 0: return <StepWelcome name={displayName || profile?.display_name || ""} />;
      case 1: return (
        <StepProfile
          displayName={displayName} setDisplayName={setDisplayName}
          avatarPreview={avatarPreview} initials={initials}
          onAvatarChange={handleAvatarChange}
        />
      );
      case 2: return (
        <StepAppearance
          mode={theme.mode} setMode={setMode}
          wallpaperId={wallpaperId} setWallpaper={setWallpaper}
        />
      );
      case 3: return (
        <StepWorkspace
          wsName={wsName} setWsName={setWsName}
          wsIcon={wsIcon} setWsIcon={setWsIcon}
          wsColor={wsColor} setWsColor={setWsColor}
          addSecond={addSecond} setAddSecond={setAddSecond}
          ws2Name={ws2Name} setWs2Name={setWs2Name}
          ws2Icon={ws2Icon} setWs2Icon={setWs2Icon}
          ws2Color={ws2Color} setWs2Color={setWs2Color}
        />
      );
      case 4: return (
        <StepConnections
          onConnect={handleConnect}
          isConnected={(cat) => isConnected(cat) || connectedInSession.has(cat)}
          workspaceId={workspaceId}
          enabledCategories={enabledOnboardingCategories}
        />
      );
      case 5: return <StepTour />;
      case 6: return <StepInstallApp />;
      case 7: return <StepDone connectedCount={connectedInSession.size} onActivateDemo={() => setDemoMode(true)} />;
      default: return null;
    }
  };

  const isSkippable = step === 1 || step === 2 || step === 4 || step === 6;
  const isLast = step === TOTAL_STEPS - 1;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-xl" />

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative z-10 w-full max-w-md glass-card rounded-3xl p-5 sm:p-8 flex flex-col max-h-[min(90vh,700px)] overflow-hidden"
      >
        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">{step + 1} / {TOTAL_STEPS}</span>
            {isSkippable && step < TOTAL_STEPS - 1 && (
              <button onClick={() => go(1)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Pular
              </button>
            )}
          </div>
          <Progress value={((step + 1) / TOTAL_STEPS) * 100} className="h-1.5" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => go(-1)}
            disabled={step === 0}
            className="gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>

          {isLast ? (
            <Button onClick={handleFinish} disabled={saving} className="gap-1">
              {saving ? "Salvando..." : "Ir para o Dashboard"} <Rocket className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={() => go(1)} className="gap-1">
              Próximo <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </motion.div>

      {/* Connection Dialog */}
      <Dialog open={showConnectModal} onOpenChange={(open) => { if (!open) { setShowConnectModal(false); setSelectedCategory(null); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto z-[10000]">
          <DialogHeader>
            <DialogTitle>
              {selectedCategory ? `Conectar ${selectedCategory.label}` : "Conectar"}
            </DialogTitle>
          </DialogHeader>
          {selectedCategory && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Use a página de Conexões para conectar {selectedCategory.label} via Google Workspace.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>,
    document.body
  );
}

// ─── Step Components ────────────────────────────────────

function StepWelcome({ name }: { name: string }) {
  return (
    <div className="text-center space-y-5">
      <motion.img
        src={deshLogo}
        alt="DESH"
        className="w-20 h-20 mx-auto rounded-2xl shadow-lg"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
      />
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {name ? `Olá, ${name}! 👋` : "Bem-vindo ao DESH! 👋"}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Seu hub pessoal inteligente. Vamos configurar tudo em poucos passos para você ter a melhor experiência.
        </p>
      </div>
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/70">
        <Sparkles className="w-3.5 h-3.5" />
        <span>Leva menos de 2 minutos</span>
      </div>
    </div>
  );
}

function StepProfile({ displayName, setDisplayName, avatarPreview, initials, onAvatarChange }: {
  displayName: string; setDisplayName: (v: string) => void;
  avatarPreview: string; initials: string;
  onAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <User className="w-8 h-8 mx-auto text-primary mb-2" />
        <h2 className="text-lg font-semibold text-foreground">Configurar Perfil</h2>
        <p className="text-xs text-muted-foreground mt-1">Seu nome aparece no topo do dashboard e na IA</p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <label className="cursor-pointer group relative">
          {avatarPreview ? (
            <img src={avatarPreview} alt="Avatar" className="w-20 h-20 rounded-full object-cover ring-2 ring-primary/30 group-hover:ring-primary transition-all" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-xl font-bold text-primary group-hover:bg-primary/30 transition-colors">
              {initials}
            </div>
          )}
          <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Palette className="w-5 h-5 text-white" />
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
        </label>
        <span className="text-xs text-muted-foreground">Clique para adicionar foto</span>
      </div>
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Nome de exibição</label>
        <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Seu nome" />
      </div>
    </div>
  );
}

function StepAppearance({ mode, setMode, wallpaperId, setWallpaper }: {
  mode: string; setMode: (m: "light" | "dark") => void;
  wallpaperId: WallpaperId; setWallpaper: (id: WallpaperId) => void;
}) {
  const categories = ["paisagem", "abstrato", "animado"] as const;
  const [cat, setCat] = useState<typeof categories[number]>("paisagem");
  const filtered = wallpaperOptions.filter(w => w.category === cat);

  return (
    <div className="space-y-3">
      <div className="text-center">
        <Palette className="w-7 h-7 mx-auto text-primary mb-1" />
        <h2 className="text-lg font-semibold text-foreground">Aparência</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Você pode mudar isso depois em Configurações</p>
      </div>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setMode("light")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            mode === "light" ? "bg-primary text-primary-foreground shadow-md" : "glass-card hover:bg-foreground/5"
          }`}
        >
          <Sun className="w-4 h-4" /> Claro
        </button>
        <button
          onClick={() => setMode("dark")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            mode === "dark" ? "bg-primary text-primary-foreground shadow-md" : "glass-card hover:bg-foreground/5"
          }`}
        >
          <Moon className="w-4 h-4" /> Escuro
        </button>
      </div>
      <div className="flex gap-1 justify-center">
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
              cat === c ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto rounded-xl">
        {filtered.map(wp => (
          <button
            key={wp.id}
            onClick={() => setWallpaper(wp.id)}
            className={`relative rounded-lg overflow-hidden h-14 transition-all ring-1 ring-border/30 ${
              wallpaperId !== wp.id ? "hover:ring-primary/50" : ""
            }`}
          >
            {wp.src ? (
              <img src={wp.src} alt={wp.label} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full" style={{ background: wp.gradient, ...(wp.animation || {}) }} />
            )}
            {wallpaperId === wp.id && (
              <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                <Check className="w-5 h-5 text-white drop-shadow-lg" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepWorkspace(props: {
  wsName: string; setWsName: (v: string) => void;
  wsIcon: string; setWsIcon: (v: string) => void;
  wsColor: string; setWsColor: (v: string) => void;
  addSecond: boolean; setAddSecond: (v: boolean) => void;
  ws2Name: string; setWs2Name: (v: string) => void;
  ws2Icon: string; setWs2Icon: (v: string) => void;
  ws2Color: string; setWs2Color: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <LayoutGrid className="w-8 h-8 mx-auto text-primary mb-2" />
        <h2 className="text-lg font-semibold text-foreground">Criar Workspace</h2>
        <p className="text-xs text-muted-foreground mt-1">Separe vida pessoal e profissional. Cada perfil tem dados isolados.</p>
      </div>
      <div className="glass-card rounded-xl p-3 space-y-2">
        <label className="text-xs font-medium text-foreground/80">Workspace principal</label>
        <Input value={props.wsName} onChange={e => props.setWsName(e.target.value)} placeholder="Nome" />
        <div className="flex gap-1 flex-wrap">
          {WORKSPACE_ICONS.map(icon => (
            <button key={icon} onClick={() => props.setWsIcon(icon)}
              className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all ${props.wsIcon === icon ? "ring-2 ring-primary bg-primary/10" : "hover:bg-foreground/5"}`}
            >{icon}</button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {WORKSPACE_COLORS.map(c => (
            <button key={c} onClick={() => props.setWsColor(c)}
              className={`w-6 h-6 rounded-full transition-all ${props.wsColor === c ? "ring-2 ring-offset-2 ring-primary" : ""}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      {!props.addSecond ? (
        <button onClick={() => props.setAddSecond(true)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
        >
          <Plus className="w-4 h-4" /> Adicionar segundo workspace
        </button>
      ) : (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="glass-card rounded-xl p-3 space-y-2">
          <label className="text-xs font-medium text-foreground/80">Segundo workspace</label>
          <Input value={props.ws2Name} onChange={e => props.setWs2Name(e.target.value)} placeholder="Ex: Trabalho" />
          <div className="flex gap-1 flex-wrap">
            {WORKSPACE_ICONS.map(icon => (
              <button key={icon} onClick={() => props.setWs2Icon(icon)}
                className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all ${props.ws2Icon === icon ? "ring-2 ring-primary bg-primary/10" : "hover:bg-foreground/5"}`}
              >{icon}</button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {WORKSPACE_COLORS.map(c => (
              <button key={c} onClick={() => props.setWs2Color(c)}
                className={`w-6 h-6 rounded-full transition-all ${props.ws2Color === c ? "ring-2 ring-offset-2 ring-primary" : ""}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function StepConnections({ onConnect, isConnected, workspaceId, enabledCategories }: {
  onConnect: (cat: typeof ONBOARDING_CATEGORIES[number]) => void;
  isConnected: (category: string) => boolean;
  workspaceId: string | null;
  enabledCategories: typeof ONBOARDING_CATEGORIES;
}) {
  const connectedCount = enabledCategories.filter(c => isConnected(c.id)).length;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="text-center">
        <Plug className="w-8 h-8 mx-auto text-primary mb-2" />
        <h2 className="text-lg font-semibold text-foreground">Conectar seus serviços</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Toque em cada serviço para saber mais. Você pode fazer isso depois também.
        </p>
        {connectedCount > 0 && (
          <p className="text-xs text-primary mt-1 font-medium">
            {connectedCount} de {enabledCategories.length} conectados
          </p>
        )}
      </div>

      <div className="space-y-2">
        {enabledCategories.map((cat, i) => {
          const connected = isConnected(cat.id);
          const Icon = cat.icon;
          const isExpanded = expandedId === cat.id;
          return (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="glass-card rounded-xl overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : cat.id)}
                className="flex items-center gap-3 p-3 w-full text-left"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: cat.color + "20" }}
                >
                  <Icon className="w-5 h-5" style={{ color: cat.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{cat.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{cat.description}</p>
                </div>
                {connected ? (
                  <span className="flex items-center gap-1 text-[10px] bg-primary/15 text-primary px-2 py-1 rounded-full font-medium flex-shrink-0">
                    <Check className="w-3 h-3" /> Conectado
                  </span>
                ) : (
                  <motion.div
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-muted-foreground flex-shrink-0"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </motion.div>
                )}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 pt-0">
                      <div
                        className="rounded-lg p-3 text-xs leading-relaxed"
                        style={{ backgroundColor: cat.color + "08", borderLeft: `3px solid ${cat.color}` }}
                      >
                        <motion.p
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 }}
                          className="text-foreground/80"
                        >
                          {cat.tutorial}
                        </motion.p>
                      </div>
                      {!connected && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                          className="mt-2 flex justify-end"
                        >
                          <button
                            onClick={(e) => { e.stopPropagation(); onConnect(cat); }}
                            disabled={!workspaceId}
                            className="flex items-center gap-1 text-xs bg-primary/15 text-primary px-3 py-1.5 rounded-xl font-medium hover:bg-primary/25 transition-colors disabled:opacity-50"
                          >
                            <Plug className="w-3 h-3" /> Conectar {cat.label}
                          </button>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function StepTour() {
  const features = [
    { icon: Sparkles, title: "IA Assistente", desc: "Pergunte qualquer coisa", color: "hsl(270, 70%, 55%)" },
    { icon: CheckSquare, title: "Tarefas e Calendário", desc: "Organize seu dia", color: "hsl(150, 60%, 42%)" },
    { icon: DollarSign, title: "Finanças", desc: "Controle seus gastos", color: "hsl(25, 90%, 55%)" },
    { icon: Globe, title: "Busca Web", desc: "Informações em tempo real", color: "hsl(215, 80%, 55%)" },
    { icon: LayoutGrid, title: "Widgets", desc: "Personalize seu dashboard", color: "hsl(340, 75%, 55%)" },
  ];

  return (
    <div className="space-y-4">
      <div className="text-center">
        <Rocket className="w-8 h-8 mx-auto text-primary mb-2" />
        <h2 className="text-lg font-semibold text-foreground">Tour Rápido</h2>
        <p className="text-xs text-muted-foreground mt-1">Conheça os principais recursos do DESH</p>
      </div>
      <div className="space-y-2">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-3 glass-card rounded-xl p-3"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: f.color + "20" }}>
              <f.icon className="w-5 h-5" style={{ color: f.color }} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{f.title}</p>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function StepInstallApp() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem("desh-sound-enabled") !== "false"; } catch { return true; }
  });

  useEffect(() => {
    // Check if already installed as PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const installedHandler = () => setIsInstalled(true);
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === "accepted") {
        setIsInstalled(true);
        toast({ title: "App instalado! 🎉", description: "O DESH foi adicionado à tela inicial." });
      }
      setInstallPrompt(null);
    }
  };

  const handleNotifications = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    if (result === "granted") {
      toast({ title: "Notificações ativadas! 🔔", description: "Você receberá alertas importantes." });
    }
  };

  const handleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("desh-sound-enabled", String(next));
    if (next) {
      toast({ title: "Sons ativados 🔊" });
    }
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  return (
    <div className="space-y-4">
      <div className="text-center">
        <Smartphone className="w-8 h-8 mx-auto text-primary mb-2" />
        <h2 className="text-lg font-semibold text-foreground">Instalar o DESH</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Use como um app nativo no seu celular ou computador
        </p>
      </div>

      <div className="space-y-3">
        {/* Install PWA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-xl p-4"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Instalar App</p>
              <p className="text-xs text-muted-foreground">Acesse direto da tela inicial</p>
            </div>
            {isInstalled ? (
              <span className="flex items-center gap-1 text-[10px] bg-primary/15 text-primary px-2 py-1 rounded-full font-medium">
                <Check className="w-3 h-3" /> Instalado
              </span>
            ) : installPrompt ? (
              <Button size="sm" onClick={handleInstall} className="text-xs h-8 gap-1">
                <Download className="w-3 h-3" /> Instalar
              </Button>
            ) : null}
          </div>
          {!isInstalled && !installPrompt && (
            <div className="text-xs text-muted-foreground bg-foreground/5 rounded-lg p-2.5 mt-1 leading-relaxed">
              {isIOS ? (
                <>Toque em <strong>Compartilhar</strong> (ícone ↑) e depois em <strong>"Adicionar à Tela de Início"</strong>.</>
              ) : isAndroid ? (
                <>Toque no menu <strong>⋮</strong> do navegador e selecione <strong>"Instalar app"</strong> ou <strong>"Adicionar à tela inicial"</strong>.</>
              ) : (
                <>No Chrome, clique no ícone de instalação na barra de endereço, ou vá em <strong>Menu → Instalar DESH</strong>.</>
              )}
            </div>
          )}
        </motion.div>

        {/* Push Notifications */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Notificações</p>
              <p className="text-xs text-muted-foreground">Alertas de tarefas, eventos e mensagens</p>
            </div>
            {notifPermission === "granted" ? (
              <span className="flex items-center gap-1 text-[10px] bg-primary/15 text-primary px-2 py-1 rounded-full font-medium">
                <Check className="w-3 h-3" /> Ativo
              </span>
            ) : notifPermission === "denied" ? (
              <span className="text-[10px] text-destructive font-medium">Bloqueado</span>
            ) : (
              <Button size="sm" variant="outline" onClick={handleNotifications} className="text-xs h-8 gap-1">
                <Bell className="w-3 h-3" /> Ativar
              </Button>
            )}
          </div>
        </motion.div>

        {/* Sound */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
              <Volume2 className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Sons e Alertas</p>
              <p className="text-xs text-muted-foreground">Feedback sonoro para ações e lembretes</p>
            </div>
            <button
              onClick={handleSound}
              className={`w-10 h-6 rounded-full transition-all relative shrink-0 ${soundEnabled ? "bg-primary" : "bg-foreground/20"}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-primary-foreground shadow transition-transform ${soundEnabled ? "left-[18px]" : "left-0.5"}`} />
            </button>
          </div>
        </motion.div>
      </div>

      <p className="text-[10px] text-center text-muted-foreground/60 mt-2">
        Você pode alterar essas preferências a qualquer momento em Configurações
      </p>
    </div>
  );
}

function StepDone({ connectedCount, onActivateDemo }: { connectedCount: number; onActivateDemo: () => void }) {
  useEffect(() => {
    import("canvas-confetti").then((mod) => {
      const fire = mod.default;
      fire({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      setTimeout(() => {
        fire({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0, y: 0.6 } });
        fire({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1, y: 0.6 } });
      }, 300);
    });
  }, []);

  return (
    <div className="text-center space-y-5">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 12 }}
        className="w-20 h-20 mx-auto rounded-full bg-primary/15 flex items-center justify-center"
      >
        <Check className="w-10 h-10 text-primary" />
      </motion.div>
      <div>
        <h2 className="text-2xl font-bold text-foreground">Tudo pronto! 🎉</h2>
        <p className="text-muted-foreground mt-2 text-sm">Seu DESH está configurado e pronto para usar.</p>
        
        {connectedCount === 0 && (
          <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-300 mb-3">
              Notamos que você não conectou nenhuma plataforma. Quer ver como o DESH funciona com dados de exemplo?
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onActivateDemo}
              className="text-xs h-8 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
            >
              Ativar Modo Demo
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

import { APP_VERSION } from "@/constants/app";
import { wallpaperOptions } from "@/hooks/ui/useWallpaper";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import PageLayout from "@/components/dashboard/PageLayout";
import PageHeader from "@/components/dashboard/PageHeader";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import GlassCard from "@/components/dashboard/GlassCard";
import { Palette, Bell, Plug, Info, LayoutGrid, Moon, Sun, Image, SunDim, Droplets, Users, Trash2, Pencil, RotateCcw, Loader2, CreditCard, Mail, ScrollText, FileText, Eye, ChevronDown, ChevronUp, Shield } from "lucide-react";
import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useThemeContext } from "@/contexts/ThemeContext";
import { themeColors } from "@/hooks/ui/useTheme";
import { useWorkspace } from "@/contexts/WorkspaceContext";

import { GoogleNotifSettings, defaultGoogleNotifs, getGoogleNotifPrefs } from "@/lib/googleNotifPrefs";
import { STORAGE_KEYS } from "@/constants/storage-keys";

import { useDemo } from "@/contexts/DemoContext";

// Lazy-loaded heavy sub-components
const ThemeEditorInline = lazy(() => import("@/components/settings/ThemeEditorInline"));
const PrivacySection = lazy(() => import("@/components/settings/PrivacySection"));
const OpenBankingSettingsSection = lazy(() => import("@/components/settings/OpenBankingSettingsSection"));
const GoogleStatusPanel = lazy(() => import("@/components/settings/GoogleStatusPanel"));
const GoogleNotifSection = lazy(() => import("@/components/settings/GoogleNotifSection"));
const BillingSettingsSection = lazy(() => import("@/components/settings/BillingSettingsSection"));
const EmailNotifPreferences = lazy(() => import("@/components/settings/EmailNotifPreferences"));

const SectionFallback = () => <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;

interface NotifSettings {
  email: boolean;
  calendar: boolean;
  tasks: boolean;
  whatsapp: boolean;
  autoRecurring: boolean;
}

const defaultNotifs: NotifSettings = { email: true, calendar: true, tasks: true, whatsapp: true, autoRecurring: true };

// Re-export for backward compatibility
export type { GoogleNotifSettings };
export { defaultGoogleNotifs, getGoogleNotifPrefs };

type SettingsSection = "aparencia" | "wallpaper" | "notificacoes" | "email_notifs" | "perfis" | "widgets" | "conexoes" | "privacidade" | "faturamento" | "logs" | "sobre" | "demo";

const SETTINGS_SECTIONS: { id: SettingsSection; label: string; icon: React.ElementType }[] = [
  { id: "demo", label: "Demo", icon: Eye },
  { id: "aparencia", label: "Aparência", icon: Palette },
  { id: "wallpaper", label: "Wallpaper", icon: Image },
  { id: "notificacoes", label: "Notificações", icon: Bell },
  { id: "email_notifs", label: "E-mail", icon: Mail },
  { id: "perfis", label: "Perfis", icon: Users },
  { id: "conexoes", label: "Conexões", icon: Plug },
  { id: "privacidade", label: "Privacidade", icon: Shield },
  { id: "faturamento", label: "Faturamento", icon: CreditCard },
  { id: "logs", label: "Logs", icon: ScrollText },
  { id: "sobre", label: "Sobre", icon: Info },
];

const SettingsPage = () => {
  const navigate = useNavigate();
  const { theme, toggleMode, setColor, wallpaperId, setWallpaper, wallpaperBrightness, setWallpaperBrightness, wallpaperBlur, setWallpaperBlur } = useThemeContext();
  const { isDemoMode, isLoading: demoLoading, setDemoMode } = useDemo();
  const { user } = useAuth();
  const { workspaces, createWorkspace, updateWorkspace, deleteWorkspace } = useWorkspace();
  const [editingWs, setEditingWs] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editColor, setEditColor] = useState("");
  const [newWsName, setNewWsName] = useState("");
  const [newWsIcon, setNewWsIcon] = useState("💼");
  const [newWsColor, setNewWsColor] = useState("hsl(280, 80%, 50%)");
  const [showAdvancedEditor, setShowAdvancedEditor] = useState(false);
  

  const wsColors = [
    "hsl(220, 80%, 50%)", "hsl(280, 80%, 50%)", "hsl(340, 80%, 50%)",
    "hsl(160, 80%, 40%)", "hsl(30, 90%, 50%)", "hsl(200, 80%, 50%)",
  ];
  const wsEmojis = [
    "🏠", "💼", "🏢", "🎨", "📚", "🎮", "🧪", "🌟", "🚀", "💡", "📊", "🛒",
    "🎯", "⚡", "🔬", "🌍", "🎓", "🏆", "🎵", "📱", "💎", "🔧", "🌈", "🐱",
    "🍀", "🔥", "❤️", "🧠", "📝", "🛡️", "🎪", "🏄", "🌙", "☀️", "🦊", "🐝",
  ];

  const [notifs, setNotifs] = useState<NotifSettings>(() => {
    const saved = localStorage.getItem("dashfy-notifs");
    return saved ? JSON.parse(saved) : defaultNotifs;
  });

  useEffect(() => {
    localStorage.setItem("dashfy-notifs", JSON.stringify(notifs));
  }, [notifs]);

  const toggleNotif = useCallback((key: keyof NotifSettings) => {
    setNotifs(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const ToggleSwitch = useCallback(({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
    <button
      onClick={onToggle}
      className={`w-10 h-6 rounded-full transition-all relative ${enabled ? "bg-primary" : "bg-foreground/20"}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-primary-foreground shadow transition-transform ${enabled ? "left-[18px]" : "left-0.5"}`} />
    </button>
  ), []);

  const handleResetOnboarding = useCallback(async () => {
    if (!user) return;
    await supabase.from("profiles").update({ onboarding_completed: false } as any).eq("user_id", user.id);
    toast({ title: "Onboarding resetado", description: "O wizard aparecerá na próxima vez que abrir o dashboard." });
  }, [user]);

  return (
    <PageLayout maxWidth="7xl">
      <PageHeader
        title="Configurações"
        icon={<Palette className="w-6 h-6 text-primary drop-shadow" />}
      />

      {/* Section Navigation */}
      <div className="flex gap-1.5 mb-5 pb-3 border-b border-foreground/10 overflow-x-auto scrollbar-thin">
        {SETTINGS_SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => {
              const el = document.getElementById(`settings-${s.id}`);
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap bg-foreground/5 text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
          >
            <s.icon className="w-3 h-3" />
            {s.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {/* Demo Mode */}
        <AnimatedItem index={0}>
          <GlassCard size="auto" id="settings-demo">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-4 h-4 text-primary" />
              <p className="widget-title">Modo Demo</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Habilitar Modo Demo</p>
                <p className="text-xs text-muted-foreground">Cria dados simulados no banco para uma experiência 100% realista</p>
                <p className="text-[10px] text-amber-400/80 mt-1">⚡ Funções de IA consomem créditos normalmente</p>
              </div>
              {demoLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              ) : (
                <ToggleSwitch enabled={isDemoMode} onToggle={() => setDemoMode(!isDemoMode)} />
              )}
            </div>
          </GlassCard>
        </AnimatedItem>

        {/* Aparência */}
        <AnimatedItem index={0}>
          <GlassCard size="auto" id="settings-aparencia">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-4 h-4 text-primary" />
              <p className="widget-title">Aparência</p>
            </div>

            {/* Modo claro/escuro */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-sm font-medium text-foreground">Tema</p>
                <p className="text-xs text-muted-foreground">Alternar entre claro e escuro</p>
              </div>
              <button
                onClick={toggleMode}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-foreground/5 text-sm text-foreground hover:bg-foreground/10 transition-colors"
              >
                {theme.mode === "light" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {theme.mode === "light" ? "Claro" : "Escuro"}
              </button>
            </div>

            {/* Cores */}
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Cor do tema</p>
              <p className="text-xs text-muted-foreground mb-3">Escolha a cor de destaque do app</p>
              <div className="flex flex-wrap gap-2">
                {themeColors.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setColor(c.id)}
                    className={`w-8 h-8 rounded-full transition-all border-2 ${
                      theme.color === c.id
                        ? "border-foreground scale-110 shadow-lg"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ background: `hsl(${c.preview})` }}
                    title={c.label}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Selecionado: <span className="font-medium text-foreground">{themeColors.find(c => c.id === theme.color)?.label}</span>
              </p>
              <button
                onClick={() => setShowAdvancedEditor(v => !v)}
                className="mt-3 w-full flex items-center gap-2 p-3 rounded-lg bg-foreground/5 hover:bg-foreground/10 transition-colors text-left"
              >
                <Palette className="w-4 h-4 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Editor avançado de temas</p>
                  <p className="text-xs text-muted-foreground">HSL personalizado, preview em tempo real e temas da comunidade</p>
                </div>
                {showAdvancedEditor ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              <AnimatePresence>
                {showAdvancedEditor && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <Suspense fallback={<SectionFallback />}>
                      <ThemeEditorInline />
                    </Suspense>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </GlassCard>
        </AnimatedItem>

        {/* Wallpaper */}
        <AnimatedItem index={1}>
          <GlassCard size="auto" id="settings-wallpaper">
            <div className="flex items-center gap-2 mb-4">
              <Image className="w-4 h-4 text-primary" />
              <p className="widget-title">Papel de Parede</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Escolha o fundo do dashboard</p>

            {/* Paisagens */}
            <p className="text-xs font-semibold text-foreground mb-2">Paisagens</p>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-4">
              {wallpaperOptions.filter(wp => wp.category === "paisagem").map(wp => (
                <button key={wp.id} onClick={() => setWallpaper(wp.id)}
                  className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                    wallpaperId === wp.id ? "border-primary scale-105 shadow-lg" : "border-transparent hover:scale-105 opacity-70 hover:opacity-100"
                  }`}>
                  <img src={wp.src} alt={wp.label} className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[9px] text-center py-0.5">{wp.label}</span>
                </button>
              ))}
            </div>

            {/* Abstratos */}
            <p className="text-xs font-semibold text-foreground mb-2">Abstratos</p>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {wallpaperOptions.filter(wp => wp.category === "abstrato").map(wp => (
                <button key={wp.id} onClick={() => setWallpaper(wp.id)}
                  className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                    wallpaperId === wp.id ? "border-primary scale-105 shadow-lg" : "border-transparent hover:scale-105 opacity-70 hover:opacity-100"
                  }`}>
                  <div className="w-full h-full" style={{ background: wp.gradient }} />
                  <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[9px] text-center py-0.5">{wp.label}</span>
                </button>
              ))}
            </div>

            {/* Animados */}
            <p className="text-xs font-semibold text-foreground mb-2">Animados</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {wallpaperOptions.filter(wp => wp.category === "animado").map(wp => (
                <button key={wp.id} onClick={() => setWallpaper(wp.id)}
                  className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                    wallpaperId === wp.id ? "border-primary scale-105 shadow-lg" : "border-transparent hover:scale-105 opacity-70 hover:opacity-100"
                  }`}>
                  <div className="w-full h-full" style={{ background: wp.gradient, backgroundSize: wp.animation?.backgroundSize, animation: wp.animation?.animation }} />
                  <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[9px] text-center py-0.5">{wp.label}</span>
                </button>
              ))}
            </div>

            {/* Brightness */}
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <SunDim className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Brilho do papel de parede</p>
              </div>
              <div className="flex items-center gap-3">
                <Moon className="w-3.5 h-3.5 text-muted-foreground" />
                <input type="range" min={20} max={180} value={wallpaperBrightness}
                  onChange={e => setWallpaperBrightness(parseInt(e.target.value, 10))}
                  className="flex-1 h-1.5 rounded-full appearance-none bg-foreground/15 accent-primary cursor-pointer" />
                <Sun className="w-3.5 h-3.5 text-muted-foreground" />
                <button onClick={() => setWallpaperBrightness(100)}
                  className="text-[10px] px-2 py-0.5 rounded bg-foreground/5 text-muted-foreground hover:text-foreground transition-colors">
                  Reset
                </button>
              </div>
            </div>

            {/* Blur */}
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <Droplets className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Desfoque do papel de parede</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground w-4 text-center">0</span>
                <input type="range" min={0} max={40} value={wallpaperBlur}
                  onChange={e => setWallpaperBlur(parseInt(e.target.value, 10))}
                  className="flex-1 h-1.5 rounded-full appearance-none bg-foreground/15 accent-primary cursor-pointer" />
                <span className="text-[10px] text-muted-foreground w-4 text-center">40</span>
                <button onClick={() => setWallpaperBlur(0)}
                  className="text-[10px] px-2 py-0.5 rounded bg-foreground/5 text-muted-foreground hover:text-foreground transition-colors">
                  Reset
                </button>
              </div>
            </div>
          </GlassCard>
        </AnimatedItem>

        <AnimatedItem index={2}>
          <GlassCard size="auto" id="settings-notificacoes">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-4 h-4 text-primary" />
              <p className="widget-title">Notificações</p>
            </div>
            <div className="space-y-3">
              {([
                { key: "email" as const, label: "E-mail", desc: "Notificações de novos e-mails" },
                { key: "calendar" as const, label: "Calendário", desc: "Lembretes de eventos" },
                { key: "tasks" as const, label: "Tarefas", desc: "Alertas de tarefas pendentes" },
                { key: "whatsapp" as const, label: "WhatsApp", desc: "Mensagens recebidas" },
                { key: "autoRecurring" as const, label: "Recorrentes automáticas", desc: "Gerar transações recorrentes ao abrir o app" },
              ]).map(item => (
                <div key={item.key} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <ToggleSwitch enabled={notifs[item.key]} onToggle={() => toggleNotif(item.key)} />
                </div>
              ))}
            </div>

            {/* Animação de abertura */}
            <div className="mt-4 pt-4 border-t border-foreground/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Animação de abertura</p>
                  <p className="text-xs text-muted-foreground">Intro futurista ao entrar no dashboard</p>
                </div>
                <ToggleSwitch
                  enabled={!localStorage.getItem("desh-intro-disabled")}
                  onToggle={() => {
                    if (localStorage.getItem("desh-intro-disabled")) {
                      localStorage.removeItem("desh-intro-disabled");
                    } else {
                      localStorage.setItem("desh-intro-disabled", "1");
                    }
                    window.dispatchEvent(new Event("storage"));
                  }}
                />
              </div>
            </div>

            {/* Google Push Notifications */}
            <Suspense fallback={<SectionFallback />}>
              <GoogleNotifSection ToggleSwitch={ToggleSwitch} />
            </Suspense>
          </GlassCard>
        </AnimatedItem>

        {/* Notificações por E-mail */}
        <AnimatedItem index={2.5}>
          <Suspense fallback={<SectionFallback />}>
            <EmailNotifPreferences userId={user?.id} ToggleSwitch={ToggleSwitch} />
          </Suspense>
        </AnimatedItem>

        {/* Perfis / Workspaces */}
        <AnimatedItem index={3}>
          <GlassCard size="auto" id="settings-perfis">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-primary" />
              <p className="widget-title">Perfis</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Gerencie seus perfis para separar contextos (Pessoal, Trabalho, etc.)</p>

            <div className="space-y-2 mb-4">
              {workspaces.map(ws => (
                <div key={ws.id} className="p-2.5 rounded-lg bg-foreground/5">
                  {editingWs === ws.id ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-9 gap-1">
                        {wsEmojis.map(e => (
                          <button key={e} onClick={() => setEditIcon(e)} className={`w-7 h-7 rounded text-sm flex items-center justify-center ${editIcon === e ? "bg-primary/20 ring-1 ring-primary" : ""}`}>{e}</button>
                        ))}
                      </div>
                      <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-2 py-1.5 rounded bg-foreground/5 border border-foreground/10 text-sm text-foreground" />
                      <div className="flex items-center gap-1 flex-wrap">
                        {wsColors.map(c => (
                          <button key={c} onClick={() => setEditColor(c)} className={`w-5 h-5 rounded-full border-2 ${editColor === c ? "border-foreground" : "border-transparent"}`} style={{ background: c }} />
                        ))}
                        <label className="w-5 h-5 rounded-full cursor-pointer border-2 border-dashed border-foreground/20 hover:border-foreground/40 transition-colors flex items-center justify-center overflow-hidden" style={{ background: wsColors.includes(editColor) ? 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' : editColor }} title="Cor personalizada">
                          <input type="color" value={editColor.startsWith('#') ? editColor : '#8b5cf6'} onChange={e => setEditColor(e.target.value)} className="opacity-0 absolute w-0 h-0" />
                          {wsColors.includes(editColor) && <span className="text-[8px] text-white font-bold drop-shadow">+</span>}
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={async () => { await updateWorkspace(ws.id, { name: editName, icon: editIcon, color: editColor }); setEditingWs(null); }} className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground">Salvar</button>
                        <button onClick={() => setEditingWs(null)} className="text-xs text-muted-foreground">✕</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-base">{ws.icon}</span>
                      <span className="flex-1 text-sm font-medium text-foreground truncate min-w-0">{ws.name}</span>
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: ws.color }} />
                      {ws.is_default && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary flex-shrink-0">Padrão</span>}
                      <button onClick={() => { setEditingWs(ws.id); setEditName(ws.name); setEditIcon(ws.icon); setEditColor(ws.color); }} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {!ws.is_default && (
                        <button onClick={() => { if (confirm(`Excluir perfil "${ws.name}"?`)) deleteWorkspace(ws.id); }} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Create new */}
            <div className="p-2.5 rounded-lg border border-dashed border-foreground/15 space-y-2">
              <div className="flex items-center gap-2">
                <select value={newWsIcon} onChange={e => setNewWsIcon(e.target.value)} className="bg-transparent text-base cursor-pointer flex-shrink-0">
                  {wsEmojis.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <input value={newWsName} onChange={e => setNewWsName(e.target.value)} placeholder="Nome do novo perfil"
                  className="flex-1 min-w-0 px-2 py-1.5 rounded bg-foreground/5 border border-foreground/10 text-sm text-foreground placeholder:text-muted-foreground"
                  onKeyDown={e => { if (e.key === "Enter" && newWsName.trim()) { createWorkspace({ name: newWsName.trim(), icon: newWsIcon, color: newWsColor }); setNewWsName(""); } }} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-1 flex-wrap">
                  {wsColors.map(c => (
                    <button key={c} onClick={() => setNewWsColor(c)} className={`w-5 h-5 rounded-full border-2 ${newWsColor === c ? "border-foreground" : "border-transparent"}`} style={{ background: c }} />
                  ))}
                  <label className="w-5 h-5 rounded-full cursor-pointer border-2 border-dashed border-foreground/20 hover:border-foreground/40 transition-colors flex items-center justify-center overflow-hidden" style={{ background: wsColors.includes(newWsColor) ? 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' : newWsColor }} title="Cor personalizada">
                    <input type="color" value={newWsColor.startsWith('#') ? newWsColor : '#8b5cf6'} onChange={e => setNewWsColor(e.target.value)} className="opacity-0 absolute w-0 h-0" />
                    {wsColors.includes(newWsColor) && <span className="text-[8px] text-white font-bold drop-shadow">+</span>}
                  </label>
                </div>
                <button onClick={() => { if (newWsName.trim()) { createWorkspace({ name: newWsName.trim(), icon: newWsIcon, color: newWsColor }); setNewWsName(""); } }}
                  disabled={!newWsName.trim()}
                  className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                  Criar
                </button>
              </div>
            </div>

            {/* MigrationWizard removed */}
          </GlassCard>
        </AnimatedItem>

        {/* Widgets */}
        <AnimatedItem index={5}>
          <GlassCard size="auto">
            <div className="flex items-center gap-2 mb-4">
              <LayoutGrid className="w-4 h-4 text-primary" />
              <p className="widget-title">Widgets</p>
            </div>
            <button onClick={() => navigate("/widgets")}
              className="w-full text-left text-sm text-foreground/80 p-3 rounded-lg bg-foreground/5 hover:bg-foreground/10 transition-colors">
              Gerenciar widgets ativos →
            </button>
          </GlassCard>
        </AnimatedItem>

        {/* Conexões */}
        <AnimatedItem index={4}>
          <GlassCard size="auto" id="settings-conexoes">
            <div className="flex items-center gap-2 mb-4">
              <Plug className="w-4 h-4 text-primary" />
              <p className="widget-title">Conexões</p>
            </div>
            <button onClick={() => navigate("/integrations")}
              className="w-full text-left text-sm text-foreground/80 p-3 rounded-lg bg-foreground/5 hover:bg-foreground/10 transition-colors mb-3">
              Gerenciar conexões externas →
            </button>

            <Suspense fallback={<SectionFallback />}>
              <OpenBankingSettingsSection />
              <GoogleStatusPanel />
            </Suspense>
          </GlassCard>
        </AnimatedItem>

        {/* Dados & Privacidade LGPD */}
        <AnimatedItem index={5.5}>
          <GlassCard size="auto" id="settings-privacidade">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-primary" />
              <p className="widget-title">Dados & Privacidade</p>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Seus direitos conforme a <span className="font-medium text-foreground">LGPD Art. 18</span> e GDPR Art. 20.
            </p>
            <Suspense fallback={<SectionFallback />}>
              <PrivacySection />
            </Suspense>
            <div className="mt-4 pt-3 border-t border-foreground/10">
              <button onClick={() => navigate("/settings/data-reset")}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-destructive/5 hover:bg-destructive/10 transition-colors text-left group">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-destructive" />
                  <div>
                    <span className="text-sm font-medium text-destructive">Resetar Dados por Módulo</span>
                    <p className="text-[11px] text-muted-foreground">Apague dados de WhatsApp, E-mail, Tarefas e outros módulos</p>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-destructive/50 -rotate-90" />
              </button>
            </div>
          </GlassCard>
        </AnimatedItem>

        {/* Plano & Faturamento */}
        <AnimatedItem index={5.7}>
          <GlassCard size="auto" id="settings-faturamento">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-primary" />
              <p className="widget-title">Plano & Faturamento</p>
            </div>
            <Suspense fallback={<SectionFallback />}>
              <BillingSettingsSection />
            </Suspense>
          </GlassCard>
        </AnimatedItem>

        {/* Logs de Atividade */}
        <AnimatedItem index={6}>
          <GlassCard size="auto" id="settings-logs">
            <div className="flex items-center gap-2 mb-4">
              <ScrollText className="w-4 h-4 text-primary" />
              <p className="widget-title">Logs de Atividade</p>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Visualize o histórico completo de todas as suas ações no sistema — notas criadas, tarefas concluídas, configurações alteradas e muito mais.
            </p>
            <button onClick={() => navigate("/settings/logs")}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-colors text-left group">
              <div className="flex items-center gap-2.5">
                <ScrollText className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">Ver logs completos</p>
                  <p className="text-xs text-muted-foreground">Histórico detalhado de uso do sistema</p>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground -rotate-90 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </GlassCard>
        </AnimatedItem>

        <AnimatedItem index={6}>
          <GlassCard size="auto" id="settings-sobre">
            <div className="flex items-center gap-2 mb-4">
              <Info className="w-4 h-4 text-primary" />
              <p className="widget-title">Sobre</p>
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Versão</span>
                <span className="text-foreground font-medium flex items-center gap-1.5">
                  {APP_VERSION}
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">estável</span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Plataforma</span>
                <span className="text-foreground font-medium">Desh — Personal OS</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Desenvolvido por</span>
                <a href="https://www.webstar.studio" target="_blank" rel="noopener noreferrer" className="text-foreground font-medium hover:text-primary transition-colors">Web Star Studio</a>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Conta</span>
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">{user?.email}</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-foreground/10 space-y-2">
              <button
                onClick={handleResetOnboarding}
                className="flex items-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-foreground/5">
                <RotateCcw className="w-3.5 h-3.5" />
                Refazer o onboarding
              </button>
              <div className="flex gap-2 flex-wrap pt-1">
                <a href="/privacy" className="text-[11px] text-primary hover:underline">Privacidade</a>
                <span className="text-[11px] text-muted-foreground/30">·</span>
                <a href="/terms" className="text-[11px] text-primary hover:underline">Termos</a>
                <span className="text-[11px] text-muted-foreground/30">·</span>
                <a href="mailto:dev@webstar.studio" className="text-[11px] text-muted-foreground hover:text-foreground">Contato</a>
              </div>
            </div>
          </GlassCard>
        </AnimatedItem>
      </div>
    </PageLayout>
  );
};

export default SettingsPage;

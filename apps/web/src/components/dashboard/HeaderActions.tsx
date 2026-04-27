import { Bell, X, Plus, Moon, Sun, Settings, LogOut, User, Volume2, VolumeX, Plug, LayoutGrid, CreditCard, RefreshCw, Podcast, Loader2, Square } from "lucide-react";
import DeshTooltip from "@/components/ui/DeshTooltip";
import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate, useLocation } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import WidgetManager from "@/components/dashboard/WidgetManager";
import { useWidgetLayout } from "@/hooks/ui/useWidgetLayout";
import { useValidWidgetIds } from "@/components/dashboard/WidgetGrid";
import { shellDropdownContentClass, shellMenuSurfaceClass } from "@/lib/shell-menu";
import { cn } from "@/lib/utils";
import { useThemeContext } from "@/contexts/ThemeContext";
import { useDashboardState } from "@/contexts/DashboardContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSoundAlerts } from "@/hooks/ui/useSoundAlerts";
import { motion, AnimatePresence } from "framer-motion";

import QuickAddPopup from "@/components/dashboard/QuickAddPopup";
import { Slider } from "@/components/ui/slider";
import CreditsBadge from "@/components/dashboard/CreditsBadge";
import WorkspaceSwitcher from "@/components/dashboard/WorkspaceSwitcher";
import { useMorningBriefing } from "@/hooks/ai/useMorningBriefing";

const dropdownVariants = {
  hidden: { opacity: 0, y: -8, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.15, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -6, scale: 0.97, transition: { duration: 0.1 } },
};

const HeaderActions = React.forwardRef<HTMLDivElement>((_, ref) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { widgets, toggleWidget, moveWidgetById } = useWidgetLayout();
  const validWidgetIds = useValidWidgetIds();
  const [widgetMenuOpen, setWidgetMenuOpen] = useState(false);
  const { theme, toggleMode } = useThemeContext();
  const state = useDashboardState();
  const { user, profile, signOut } = useAuth();
  const { playSound, muted, toggleMute, volume, setVolume } = useSoundAlerts();
  const isMobile = useIsMobile();
  const { status: briefingStatus, progress: briefingProgress, shouldOffer: briefingShouldOffer, generateAndPlay: briefingPlay, stop: briefingStop } = useMorningBriefing();
  const showBriefingBtn = isMobile && (briefingShouldOffer || briefingStatus === "generating" || briefingStatus === "playing");
  const profileInitial = (profile?.display_name || user?.email || "U").charAt(0).toUpperCase();
  const profileAvatarUrl = profile?.avatar_url || user?.user_metadata.avatar_url || null;
  const profileAvatarStyle = profileAvatarUrl
    ? {
        backgroundImage: `url(${JSON.stringify(profileAvatarUrl)})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [dismissedNotifs, setDismissedNotifs] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pathname !== "/dashboard") setWidgetMenuOpen(false);
  }, [pathname]);

  // Click-outside handler to close all dropdowns
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
        setShowProfile(false);
        // QuickAddPopup has its own handler
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    sessionStorage.removeItem("desh-intro-seen");
    setTimeout(() => window.location.reload(), 800);
  }, []);

  const tasks = state.tasks;
  const events = state.events;
  const notes = state.notes;

  const smartNotifs = useMemo(() => {
    const now = new Date();
    const notifs: { id: string; text: string; type: "info" | "warning" | "success" }[] = [];
    const pendingTasks = tasks.filter(t => !t.done);
    const completedToday = tasks.filter(t => t.done);
    const todayEvents = events.filter(e => e.day === now.getDate() && e.month === now.getMonth() && e.year === now.getFullYear());
    const highPriority = pendingTasks.filter(t => t.priority === "high");
    if (highPriority.length > 0) notifs.push({ id: "high-priority", text: `🔴 ${highPriority.length} tarefa(s) de alta prioridade pendente(s)`, type: "warning" });
    if (pendingTasks.length > 0) notifs.push({ id: "pending", text: `📋 Você tem ${pendingTasks.length} tarefa(s) pendente(s)`, type: "info" });
    if (todayEvents.length > 0) notifs.push({ id: "events-today", text: `📅 ${todayEvents.length} evento(s) hoje: ${todayEvents.map(e => e.label).join(", ")}`, type: "info" });
    if (completedToday.length > 0) notifs.push({ id: "completed", text: `✅ ${completedToday.length} tarefa(s) concluída(s). Bom trabalho!`, type: "success" });
    if (notes.length > 0) notifs.push({ id: "notes", text: `📝 ${notes.length} nota(s) salva(s)`, type: "info" });
    return notifs;
  }, [tasks, events, notes]);

  const visibleNotifs = useMemo(
    () => smartNotifs.filter(n => !dismissedNotifs.has(n.id)),
    [smartNotifs, dismissedNotifs]
  );

  const dismissNotif = useCallback((id: string) => {
    setDismissedNotifs(prev => new Set(prev).add(id));
  }, []);

  const closeAll = useCallback(() => {
    setShowNotifs(false);
    setShowProfile(false);
    setShowQuickAdd(false);
  }, []);

  const menuItemClass = "flex items-center gap-2.5 w-full text-left text-xs text-foreground/70 hover:text-foreground py-2 px-2.5 rounded-lg hover:bg-foreground/5 transition-colors";

  return (
    <>
    <div ref={containerRef} className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 drop-shadow-[0_1px_3px_rgba(0,0,0,0.15)] relative z-[200]">
      <div className="flex-shrink-0">
        <WorkspaceSwitcher />
      </div>

      {/* Credits: hidden on mobile, visible on sm+ */}
      <div className="hidden sm:block">
        <CreditsBadge />
      </div>

      {pathname === "/dashboard" && (
        <DropdownMenu
          modal={false}
          open={widgetMenuOpen}
          onOpenChange={(open) => {
            setWidgetMenuOpen(open);
            if (open) {
              setShowNotifs(false);
              setShowProfile(false);
              setShowQuickAdd(false);
            }
          }}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Gerenciar widgets"
              className="focusable glass-card w-9 h-9 sm:w-10 sm:h-10 rounded-full hover:bg-foreground/10 transition-colors flex items-center justify-center outline-none"
              aria-expanded={widgetMenuOpen}
              aria-haspopup="menu"
              aria-label="Gerenciar widgets"
            >
              <LayoutGrid className="w-4 h-4 text-overlay-muted" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className={shellDropdownContentClass("w-[min(20rem,calc(100vw-1.5rem))]")}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <WidgetManager
              widgets={widgets}
              validWidgetIds={validWidgetIds}
              onToggle={toggleWidget}
              onMoveById={moveWidgetById}
              onClose={() => setWidgetMenuOpen(false)}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <DeshTooltip label="Notificações">
        <button className="focusable glass-card w-9 h-9 sm:w-10 sm:h-10 rounded-full hover:bg-foreground/10 transition-colors relative flex items-center justify-center" onClick={() => {
          setShowNotifs(!showNotifs); setShowProfile(false); setShowQuickAdd(false);
        }}>
          <Bell className="w-4 h-4 text-overlay-muted" />
          {visibleNotifs.length > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background"
            />
          )}
        </button>
      </DeshTooltip>

      <div className="relative">
        <DeshTooltip label="Adicionar rápido">
          <button
            className="focusable glass-card w-9 h-9 sm:w-10 sm:h-10 rounded-full hover:bg-foreground/10 transition-colors flex items-center justify-center"
            onClick={() => { setShowQuickAdd(!showQuickAdd); setShowNotifs(false); setShowProfile(false); }}
          >
            <Plus className="w-4 h-4 text-overlay-muted" />
          </button>
        </DeshTooltip>
        <QuickAddPopup open={showQuickAdd} onClose={() => setShowQuickAdd(false)} />
      </div>

      {showBriefingBtn && (
        <button
          className="glass-card p-2 rounded-full hover:bg-foreground/10 transition-colors sm:hidden disabled:opacity-50"
          onClick={briefingStatus === "playing" ? briefingStop : briefingPlay}
          disabled={briefingStatus === "generating"}
          title={briefingStatus === "playing" ? "Parar briefing" : "Ouvir briefing matinal"}
        >
          {briefingStatus === "generating" ? (
            <Loader2 className="w-4 h-4 text-overlay-muted animate-spin" />
          ) : briefingStatus === "playing" ? (
            <Volume2 className="w-4 h-4 text-primary animate-pulse" />
          ) : (
            <Podcast className="w-4 h-4 text-overlay-muted" />
          )}
        </button>
      )}

      <DeshTooltip label="Atualizar tudo">
        <button
          className="focusable hidden sm:flex glass-card w-9 h-9 sm:w-10 sm:h-10 rounded-full hover:bg-foreground/10 transition-colors items-center justify-center"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 text-overlay-muted ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </DeshTooltip>

      <DeshTooltip label="Perfil e opções">
        <button
          className={cn(
            "focusable w-9 h-9 sm:w-10 sm:h-10 rounded-full backdrop-blur-sm flex items-center justify-center text-xs sm:text-sm font-semibold text-overlay transition-all border border-foreground/10 shadow-sm overflow-hidden",
            profileAvatarUrl
              ? "bg-cover bg-center hover:brightness-110"
              : "bg-gradient-to-br from-primary/20 to-primary/10 hover:from-primary/25 hover:to-primary/15",
          )}
          style={profileAvatarStyle}
          onClick={() => { setShowProfile(!showProfile); setShowNotifs(false); setShowQuickAdd(false); }}
          aria-label="Perfil e opções"
        >
          {profileAvatarUrl ? <span className="sr-only">{profileInitial}</span> : profileInitial}
        </button>
      </DeshTooltip>

      <AnimatePresence>
        {showNotifs && (
          <motion.div
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              "absolute top-full right-0 w-80 max-w-[calc(100vw-2rem)] p-4 z-[100] mt-2 sm:right-0",
              shellMenuSurfaceClass,
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">Notificações</p>
              <span className="text-[10px] text-muted-foreground/60 bg-foreground/5 px-2 py-0.5 rounded-full">
                {visibleNotifs.length}
              </span>
            </div>
            <div className="space-y-1.5 max-h-52 overflow-y-auto scrollbar-thin">
              {visibleNotifs.map((n, i) => (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-2.5 p-2.5 rounded-xl bg-foreground/[0.03] hover:bg-foreground/[0.06] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground font-medium leading-relaxed">{n.text}</p>
                  </div>
                  <button onClick={() => dismissNotif(n.id)} className="text-muted-foreground/40 hover:text-foreground transition-colors mt-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              ))}
              {visibleNotifs.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-2xl mb-1">🎉</p>
                  <p className="text-xs text-muted-foreground">Tudo em dia!</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showProfile && (
          <motion.div
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              "absolute top-full right-0 w-60 p-4 z-[100] mt-2",
              shellMenuSurfaceClass,
            )}
          >
            <div className="flex items-center gap-3 mb-3 pb-3 border-b border-foreground/5">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-primary overflow-hidden",
                  profileAvatarUrl
                    ? "bg-cover bg-center"
                    : "bg-gradient-to-br from-primary/25 to-primary/10",
                )}
                style={profileAvatarStyle}
              >
                {profileAvatarUrl ? <span className="sr-only">{profileInitial}</span> : profileInitial}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{profile?.display_name || "Usuário"}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="flex flex-col gap-0.5 mb-1 pb-1.5 border-b border-foreground/5">
                <button onClick={toggleMode} className={menuItemClass}>
                  {theme.mode === "light" ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                  {theme.mode === "light" ? "Modo escuro" : "Modo claro"}
                </button>
                <button onClick={toggleMute} className={menuItemClass}>
                  {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  {muted ? "Som desligado" : "Som ligado"}
                </button>
                {!muted && (
                  <div className="px-2.5 pb-1.5">
                    <Slider min={0} max={0.3} step={0.01} value={[volume]} onValueChange={([v]) => { setVolume(v); if (v === 0 && !muted) toggleMute(); }} className="w-full" />
                  </div>
                )}
              </div>
              <button onClick={() => { closeAll(); navigate("/profile"); }} className={menuItemClass}>
                <User className="w-3.5 h-3.5" /> Meu Perfil
              </button>
              <button onClick={() => { closeAll(); navigate("/settings"); }} className={menuItemClass}>
                <Settings className="w-3.5 h-3.5" /> Configurações
              </button>
              <button onClick={() => { closeAll(); navigate("/integrations"); }} className={menuItemClass}>
                <Plug className="w-3.5 h-3.5" /> Conexões
              </button>
              <button onClick={() => { closeAll(); navigate("/widgets"); }} className={menuItemClass}>
                <LayoutGrid className="w-3.5 h-3.5" /> Widgets
              </button>
              <button onClick={() => { closeAll(); navigate("/billing"); }} className={menuItemClass}>
                <CreditCard className="w-3.5 h-3.5" /> Faturamento
              </button>
              <div className="pt-1 mt-1 border-t border-foreground/5">
                <button onClick={() => { closeAll(); signOut(); }} className="flex items-center gap-2.5 w-full text-left text-xs text-destructive/70 hover:text-destructive py-2 px-2.5 rounded-lg hover:bg-destructive/5 transition-colors">
                  <LogOut className="w-3.5 h-3.5" /> Sair
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

    </>
  );
});

HeaderActions.displayName = "HeaderActions";

export default React.memo(HeaderActions);

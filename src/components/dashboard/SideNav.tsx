import React, { useSyncExternalStore } from "react";

import { Home, Search, CalendarDays, Settings, Shield, Mail, MessageSquare, FolderOpen, StickyNote, ListTodo, Users, Wallet, Sparkles, MoreHorizontal, Bell, Inbox, BarChart3, Zap, Palette, Share2, Building2, Plug2 } from "lucide-react";
import DeshTooltip from "@/components/ui/DeshTooltip";
import deshIcon from "@/assets/desh-logo-icon.png";
import { APP_VERSION } from "@/constants/app";
import { useNavigate, useLocation } from "react-router-dom";
import { useAdminRole } from "@/hooks/admin/useAdminRole";
import { useCallback, useMemo, useState, useRef } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform, useAnimation, PanInfo } from "framer-motion";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useDashboardState } from "@/contexts/DashboardContext";
import { usePlatformIntegrationsContext } from "@/contexts/PlatformIntegrationsContext";
import { getEmailUnreadCount, subscribeEmailUnread } from "@/stores/emailUnreadStore";
import { getCalendarTodayCount, subscribeCalendarToday } from "@/stores/calendarTodayStore";

const routeImports: Record<string, () => Promise<unknown>> = {
  "/": () => import("@/pages/Index"),
  "/search": () => import("@/pages/SearchPage"),
  "/inbox": () => import("@/pages/InboxPage"),
  "/notifications": () => import("@/pages/NotificationsPage"),
  "/calendar": () => import("@/pages/CalendarPage"),
  "/email": () => import("@/pages/EmailPage"),
  "/messages": () => import("@/pages/MessagesPage"),
  "/files": () => import("@/pages/FilesPage"),
  "/notes": () => import("@/pages/NotesPage"),
  "/tasks": () => import("@/pages/TasksPage"),
  "/contacts": () => import("@/pages/ContactsPage"),
  "/finances": () => import("@/pages/FinancesPage"),
  "/ai": () => import("@/pages/AIPage"),
  "/automations": () => import("@/pages/AutomationsPage"),
  "/social": () => import("@/pages/SocialPage"),
  "/whatsapp-business": () => import("@/pages/WhatsappBusinessPage"),
  "/billing": () => import("@/pages/BillingPage"),
  "/connections": () => import("@/pages/IntegrationsPage"),
  "/integrations": () => import("@/pages/IntegrationsPage"),
  "/settings": () => import("@/pages/SettingsPage"),
  "/profile": () => import("@/pages/ProfilePage"),
  "/admin": () => import("@/pages/AdminPage"),
};

const prefetched = new Set<string>();

interface NavItem {
  icon: any;
  label: string;
  path: string;
  shortcut?: string;
  /** Integration IDs — visible if ANY is enabled. Omit = always visible */
  integrations?: string[];
}

const navGroups: Array<{ items: NavItem[] }> = [
  {
    items: [
      { icon: Home, label: "Início", path: "/" },
      { icon: Inbox, label: "Inbox", path: "/inbox" },
      { icon: Search, label: "Buscar", path: "/search", shortcut: "⌘K" },
      { icon: CalendarDays, label: "Calendário", path: "/calendar", shortcut: "⌘⇧C" },
    ],
  },
  {
    items: [
      { icon: Mail, label: "E-mail", path: "/email", integrations: ["google"] },
      { icon: MessageSquare, label: "Mensagens", path: "/messages", integrations: ["whatsapp"] },
      // { icon: Building2, label: "WA Business", path: "/whatsapp-business" }, // Hidden until launch
    ],
  },
  {
    items: [
      { icon: FolderOpen, label: "Arquivos", path: "/files", integrations: ["google"] },
      { icon: StickyNote, label: "Notas", path: "/notes" },
      { icon: ListTodo, label: "Tarefas", path: "/tasks" },
      { icon: Users, label: "Contatos", path: "/contacts", integrations: ["google"] },
    ],
  },
  {
    items: [
      { icon: Wallet, label: "Financeiro", path: "/finances", integrations: ["pluggy"] },
      { icon: Share2, label: "Social", path: "/social" },
      { icon: Sparkles, label: "IA", path: "/ai" },
      { icon: Zap, label: "Automações", path: "/automations" },
    ],
  },
  {
    items: [
      { icon: Plug2, label: "Integrações", path: "/integrations" },
      { icon: Settings, label: "Config", path: "/settings" },
    ],
  },
];

// Mobile bottom bar: 5 primary items
const mobileItems: NavItem[] = [
  { icon: Home, label: "Início", path: "/" },
  { icon: Mail, label: "E-mail", path: "/email", integrations: ["google"] },
  { icon: MessageSquare, label: "Mensagens", path: "/messages", integrations: ["whatsapp"] },
  { icon: CalendarDays, label: "Calendário", path: "/calendar" },
  { icon: Wallet, label: "Financeiro", path: "/finances", integrations: ["pluggy"] },
];

const SideNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAdminRole();
  const [showMore, setShowMore] = useState(false);
  const { unreadCount } = useNotifications();
  const state = useDashboardState();
  const { isIntegrationEnabled } = usePlatformIntegrationsContext();
  
  const emailUnreadCount = useSyncExternalStore(subscribeEmailUnread, getEmailUnreadCount);
  const calendarTodayCount = useSyncExternalStore(subscribeCalendarToday, getCalendarTodayCount);
  const dragY = useMotionValue(0);
  const drawerControls = useAnimation();
  const drawerBg = useTransform(dragY, [0, 300], [1, 0]);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    if (info.offset.y > 80 || info.velocity.y > 300) {
      setShowMore(false);
    } else {
      drawerControls.start({ y: 0 });
    }
    dragY.set(0);
  }, [drawerControls, dragY]);

  const inboxCount = useMemo(() => {
    const pendingTasks = state.tasks.filter(t => !t.done).length;
    const now = new Date();
    const upcomingEvents = state.events.filter(e => {
      const eventDate = new Date(e.year, e.month, e.day);
      const diffDays = Math.floor((eventDate.getTime() - now.getTime()) / 86400000);
      return diffDays >= -1 && diffDays <= 7;
    }).length;
    return pendingTasks + upcomingEvents + unreadCount;
  }, [state.tasks, state.events, unreadCount]);

  const isItemVisible = useCallback((item: NavItem) => {
    if (!item.integrations) return true;
    return item.integrations.some(id => isIntegrationEnabled(id));
  }, [isIntegrationEnabled]);

  const filteredNavGroups = useMemo(() => 
    navGroups
      .map(g => ({ items: g.items.filter(isItemVisible) }))
      .filter(g => g.items.length > 0),
    [isItemVisible]
  );

  const filteredMobileItems = useMemo(() => mobileItems.filter(isItemVisible), [isItemVisible]);

  const allNavItems = useMemo(() => filteredNavGroups.flatMap(g => g.items), [filteredNavGroups]);
  const mobileMoreItems = useMemo(() => allNavItems.filter(item => !filteredMobileItems.some(m => m.path === item.path)), [allNavItems, filteredMobileItems]);

  const adminItem: NavItem = { icon: Shield, label: "Admin", path: "/admin" };

  const isActive = (path: string) => location.pathname === path;

  const handlePrefetch = useCallback((path: string) => {
    if (prefetched.has(path) || !routeImports[path]) return;
    prefetched.add(path);
    routeImports[path]();
  }, []);

  return (
    <>
      {/* Desktop: floating icon sidebar */}
      <nav className="hidden md:flex flex-col items-center py-8 px-1.5 gap-3 w-[72px] min-h-screen ml-3 z-[250] relative">
        <img src={deshIcon} alt="DESH" className="w-9 h-9 mb-2 opacity-80 cursor-pointer hover:opacity-100 transition-opacity" onClick={() => navigate("/dashboard")} />
        <div className="flex flex-col items-center gap-0.5 glass-card py-4 px-1.5 rounded-2xl">
          {filteredNavGroups.map((group, gi) => (
            <div key={`nav-group-${gi}`}>
              {gi > 0 && <div className="w-6 h-px bg-foreground/10 mx-auto my-1.5" />}
              {group.items.map((item) => (
                <DeshTooltip key={item.path} label={item.shortcut ? `${item.label} (${item.shortcut})` : item.label} side="right">
                  <button
                    onClick={() => navigate(item.path)}
                    onMouseEnter={() => handlePrefetch(item.path)}
                  className={`focusable relative w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                    isActive(item.path)
                      ? "bg-primary/15 text-primary backdrop-blur-sm"
                      : "text-foreground/50 hover:text-foreground/70 hover:bg-foreground/5"
                  }`}
                  >
                    <item.icon className="w-[18px] h-[18px]" strokeWidth={isActive(item.path) ? 2.2 : 1.8} />
                    {item.path === "/inbox" && inboxCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                        {inboxCount > 99 ? "99+" : inboxCount}
                      </span>
                    )}
                    {item.path === "/email" && emailUnreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                        {emailUnreadCount > 99 ? "99+" : emailUnreadCount}
                      </span>
                    )}
                    {item.path === "/calendar" && calendarTodayCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                        {calendarTodayCount}
                      </span>
                    )}
                  </button>
                </DeshTooltip>
              ))}
            </div>
          ))}
          {isAdmin && (
            <>
              <div className="w-6 h-px bg-foreground/10 mx-auto my-1.5" />
              <DeshTooltip label="Admin" side="right">
                <button
                  onClick={() => navigate(adminItem.path)}
                  onMouseEnter={() => handlePrefetch(adminItem.path)}
                  className={`focusable w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                    isActive(adminItem.path)
                      ? "bg-primary/15 text-primary backdrop-blur-sm"
                      : "text-foreground/50 hover:text-foreground/70 hover:bg-foreground/5"
                  }`}
                >
                  <adminItem.icon className="w-[18px] h-[18px]" strokeWidth={isActive(adminItem.path) ? 2.2 : 1.8} />
                </button>
              </DeshTooltip>
            </>
          )}
        </div>
        <p className="text-[9px] text-foreground/20 text-center mt-2 select-none">V {APP_VERSION}</p>
      </nav>

      {/* Mobile: bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-card border-t border-foreground/5 backdrop-blur-xl will-change-transform [backface-visibility:hidden] no-select" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0.5rem)' }}>
        <div className="flex items-center justify-around py-1.5 px-1">
          {filteredMobileItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              onTouchStart={() => handlePrefetch(item.path)}
              className={`focusable relative flex flex-col items-center gap-0.5 p-2 rounded-xl transition-all press-scale touch-target ${
                isActive(item.path) ? "text-foreground bg-foreground/8" : "text-foreground/40"
              }`}
            >
              <item.icon className="w-5 h-5" strokeWidth={isActive(item.path) ? 2.2 : 1.8} />
              <span className="text-[9px] font-medium leading-tight">{item.label}</span>
              {item.path === "/email" && emailUnreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center">
                  {emailUnreadCount > 99 ? "99+" : emailUnreadCount}
                </span>
              )}
              {item.path === "/calendar" && calendarTodayCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center">
                  {calendarTodayCount}
                </span>
              )}
              {isActive(item.path) && (
                <motion.div layoutId="nav-indicator" className="absolute bottom-0.5 w-6 h-[3px] rounded-full bg-primary" />
              )}
            </button>
          ))}
          {/* More button */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={`flex flex-col items-center gap-0.5 p-2 rounded-xl transition-all press-scale touch-target ${showMore ? "text-foreground" : "text-foreground/40"}`}
          >
            <MoreHorizontal className="w-5 h-5" strokeWidth={1.8} />
            <span className="text-[9px] font-medium leading-tight">Mais</span>
          </button>
        </div>
      </nav>

      {/* Mobile: More menu drawer */}
      <AnimatePresence>
        {showMore && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowMore(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={handleDragEnd}
              style={{ y: dragY }}
              className="absolute bottom-0 left-0 right-0 glass-card rounded-t-2xl safe-area-bottom touch-none"
              onClick={e => e.stopPropagation()}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
                <div className="w-10 h-1 rounded-full bg-foreground/20" />
              </div>

              <div className="px-4 pb-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3 px-1">Mais opções</p>
                <div className="grid grid-cols-4 gap-2">
                  {mobileMoreItems.map(item => (
                    <button
                      key={item.path}
                      onClick={() => { navigate(item.path); setShowMore(false); }}
                      className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors press-scale ${
                        isActive(item.path) ? "bg-foreground/10 text-foreground" : "text-foreground/50 hover:text-foreground active:bg-foreground/5"
                      }`}
                    >
                      <item.icon className="w-5 h-5" strokeWidth={1.8} />
                      <span className="text-[9px] font-medium">{item.label}</span>
                      {item.path === "/inbox" && inboxCount > 0 && (
                        <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                          {inboxCount > 99 ? "99+" : inboxCount}
                        </span>
                      )}
                    </button>
                  ))}
                  {isAdmin && (
                    <button
                      onClick={() => { navigate(adminItem.path); setShowMore(false); }}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors press-scale ${
                        isActive(adminItem.path) ? "bg-foreground/10 text-foreground" : "text-foreground/50 hover:text-foreground active:bg-foreground/5"
                      }`}
                    >
                      <Shield className="w-5 h-5" strokeWidth={1.8} />
                      <span className="text-[9px] font-medium">Admin</span>
                    </button>
                  )}
                </div>

                {/* Keyboard shortcuts hint */}
                <div className="mt-4 pt-3 border-t border-foreground/10">
                  <p className="text-[10px] text-muted-foreground text-center">
                    Dica: Use <kbd className="px-1 py-0.5 rounded bg-foreground/10 text-foreground/60 font-mono text-[9px]">Ctrl+K</kbd> para buscar
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default React.memo(SideNav);

import { useState, useMemo, useCallback, useEffect, useRef, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import PageLayout from "@/components/dashboard/PageLayout";
import PageHeader from "@/components/dashboard/PageHeader";
import { useDashboard } from "@/contexts/DashboardContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useGmailSync } from "@/hooks/email/useGmailSync";
import { useWhatsappConversations } from "@/hooks/whatsapp/useWhatsappConversations";
import { useInboxAI, type SmartGroup } from "@/hooks/common/useInboxAI";
import { useInboxAutomation } from "@/hooks/common/useInboxAutomation";
import InboxItemCard, { type InboxItem } from "@/components/inbox/InboxItemCard";
import InboxSummaryCards from "@/components/inbox/InboxSummaryCards";
import { AnimatePresence } from "framer-motion";
import {
  Inbox, ListTodo, CalendarDays, Bell, Mail, Search, X,
  MessageCircle, Brain, EyeOff, AlertTriangle, Sparkles, Timer,
  RefreshCw, CheckCircle2, Loader2,
} from "lucide-react";
import { isPast, isToday, isTomorrow, differenceInDays } from "date-fns";
import { toast } from "@/hooks/use-toast";

const InboxAIPanel = lazy(() => import("@/components/inbox/InboxAIPanel"));
const InboxBatchBar = lazy(() => import("@/components/inbox/InboxBatchBar"));
const InboxNoticesSection = lazy(() => import("@/components/inbox/InboxNoticesSection"));

// ── Types ────────────────────────────────────────────────────────────────────
type MainFilter = "all" | "tasks" | "events" | "emails" | "whatsapp" | "notices";
type NoticeFilter = "all" | "info" | "warning" | "success";

const MAIN_FILTERS: { key: MainFilter; label: string; icon: React.ElementType }[] = [
  { key: "all",      label: "Todos",     icon: Inbox },
  { key: "tasks",    label: "Tarefas",   icon: ListTodo },
  { key: "events",   label: "Eventos",   icon: CalendarDays },
  { key: "emails",   label: "E-mails",   icon: Mail },
  { key: "whatsapp", label: "WhatsApp",  icon: MessageCircle },
  { key: "notices",  label: "Avisos",    icon: Bell },
];

// ── Page ─────────────────────────────────────────────────────────────────────
const InboxPage = () => {
  const { state, toggleTask } = useDashboard();
  const { broadcasts, visible, dismissed, dismiss, undismiss, dismissAll, loading } = useNotifications();
  const { cachedEmails } = useGmailSync();
  const { conversations: waConversations } = useWhatsappConversations();
  const navigate = useNavigate();

  const [mainFilter, setMainFilter] = useState<MainFilter>("all");
  const [noticeFilter, setNoticeFilter] = useState<NoticeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusIndex, setFocusIndex] = useState(-1);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [activeGroupFilter, setActiveGroupFilter] = useState<SmartGroup | null>(null);
  const [snoozeMenuId, setSnoozeMenuId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Stable ref for toggleTask to avoid re-computing items
  const toggleTaskRef = useRef(toggleTask);
  toggleTaskRef.current = toggleTask;

  const { analysis, loading: aiLoading, analyzeInbox, clearAnalysis, quickReplies, quickReplyLoading, getQuickReplies } = useInboxAI();
  const {
    snoozedItems, snoozeItem, unsnoozeItem,
    autoAnalyzed, markAutoAnalyzed,
    focusMode, toggleFocusMode,
    focusItemIds, setFocusItems,
    logInboxActivity,
  } = useInboxAutomation();

  // ── Build items (stable — no toggleTask in deps) ──────────────────────────
  const items = useMemo<InboxItem[]>(() => {
    const result: InboxItem[] = [];
    const now = new Date();

    for (const t of state.tasks) {
      if (t.done) continue;
      const p = t.priority === "high" ? 1 : t.priority === "low" ? 3 : 2;
      const dueDate = (t as any).due_date ? new Date((t as any).due_date) : null;
      const overdue = dueDate ? isPast(dueDate) && !isToday(dueDate) : false;

      let subtitle = "";
      if (dueDate) {
        if (isToday(dueDate)) subtitle = "Vence hoje";
        else if (isTomorrow(dueDate)) subtitle = "Vence amanhã";
        else if (overdue) subtitle = "Atrasado";
        else {
          const days = differenceInDays(dueDate, now);
          subtitle = `Vence em ${days} dia(s)`;
        }
      } else if (t.priority) {
        subtitle = `Prioridade ${t.priority === "high" ? "alta" : t.priority === "low" ? "baixa" : "média"}`;
      }

      const taskId = t.id;
      result.push({
        id: `task-${taskId}`, type: "task", title: t.text,
        subtitle, priority: overdue ? 0 : p, overdue,
        timestamp: t.created_at || now.toISOString(),
        navigateTo: "/tasks",
        onAction: () => toggleTaskRef.current(taskId),
        actionLabel: "Concluir",
      });
    }

    for (const e of state.events) {
      const eventDate = new Date(e.year, e.month, e.day);
      const diffDays = Math.floor((eventDate.getTime() - now.getTime()) / 86400000);
      if (diffDays < -1 || diffDays > 7) continue;
      const today = diffDays >= -1 && diffDays <= 0;
      result.push({
        id: `event-${e.id}`, type: "event", title: e.label,
        subtitle: today ? "Hoje" : isTomorrow(eventDate) ? "Amanhã" : `Em ${diffDays} dia(s)`,
        priority: today ? 1 : 2, timestamp: eventDate.toISOString(),
        navigateTo: "/calendar",
      });
    }

    const unreadEmails = cachedEmails.filter(e => e.unread).slice(0, 15);
    for (const e of unreadEmails) {
      result.push({
        id: `email-${e.gmail_id}`, type: "email", title: e.subject || "Sem assunto",
        subtitle: `${e.from} — ${e.body?.slice(0, 60) || ""}`,
        priority: 2, timestamp: e.date || now.toISOString(),
        navigateTo: `/email?id=${e.gmail_id}`,
      });
    }

    const unreadWa = waConversations.filter(c => c.unreadCount > 0).slice(0, 15);
    for (const c of unreadWa) {
      result.push({
        id: `wa-${c.id}`, type: "whatsapp",
        title: c.title || c.externalContactId,
        subtitle: `${c.unreadCount} mensagem(ns) não lida(s)`,
        priority: 2, timestamp: c.lastMessageAt,
        navigateTo: `/messages?conversation=${c.id}`,
      });
    }

    result.sort((a, b) => a.priority - b.priority || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return result;
  }, [state.tasks, state.events, cachedEmails, waConversations]);

  // ── Build item lookup map for O(1) access ─────────────────────────────────
  const itemMap = useMemo(() => {
    const map = new Map<string, InboxItem>();
    for (const item of items) map.set(item.id, item);
    return map;
  }, [items]);

  // ── Filtering pipeline (all memoized) ─────────────────────────────────────
  const activeItems = useMemo(() => items.filter(i => !snoozedItems.has(i.id)), [items, snoozedItems]);

  const aiEnhancedItems = useMemo(() => {
    if (!analysis?.priorityOverrides?.length) return activeItems;
    const overrideMap = new Map(analysis.priorityOverrides.map(o => [o.itemId, o]));
    return activeItems.map(item => {
      const override = overrideMap.get(item.id);
      if (override) return { ...item, priority: override.newPriority };
      return item;
    }).sort((a, b) => a.priority - b.priority || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activeItems, analysis]);

  const searchedItems = useMemo(() => {
    if (!searchQuery.trim()) return aiEnhancedItems;
    const q = searchQuery.toLowerCase();
    return aiEnhancedItems.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.subtitle?.toLowerCase().includes(q) ||
      i.type.includes(q)
    );
  }, [aiEnhancedItems, searchQuery]);

  const filteredNotices = useMemo(
    () => broadcasts.filter(b => noticeFilter === "all" || b.type === noticeFilter),
    [broadcasts, noticeFilter]
  );
  const searchedNotices = useMemo(() => {
    if (!searchQuery.trim()) return filteredNotices;
    const q = searchQuery.toLowerCase();
    return filteredNotices.filter(b =>
      b.title.toLowerCase().includes(q) || b.message.toLowerCase().includes(q)
    );
  }, [filteredNotices, searchQuery]);
  const newNotices = useMemo(() => searchedNotices.filter(b => visible.some(v => v.id === b.id)), [searchedNotices, visible]);
  const oldNotices = useMemo(() => searchedNotices.filter(b => dismissed.some(d => d.id === b.id)), [searchedNotices, dismissed]);

  const filteredItems = useMemo(() => {
    let result = mainFilter === "all"
      ? searchedItems
      : mainFilter === "notices" ? []
      : searchedItems.filter(i => i.type === (
          mainFilter === "tasks" ? "task" :
          mainFilter === "events" ? "event" :
          mainFilter === "whatsapp" ? "whatsapp" : "email"
        ));

    if (activeGroupFilter) {
      const groupIds = new Set(activeGroupFilter.itemIds);
      result = result.filter(i => groupIds.has(i.id));
    }

    if (focusMode) {
      result = result.filter(i =>
        i.overdue || i.priority <= 1 || focusItemIds.has(i.id)
      );
    }

    return result;
  }, [searchedItems, mainFilter, activeGroupFilter, focusMode, focusItemIds]);

  const counts = useMemo(() => ({
    all: activeItems.length + visible.length,
    tasks: activeItems.filter(i => i.type === "task").length,
    events: activeItems.filter(i => i.type === "event").length,
    emails: activeItems.filter(i => i.type === "email").length,
    whatsapp: activeItems.filter(i => i.type === "whatsapp").length,
    notices: visible.length,
  }), [activeItems, visible]);

  const showingNotices = mainFilter === "notices" || mainFilter === "all";
  const showingItems = mainFilter !== "notices";
  const overdueItems = useMemo(() => filteredItems.filter(i => i.overdue), [filteredItems]);
  const highItems = useMemo(() => filteredItems.filter(i => !i.overdue && i.priority <= 1), [filteredItems]);
  const normalItems = useMemo(() => filteredItems.filter(i => !i.overdue && i.priority > 1), [filteredItems]);

  // ── Auto-analyze (only once per session via ref) ──────────────────────────
  const hasAutoAnalyzedRef = useRef(false);
  useEffect(() => {
    if (hasAutoAnalyzedRef.current || autoAnalyzed || aiLoading || analysis) return;
    if (activeItems.length < 3) return;
    hasAutoAnalyzedRef.current = true;
    markAutoAnalyzed();
    setShowAIPanel(true);
    analyzeInbox(activeItems.map(i => ({
      id: i.id, type: i.type, title: i.title,
      subtitle: i.subtitle, priority: i.priority,
      timestamp: i.timestamp, overdue: i.overdue,
    })));
    logInboxActivity("auto_analyze", { item_count: activeItems.length });
  }, [activeItems.length, autoAnalyzed, aiLoading, analysis, markAutoAnalyzed, analyzeInbox, logInboxActivity]);

  useEffect(() => {
    if (analysis?.priorityOverrides) {
      const focusIds = analysis.priorityOverrides
        .filter(po => po.newPriority <= 1)
        .map(po => po.itemId);
      setFocusItems(focusIds);
    }
  }, [analysis, setFocusItems]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleItemClick = useCallback((item: InboxItem) => {
    logInboxActivity("item_click", { item_id: item.id, type: item.type });
    if (item.navigateTo) navigate(item.navigateTo);
  }, [navigate, logInboxActivity]);

  const toggleSelect = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => setSelectedIds(new Set(filteredItems.map(i => i.id))), [filteredItems]);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const batchComplete = useCallback(() => {
    let completed = 0;
    for (const id of selectedIds) {
      const item = itemMap.get(id);
      if (item?.onAction) { item.onAction(); completed++; }
    }
    if (completed > 0) {
      toast({ title: `${completed} tarefa(s) concluída(s)` });
      logInboxActivity("batch_complete", { count: completed });
    }
    setSelectedIds(new Set());
  }, [selectedIds, itemMap, logInboxActivity]);

  const batchSnooze = useCallback((minutes: number) => {
    for (const id of selectedIds) {
      const item = itemMap.get(id);
      if (item) snoozeItem(id, item.title, minutes);
    }
    logInboxActivity("batch_snooze", { count: selectedIds.size, minutes });
    setSelectedIds(new Set());
  }, [selectedIds, itemMap, snoozeItem, logInboxActivity]);

  const handleAnalyze = useCallback(() => {
    analyzeInbox(activeItems.map(i => ({ id: i.id, type: i.type, title: i.title, subtitle: i.subtitle, priority: i.priority, timestamp: i.timestamp, overdue: i.overdue })));
  }, [activeItems, analyzeInbox]);

  const handleGroupClick = useCallback((group: SmartGroup) => {
    setActiveGroupFilter(prev => prev?.label === group.label ? null : group);
  }, []);

  const handleAIActionClick = useCallback((itemId: string, actionType: string) => {
    const item = itemMap.get(itemId);
    if (!item) {
      toast({ title: "Item não encontrado", description: "Este item pode já ter sido concluído ou removido.", variant: "destructive" });
      return;
    }
    switch (actionType) {
      case "complete":
        if (item.onAction) {
          item.onAction();
          toast({ title: "Tarefa concluída via IA ✅" });
        } else {
          toast({ title: "Este item não suporta conclusão direta" });
        }
        break;
      case "navigate":
      case "reply":
        if (item.navigateTo) navigate(item.navigateTo);
        break;
      case "defer":
        snoozeItem(item.id, item.title, 60);
        break;
      case "delegate":
        if (item.navigateTo) navigate(item.navigateTo);
        toast({ title: "Aberto para delegação", description: "Redirecione ou encaminhe este item" });
        break;
      default:
        if (item.navigateTo) navigate(item.navigateTo);
    }
    logInboxActivity("ai_action", { item_id: itemId, action: actionType });
  }, [itemMap, navigate, snoozeItem, logInboxActivity]);

  const handleQuickReplySelect = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Resposta copiada!", description: text });
  }, []);

  const handleSnooze = useCallback((id: string, title: string, minutes: number) => {
    snoozeItem(id, title, minutes);
    setSnoozeMenuId(null);
    logInboxActivity("snooze", { item_id: id, minutes });
  }, [snoozeItem, logInboxActivity]);

  const getTriageLabel = useCallback((itemId: string) => {
    if (!analysis?.autoTriageLabels) return null;
    return analysis.autoTriageLabels.find(t => t.itemId === itemId);
  }, [analysis]);

  // ── Keyboard (stable deps via refs) ──────────────────────────────────────
  const filteredItemsRef = useRef(filteredItems);
  filteredItemsRef.current = filteredItems;
  const focusIndexRef = useRef(focusIndex);
  focusIndexRef.current = focusIndex;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (document.activeElement?.tagName === "INPUT") return;

      const currentItems = filteredItemsRef.current;
      const currentFocus = focusIndexRef.current;

      if (e.key === "x" && currentFocus >= 0 && currentFocus < currentItems.length) {
        e.preventDefault();
        const item = currentItems[currentFocus];
        setSelectedIds(prev => {
          const next = new Set(prev);
          if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
          return next;
        });
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIndex(prev => Math.min(prev + 1, currentItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && currentFocus >= 0 && currentFocus < currentItems.length) {
        handleItemClick(currentItems[currentFocus]);
      } else if (e.key === "Escape") {
        setSearchQuery("");
        searchRef.current?.blur();
        setSelectedIds(new Set());
        setFocusIndex(-1);
        setActiveGroupFilter(null);
        setSnoozeMenuId(null);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleItemClick]); // stable — only depends on navigate + logInboxActivity

  useEffect(() => { setFocusIndex(-1); }, [mainFilter, searchQuery]);

  const hasAnyTaskSelected = useMemo(
    () => [...selectedIds].some(id => itemMap.get(id)?.onAction),
    [selectedIds, itemMap]
  );

  const itemTitleMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of items) map[item.id] = item.title;
    return map;
  }, [items]);

  const overdueTasks = useMemo(() => activeItems.filter(i => i.overdue).length, [activeItems]);
  const todayEvents = useMemo(() => activeItems.filter(i => i.type === "event" && i.subtitle === "Hoje").length, [activeItems]);
  const snoozedCount = snoozedItems.size;

  // ── Precomputed index map for O(1) focus lookup ─────────────────────────
  const filteredIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    filteredItems.forEach((item, i) => map.set(item.id, i));
    return map;
  }, [filteredItems]);

  // ── Stable snooze toggle callback ─────────────────────────────────────
  const handleSnoozeToggle = useCallback((id: string) => {
    setSnoozeMenuId(prev => prev === id ? null : id);
  }, []);

  // ── Stable quick reply generate callback ──────────────────────────────
  const handleQuickReplyGenerate = useCallback((itm: InboxItem) => {
    getQuickReplies({
      id: itm.id, type: itm.type, title: itm.title,
      subtitle: itm.subtitle, priority: itm.priority,
      timestamp: itm.timestamp, overdue: itm.overdue,
    });
  }, [getQuickReplies]);

  // ── Render helpers ───────────────────────────────────────────────────────
  const renderItemGroup = useCallback((label: string, groupItems: InboxItem[], icon?: React.ReactNode) => {
    if (groupItems.length === 0) return null;
    return (
      <div className="mb-4">
        <div className="flex items-center gap-1.5 px-1 mb-2">
          {icon}
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <span className="text-[9px] text-muted-foreground/60 ml-1">({groupItems.length})</span>
        </div>
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {groupItems.map((item, i) => {
              const globalIndex = filteredIndexMap.get(item.id) ?? -1;
              const isEmailOrWa = item.type === "email" || item.type === "whatsapp";
              return (
                <InboxItemCard
                  key={item.id}
                  item={item}
                  index={i}
                  isFocused={globalIndex === focusIndex}
                  isSelected={selectedIds.has(item.id)}
                  triageLabel={getTriageLabel(item.id)}
                  showSnoozeMenu={snoozeMenuId === item.id}
                  showQuickReplies={isEmailOrWa && (quickReplies[item.id]?.length > 0 || quickReplyLoading === item.id)}
                  quickReplies={quickReplies[item.id] || []}
                  quickReplyLoading={quickReplyLoading === item.id}
                  onItemClick={handleItemClick}
                  onToggleSelect={toggleSelect}
                  onSnoozeToggle={handleSnoozeToggle}
                  onSnooze={handleSnooze}
                  onQuickReplySelect={handleQuickReplySelect}
                  onQuickReplyGenerate={handleQuickReplyGenerate}
                />
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    );
  }, [filteredIndexMap, focusIndex, selectedIds, snoozeMenuId, quickReplies, quickReplyLoading,
      getTriageLabel, handleItemClick, toggleSelect, handleSnoozeToggle, handleSnooze, handleQuickReplySelect, handleQuickReplyGenerate]);

  return (
    <PageLayout maxWidth="full">
      <PageHeader
        title="Inbox"
        icon={<Inbox className="w-6 h-6 text-primary drop-shadow" />}
        subtitle={`${counts.all} item(ns) pendente(s)${focusMode ? " · Modo Foco" : ""}`}
        actions={
          <div className="flex items-center gap-1.5">
            {focusMode && (
              <button
                onClick={toggleFocusMode}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-medium bg-primary text-primary-foreground"
              >
                <EyeOff className="w-3 h-3" /> Sair do Foco
              </button>
            )}
            <button
              onClick={() => {
                setShowAIPanel(!showAIPanel);
                if (!showAIPanel && !analysis && !aiLoading && activeItems.length > 0) {
                  handleAnalyze();
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all press-scale ${
                showAIPanel || analysis
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "glass-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              {aiLoading ? "Analisando..." : "IA"}
            </button>
          </div>
        }
      />

      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          ref={searchRef}
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar no inbox... (Ctrl+K)"
          className="w-full pl-9 pr-8 py-2.5 rounded-xl glass-card bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 ring-primary/30 transition-all"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* AI Panel */}
      <AnimatePresence>
        {showAIPanel && (
          <Suspense fallback={<div className="flex items-center justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>}>
            <InboxAIPanel
              analysis={analysis}
              loading={aiLoading}
              onClose={() => { setShowAIPanel(false); setActiveGroupFilter(null); }}
              onAnalyze={handleAnalyze}
              onGroupClick={handleGroupClick}
              onActionClick={handleAIActionClick}
              focusMode={focusMode}
              onToggleFocusMode={toggleFocusMode}
              itemTitleMap={itemTitleMap}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Active group filter */}
      {activeGroupFilter && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl glass-card border border-primary/20">
          <span className="text-sm">{activeGroupFilter.icon}</span>
          <span className="text-xs font-medium text-foreground">{activeGroupFilter.label}</span>
          <span className="text-[10px] text-muted-foreground">— {activeGroupFilter.reason}</span>
          <button onClick={() => setActiveGroupFilter(null)} className="ml-auto text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Snoozed items indicator */}
      {snoozedCount > 0 && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl glass-card border border-foreground/10">
          <Timer className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{snoozedCount} item(ns) adiado(s)</span>
          <div className="flex items-center gap-1 ml-auto">
            {[...snoozedItems.values()].slice(0, 3).map(si => (
              <button
                key={si.id}
                onClick={() => unsnoozeItem(si.id)}
                className="px-2 py-0.5 rounded-lg text-[10px] text-foreground/60 hover:text-foreground glass-card hover:bg-foreground/5 transition-colors truncate max-w-[120px]"
                title={`Restaurar: ${si.title}`}
              >
                {si.title.slice(0, 20)}…
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Batch action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <Suspense fallback={null}>
            <InboxBatchBar
              selectedCount={selectedIds.size}
              totalCount={filteredItems.length}
              hasTaskSelected={hasAnyTaskSelected}
              onBatchComplete={batchComplete}
              onBatchSnooze={batchSnooze}
              onBatchDismiss={() => {
                for (const id of selectedIds) {
                  const item = itemMap.get(id);
                  if (item) snoozeItem(id, item.title, 1440 * 365);
                }
                toast({ title: `${selectedIds.size} item(ns) arquivado(s)` });
                logInboxActivity("batch_archive", { count: selectedIds.size });
                setSelectedIds(new Set());
              }}
              onSelectAll={selectAll}
              onClear={clearSelection}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Quick summary cards */}
      <InboxSummaryCards
        overdueTasks={overdueTasks}
        todayEvents={todayEvents}
        unreadEmails={counts.emails}
        unreadWhatsapp={counts.whatsapp}
        snoozedCount={snoozedCount}
        onFilterChange={setMainFilter}
      />

      {/* Main filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 no-scrollbar">
        {MAIN_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => { setMainFilter(f.key); setActiveGroupFilter(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all press-scale ${
              mainFilter === f.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "glass-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <f.icon className="w-3.5 h-3.5" />
            {f.label}
            {counts[f.key] > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                mainFilter === f.key ? "bg-primary-foreground/20 text-primary-foreground" : "bg-foreground/10"
              }`}>
                {counts[f.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search results indicator */}
      {searchQuery.trim() && (
        <p className="text-xs text-muted-foreground mb-3">
          {filteredItems.length + (showingNotices ? newNotices.length + oldNotices.length : 0)} resultado(s) para "{searchQuery}"
        </p>
      )}

      {/* Items */}
      {showingItems && (
        <div ref={listRef}>
          {mainFilter === "all" ? (
            <>
              {renderItemGroup("Atrasados", overdueItems, <AlertTriangle className="w-3 h-3 text-destructive" />)}
              {renderItemGroup("Prioridade alta", highItems, <Sparkles className="w-3 h-3 text-orange-500" />)}
              {renderItemGroup("Outros", normalItems)}
              {filteredItems.length === 0 && (
                <div className="text-center py-10">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500/30 mx-auto mb-2" />
                  <p className="text-foreground text-sm font-medium">
                    {searchQuery ? "Nenhum resultado encontrado" : focusMode ? "Nenhum item prioritário no momento 🎯" : "Inbox limpo! 🎉"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {searchQuery ? "Tente termos diferentes" : "Todas as tarefas e mensagens foram tratadas"}
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              {renderItemGroup(
                mainFilter === "tasks" ? "Tarefas pendentes" :
                mainFilter === "events" ? "Próximos eventos" :
                mainFilter === "whatsapp" ? "WhatsApp não lidos" :
                "E-mails não lidos",
                filteredItems,
              )}
              {filteredItems.length === 0 && (
                <div className="text-center py-10">
                  {mainFilter === "tasks" && <ListTodo className="w-10 h-10 text-primary/20 mx-auto mb-2" />}
                  {mainFilter === "events" && <CalendarDays className="w-10 h-10 text-emerald-500/20 mx-auto mb-2" />}
                  {mainFilter === "emails" && <Mail className="w-10 h-10 text-sky-500/20 mx-auto mb-2" />}
                  {mainFilter === "whatsapp" && <MessageCircle className="w-10 h-10 text-green-500/20 mx-auto mb-2" />}
                  <p className="text-muted-foreground text-sm">
                    {searchQuery ? "Nenhum resultado encontrado" : focusMode ? "Nenhum item prioritário 🎯" : 
                      mainFilter === "tasks" ? "Nenhuma tarefa pendente" :
                      mainFilter === "events" ? "Nenhum evento próximo" :
                      mainFilter === "emails" ? "Nenhum e-mail não lido" :
                      "Nenhuma mensagem não lida"
                    }
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Notices */}
      {showingNotices && (
        <Suspense fallback={null}>
          <InboxNoticesSection
            newNotices={newNotices}
            oldNotices={oldNotices}
            loading={loading}
            noticeFilter={noticeFilter}
            onNoticeFilterChange={setNoticeFilter}
            onDismiss={dismiss}
            onDismissAll={dismissAll}
            onUndismiss={undismiss}
            isMainAll={mainFilter === "all"}
          />
        </Suspense>
      )}

      {/* Empty state */}
      {mainFilter === "all" && activeItems.length === 0 && visible.length === 0 && !loading && (
        <div className="text-center py-16">
          <Inbox className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Tudo em dia! 🎉</p>
          <p className="text-[10px] text-muted-foreground/50 mt-1">Use ↑↓ para navegar, X para selecionar, Ctrl+K para buscar</p>
        </div>
      )}
    </PageLayout>
  );
};

export default InboxPage;

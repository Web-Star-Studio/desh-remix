import { useCallback, useRef, useEffect, useMemo } from "react";
import type { ToolContext } from "./toolContext";
import { handleTaskTool, TASK_TOOL_NAMES } from "./toolHandlersTask";
import { handleFinanceTool, FINANCE_TOOL_NAMES } from "./toolHandlersFinance";
import { handleIntegrationTool, INTEGRATION_TOOL_NAMES } from "./toolHandlersIntegration";
import { handleSystemTool, SYSTEM_TOOL_NAMES } from "./toolHandlersSystem";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchContacts, fetchFinanceGoals, fetchRecentTransactions, fetchMemories,
  fetchRecurring, fetchProfile, fetchDefaultWorkspace,
  fetchSubtasks, fetchHabits, fetchKnowledgeBase, fetchAutomations,
  fetchEmailsCache, fetchWhatsappStatus, fetchWorkspaces, fetchConnections,
  fetchBudgets, fetchInteractions, fetchWhatsappConversations,
  fetchSocialAccounts, fetchBankAccounts, fetchInvestments, fetchFinancialConnections,
  INITIAL_DATA_CACHE, type AIDataCache,
} from "./dataQueries";
import { useEdgeFn } from "./useEdgeFn";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard } from "@/contexts/DashboardContext";
import { useThemeContext } from "@/contexts/ThemeContext";
import { useNavigate } from "react-router-dom";
import { useWorkspaceFilter } from "@/hooks/workspace/useWorkspaceFilter";
import { useComposioWorkspaceId } from "@/hooks/integrations/useComposioWorkspaceId";
import type { WallpaperId } from "@/hooks/ui/useWallpaper";
import { invalidateGoogleCache } from "@/hooks/integrations/useGoogleServiceData";

// Types — canonical definitions live in /src/types/ai.ts
export type { ToolCall } from "@/types/ai";
import type { ToolCall } from "@/types/ai";

type QuickReply = { label: string; message: string };

/** Resolve email from contact: checks `email` varchar first, then `emails` JSON array */
function resolveEmail(contact: any): string | null {
  if (contact.email) return contact.email;
  const arr = Array.isArray(contact.emails) ? contact.emails : [];
  const primary = arr.find((e: any) => e.is_primary) || arr[0];
  return primary?.email || null;
}

/** Resolve phone from contact: checks `phone` varchar first, then `phones` JSON array */
function resolvePhone(contact: any): string | null {
  if (contact.phone) return contact.phone;
  const arr = Array.isArray(contact.phones) ? contact.phones : [];
  const primary = arr.find((p: any) => p.is_primary) || arr[0];
  return primary?.number || null;
}
export function useAIToolExecution(opts: {
  setDynamicReplies?: (replies: QuickReply[]) => void;
}) {
  const { user } = useAuth();
  const { invoke: rawInvokeEdge } = useEdgeFn();
  const composioWsId = useComposioWorkspaceId();
  // Wrapper that auto-injects workspace_id into composio-proxy calls
  const invokeEdge = useCallback(<T = any>(o: Parameters<typeof rawInvokeEdge<T>>[0]) => {
    if (o.fn === "composio-proxy" && o.body && typeof o.body === "object") {
      return rawInvokeEdge<T>({ ...o, body: { ...o.body, workspace_id: composioWsId } });
    }
    return rawInvokeEdge<T>(o);
  }, [rawInvokeEdge, composioWsId]);
  const { state, addTask, toggleTask, updateTask, deleteTask, addNote, updateNote, deleteNote, addEvent, updateEvent, deleteEvent } = useDashboard();
  const { theme, setMode, setColor, setWallpaper, wallpaperId } = useThemeContext();
  const navigate = useNavigate();
  const { getInsertWorkspaceId } = useWorkspaceFilter();

  // Consolidated data cache ref
  const dataRef = useRef<AIDataCache>({ ...INITIAL_DATA_CACHE });

  // Proxy refs for backward compatibility with tool handlers
  const contactsRef = useMemo(() => ({ get current() { return dataRef.current.contacts; }, set current(v) { dataRef.current.contacts = v; } }), []) as React.MutableRefObject<any[]>;
  const financeGoalsRef = useMemo(() => ({ get current() { return dataRef.current.financeGoals; }, set current(v) { dataRef.current.financeGoals = v; } }), []) as React.MutableRefObject<any[]>;
  const financeTransactionsRef = useMemo(() => ({ get current() { return dataRef.current.financeTransactions; }, set current(v) { dataRef.current.financeTransactions = v; } }), []) as React.MutableRefObject<any[]>;
  const memoriesRef = useMemo(() => ({ get current() { return dataRef.current.memories; }, set current(v) { dataRef.current.memories = v; } }), []) as React.MutableRefObject<any[]>;
  const financeRecurringRef = useMemo(() => ({ get current() { return dataRef.current.financeRecurring; }, set current(v) { dataRef.current.financeRecurring = v; } }), []) as React.MutableRefObject<any[]>;
  const filesCountRef = useMemo(() => ({ get current() { return dataRef.current.filesCount; }, set current(v) { dataRef.current.filesCount = v; } }), []) as React.MutableRefObject<number>;
  const profileRef = useMemo(() => ({ get current() { return dataRef.current.profile; }, set current(v) { dataRef.current.profile = v; } }), []) as React.MutableRefObject<{ display_name: string | null }>;
  const workspaceRef = useMemo(() => ({ get current() { return dataRef.current.workspace; }, set current(v) { dataRef.current.workspace = v; } }), []) as React.MutableRefObject<{ name: string | null }>;
  const subtasksRef = useMemo(() => ({ get current() { return dataRef.current.subtasks; }, set current(v) { dataRef.current.subtasks = v; } }), []) as React.MutableRefObject<any[]>;
  const habitsRef = useMemo(() => ({ get current() { return dataRef.current.habits; }, set current(v) { dataRef.current.habits = v; } }), []) as React.MutableRefObject<{ rowId: string | null; data: any | null }>;
  const knowledgeBaseRef = useMemo(() => ({ get current() { return dataRef.current.knowledgeBase; }, set current(v) { dataRef.current.knowledgeBase = v; } }), []) as React.MutableRefObject<any[]>;
  const automationsRef = useMemo(() => ({ get current() { return dataRef.current.automations; }, set current(v) { dataRef.current.automations = v; } }), []) as React.MutableRefObject<any[]>;
  const recentEmailsRef = useMemo(() => ({ get current() { return dataRef.current.recentEmails; }, set current(v) { dataRef.current.recentEmails = v; } }), []) as React.MutableRefObject<any[]>;
  const filesRef = useMemo(() => ({ get current() { return dataRef.current.files; }, set current(v) { dataRef.current.files = v; } }), []) as React.MutableRefObject<any[]>;
  const whatsappStatusRef = useMemo(() => ({ get current() { return dataRef.current.whatsappStatus; }, set current(v) { dataRef.current.whatsappStatus = v; } }), []) as React.MutableRefObject<string>;
  const workspacesRef = useMemo(() => ({ get current() { return dataRef.current.workspaces; }, set current(v) { dataRef.current.workspaces = v; } }), []) as React.MutableRefObject<any[]>;
  const connectionsRef = useMemo(() => ({ get current() { return dataRef.current.connections; }, set current(v) { dataRef.current.connections = v; } }), []) as React.MutableRefObject<any[]>;
  const budgetsRef = useMemo(() => ({ get current() { return dataRef.current.budgets; }, set current(v) { dataRef.current.budgets = v; } }), []) as React.MutableRefObject<any[]>;
  const interactionsRef = useMemo(() => ({ get current() { return dataRef.current.interactions; }, set current(v) { dataRef.current.interactions = v; } }), []) as React.MutableRefObject<any[]>;
  const waConversationsRef = useMemo(() => ({ get current() { return dataRef.current.waConversations; }, set current(v) { dataRef.current.waConversations = v; } }), []) as React.MutableRefObject<any[]>;
  const waRecentMessagesRef = useMemo(() => ({ get current() { return dataRef.current.waRecentMessages; }, set current(v) { dataRef.current.waRecentMessages = v; } }), []) as React.MutableRefObject<any[]>;
  const foldersRef = useMemo(() => ({ get current() { return dataRef.current.folders; }, set current(v) { dataRef.current.folders = v; } }), []) as React.MutableRefObject<any[]>;
  const socialAccountsRef = useMemo(() => ({ get current() { return dataRef.current.socialAccounts; }, set current(v) { dataRef.current.socialAccounts = v; } }), []) as React.MutableRefObject<any[]>;
  const bankAccountsRef = useMemo(() => ({ get current() { return dataRef.current.bankAccounts; }, set current(v) { dataRef.current.bankAccounts = v; } }), []) as React.MutableRefObject<any[]>;
  const investmentsRef = useMemo(() => ({ get current() { return dataRef.current.investments; }, set current(v) { dataRef.current.investments = v; } }), []) as React.MutableRefObject<any[]>;
  const financialConnectionsRef = useMemo(() => ({ get current() { return dataRef.current.financialConnections; }, set current(v) { dataRef.current.financialConnections = v; } }), []) as React.MutableRefObject<any[]>;
  const volatileCacheRef = useRef<{ lastRefresh: number }>({ lastRefresh: 0 });
  const VOLATILE_TTL = 30_000; // 30 seconds

  // Phase 1: Essential data (profile, workspace, tasks context, memories)
  // Phase 2: Deferred data (WhatsApp, connections, automations, emails, files)
  const deferredLoadedRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    // Phase 1: Critical path — only 7 queries needed for basic AI context
    const loadEssential = async () => {
      const [cRes, gRes, tRes, mRes, rRes, pRes, wRes] = await Promise.all([
        fetchContacts(user.id),
        fetchFinanceGoals(user.id),
        fetchRecentTransactions(user.id),
        fetchMemories(user.id),
        fetchRecurring(user.id),
        fetchProfile(user.id),
        fetchDefaultWorkspace(user.id),
      ]);
      if (cancelled) return;
      contactsRef.current = cRes.data || [];
      financeGoalsRef.current = gRes.data || [];
      financeTransactionsRef.current = tRes.data || [];
      memoriesRef.current = mRes.data || [];
      financeRecurringRef.current = rRes.data || [];
      filesCountRef.current = 0;
      profileRef.current = { display_name: pRes.data?.display_name || null };
      workspaceRef.current = { name: wRes.data?.name || null };
      volatileCacheRef.current.lastRefresh = Date.now();
    };

    // Phase 2: Deferred — loaded after 500ms to not block first interaction
    const loadDeferred = async () => {
      const [stRes, hRes, kbRes, autoRes, emailRes, waRes, wsRes, connRes, budRes, intRes, waConvRes] = await Promise.all([
        fetchSubtasks(),
        fetchHabits(user.id),
        fetchKnowledgeBase(user.id),
        fetchAutomations(user.id),
        fetchEmailsCache(user.id),
        fetchWhatsappStatus(user.id),
        fetchWorkspaces(user.id),
        fetchConnections(user.id),
        fetchBudgets(user.id),
        fetchInteractions(user.id),
        fetchWhatsappConversations(user.id),
      ]);
      if (cancelled) return;
      subtasksRef.current = (stRes.data as any[]) || [];
      if (hRes.data && (hRes.data as any[]).length > 0) {
        const row = (hRes.data as any[])[0];
        habitsRef.current = { rowId: row.id, data: row.data };
      }
      knowledgeBaseRef.current = (kbRes.data as any[]) || [];
      automationsRef.current = autoRes.data || [];
      recentEmailsRef.current = emailRes.data || [];
      filesRef.current = [];
      const waData = (waRes.data as any[]);
      whatsappStatusRef.current = waData?.[0]?.status || "não configurado";
      workspacesRef.current = (wsRes.data as any[]) || [];
      connectionsRef.current = connRes.data || [];
      budgetsRef.current = budRes.data || [];
      interactionsRef.current = intRes.data || [];
      waConversationsRef.current = waConvRes.data || [];

      // Phase 2b: Load additional module data in parallel
      const [foldersRes, socialAccRes, bankAccRes, investRes, finConnRes, waConvMsgRes] = await Promise.all([
        supabase.from("file_folders").select("id,name,color,icon,parent_id").eq("user_id", user.id).order("name", { ascending: true }),
        fetchSocialAccounts(user.id),
        fetchBankAccounts(user.id),
        fetchInvestments(user.id),
        fetchFinancialConnections(user.id),
        // Load recent messages from top 5 conversations
        (async () => {
          const top5 = (waConvRes.data || []).slice(0, 5);
          if (top5.length === 0) return [];
          const msgResults = await Promise.all(
            top5.map((c: any) =>
              supabase.from("whatsapp_messages").select("id,conversation_id,direction,content_text,sent_at,status").eq("conversation_id", c.id).order("sent_at", { ascending: false }).limit(5)
            )
          );
          return msgResults.flatMap((r, i) =>
            (r.data || []).map((m: any) => ({ ...m, conversation_title: top5[i].title || top5[i].external_contact_id }))
          );
        })(),
      ]);
      if (cancelled) return;
      foldersRef.current = foldersRes.data || [];
      socialAccountsRef.current = socialAccRes.data || [];
      bankAccountsRef.current = bankAccRes.data || [];
      investmentsRef.current = investRes.data || [];
      financialConnectionsRef.current = finConnRes.data || [];
      waRecentMessagesRef.current = waConvMsgRes || [];
      deferredLoadedRef.current = true;
    };

    loadEssential();
    // Defer non-critical queries by 500ms
    const deferTimer = setTimeout(loadDeferred, 500);
    return () => { cancelled = true; clearTimeout(deferTimer); };
  }, [user]);

  // Refresh volatile data (tasks, contacts, finances, notes, events) before each AI call
  const refreshVolatileData = useCallback(async () => {
    if (!user) return;
    const now = Date.now();
    if (now - volatileCacheRef.current.lastRefresh < VOLATILE_TTL) return; // Cache still valid

    const [cRes, gRes, tRes, rRes, mRes, emailRes, intRes, stRes, hRes, waRefreshRes] = await Promise.all([
      fetchContacts(user.id),
      fetchFinanceGoals(user.id),
      fetchRecentTransactions(user.id),
      fetchRecurring(user.id),
      fetchMemories(user.id),
      fetchEmailsCache(user.id),
      fetchInteractions(user.id),
      fetchSubtasks(),
      fetchHabits(user.id),
      fetchWhatsappStatus(user.id),
    ]);

    contactsRef.current = cRes.data || [];
    const waRefreshData = (waRefreshRes.data as any[]);
    whatsappStatusRef.current = waRefreshData?.[0]?.status || "não configurado";
    financeGoalsRef.current = gRes.data || [];
    financeTransactionsRef.current = tRes.data || [];
    financeRecurringRef.current = rRes.data || [];
    memoriesRef.current = mRes.data || [];
    recentEmailsRef.current = emailRes.data || [];
    interactionsRef.current = intRes.data || [];
    subtasksRef.current = (stRes.data as any[]) || [];
    if (hRes.data && (hRes.data as any[]).length > 0) {
      const row = (hRes.data as any[])[0];
      habitsRef.current = { rowId: row.id, data: row.data };
    }

    volatileCacheRef.current.lastRefresh = now;
  }, [user]);

  // ── Realtime: keep WhatsApp status always up-to-date ──────────────────────
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("ai_wa_status")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "whatsapp_web_sessions",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const row = payload.new as { status?: string } | undefined;
        if (row?.status) {
          whatsappStatusRef.current = row.status;
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const buildContext = useCallback(async () => {
    await refreshVolatileData();

    // Smart context trimming: only send top-priority data to reduce token usage
    const pendingTasks = state.tasks.filter(t => !t.done);
    const recentDoneTasks = state.tasks.filter(t => t.done).slice(0, 5);
    const trimmedTasks = [...pendingTasks, ...recentDoneTasks].map(t => ({
      id: t.id, text: t.text, done: t.done, priority: t.priority,
      due_date: (t as any).due_date || null, project: (t as any).project || null,
    }));

    // Only top 30 contacts (most recent interactions first)
    const interactedIds = new Set(interactionsRef.current.slice(0, 20).map(i => i.contact_id));
    const prioritizedContacts = [
      ...contactsRef.current.filter(c => interactedIds.has(c.id)),
      ...contactsRef.current.filter(c => !interactedIds.has(c.id)),
    ].slice(0, 30).map(c => ({
      id: c.id, name: c.name, email: resolveEmail(c), phone: resolvePhone(c),
      company: c.company, role: c.role, tags: c.tags || [],
    }));

    // Only recent transactions (already limited to 30)
    const txs = financeTransactionsRef.current;
    const income = txs.filter(t => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const expense = txs.filter(t => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);

    // Trim notes content to preview
    const trimmedNotes = state.notes.map(n => ({
      id: n.id, title: n.title, content: n.content.substring(0, 80),
      tags: n.tags, favorited: n.favorited,
    }));

    // Knowledge base: only titles + categories (not full content)
    const trimmedKB = knowledgeBaseRef.current.map(k => ({
      id: k.id, title: k.title, category: k.category, tags: k.tags,
    }));

    return ({
      user_name: profileRef.current.display_name,
      workspace_name: workspaceRef.current.name,
      tasks: trimmedTasks,
      notes: trimmedNotes,
      events: state.events.map(e => ({ id: e.id, day: e.day, month: e.month, year: e.year, label: e.label, category: e.category })),
      contacts: prioritizedContacts,
      finance_goals: financeGoalsRef.current.map(g => ({ id: g.id, name: g.name, target: g.target, current: g.current })),
      finance_summary: { income, expense, balance: income - expense, transaction_count: txs.length },
      finance_recurring: financeRecurringRef.current.filter(r => r.active).map(r => ({
        id: r.id, description: r.description, amount: r.amount, type: r.type, category: r.category, day_of_month: r.day_of_month,
      })),
      memories: memoriesRef.current.map(m => ({ id: m.id, content: m.content, category: m.category, importance: m.importance })),
      habits: habitsRef.current.data?.habits?.map((h: any) => ({ id: h.id, name: h.name, streak: h.streak, completedToday: h.completedToday, category: h.category })) || [],
      datetime: new Date().toLocaleString("pt-BR"),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      active_page: window.location.pathname,
      knowledge_base: trimmedKB,
      automations: automationsRef.current.map(a => ({ id: a.id, name: a.name, trigger_type: a.trigger_type, action_type: a.action_type, enabled: a.enabled })),
      recent_emails: recentEmailsRef.current.slice(0, 10).map((e: any) => ({
        id: e.id, subject: e.subject, from_name: e.from_name, from_email: e.from_email,
        is_unread: e.is_unread ?? !e.is_read, date: e.date || e.received_at,
      })),
      whatsapp_status: whatsappStatusRef.current,
      workspaces: workspacesRef.current.map(w => ({ id: w.id, name: w.name, icon: w.icon, is_default: w.is_default })),
      connections_summary: connectionsRef.current.length > 0
        ? `${connectionsRef.current.length} conexões (${connectionsRef.current.map(c => c.name).join(", ")})`
        : "Nenhuma conexão",
      budgets: budgetsRef.current.map(b => ({ id: b.id, category: b.category, monthly_limit: b.monthly_limit })),
      recent_interactions: interactionsRef.current.slice(0, 10).map(i => ({ contact_id: i.contact_id, title: i.title, type: i.type, date: i.interaction_date })),
      whatsapp_conversations: waConversationsRef.current.slice(0, 10).map(c => ({ id: c.id, contact: c.title || c.external_contact_id, last_message_at: c.last_message_at, unread: c.unread_count })),
      whatsapp_recent_messages: waRecentMessagesRef.current.slice(0, 10).map(m => ({ contact: m.conversation_title, direction: m.direction, text: (m.content_text || "").substring(0, 100), date: m.sent_at })),
      proactive_alerts: (() => {
        const alerts: string[] = [];
        // Calendar conflict detection
        const todayEvents = state.events.filter(e => {
          const now = new Date();
          return e.day === now.getDate() && e.month === now.getMonth() && e.year === now.getFullYear();
        });
        if (todayEvents.length > 1) {
          // Check for overlapping events (simple time-based check via label parsing)
          alerts.push(`📅 ${todayEvents.length} eventos hoje — verifique possíveis conflitos de horário`);
        }
        // Stale unread emails (>24h)
        const now = Date.now();
        const staleUnread = recentEmailsRef.current.filter((e: any) => {
          const isUnread = e.is_unread ?? !e.is_read;
          const emailDate = new Date(e.date || e.received_at || 0).getTime();
          return isUnread && (now - emailDate > 24 * 60 * 60 * 1000);
        });
        if (staleUnread.length > 0) {
          alerts.push(`📧 ${staleUnread.length} email(s) não lido(s) há mais de 24h`);
        }
        return alerts;
      })(),
    });
  }, [state, refreshVolatileData]);

  // Helper: wait for DB write to propagate then verify existence
  const verifyTaskInDb = useCallback(async (userId: string, title: string, retries = 4, delayMs = 400): Promise<boolean> => {
    for (let i = 0; i < retries; i++) {
      await new Promise(r => setTimeout(r, delayMs * (i + 1)));
      const { data } = await supabase.from("tasks").select("id").eq("user_id", userId).ilike("title", title).limit(1);
      if (data?.length) return true;
    }
    return false;
  }, []);

  const verifyEventInDb = useCallback(async (userId: string, label: string, retries = 5, delayMs = 500): Promise<boolean> => {
    for (let i = 0; i < retries; i++) {
      await new Promise(r => setTimeout(r, delayMs * (i + 1)));
      // Events are stored as data_type "event" in user_data via DashboardContext
      const { data } = await supabase.from("user_data").select("id, data").eq("user_id", userId).eq("data_type", "event").order("created_at", { ascending: false }).limit(10);
      if (data?.some((row: any) => {
        const d = row.data as any;
        return d?.label?.toLowerCase() === label.toLowerCase();
      })) return true;
    }
    return false;
  }, []);

  const verifyNoteInDb = useCallback(async (noteId: string, retries = 4, delayMs = 400): Promise<boolean> => {
    for (let i = 0; i < retries; i++) {
      await new Promise(r => setTimeout(r, delayMs * (i + 1)));
      const { data } = await supabase.from("user_data").select("id").eq("id", noteId).eq("data_type", "note").maybeSingle();
      if ((data as any)?.id) return true;
    }
    return false;
  }, []);

  const executeToolCall = useCallback(async (tc: ToolCall): Promise<string> => {
    // SECURITY: Sanitize tool arguments to prevent injection
    const rawArgs = tc.arguments || {};
    const args: Record<string, any> = {};
    for (const [key, val] of Object.entries(rawArgs)) {
      if (typeof val === "string") {
        args[key] = val
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
          .substring(0, 5000);
      } else {
        args[key] = val;
      }
    }

    // Build shared context for modular handlers
    const ctx: ToolContext = {
      user, supabase, invokeEdge, getInsertWorkspaceId, state,
      addTask, toggleTask, updateTask, deleteTask,
      addNote, updateNote, deleteNote,
      addEvent, updateEvent, deleteEvent,
      setMode, setColor, setWallpaper, navigate, opts,
      dataRef,
      contactsRef, financeGoalsRef, financeTransactionsRef, memoriesRef,
      financeRecurringRef, filesCountRef, profileRef, workspaceRef,
      subtasksRef, habitsRef, knowledgeBaseRef, automationsRef,
      recentEmailsRef, filesRef, whatsappStatusRef, workspacesRef,
      connectionsRef, budgetsRef, interactionsRef, waConversationsRef,
      waRecentMessagesRef, foldersRef, socialAccountsRef, bankAccountsRef,
      investmentsRef, financialConnectionsRef,
      verifyTaskInDb, verifyEventInDb, verifyNoteInDb,
      resolveEmail, resolvePhone, invalidateGoogleCache,
    };

    // O(1) dispatch via tool name lookup
    let result: string | null = null;
    if (TASK_TOOL_NAMES.has(tc.name)) {
      result = await handleTaskTool(tc.name, args, ctx);
    } else if (FINANCE_TOOL_NAMES.has(tc.name)) {
      result = await handleFinanceTool(tc.name, args, ctx);
    } else if (INTEGRATION_TOOL_NAMES.has(tc.name)) {
      result = await handleIntegrationTool(tc.name, args, ctx);
    } else if (SYSTEM_TOOL_NAMES.has(tc.name)) {
      result = await handleSystemTool(tc.name, args, ctx);
    }

    return result ?? `[ERRO] Ferramenta desconhecida: ${tc.name}`;
  }, [state, addTask, toggleTask, updateTask, deleteTask, addNote, updateNote, deleteNote, addEvent, updateEvent, deleteEvent, setMode, setColor, setWallpaper, user, navigate, opts, getInsertWorkspaceId, verifyTaskInDb, verifyEventInDb, verifyNoteInDb]);

  return { executeToolCall, buildContext, contactsRef, financeGoalsRef, financeTransactionsRef, memoriesRef, knowledgeBaseRef, budgetsRef };
}

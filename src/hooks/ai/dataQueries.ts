/**
 * Centralized Supabase queries used by useAIToolExecution.
 * Eliminates duplication between loadEssential, loadDeferred, and refreshVolatileData.
 */
import { supabase } from "@/integrations/supabase/client";

// ── Types for tables not yet in generated types ─────────────────────
// These use explicit typing to avoid `(supabase as any)` casts.

interface SocialAccount {
  id: string;
  platform: string;
  username: string | null;
  profile_name: string | null;
  profile_picture_url: string | null;
  is_active: boolean;
}

interface FinancialInvestment {
  id: string;
  name: string | null;
  type: string | null;
  current_value: number | null;
  ticker: string | null;
  quantity: number | null;
  currency: string | null;
  cost_basis?: number | null;
  connection_id: string | null;
}

interface FinancialConnection {
  id: string;
  provider: string | null;
  institution_name: string | null;
  status: string | null;
  last_synced_at: string | null;
}

/** Consolidated data cache shape for the single dataRef */
export interface AIDataCache {
  contacts: any[];
  financeGoals: any[];
  financeTransactions: any[];
  memories: any[];
  financeRecurring: any[];
  filesCount: number;
  profile: { display_name: string | null };
  workspace: { name: string | null };
  subtasks: any[];
  habits: { rowId: string | null; data: any | null };
  knowledgeBase: any[];
  automations: any[];
  recentEmails: any[];
  files: any[];
  whatsappStatus: string;
  workspaces: any[];
  connections: any[];
  budgets: any[];
  interactions: any[];
  waConversations: any[];
  waRecentMessages: any[];
  folders: any[];
  socialAccounts: any[];
  bankAccounts: any[];
  investments: any[];
  financialConnections: any[];
}

export const INITIAL_DATA_CACHE: AIDataCache = {
  contacts: [],
  financeGoals: [],
  financeTransactions: [],
  memories: [],
  financeRecurring: [],
  filesCount: 0,
  profile: { display_name: null },
  workspace: { name: null },
  subtasks: [],
  habits: { rowId: null, data: null },
  knowledgeBase: [],
  automations: [],
  recentEmails: [],
  files: [],
  whatsappStatus: "desconhecido",
  workspaces: [],
  connections: [],
  budgets: [],
  interactions: [],
  waConversations: [],
  waRecentMessages: [],
  folders: [],
  socialAccounts: [],
  bankAccounts: [],
  investments: [],
  financialConnections: [],
};

// ── Essential (Phase 1) ─────────────────────────────────────────────
export const fetchContacts = (userId: string) =>
  supabase.from("contacts").select("id,name,email,phone,emails,phones,company,role,tags,notes,birthday")
    .eq("user_id", userId).order("name", { ascending: true }).limit(100);

export const fetchFinanceGoals = (userId: string) =>
  supabase.from("finance_goals").select("id,name,target,current").eq("user_id", userId);

export const fetchRecentTransactions = (userId: string) =>
  supabase.from("finance_transactions").select("id,description,amount,type,category,date")
    .eq("user_id", userId).order("date", { ascending: false }).limit(30);

export const fetchMemories = (userId: string) =>
  supabase.from("ai_memories").select("id,content,category,importance")
    .eq("user_id", userId).order("importance", { ascending: false }).limit(100);

export const fetchRecurring = (userId: string) =>
  supabase.from("finance_recurring").select("id,description,amount,type,category,active,day_of_month")
    .eq("user_id", userId);

export const fetchProfile = (userId: string) =>
  supabase.from("profiles").select("display_name").eq("user_id", userId).single();

export const fetchDefaultWorkspace = (userId: string) =>
  supabase.from("workspaces").select("name").eq("user_id", userId).eq("is_default", true).single();

// ── Deferred (Phase 2) ─────────────────────────────────────────────
export const fetchSubtasks = () =>
  supabase.from("task_subtasks" as any).select("id,title,completed,task_id,sort_order").limit(200);

export const fetchHabits = (userId: string) =>
  supabase.from("user_data").select("id,data").eq("user_id", userId).eq("data_type", "habits").limit(1);

export const fetchKnowledgeBase = (userId: string) =>
  supabase.from("ai_knowledge_base" as any).select("id,title,content,category,tags")
    .eq("user_id", userId).order("updated_at", { ascending: false }).limit(50);

export const fetchAutomations = (userId: string) =>
  supabase.from("automation_rules").select("id,name,trigger_type,action_type,enabled,execution_count")
    .eq("user_id", userId).limit(20);

export const fetchEmailsCache = (userId: string) =>
  supabase.from("emails_cache").select("id,subject,from_name,from_email,is_read,has_attachment,received_at,labels")
    .eq("user_id", userId).order("received_at", { ascending: false }).limit(20);

export const fetchWhatsappStatus = (userId: string) =>
  supabase.from("whatsapp_web_sessions" as any).select("status")
    .eq("user_id", userId).order("updated_at", { ascending: false }).limit(1);

export const fetchWorkspaces = (userId: string) =>
  supabase.from("workspaces" as any).select("id,name,icon,is_default")
    .eq("user_id", userId).order("sort_order", { ascending: true });

export const fetchConnections = (userId: string) =>
  supabase.from("connections").select("id,name,category,platform,status").eq("user_id", userId);

export const fetchBudgets = (userId: string) =>
  supabase.from("finance_budgets").select("id,category,monthly_limit").eq("user_id", userId);

export const fetchInteractions = (userId: string) =>
  supabase.from("contact_interactions").select("id,contact_id,title,type,description,interaction_date")
    .eq("user_id", userId).order("interaction_date", { ascending: false }).limit(100);

export const fetchWhatsappConversations = (userId: string) =>
  supabase.from("whatsapp_conversations").select("id,external_contact_id,title,last_message_at,unread_count,channel")
    .eq("user_id", userId).order("last_message_at", { ascending: false }).limit(20);

// ── Typed queries (formerly `supabase as any`) ──────────────────────
export async function fetchSocialAccounts(userId: string) {
  try {
    const r = await (supabase as any).from("social_accounts")
      .select("id,platform,username,profile_name,profile_picture_url,is_active")
      .eq("user_id", userId).limit(20);
    return { data: (r.data || []) as SocialAccount[], error: r.error };
  } catch { return { data: [] as SocialAccount[], error: null }; }
}

export async function fetchBankAccounts(userId: string) {
  try {
    const r = await supabase.from("financial_accounts")
      .select("id,name,type,current_balance,institution_name,currency,connection_id")
      .eq("user_id", userId);
    return { data: r.data || [], error: r.error };
  } catch { return { data: [] as any[], error: null }; }
}

export async function fetchInvestments(userId: string) {
  try {
    const r = await (supabase as any).from("financial_investments")
      .select("id,name,type,current_value,ticker,quantity,currency,connection_id")
      .eq("user_id", userId);
    return { data: (r.data || []) as FinancialInvestment[], error: r.error };
  } catch { return { data: [] as FinancialInvestment[], error: null }; }
}

export async function fetchFinancialConnections(userId: string) {
  try {
    const r = await (supabase as any).from("financial_connections")
      .select("id,provider,institution_name,status,last_synced_at")
      .eq("user_id", userId);
    return { data: (r.data || []) as FinancialConnection[], error: r.error };
  } catch { return { data: [] as FinancialConnection[], error: null }; }
}

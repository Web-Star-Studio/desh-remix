/**
 * Shared context type passed to all AI tool handler functions.
 * Contains all dependencies needed to execute tool calls.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { WallpaperId } from "@/hooks/ui/useWallpaper";
import type { AIDataCache } from "./dataQueries";

export interface ToolContext {
  user: { id: string } | null;
  supabase: SupabaseClient<Database>;
  invokeEdge: <T = any>(o: { fn: string; body?: Record<string, unknown> }) => Promise<{ data: T | null; error: string | null }>;
  getInsertWorkspaceId: () => string | null;
  // Dashboard state & actions
  state: {
    tasks: Array<{ id: string; text: string; done: boolean; priority?: string; due_date?: string; project?: string }>;
    notes: Array<{ id: string; title: string; content: string; tags?: string[]; favorited?: boolean }>;
    events: Array<{ id: string; day: number; month: number; year: number; label: string; category?: string }>;
  };
  addTask: (title: string, priority: string) => void;
  toggleTask: (id: string) => void;
  updateTask: (id: string, changes: Record<string, any>) => void;
  deleteTask: (id: string) => void;
  addNote: (title: string, content: string) => { id: string };
  updateNote: (id: string, changes: Record<string, any>) => void;
  deleteNote: (id: string) => void;
  addEvent: (day: number, month: number, year: number, label: string, category: string) => void;
  updateEvent: (id: string, changes: Record<string, any>) => void;
  deleteEvent: (id: string) => void;
  // Theme
  setMode: (mode: string) => void;
  setColor: (color: string) => void;
  setWallpaper: (id: WallpaperId) => void;
  // Navigation
  navigate: (path: string) => void;
  // Opts
  opts: { setDynamicReplies?: (replies: Array<{ label: string; message: string }>) => void };
  /** Consolidated data ref — replaces 25+ individual refs */
  dataRef: React.MutableRefObject<AIDataCache>;
  // Legacy individual refs — kept as getters for backward compat during migration
  contactsRef: React.MutableRefObject<any[]>;
  financeGoalsRef: React.MutableRefObject<any[]>;
  financeTransactionsRef: React.MutableRefObject<any[]>;
  memoriesRef: React.MutableRefObject<any[]>;
  financeRecurringRef: React.MutableRefObject<any[]>;
  filesCountRef: React.MutableRefObject<number>;
  profileRef: React.MutableRefObject<{ display_name: string | null }>;
  workspaceRef: React.MutableRefObject<{ name: string | null }>;
  subtasksRef: React.MutableRefObject<any[]>;
  habitsRef: React.MutableRefObject<{ rowId: string | null; data: any | null }>;
  knowledgeBaseRef: React.MutableRefObject<any[]>;
  automationsRef: React.MutableRefObject<any[]>;
  recentEmailsRef: React.MutableRefObject<any[]>;
  filesRef: React.MutableRefObject<any[]>;
  whatsappStatusRef: React.MutableRefObject<string>;
  workspacesRef: React.MutableRefObject<any[]>;
  connectionsRef: React.MutableRefObject<any[]>;
  budgetsRef: React.MutableRefObject<any[]>;
  interactionsRef: React.MutableRefObject<any[]>;
  waConversationsRef: React.MutableRefObject<any[]>;
  waRecentMessagesRef: React.MutableRefObject<any[]>;
  foldersRef: React.MutableRefObject<any[]>;
  socialAccountsRef: React.MutableRefObject<any[]>;
  bankAccountsRef: React.MutableRefObject<any[]>;
  investmentsRef: React.MutableRefObject<any[]>;
  financialConnectionsRef: React.MutableRefObject<any[]>;
  // Helpers
  verifyTaskInDb: (userId: string, title: string) => Promise<boolean>;
  verifyEventInDb: (userId: string, label: string) => Promise<boolean>;
  verifyNoteInDb: (noteId: string) => Promise<boolean>;
  resolveEmail: (contact: any) => string | null;
  resolvePhone: (contact: any) => string | null;
  invalidateGoogleCache: (service: string) => void;
}

/** Handler function signature */
export type ToolHandler = (args: Record<string, any>, ctx: ToolContext) => Promise<string>;

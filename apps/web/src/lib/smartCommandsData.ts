import { supabase } from "@/integrations/supabase/client";
import { User, FileText, CheckSquare, Hash, Calendar, Clock, Languages, Sparkles, List, Type, AlarmClock, UserPlus, ListTodo, BookOpen, FolderOpen } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type TriggerType = "@" | "/" | "#";
export type CommandContext = "chat" | "email" | "task" | "note" | "general";

export interface SmartCommandItem {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  category: string;
  trigger: TriggerType;
  insertText: string;
  /** For @ mentions — enriched metadata */
  metadata?: Record<string, any>;
  /** Contexts where this command is available */
  contexts?: CommandContext[];
  /** If true, this is an action (/) that should be handled by a callback */
  isAction?: boolean;
}

// ── Static slash commands ──────────────────────────────────────
const SLASH_COMMANDS: SmartCommandItem[] = [
  { id: "slash_resumir", label: "resumir", description: "Resumir o conteúdo com IA", icon: Sparkles, category: "IA", trigger: "/", insertText: "/resumir", contexts: ["chat", "email"], isAction: true },
  { id: "slash_traduzir", label: "traduzir", description: "Traduzir o texto", icon: Languages, category: "IA", trigger: "/", insertText: "/traduzir", contexts: ["chat", "email", "note", "general"], isAction: true },
  { id: "slash_formalizar", label: "formalizar", description: "Reescrever em tom formal", icon: Type, category: "IA", trigger: "/", insertText: "/formalizar", contexts: ["email", "chat", "general"], isAction: true },
  { id: "slash_simplificar", label: "simplificar", description: "Simplificar o texto", icon: Type, category: "IA", trigger: "/", insertText: "/simplificar", contexts: ["chat", "email", "note", "task", "general"], isAction: true },
  { id: "slash_bullet", label: "bullet", description: "Converter em tópicos", icon: List, category: "Formatar", trigger: "/", insertText: "/bullet", contexts: ["chat", "email", "note", "task", "general"], isAction: true },
  { id: "slash_data", label: "data", description: "Inserir data/hora atual", icon: Clock, category: "Inserir", trigger: "/", insertText: "", contexts: ["chat", "email", "note", "task", "general"], isAction: false },
  { id: "slash_template", label: "template", description: "Abrir templates salvos", icon: BookOpen, category: "Inserir", trigger: "/", insertText: "/template", contexts: ["email"], isAction: true },
  { id: "slash_lembrete", label: "lembrete", description: "Criar um lembrete rápido", icon: AlarmClock, category: "Ação", trigger: "/", insertText: "/lembrete", contexts: ["chat", "task"], isAction: true },
  { id: "slash_contato", label: "contato", description: "Criar contato rápido", icon: UserPlus, category: "Ação", trigger: "/", insertText: "/contato", contexts: ["chat"], isAction: true },
  { id: "slash_tarefa", label: "tarefa", description: "Criar tarefa rápida", icon: ListTodo, category: "Ação", trigger: "/", insertText: "/tarefa", contexts: ["chat", "note"], isAction: true },
];

// ── Fetch functions ────────────────────────────────────────────

export async function fetchMentionItems(query: string): Promise<SmartCommandItem[]> {
  const q = query.toLowerCase();
  const results: SmartCommandItem[] = [];

  // Contacts
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, name, email, phone, company, role")
    .ilike("name", `%${q}%`)
    .limit(5);

  if (contacts) {
    for (const c of contacts) {
      results.push({
        id: `contact_${c.id}`,
        label: c.name,
        description: [c.email, c.company].filter(Boolean).join(" · "),
        icon: User,
        category: "Contato",
        trigger: "@",
        insertText: `@${c.name}`,
        metadata: { type: "contact", id: c.id, name: c.name, email: c.email, phone: c.phone, company: c.company, role: c.role },
      });
    }
  }

  // Tasks
  const { data: tasks } = await supabase
    .from("tasks" as any)
    .select("id, title, status, priority")
    .ilike("title", `%${q}%`)
    .limit(4);

  if (tasks) {
    for (const t of tasks as any[]) {
      results.push({
        id: `task_${t.id}`,
        label: t.title,
        description: `${t.status} · ${t.priority}`,
        icon: CheckSquare,
        category: "Tarefa",
        trigger: "@",
        insertText: `@tarefa:${t.title}`,
        metadata: { type: "task", id: t.id, title: t.title },
      });
    }
  }

  // Notes (stored in user_data with data_type = "notes")
  const { data: notes } = await supabase
    .from("user_data")
    .select("id, data")
    .eq("data_type", "note")
    .limit(20);

  if (notes) {
    for (const n of notes) {
      const noteData = n.data as any;
      const title = noteData?.title || "Sem título";
      if (!title.toLowerCase().includes(q)) continue;
      results.push({
        id: `note_${n.id}`,
        label: title,
        description: "Nota",
        icon: FileText,
        category: "Nota",
        trigger: "@",
        insertText: `@nota:${title}`,
        metadata: { type: "note", id: n.id, title },
      });
      if (results.filter(r => r.category === "Nota").length >= 4) break;
    }
  }

  return results;
}

export async function fetchTagItems(query: string): Promise<SmartCommandItem[]> {
  const q = query.toLowerCase();
  const results: SmartCommandItem[] = [];

  // Projects
  const { data: projects } = await supabase
    .from("ai_projects")
    .select("id, name, icon, color")
    .eq("archived", false)
    .ilike("name", `%${q}%`)
    .limit(5);

  if (projects) {
    for (const p of projects) {
      results.push({
        id: `project_${p.id}`,
        label: p.name,
        description: "Projeto",
        icon: FolderOpen,
        category: "Projeto",
        trigger: "#",
        insertText: `#${p.name}`,
        metadata: { type: "project", id: p.id },
      });
    }
  }

  // Unique contact tags
  const { data: contacts } = await supabase
    .from("contacts")
    .select("tags")
    .not("tags", "is", null)
    .limit(50);

  if (contacts) {
    const tagSet = new Set<string>();
    for (const c of contacts) {
      if (Array.isArray(c.tags)) {
        for (const tag of c.tags) {
          if (typeof tag === "string" && tag.toLowerCase().includes(q)) tagSet.add(tag);
        }
      }
    }
    for (const tag of Array.from(tagSet).slice(0, 5)) {
      results.push({
        id: `tag_${tag}`,
        label: tag,
        description: "Tag",
        icon: Hash,
        category: "Tag",
        trigger: "#",
        insertText: `#${tag}`,
      });
    }
  }

  return results;
}

export function getSlashCommands(context: CommandContext, query: string): SmartCommandItem[] {
  return SLASH_COMMANDS.filter(cmd => {
    if (cmd.contexts && !cmd.contexts.includes(context)) return false;
    if (query && !cmd.label.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });
}

/** For /data command — returns formatted date string */
export function getDateTimeString(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date());
}

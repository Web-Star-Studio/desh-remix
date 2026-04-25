// Core email types re-exported from /src/types/email.ts
export type { EmailFolder, EmailItem } from "@/types/email";
import type { EmailFolder } from "@/types/email";
export type LabelColor = "red" | "blue" | "green" | "yellow" | "purple" | "orange";

export interface EmailLabel {
  id: string;
  name: string;
  color: LabelColor;
}

export const LABEL_COLORS: Record<LabelColor, string> = {
  red: "bg-red-500/20 text-red-400 border-red-500/30",
  blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  green: "bg-green-500/20 text-green-400 border-green-500/30",
  yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  purple: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  orange: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

export const LABEL_DOT: Record<LabelColor, string> = {
  red: "bg-red-400",
  blue: "bg-blue-400",
  green: "bg-green-400",
  yellow: "bg-yellow-400",
  purple: "bg-purple-400",
  orange: "bg-orange-400",
};

export const AI_CATEGORY_STYLES: Record<string, { badge: string; label: string }> = {
  trabalho:      { badge: "bg-blue-500/15 text-blue-400 border-blue-500/20",    label: "Trabalho" },
  urgente:       { badge: "bg-red-500/15 text-red-400 border-red-500/20",       label: "Urgente" },
  financeiro:    { badge: "bg-yellow-500/15 text-yellow-500 border-yellow-500/20", label: "Financeiro" },
  reunião:       { badge: "bg-violet-500/15 text-violet-400 border-violet-500/20", label: "Reunião" },
  projeto:       { badge: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20", label: "Projeto" },
  pessoal:       { badge: "bg-green-500/15 text-green-400 border-green-500/20", label: "Pessoal" },
  promoções:     { badge: "bg-orange-500/15 text-orange-400 border-orange-500/20", label: "Promoções" },
  notificações:  { badge: "bg-foreground/10 text-foreground/50 border-foreground/10", label: "Notif." },
  newsletter:    { badge: "bg-foreground/10 text-foreground/50 border-foreground/10", label: "Newsletter" },
  outro:         { badge: "bg-foreground/10 text-foreground/50 border-foreground/10", label: "Outro" },
};

export const DEFAULT_LABELS: EmailLabel[] = [
  { id: "work", name: "Trabalho", color: "blue" },
  { id: "personal", name: "Pessoal", color: "green" },
  { id: "urgent", name: "Urgente", color: "red" },
  { id: "finance", name: "Financeiro", color: "yellow" },
  { id: "project", name: "Projeto", color: "purple" },
];

/** Maps default label IDs to AI category names for unified filtering */
export const LABEL_TO_AI_CATEGORY: Record<string, string> = {
  work: "trabalho",
  personal: "pessoal",
  urgent: "urgente",
  finance: "financeiro",
  project: "projeto",
};

export function getAvatarInfo(name: string, email: string) {
  const initials = (name || email || "?").split(/[\s@]/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");
  const colors = ["bg-blue-600", "bg-emerald-600", "bg-violet-600", "bg-amber-600", "bg-rose-600", "bg-cyan-600", "bg-indigo-600", "bg-pink-600"];
  const hash = (email || name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return { initials: initials || "?", color: colors[hash % colors.length] };
}

import {
  TrendingUp, TrendingDown, DollarSign, Home, Utensils, Car, Smile, Heart, BookOpen, HelpCircle, ShoppingBag,
} from "lucide-react";

// ─── Shared Constants ────────────────────────────────────────
export const PIE_COLORS = [
  "hsl(220, 60%, 55%)", "hsl(140, 50%, 50%)", "hsl(35, 80%, 55%)",
  "hsl(280, 50%, 55%)", "hsl(0, 0%, 60%)", "hsl(0, 70%, 55%)", "hsl(180, 50%, 50%)",
];

export const CATEGORIES = ["Renda", "Moradia", "Alimentação", "Transporte", "Lazer", "Saúde", "Educação", "Outros"];

export const CATEGORY_META: Record<string, { icon: React.ElementType; bg: string; text: string }> = {
  "Renda":        { icon: DollarSign, bg: "bg-green-500/15",  text: "text-green-400" },
  "Moradia":      { icon: Home,        bg: "bg-blue-500/15",   text: "text-blue-400" },
  "Alimentação":  { icon: Utensils,    bg: "bg-orange-500/15", text: "text-orange-400" },
  "Transporte":   { icon: Car,         bg: "bg-cyan-500/15",   text: "text-cyan-400" },
  "Lazer":        { icon: Smile,       bg: "bg-violet-500/15", text: "text-violet-400" },
  "Saúde":        { icon: Heart,       bg: "bg-rose-500/15",   text: "text-rose-400" },
  "Educação":     { icon: BookOpen,    bg: "bg-indigo-500/15", text: "text-indigo-400" },
  "Outros":       { icon: HelpCircle,  bg: "bg-foreground/10", text: "text-muted-foreground" },
};

export const getCategoryMeta = (cat: string, type: "income" | "expense") => {
  if (type === "income") return { icon: TrendingUp, bg: "bg-green-500/15", text: "text-green-400" };
  return CATEGORY_META[cat] ?? { icon: ShoppingBag, bg: "bg-foreground/10", text: "text-muted-foreground" };
};

export const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

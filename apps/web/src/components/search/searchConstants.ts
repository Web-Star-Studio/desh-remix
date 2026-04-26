import {
  Globe, Newspaper, ImageIcon, GraduationCap, Database,
} from "lucide-react";

/* ── Filter chips (simplified — 5 tabs) ── */
export const filters = [
  { label: "Web", icon: Globe },
  { label: "Meus Dados", icon: Database },
  { label: "Notícias", icon: Newspaper },
  { label: "Imagens", icon: ImageIcon },
  { label: "Acadêmico", icon: GraduationCap },
];

/* ── Specialized engine filters that bypass Perplexity entirely ── */
export const SPECIALIZED_FILTERS = new Set([
  "academic",
]);

/* ── Filter ↔ API value mappers ── */
export const filterToApiValue = (label: string) => {
  const map: Record<string, string> = {
    "Notícias": "news", "Acadêmico": "academic",
    "Imagens": "images",
  };
  return map[label] || "web";
};

export const apiValueToFilter = (val: string) => {
  const map: Record<string, string> = {
    news: "Notícias", academic: "Acadêmico",
    images: "Imagens",
  };
  return map[val] || "Web";
};

/* ── Accent colors per specialized engine ── */
export const accentMap: Record<string, string> = {
  "Acadêmico": "bg-slate-500/15 text-slate-600 dark:text-slate-400 ring-slate-500/30",
};

/* ── Engine context banner config ── */
export const bannerConfig: Record<string, { icon: any; bannerClass: string; iconClass: string; labelClass: string; label: string; credits: number; hint: string }> = {
  "Acadêmico": { icon: GraduationCap, bannerClass: "border-slate-500/20 bg-slate-500/5", iconClass: "text-slate-500", labelClass: "text-slate-500", label: "Google Scholar", credits: 3, hint: "Pesquise artigos e papers — a IA traduz e otimiza para melhores resultados" },
};

/* ── Empty state config per specialized engine ── */
export const emptyStateMap: Record<string, { icon: any; title: string; subtitle: string; colorClass: string; examples: string[] }> = {
  academic: { icon: GraduationCap, title: "Nenhum artigo encontrado", subtitle: "Tente usar termos em inglês ou mais técnicos.", colorClass: "text-slate-500", examples: ["machine learning healthcare", "deep learning survey 2025", "climate change impact"] },
};

/* ── Specialized skeleton config ── */
export const specializedSkeletonConfig: Record<string, { icon: any; label: string; colorClass: string }> = {
  "Acadêmico": { icon: GraduationCap, label: "Google Scholar", colorClass: "text-slate-500" },
};

/* ── Search input placeholders ── */
export const searchPlaceholders: Record<string, string> = {
  "Acadêmico": "Ex: machine learning in healthcare...",
  "Notícias": "Ex: últimas notícias economia Brasil...",
  "Imagens": "Ex: aurora boreal Noruega...",
};

/* ── Specialized engine list ── */
export const SPECIALIZED_FILTER_LABELS = [
  "Acadêmico",
];

/* ── Engines that show the AdaptiveSearchForm ── */
export const ENGINES_WITH_FORM = new Set([
  "Acadêmico",
]);

/* ── Engine map for SerpAPI ── */
export const serpEngineMap: Record<string, string> = {
  academic: "google_scholar",
};

export const filterEngineMap: Record<string, string> = {
  "Notícias": "google_news",
  "Imagens": "google_images",
};

/* ── Stagger animation variant ── */
export const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
};

/* ── Fact badge colors ── */
export const FACT_COLORS = [
  "bg-primary/10 text-primary",
  "bg-emerald-500/10 text-emerald-500",
  "bg-amber-500/10 text-amber-500",
  "bg-sky-500/10 text-sky-500",
  "bg-violet-500/10 text-violet-500",
  "bg-rose-500/10 text-rose-500",
  "bg-orange-500/10 text-orange-500",
  "bg-teal-500/10 text-teal-500",
];

/* ── Helper functions ── */
export function getReadingTime(text: string) {
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / 200);
  return { words, minutes };
}

export function cleanStreamingText(text: string): string {
  return text
    .replace(/\[TLDR\][\s\S]*?\[\/TLDR\]/g, "")
    .replace(/\[KEY_FACTS\][\s\S]*?\[\/KEY_FACTS\]/g, "")
    .replace(/\[TLDR\][\s\S]*$/g, "")
    .replace(/\[KEY_FACTS\][\s\S]*$/g, "")
    .replace(/\[\/?(TLDR|KEY_FACTS)\]?/g, "")
    .trim();
}

export function detectSpecializedEngine(query: string): string | null {
  const q = query.trim().toLowerCase();
  if (/\b(artigo|artigos|paper|papers|tese|dissertação|scholar|acadêmico|científico|pesquisa científica|pubmed|citação|revisão sistemática)\b/i.test(q)) return "google_scholar";
  return null;
}

/* ── SearchResult interface ── */
export interface SearchResult {
  answer: string;
  citations: string[];
  images: string[];
  location: { name: string; lat: number; lng: number } | null;
  related_queries: string[];
  tldr: string;
  key_facts: string[];
}

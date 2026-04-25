import lifeOs from "@/assets/blog/life-os.jpg";
import pandoraVsChatgpt from "@/assets/blog/pandora-vs-chatgpt.jpg";
import openBanking from "@/assets/blog/open-banking.jpg";
import automacaoFinanceira from "@/assets/blog/automacao-financeira.jpg";
import whatsappIa from "@/assets/blog/whatsapp-ia.jpg";
import deepWork from "@/assets/blog/deep-work.jpg";

// Map blog slug → bundled hero image. Falls back to undefined.
export const blogCoverBySlug: Record<string, string> = {
  "o-que-e-life-os": lifeOs,
  "pandora-ia-vs-chatgpt": pandoraVsChatgpt,
  "open-banking-pessoal-brasil": openBanking,
  "automacao-financeira-inteligente": automacaoFinanceira,
  "whatsapp-ia-produtividade": whatsappIa,
  "deep-work-2025-foco-notificacoes": deepWork,
};

export function resolveBlogCover(slug: string, dbCover: string | null | undefined): string | undefined {
  // Prefer real CDN URLs from the DB (http/https)
  if (dbCover && /^https?:\/\//.test(dbCover)) return dbCover;
  // Otherwise use the bundled asset by slug
  return blogCoverBySlug[slug];
}

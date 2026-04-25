export interface InteractionSummary {
  count: number;
  lastDate: string | null;
  typeCounts: Record<string, number>;
}

const MS_PER_DAY = 86400000;

export const computeRelationshipScore = (summary: InteractionSummary): number => {
  const { count, lastDate, typeCounts } = summary;
  const frequencyScore = Math.min(count * 2, 40);
  let recencyScore = 0;
  if (lastDate) {
    const daysSince = Math.floor((Date.now() - new Date(lastDate).getTime()) / MS_PER_DAY);
    if (daysSince <= 7) recencyScore = 40;
    else if (daysSince <= 14) recencyScore = 32;
    else if (daysSince <= 30) recencyScore = 20;
    else if (daysSince <= 60) recencyScore = 10;
    else if (daysSince <= 90) recencyScore = 4;
  }
  const typeWeights: Record<string, number> = { meeting: 4, call: 3, email: 2, note: 1 };
  const typeScore = Math.min(
    Object.entries(typeCounts).reduce((sum, [type, c]) => sum + (typeWeights[type] || 1) * Math.min(c, 3), 0),
    20
  );
  return Math.min(Math.round(frequencyScore + recencyScore + typeScore), 100);
};

export const computeCompleteness = (c: any): { pct: number; missing: string[] } => {
  const checks: [boolean, string][] = [
    [!!c.name, "Nome"], [!!c.email || (c.emails?.length ?? 0) > 0, "E-mail"],
    [!!c.phone || (c.phones?.length ?? 0) > 0, "Telefone"], [!!c.company, "Empresa"],
    [!!c.role, "Cargo"], [!!c.notes, "Notas"], [(c.tags || []).length > 0, "Tags"],
    [!!c.avatar_url, "Foto"], [!!c.website, "Website"], [!!c.birthday, "Aniversário"],
    [(c.addresses || []).length > 0, "Endereço"],
    [Object.values(c.social_links || {}).some((v: any) => v && v.trim()), "Redes sociais"],
  ];
  const missing = checks.filter(([ok]) => !ok).map(([, l]) => l);
  return { pct: Math.round((checks.filter(([ok]) => ok).length / checks.length) * 100), missing };
};

export const getScoreLabel = (score: number): { label: string; color: string; bg: string } => {
  if (score >= 80) return { label: "Forte", color: "text-green-400", bg: "bg-green-400" };
  if (score >= 55) return { label: "Bom", color: "text-primary", bg: "bg-primary" };
  if (score >= 30) return { label: "Fraco", color: "text-amber-400", bg: "bg-amber-400" };
  if (score > 0) return { label: "Inicial", color: "text-muted-foreground", bg: "bg-muted-foreground" };
  return { label: "Sem dados", color: "text-muted-foreground/50", bg: "bg-foreground/20" };
};

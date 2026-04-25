import { useState, useMemo } from "react";
import { DollarSign, Eye, MousePointerClick, TrendingUp, Loader2, Megaphone, ChevronLeft, ChevronRight, Filter, ArrowDownNarrowWide } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import { useAdsData } from "@/hooks/social/useAdsData";
import { MetricCard } from "./MetricCard";
import { EmptyState } from "./EmptyState";
import { AdsFunnel } from "./AdsFunnel";
import { formatNumber } from "./utils";
import { useSocialConnections } from "@/hooks/social/useSocialConnections";
import { getAdsPlatforms } from "@/lib/social-integrations";
import type { Period } from "./PeriodSelector";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface AdsTabProps {
  period: Period;
  onGoToAccounts?: () => void;
}

const ITEMS_PER_PAGE = 10;

const STATUS_LABELS: Record<string, string> = {
  all: "Todos",
  active: "Ativas",
  paused: "Pausadas",
  completed: "Encerradas",
};

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", label: "Ativa" },
  paused: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", label: "Pausada" },
  completed: { bg: "bg-muted", text: "text-muted-foreground", label: "Encerrada" },
};

function getRoasColor(roas: number): string {
  if (roas >= 3) return "text-emerald-600 dark:text-emerald-400";
  if (roas >= 1) return "text-primary";
  if (roas > 0) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

export function AdsTab({ period, onGoToAccounts }: AdsTabProps) {
  const { ads, isLoading, error } = useAdsData(period);
  const { connectedIds } = useSocialConnections();
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [page, setPage] = useState(0);

  const hasAdsConnected = getAdsPlatforms().some(p => connectedIds.includes(p.id));

  const platformChartData = (ads.byPlatform ?? []).map(p => ({
    name: p.name,
    spend: p.spend,
    roas: p.roas,
    color: p.color,
  }));

  const hasChartData = platformChartData.some(d => d.spend > 0);

  const platformNames = useMemo(() => {
    const names = new Set((ads.campaigns ?? []).map(c => c.platform));
    return Array.from(names);
  }, [ads.campaigns]);

  const filteredCampaigns = useMemo(() => {
    let list = ads.campaigns ?? [];
    if (statusFilter !== "all") list = list.filter(c => c.status.toLowerCase() === statusFilter);
    if (platformFilter !== "all") list = list.filter(c => c.platform === platformFilter);
    return list;
  }, [ads.campaigns, statusFilter, platformFilter]);

  const maxSpend = useMemo(() => Math.max(...filteredCampaigns.map(c => c.spend), 1), [filteredCampaigns]);
  const totalPages = Math.max(1, Math.ceil(filteredCampaigns.length / ITEMS_PER_PAGE));
  const paginatedCampaigns = filteredCampaigns.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  const handleStatusFilter = (s: string) => { setStatusFilter(s); setPage(0); };
  const handlePlatformFilter = (p: string) => { setPlatformFilter(p); setPage(0); };

  if (!isLoading && !hasAdsConnected) {
    return <EmptyState type="ads" onGoToAccounts={onGoToAccounts} />;
  }

  return (
    <>
      {error && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          Erro ao carregar anúncios: {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Gasto Total" value={ads.totalSpend > 0 ? `R$ ${formatNumber(ads.totalSpend)}` : "—"} icon={<DollarSign className="w-4 h-4 text-primary" />} />
        <MetricCard label="Impressões" value={ads.totalImpressions > 0 ? formatNumber(ads.totalImpressions) : "—"} icon={<Eye className="w-4 h-4 text-primary" />} />
        <MetricCard label="Cliques" value={ads.totalClicks > 0 ? formatNumber(ads.totalClicks) : "—"} icon={<MousePointerClick className="w-4 h-4 text-primary" />} />
        <MetricCard
          label="ROAS"
          value={ads.avgRoas > 0 ? `${ads.avgRoas.toFixed(1)}x` : "—"}
          icon={<TrendingUp className="w-4 h-4 text-primary" />}
          subtitle={ads.avgRoas >= 3 ? "Excelente" : ads.avgRoas >= 1 ? "Positivo" : ads.avgRoas > 0 ? "Abaixo do ideal" : undefined}
        />
      </div>

      {/* Spend by platform chart */}
      {hasChartData && (
        <GlassCard size="auto">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" /> Investimento por Plataforma
          </h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={platformChartData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}`} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(value: number) => [`R$ ${formatNumber(value)}`, "Gasto"]}
                />
                <Bar dataKey="spend" radius={[6, 6, 0, 0]}>
                  {platformChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} opacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      )}

      {/* Conversion funnel */}
      {ads.totalImpressions > 0 && (
        <GlassCard size="auto">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <ArrowDownNarrowWide className="w-3.5 h-3.5 text-primary" /> Funil de Conversão
          </h3>
          <AdsFunnel data={{
            impressions: ads.totalImpressions,
            clicks: ads.totalClicks,
            conversions: (ads.campaigns ?? []).reduce((s, c) => s + c.conversions, 0),
          }} />
        </GlassCard>
      )}

      {/* Campaigns with filters */}
      <GlassCard size="auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Campanhas
            {filteredCampaigns.length > 0 && (
              <span className="text-[10px] font-normal text-muted-foreground">({filteredCampaigns.length})</span>
            )}
          </h3>

          {(ads.campaigns ?? []).length > 0 && (
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div className="flex gap-0.5 bg-foreground/5 p-0.5 rounded-lg">
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => handleStatusFilter(key)}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-all ${
                      statusFilter === key
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {platformNames.length > 1 && (
                <div className="flex gap-0.5 bg-foreground/5 p-0.5 rounded-lg">
                  <button
                    onClick={() => handlePlatformFilter("all")}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-all ${
                      platformFilter === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Todas
                  </button>
                  {platformNames.map(name => (
                    <button
                      key={name}
                      onClick={() => handlePlatformFilter(name)}
                      className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-all ${
                        platformFilter === name ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 py-8 justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="text-center py-8">
            <Megaphone className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma campanha encontrada.</p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden md:grid grid-cols-[1fr_80px_80px_70px_70px_80px_70px] gap-2 px-3 py-1.5 border-b border-foreground/5">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Campanha</span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-right">Gasto</span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-right">Impressões</span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-right">Cliques</span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-right">CTR</span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-right">CPC</span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-right">ROAS</span>
            </div>

            <div className="space-y-1">
              {paginatedCampaigns.map((c) => {
                const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
                const cpc = c.clicks > 0 ? c.spend / c.clicks : 0;
                const spendPct = (c.spend / maxSpend) * 100;
                const statusMeta = STATUS_BADGE[c.status.toLowerCase()] || STATUS_BADGE.completed;

                return (
                  <div key={c.id} className="grid grid-cols-1 md:grid-cols-[1fr_80px_80px_70px_70px_80px_70px] gap-1 md:gap-2 p-3 rounded-xl bg-foreground/[0.03] border border-foreground/5 hover:bg-foreground/[0.05] transition-colors items-center relative overflow-hidden">
                    {/* Spend progress bar background */}
                    <div
                      className="absolute inset-y-0 left-0 opacity-[0.04] pointer-events-none transition-all duration-500"
                      style={{ width: `${spendPct}%`, background: c.platformColor }}
                    />

                    {/* Campaign info */}
                    <div className="flex items-center gap-2 min-w-0 relative">
                      <div className="w-2 h-6 rounded-full shrink-0" style={{ background: c.platformColor }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">{c.platform}</span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium ${statusMeta.bg} ${statusMeta.text}`}>
                            {statusMeta.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Mobile compact row */}
                    <div className="md:hidden flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground mt-1 ml-4 relative">
                      <span>R$ {formatNumber(c.spend)}</span>
                      <span>{formatNumber(c.impressions)} imp</span>
                      <span>{formatNumber(c.clicks)} clicks</span>
                      <span>CTR {ctr.toFixed(1)}%</span>
                      <span>CPC R${cpc.toFixed(2)}</span>
                      <span className={getRoasColor(c.roas)}>{c.roas > 0 ? `${c.roas.toFixed(1)}x` : "—"}</span>
                    </div>

                    <span className="hidden md:block text-sm font-medium text-foreground text-right tabular-nums relative">R$ {formatNumber(c.spend)}</span>
                    <span className="hidden md:block text-xs text-muted-foreground text-right tabular-nums relative">{formatNumber(c.impressions)}</span>
                    <span className="hidden md:block text-xs text-muted-foreground text-right tabular-nums relative">{formatNumber(c.clicks)}</span>
                    <span className="hidden md:block text-xs text-muted-foreground text-right tabular-nums relative">{ctr > 0 ? `${ctr.toFixed(1)}%` : "—"}</span>
                    <span className="hidden md:block text-xs text-muted-foreground text-right tabular-nums relative">{cpc > 0 ? `R$${cpc.toFixed(2)}` : "—"}</span>
                    <span className={`hidden md:block text-xs font-semibold text-right tabular-nums relative ${getRoasColor(c.roas)}`}>
                      {c.roas > 0 ? `${c.roas.toFixed(1)}x` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 mt-2 border-t border-foreground/5">
                <span className="text-[11px] text-muted-foreground">
                  {page * ITEMS_PER_PAGE + 1}–{Math.min((page + 1) * ITEMS_PER_PAGE, filteredCampaigns.length)} de {filteredCampaigns.length}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-1.5 rounded-lg hover:bg-foreground/5 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="p-1.5 rounded-lg hover:bg-foreground/5 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </GlassCard>
    </>
  );
}

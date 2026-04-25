import { Users, Eye, MousePointerClick, ArrowUpRight, Loader2, Globe } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import { useAnalyticsData } from "@/hooks/social/useAnalyticsData";
import { MetricCard } from "./MetricCard";
import { EmptyState } from "./EmptyState";
import { formatNumber } from "./utils";
import { useSocialConnections } from "@/hooks/social/useSocialConnections";
import type { Period } from "./PeriodSelector";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface AnalyticsTabProps {
  period: Period;
  onGoToAccounts?: () => void;
}

export function AnalyticsTab({ period, onGoToAccounts }: AnalyticsTabProps) {
  const { analytics, isLoading, error } = useAnalyticsData(period);
  const { connectedIds } = useSocialConnections();

  const isAnalyticsConnected = connectedIds.includes("google-analytics");

  const sourcesChartData = (analytics.sources ?? []).map(s => ({
    name: s.name,
    sessions: s.sessions,
    percentage: s.percentage,
  }));

  const hasSourcesChart = sourcesChartData.some(d => d.sessions > 0);
  const maxViews = Math.max(...(analytics.topPages ?? []).map(p => p.views), 1);

  if (!isLoading && !isAnalyticsConnected) {
    return <EmptyState type="analytics" onGoToAccounts={onGoToAccounts} />;
  }

  return (
    <>
      {error && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          Erro ao carregar analytics: {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Visitantes" value={analytics.visitors > 0 ? formatNumber(analytics.visitors) : "—"} icon={<Users className="w-4 h-4 text-primary" />} />
        <MetricCard label="Pageviews" value={analytics.pageviews > 0 ? formatNumber(analytics.pageviews) : "—"} icon={<Eye className="w-4 h-4 text-primary" />} />
        <MetricCard label="Sessões" value={analytics.sessions > 0 ? formatNumber(analytics.sessions) : "—"} icon={<MousePointerClick className="w-4 h-4 text-primary" />} />
        <MetricCard
          label="Bounce Rate"
          value={analytics.bounceRate > 0 ? `${analytics.bounceRate.toFixed(1)}%` : "—"}
          icon={<ArrowUpRight className="w-4 h-4 text-primary" />}
          subtitle={analytics.bounceRate > 0 ? (analytics.bounceRate > 70 ? "Alto" : analytics.bounceRate > 40 ? "Moderado" : "Baixo") : undefined}
        />
      </div>

      {/* Traffic sources chart */}
      {hasSourcesChart && (
        <GlassCard size="auto">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" /> Fontes de Tráfego
          </h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourcesChartData} layout="vertical" barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(value: number) => [formatNumber(value), "Sessões"]}
                />
                <Bar dataKey="sessions" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      )}

      {/* Loading state for sources */}
      {!hasSourcesChart && isLoading && (
        <GlassCard size="auto">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Fontes de Tráfego
          </h3>
          <div className="flex items-center gap-2 py-6 justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        </GlassCard>
      )}

      {/* Top pages with progress bars */}
      {(analytics.topPages ?? []).length > 0 && (
        <GlassCard size="auto">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <Globe className="w-3.5 h-3.5 text-primary" /> Páginas Mais Visitadas
          </h3>
          <div className="space-y-1.5">
            {(analytics.topPages ?? []).slice(0, 10).map((p, i) => {
              const pct = (p.views / maxViews) * 100;
              return (
                <div key={p.path} className="group flex items-center gap-3 p-2 rounded-lg hover:bg-foreground/[0.03] transition-colors relative">
                  <span className={`text-[11px] w-5 font-bold tabular-nums shrink-0 text-right ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>
                    {i + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm text-foreground truncate font-mono">{p.path}</span>
                      <span className="text-xs font-semibold text-foreground tabular-nums shrink-0">{formatNumber(p.views)}</span>
                    </div>
                    <div className="h-1 rounded-full bg-foreground/5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: i < 3 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.3)',
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}
    </>
  );
}

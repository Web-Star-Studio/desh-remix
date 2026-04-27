import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Users, TrendingUp, Share2, Wifi, Loader2, ExternalLink, RefreshCw, Download, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import GlassCard from "@/components/dashboard/GlassCard";
import { useSocialConnections, type ConnectedPlatform } from "@/hooks/social/useSocialConnections";
import { useSocialOverview } from "@/hooks/social/useSocialOverview";
import { useSocialAlerts } from "@/hooks/social/useSocialAlerts";
import { SocialAlertsBanner } from "./SocialAlertsBanner";
import { SOCIAL_PLATFORMS } from "@/lib/social-integrations";
import { MetricCard } from "./MetricCard";
import { PlatformRow } from "./PlatformRow";
import { PlatformDetailInline } from "./PlatformDetailInline";
import { EmptyState } from "./EmptyState";
import { formatNumber } from "./utils";
import { OverviewCharts } from "./OverviewCharts";
import { PlatformComparisonTable } from "./PlatformComparisonTable";
import { TrendCharts } from "./TrendCharts";
import type { Period } from "./PeriodSelector";

const RANKEY_URL = "https://rankey.ai";

interface OverviewTabProps {
  period: Period;
  onGoToAccounts?: () => void;
}

export function OverviewTab({ period, onGoToAccounts }: OverviewTabProps) {
  const { overview, isLoading, error } = useSocialOverview(period);
  const { connectedPlatforms, isLoading: loadingConnections, refetch } = useSocialConnections();
  const connectedCount = connectedPlatforms.length;
  const [selectedPlatform, setSelectedPlatform] = useState<ConnectedPlatform | null>(null);
  const [exporting, setExporting] = useState(false);
  const { alerts, acknowledgeAlert } = useSocialAlerts({
    avgEngagement: overview.avgEngagement,
    avgRoas: 0,
    totalSpend: 0,
    byPlatform: overview.byPlatform,
  });

  const handleExportReport = useCallback(async () => {
    // AI-narrated reports lived on Supabase's `chat` edge fn — that's in the
    // deferred ai-router migration wave. We export a structured markdown
    // snapshot of the same numbers; users wanting analysis can run it
    // through Pandora (which has the data via the `desh` MCP).
    setExporting(true);
    try {
      const lines: string[] = [];
      lines.push(`# Relatório de Redes Sociais`);
      lines.push("");
      lines.push(`Período: **${period}** · Gerado em: ${new Date().toLocaleString("pt-BR")}`);
      lines.push("");
      lines.push(`## Visão geral`);
      lines.push("");
      lines.push(`- Seguidores: **${overview.totalFollowers.toLocaleString("pt-BR")}**`);
      lines.push(`- Engajamento médio: **${overview.avgEngagement.toFixed(1)}%**`);
      lines.push(`- Total de publicações: **${overview.totalPosts.toLocaleString("pt-BR")}**`);
      lines.push(`- Plataformas conectadas: ${connectedPlatforms.map((p) => p.name).join(", ") || "nenhuma"}`);
      lines.push("");
      if (overview.byPlatform.length > 0) {
        lines.push(`## Por plataforma`);
        lines.push("");
        lines.push(`| Plataforma | Seguidores | Engajamento | Publicações |`);
        lines.push(`| --- | ---:| ---:| ---:|`);
        for (const p of overview.byPlatform) {
          lines.push(
            `| ${p.platformName} | ${p.followers.toLocaleString("pt-BR")} | ${p.engagement.toFixed(1)}% | ${p.posts.toLocaleString("pt-BR")} |`,
          );
        }
        lines.push("");
      }
      lines.push(
        `> Para uma análise narrativa com recomendações, abra a Pandora — ela tem acesso aos mesmos dados pelo MCP \`desh\`.`,
      );
      const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-social-${period}-${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Relatório exportado com sucesso!");
    } catch {
      toast.error("Erro ao gerar relatório. Tente novamente.");
    } finally {
      setExporting(false);
    }
  }, [period, overview, connectedPlatforms]);

  const platformChartData = (overview.byPlatform ?? []).map(m => ({
    name: m.platformName,
    followers: m.followers,
    engagement: m.engagement,
    posts: m.posts,
    color: m.color,
  }));

  const hasChartData = platformChartData.some(d => d.followers > 0);

  if (!loadingConnections && connectedCount === 0) {
    return <EmptyState type="social" onGoToAccounts={onGoToAccounts} />;
  }

  return (
    <div className="space-y-5">
      {/* Alerts */}
      <SocialAlertsBanner alerts={alerts} onAcknowledge={acknowledgeAlert} />

      {error && (
        <div className="p-3.5 rounded-xl bg-destructive/8 border border-destructive/15 text-sm text-destructive flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse shrink-0" />
          Erro ao carregar dados: {error}
        </div>
      )}

      {/* Hero metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Seguidores"
          value={overview.totalFollowers > 0 ? formatNumber(overview.totalFollowers) : "—"}
          icon={<Users className="w-4 h-4 text-primary" />}
          trend={overview.growth || null}
        />
        <MetricCard
          label="Engajamento"
          value={overview.avgEngagement > 0 ? `${overview.avgEngagement.toFixed(1)}%` : "—"}
          icon={<TrendingUp className="w-4 h-4 text-primary" />}
        />
        <MetricCard
          label="Publicações"
          value={overview.totalPosts > 0 ? formatNumber(overview.totalPosts) : "—"}
          icon={<Share2 className="w-4 h-4 text-primary" />}
        />
        <MetricCard
          label="Plataformas"
          value={connectedCount}
          icon={<Wifi className="w-4 h-4 text-primary" />}
          subtitle={`de ${SOCIAL_PLATFORMS.filter(p => p.category === 'social').length} disponíveis`}
        />
      </div>

      {/* Trend line charts */}
      <TrendCharts period={period} />

      {/* Distribution + engagement charts */}
      {hasChartData && <OverviewCharts platformChartData={platformChartData} />}

      {/* Platform comparison table */}
      {platformChartData.length > 1 && <PlatformComparisonTable platformChartData={platformChartData} />}

      {/* Connected platforms section */}
      <GlassCard size="auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2.5">
            <div className="p-1 rounded-md bg-emerald-500/10">
              <Wifi className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            Plataformas Conectadas
            <span className="text-[10px] font-normal text-muted-foreground bg-foreground/[0.04] px-2 py-0.5 rounded-full">
              {connectedCount}
            </span>
          </h3>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg hover:bg-foreground/[0.06]"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        </div>
        {loadingConnections ? (
          <div className="flex items-center gap-2 py-10 justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Carregando plataformas...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {connectedPlatforms.map((p) => (
              <PlatformRow
                key={p.id}
                platform={p}
                isSelected={selectedPlatform?.id === p.id}
                onClick={() => setSelectedPlatform(prev => prev?.id === p.id ? null : p)}
              />
            ))}
          </div>
        )}
      </GlassCard>

      {/* Inline platform detail */}
      {selectedPlatform && (
        <PlatformDetailInline platform={selectedPlatform} onClose={() => setSelectedPlatform(null)} />
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-1 pb-3">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="gap-2 rounded-xl hover:border-primary/30 transition-colors text-xs"
        >
          <a href={RANKEY_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3 w-3" /> Publicar no Rankey
          </a>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 rounded-xl text-xs"
          onClick={handleExportReport}
          disabled={exporting || overview.totalFollowers === 0}
        >
          {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          {exporting ? "Gerando..." : "Exportar Relatório"}
        </Button>
      </div>
    </div>
  );
}

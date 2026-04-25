import { Loader2, RefreshCw, Shield, Zap, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSocialConnections } from "@/hooks/social/useSocialConnections";
import { PlatformSection } from "./PlatformSection";

const SECTION_META: Record<string, { icon: React.ReactNode; description: string }> = {
  social: {
    icon: <Zap className="w-3.5 h-3.5 text-primary" />,
    description: "Conecte seus perfis para monitorar seguidores, engajamento e publicações.",
  },
  ads: {
    icon: <Shield className="w-3.5 h-3.5 text-primary" />,
    description: "Vincule suas plataformas de anúncios para acompanhar gastos, ROAS e campanhas.",
  },
  analytics: {
    icon: <BarChart3 className="w-3.5 h-3.5 text-primary" />,
    description: "Conecte ferramentas de analytics para tráfego, sessões e bounce rate.",
  },
};

export function AccountsTab() {
  const { platforms, connect, disconnect, isLoading, refetch } = useSocialConnections();
  const socialPlatforms = platforms.filter(p => p.category === "social");
  const adsPlatforms = platforms.filter(p => p.category === "ads");
  const analyticsPlatforms = platforms.filter(p => p.category === "analytics");

  const totalConnected = platforms.filter(p => p.connected).length;

  if (isLoading) {
    return <div className="flex items-center gap-2 py-12 justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <>
      {/* Summary bar */}
      <div className="flex items-center justify-between p-3 rounded-xl border border-foreground/5 bg-foreground/[0.02]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${totalConnected > 0 ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
            <span className="text-sm font-medium text-foreground">{totalConnected} conexão{totalConnected !== 1 ? "ões" : ""} ativa{totalConnected !== 1 ? "s" : ""}</span>
          </div>
          <span className="text-xs text-muted-foreground">de {platforms.length} disponíveis</span>
        </div>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" onClick={() => refetch()}>
          <RefreshCw className="h-3 w-3" /> Atualizar
        </Button>
      </div>

      <PlatformSection
        title="Redes Sociais"
        platforms={socialPlatforms}
        onConnect={connect}
        onDisconnect={disconnect}
        description={SECTION_META.social.description}
      />
      <PlatformSection
        title="Anúncios"
        platforms={adsPlatforms}
        onConnect={connect}
        onDisconnect={disconnect}
        description={SECTION_META.ads.description}
      />
      {analyticsPlatforms.length > 0 && (
        <PlatformSection
          title="Analytics"
          platforms={analyticsPlatforms}
          onConnect={connect}
          onDisconnect={disconnect}
          description={SECTION_META.analytics.description}
        />
      )}
    </>
  );
}

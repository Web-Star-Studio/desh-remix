/**
 * useAdsData — Aggregated ads campaign data across CONNECTED ad platforms.
 *
 * NOTE: Zernio's ads campaign read endpoints aren't wired up yet on apps/api.
 * Until they are, this hook returns an empty structure so the UI renders
 * the empty state cleanly. To enable: extend `services/zernio.ts` with an
 * `ads.campaignsList({ profileId, accountId, platform, period })` helper +
 * a `/workspaces/:id/zernio/ads/campaigns` route, then plumb through here.
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useSocialConnections } from "./useSocialConnections";

export interface AdCampaign {
  id: string;
  name: string;
  platform: string;
  platformColor: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  roas: number;
}

export interface AdsOverview {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  avgRoas: number;
  campaigns: AdCampaign[];
  byPlatform: { name: string; spend: number; roas: number; color: string }[];
}

const EMPTY: AdsOverview = {
  totalSpend: 0,
  totalImpressions: 0,
  totalClicks: 0,
  avgRoas: 0,
  campaigns: [],
  byPlatform: [],
};

export function useAdsData(_period: "7d" | "30d" | "90d" = "30d") {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const { connectedIds } = useSocialConnections();

  const { data, isLoading, error } = useQuery({
    queryKey: ["ads_data", user?.id, activeWorkspaceId, _period, connectedIds],
    enabled: !!user && !!activeWorkspaceId && connectedIds.length > 0,
    staleTime: 5 * 60_000,
    retry: 0,
    queryFn: async (): Promise<AdsOverview> => {
      // TODO(zernio-ads): replace with /workspaces/:id/zernio/ads/campaigns
      // once the route + Zernio service helper land.
      return EMPTY;
    },
  });

  return {
    ads: data ?? EMPTY,
    isLoading,
    error: error?.message ?? null,
  };
}

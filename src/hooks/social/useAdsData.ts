/**
 * useAdsData — Aggregated ads campaign data across CONNECTED ad platforms only
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { getAdsPlatforms } from "@/lib/social-integrations";
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

const EMPTY: AdsOverview = { totalSpend: 0, totalImpressions: 0, totalClicks: 0, avgRoas: 0, campaigns: [], byPlatform: [] };

export function useAdsData(period: '7d' | '30d' | '90d' = '30d') {
  const { user } = useAuth();
  const { activeWorkspaceId, defaultWorkspace } = useWorkspace();
  const effectiveWsId = activeWorkspaceId || defaultWorkspace?.id || "default";
  const { connectedIds } = useSocialConnections();

  const { data, isLoading, error } = useQuery({
    queryKey: ["ads_data", user?.id, effectiveWsId, period, connectedIds],
    enabled: !!user && connectedIds.length > 0,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async (): Promise<AdsOverview> => {
      // Only fetch for connected ads platforms
      const connectedAds = getAdsPlatforms().filter(p => connectedIds.includes(p.id));
      if (connectedAds.length === 0) return EMPTY;

      const allCampaigns: AdCampaign[] = [];
      const platformSpend: { name: string; spend: number; roas: number; color: string }[] = [];

      const fetches = connectedAds.map(async (platform) => {
        try {
          const { data: result, error: fnError } = await supabase.functions.invoke("composio-proxy", {
            body: {
              service: platform.composioToolkit,
              path: "/campaigns",
              method: "GET",
              params: { period },
              workspace_id: effectiveWsId,
            },
          });

          if (fnError || result?.error) return;

          const campaigns = Array.isArray(result) ? result : result?.campaigns || result?.data || [];
          let platformTotalSpend = 0;
          let platformTotalRevenue = 0;

          for (const c of campaigns) {
            const spend = c.spend || c.cost || c.amount_spent || 0;
            const revenue = c.revenue || c.conversion_value || 0;
            platformTotalSpend += spend;
            platformTotalRevenue += revenue;

            allCampaigns.push({
              id: c.id || c.campaign_id,
              name: c.name || c.campaign_name || "Campaign",
              platform: platform.name,
              platformColor: platform.color,
              status: c.status || "active",
              spend,
              impressions: c.impressions || 0,
              clicks: c.clicks || 0,
              conversions: c.conversions || 0,
              roas: spend > 0 ? revenue / spend : 0,
            });
          }

          platformSpend.push({
            name: platform.name,
            spend: platformTotalSpend,
            roas: platformTotalSpend > 0 ? platformTotalRevenue / platformTotalSpend : 0,
            color: platform.color,
          });
        } catch {
          // Platform action not available
        }
      });

      await Promise.allSettled(fetches);

      const totalSpend = allCampaigns.reduce((s, c) => s + c.spend, 0);
      const totalImpressions = allCampaigns.reduce((s, c) => s + c.impressions, 0);
      const totalClicks = allCampaigns.reduce((s, c) => s + c.clicks, 0);
      const totalRevenue = allCampaigns.reduce((s, c) => s + (c.spend * c.roas), 0);
      const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

      return {
        totalSpend,
        totalImpressions,
        totalClicks,
        avgRoas,
        campaigns: allCampaigns.sort((a, b) => b.spend - a.spend),
        byPlatform: platformSpend,
      };
    },
  });

  return {
    ads: data ?? EMPTY,
    isLoading,
    error: error?.message ?? null,
  };
}

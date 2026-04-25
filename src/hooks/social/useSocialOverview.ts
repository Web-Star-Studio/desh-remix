/**
 * useSocialOverview — Aggregated metrics across connected social platforms only
 * Only fetches data for platforms the user has actually connected.
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { SOCIAL_PLATFORMS } from "@/lib/social-integrations";
import { useSocialConnections } from "./useSocialConnections";

export interface PlatformMetric {
  platformId: string;
  platformName: string;
  followers: number;
  engagement: number;
  posts: number;
  color: string;
}

export interface SocialOverviewData {
  totalFollowers: number;
  avgEngagement: number;
  totalPosts: number;
  growth: number;
  byPlatform: PlatformMetric[];
}

const EMPTY: SocialOverviewData = { totalFollowers: 0, avgEngagement: 0, totalPosts: 0, growth: 0, byPlatform: [] };

export function useSocialOverview(period: '7d' | '30d' | '90d' = '30d') {
  const { user } = useAuth();
  const { activeWorkspaceId, defaultWorkspace } = useWorkspace();
  const effectiveWsId = activeWorkspaceId || defaultWorkspace?.id || "default";
  const { connectedIds } = useSocialConnections();

  const { data, isLoading, error } = useQuery({
    queryKey: ["social_overview", user?.id, effectiveWsId, connectedIds, period],
    enabled: !!user && connectedIds.length > 0,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async (): Promise<SocialOverviewData> => {
      const connectedSocial = SOCIAL_PLATFORMS.filter(
        p => p.category === "social" && connectedIds.includes(p.id)
      );

      if (connectedSocial.length === 0) return EMPTY;

      const metrics: PlatformMetric[] = [];

      const fetches = connectedSocial.map(async (platform) => {
        try {
          const { data: result, error: fnError } = await supabase.functions.invoke("composio-proxy", {
            body: {
              service: platform.composioToolkit,
              path: "/insights",
              method: "GET",
              params: { period },
              workspace_id: effectiveWsId,
            },
          });

          if (fnError || result?.error) return null;

          return {
            platformId: platform.id,
            platformName: platform.name,
            followers: result?.followers_count ?? result?.followersCount ?? result?.subscribers ?? 0,
            engagement: result?.engagement_rate ?? result?.engagementRate ?? 0,
            posts: result?.media_count ?? result?.posts_count ?? result?.postsCount ?? 0,
            color: platform.color,
          } as PlatformMetric;
        } catch {
          return null;
        }
      });

      const results = await Promise.allSettled(fetches);
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          metrics.push(r.value);
        }
      }

      const totalFollowers = metrics.reduce((s, m) => s + m.followers, 0);
      const avgEngagement = metrics.length > 0
        ? metrics.reduce((s, m) => s + m.engagement, 0) / metrics.length
        : 0;
      const totalPosts = metrics.reduce((s, m) => s + m.posts, 0);

      return { totalFollowers, avgEngagement, totalPosts, growth: 0, byPlatform: metrics };
    },
  });

  return {
    overview: data ?? EMPTY,
    isLoading,
    error: error?.message ?? null,
  };
}

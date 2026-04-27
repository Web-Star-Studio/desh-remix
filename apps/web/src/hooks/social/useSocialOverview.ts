/**
 * useSocialOverview — Aggregated metrics across CONNECTED social platforms.
 * Reads cached metadata from `social_accounts.meta` (synced from Zernio on
 * connect + manual /sync-accounts). No upstream call per render — keeps the
 * page responsive and tenancy-clean (DB rows are workspace-scoped).
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
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

const EMPTY: SocialOverviewData = {
  totalFollowers: 0,
  avgEngagement: 0,
  totalPosts: 0,
  growth: 0,
  byPlatform: [],
};

function num(meta: unknown, key: string): number {
  if (!meta || typeof meta !== "object") return 0;
  const v = (meta as Record<string, unknown>)[key];
  return typeof v === "number" ? v : 0;
}

export function useSocialOverview(_period: "7d" | "30d" | "90d" = "30d") {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const { platforms } = useSocialConnections();

  // Period filtering will plug in when Zernio's per-account insights endpoint
  // is wired (then this hook fans out to /zernio/social/insights). For now
  // the overview reflects the snapshot in social_accounts.meta.
  const { data, isLoading } = useQuery({
    queryKey: ["social_overview", user?.id, activeWorkspaceId, platforms.map((p) => p.zernioAccountId).join(",")],
    enabled: !!user && !!activeWorkspaceId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SocialOverviewData> => {
      const connectedSocial = platforms.filter((p) => p.connected && p.category === "social");
      if (connectedSocial.length === 0) return EMPTY;

      const metrics: PlatformMetric[] = connectedSocial.map((p) => {
        const meta = (p as { meta?: unknown }).meta;
        return {
          platformId: p.id,
          platformName: p.name,
          followers: num(meta, "followers"),
          engagement: num(meta, "engagementRate"),
          posts: num(meta, "postsCount"),
          color: p.color,
        };
      });

      const totalFollowers = metrics.reduce((s, m) => s + m.followers, 0);
      const avgEngagement =
        metrics.length > 0 ? metrics.reduce((s, m) => s + m.engagement, 0) / metrics.length : 0;
      const totalPosts = metrics.reduce((s, m) => s + m.posts, 0);

      return { totalFollowers, avgEngagement, totalPosts, growth: 0, byPlatform: metrics };
    },
  });

  return {
    overview: data ?? EMPTY,
    isLoading,
    error: null as string | null,
  };
}

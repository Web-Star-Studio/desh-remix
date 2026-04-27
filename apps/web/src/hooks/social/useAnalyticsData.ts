/**
 * useAnalyticsData — Google Analytics overview.
 *
 * Zernio doesn't cover Google Analytics. Until a first-party analytics
 * source is wired (or until we re-add a narrow Composio carve-out for GA
 * specifically), this hook returns an empty structure so the Analytics tab
 * renders the empty state cleanly.
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useSocialConnections } from "./useSocialConnections";

export interface AnalyticsOverview {
  visitors: number;
  pageviews: number;
  sessions: number;
  bounceRate: number;
  avgSessionDuration: number;
  realtimeVisitors: number;
  sources: { name: string; sessions: number; percentage: number }[];
  topPages: { path: string; views: number }[];
}

const EMPTY: AnalyticsOverview = {
  visitors: 0,
  pageviews: 0,
  sessions: 0,
  bounceRate: 0,
  avgSessionDuration: 0,
  realtimeVisitors: 0,
  sources: [],
  topPages: [],
};

export function useAnalyticsData(_period: "7d" | "30d" | "90d" = "30d") {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const { connectedIds } = useSocialConnections();
  const isAnalyticsConnected = connectedIds.includes("google-analytics");

  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics_data", user?.id, activeWorkspaceId, _period, isAnalyticsConnected],
    enabled: !!user && !!activeWorkspaceId && isAnalyticsConnected,
    staleTime: 5 * 60_000,
    retry: 0,
    queryFn: async (): Promise<AnalyticsOverview> => {
      // TODO(analytics): wire to /workspaces/:id/analytics/report when a
      // first-party GA integration ships. Zernio does not cover Analytics.
      return EMPTY;
    },
  });

  return {
    analytics: data ?? EMPTY,
    isLoading,
    error: error?.message ?? null,
  };
}

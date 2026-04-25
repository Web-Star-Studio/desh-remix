/**
 * useAnalyticsData — Google Analytics data via Composio (only if connected)
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
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
  visitors: 0, pageviews: 0, sessions: 0, bounceRate: 0,
  avgSessionDuration: 0, realtimeVisitors: 0, sources: [], topPages: [],
};

export function useAnalyticsData(period: '7d' | '30d' | '90d' = '30d') {
  const { user } = useAuth();
  const { activeWorkspaceId, defaultWorkspace } = useWorkspace();
  const effectiveWsId = activeWorkspaceId || defaultWorkspace?.id || "default";
  const { connectedIds } = useSocialConnections();

  const isAnalyticsConnected = connectedIds.includes("google-analytics");

  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics_data", user?.id, effectiveWsId, period, isAnalyticsConnected],
    enabled: !!user && isAnalyticsConnected,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async (): Promise<AnalyticsOverview> => {
      try {
        const { data: result, error: fnError } = await supabase.functions.invoke("composio-proxy", {
          body: {
            service: "googleanalytics",
            path: "/report",
            method: "GET",
            params: { period },
            workspace_id: effectiveWsId,
          },
        });

        if (fnError || result?.error) return EMPTY;

        return {
          visitors: result?.users || result?.visitors || 0,
          pageviews: result?.pageviews || result?.screenPageViews || 0,
          sessions: result?.sessions || 0,
          bounceRate: result?.bounceRate || 0,
          avgSessionDuration: result?.avgSessionDuration || 0,
          realtimeVisitors: 0,
          sources: (result?.sources || []).map((s: any) => ({
            name: s.source || s.name,
            sessions: s.sessions || s.count || 0,
            percentage: s.percentage || 0,
          })),
          topPages: (result?.pages || result?.topPages || []).map((p: any) => ({
            path: p.pagePath || p.path || p.page,
            views: p.screenPageViews || p.views || p.pageviews || 0,
          })),
        };
      } catch {
        return EMPTY;
      }
    },
  });

  return {
    analytics: data ?? EMPTY,
    isLoading,
    error: error?.message ?? null,
  };
}

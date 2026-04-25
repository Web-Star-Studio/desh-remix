/**
 * useSocialTrend — Fetches historical snapshots and auto-saves today's metrics
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useSocialOverview, type PlatformMetric } from "./useSocialOverview";
import { useEffect, useRef } from "react";

export interface TrendPoint {
  date: string;
  followers: number;
  engagement: number;
}

function daysForPeriod(period: string) {
  return period === "7d" ? 7 : period === "90d" ? 90 : 30;
}

export function useSocialTrend(period: '7d' | '30d' | '90d' = '30d') {
  const { user } = useAuth();
  const { overview } = useSocialOverview(period);
  const savedRef = useRef(false);

  // Auto-save today's snapshot when overview loads
  useEffect(() => {
    if (!user || savedRef.current || overview.byPlatform.length === 0) return;
    savedRef.current = true;

    const upserts = overview.byPlatform.map((m: PlatformMetric) => ({
      user_id: user.id,
      platform_id: m.platformId,
      platform_name: m.platformName,
      followers: m.followers,
      engagement: m.engagement,
      posts: m.posts,
      snapshot_date: new Date().toISOString().slice(0, 10),
    }));

    (supabase as any)
      .from("social_metric_snapshots")
      .upsert(upserts, { onConflict: "user_id,platform_id,snapshot_date" })
      .then(() => {});
  }, [user, overview.byPlatform]);

  const days = daysForPeriod(period);
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  const { data: snapshots } = useQuery({
    queryKey: ["social_trend", user?.id, period],
    enabled: !!user,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("social_metric_snapshots")
        .select("snapshot_date, followers, engagement")
        .eq("user_id", user!.id)
        .gte("snapshot_date", sinceStr)
        .order("snapshot_date", { ascending: true });
      return (data ?? []) as { snapshot_date: string; followers: number; engagement: number }[];
    },
  });

  // Aggregate by date (sum followers, avg engagement across platforms)
  const trendData: TrendPoint[] = [];

  if (snapshots && snapshots.length > 0) {
    const byDate = new Map<string, { followers: number; engSum: number; count: number }>();
    for (const s of snapshots) {
      const existing = byDate.get(s.snapshot_date) ?? { followers: 0, engSum: 0, count: 0 };
      existing.followers += s.followers;
      existing.engSum += Number(s.engagement);
      existing.count += 1;
      byDate.set(s.snapshot_date, existing);
    }
    for (const [date, val] of byDate) {
      trendData.push({
        date,
        followers: val.followers,
        engagement: Number((val.engSum / val.count).toFixed(1)),
      });
    }
  }

  return { trendData, hasTrend: trendData.length >= 2 };
}

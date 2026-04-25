import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useEffect, useRef } from "react";

export interface SocialAlert {
  id: string;
  alert_type: string;
  title: string;
  message: string;
  severity: string;
  platform: string | null;
  metric_value: number | null;
  threshold_value: number | null;
  acknowledged: boolean;
  created_at: string;
}

interface AlertCheckParams {
  avgEngagement: number;
  previousEngagement?: number;
  avgRoas: number;
  totalSpend: number;
  campaigns?: Array<{ name: string; platform: string; spend: number; budget?: number; roas: number; status?: string }>;
  byPlatform?: Array<{ platformName: string; engagement: number; followers: number }>;
}

export function useSocialAlerts(checkParams?: AlertCheckParams) {
  const { user } = useAuth();
  const { activeWorkspaceId, defaultWorkspace } = useWorkspace();
  const wsId = activeWorkspaceId || defaultWorkspace?.id;
  const qc = useQueryClient();
  const hasChecked = useRef(false);

  const query = useQuery({
    queryKey: ["social_alerts", user?.id, wsId],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<SocialAlert[]> => {
      const { data, error } = await supabase
        .from("social_alerts")
        .select("*")
        .eq("acknowledged", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as SocialAlert[];
    },
  });

  const acknowledge = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("social_alerts")
        .update({ acknowledged: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social_alerts"] }),
  });

  const createAlert = useMutation({
    mutationFn: async (alert: Omit<SocialAlert, "id" | "acknowledged" | "created_at">) => {
      const { error } = await supabase.from("social_alerts").insert({
        user_id: user!.id,
        workspace_id: wsId ?? null,
        ...alert,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social_alerts"] }),
  });

  // Auto-check alerts based on metrics
  useEffect(() => {
    if (!user || !checkParams || hasChecked.current) return;
    hasChecked.current = true;

    const alerts: Omit<SocialAlert, "id" | "acknowledged" | "created_at">[] = [];

    // ROAS below threshold
    if (checkParams.avgRoas > 0 && checkParams.avgRoas < 1.0) {
      alerts.push({
        alert_type: "low_roas",
        title: "ROAS abaixo de 1.0x",
        message: `Seu ROAS médio está em ${checkParams.avgRoas.toFixed(1)}x, indicando que você está gastando mais do que retorna. Revise suas campanhas.`,
        severity: "warning",
        platform: null,
        metric_value: checkParams.avgRoas,
        threshold_value: 1.0,
      });
    }

    // Engagement drop (if previous available)
    if (checkParams.previousEngagement && checkParams.avgEngagement > 0) {
      const drop = ((checkParams.previousEngagement - checkParams.avgEngagement) / checkParams.previousEngagement) * 100;
      if (drop > 20) {
        alerts.push({
          alert_type: "engagement_drop",
          title: "Queda no engajamento",
          message: `Engajamento caiu ${drop.toFixed(0)}% em relação ao período anterior (de ${checkParams.previousEngagement.toFixed(1)}% para ${checkParams.avgEngagement.toFixed(1)}%).`,
          severity: "critical",
          platform: null,
          metric_value: checkParams.avgEngagement,
          threshold_value: checkParams.previousEngagement,
        });
      }
    }

    // Campaign budget exhaustion
    checkParams.campaigns?.forEach((c) => {
      if (c.budget && c.budget > 0 && c.spend >= c.budget * 0.9 && c.status === "active") {
        alerts.push({
          alert_type: "budget_exhaustion",
          title: `Budget quase esgotado: ${c.name}`,
          message: `A campanha "${c.name}" (${c.platform}) já consumiu ${((c.spend / c.budget) * 100).toFixed(0)}% do budget.`,
          severity: "warning",
          platform: c.platform,
          metric_value: c.spend,
          threshold_value: c.budget,
        });
      }
    });

    // Fire alerts (skip duplicates by checking existing)
    if (alerts.length > 0) {
      const existingTypes = (query.data ?? []).map((a) => a.alert_type + (a.platform || ""));
      alerts
        .filter((a) => !existingTypes.includes(a.alert_type + (a.platform || "")))
        .forEach((a) => createAlert.mutate(a));
    }
  }, [user, checkParams, query.data]);

  return {
    alerts: query.data ?? [],
    isLoading: query.isLoading,
    acknowledgeAlert: acknowledge.mutateAsync,
  };
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useEffect, useRef } from "react";

export interface SocialAlert {
  id: string;
  alertType: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  platform: string | null;
  metricValue: number | null;
  thresholdValue: number | null;
  acknowledged: boolean;
  createdAt: string;
}

interface AlertCheckParams {
  avgEngagement: number;
  previousEngagement?: number;
  avgRoas: number;
  totalSpend: number;
  campaigns?: Array<{
    name: string;
    platform: string;
    spend: number;
    budget?: number;
    roas: number;
    status?: string;
  }>;
  byPlatform?: Array<{ platformName: string; engagement: number; followers: number }>;
}

type CreateInput = Omit<SocialAlert, "id" | "acknowledged" | "createdAt">;

export function useSocialAlerts(checkParams?: AlertCheckParams) {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const qc = useQueryClient();
  const hasChecked = useRef(false);

  const query = useQuery({
    queryKey: ["social_alerts", user?.id, activeWorkspaceId],
    enabled: !!user && !!activeWorkspaceId,
    staleTime: 60_000,
    queryFn: async (): Promise<SocialAlert[]> => {
      if (!activeWorkspaceId) return [];
      const res = await apiFetch<{ alerts: SocialAlert[] }>(
        `/workspaces/${activeWorkspaceId}/social-alerts`,
      );
      return res.alerts ?? [];
    },
  });

  const acknowledge = useMutation({
    mutationFn: async (id: string) => {
      if (!activeWorkspaceId) throw new Error("no_workspace");
      await apiFetch(`/workspaces/${activeWorkspaceId}/social-alerts/${id}/acknowledge`, {
        method: "PATCH",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social_alerts"] }),
  });

  const createAlert = useMutation({
    mutationFn: async (alert: CreateInput) => {
      if (!activeWorkspaceId) throw new Error("no_workspace");
      await apiFetch(`/workspaces/${activeWorkspaceId}/social-alerts`, {
        method: "POST",
        body: JSON.stringify(alert),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social_alerts"] }),
  });

  // Auto-check alerts based on metrics
  useEffect(() => {
    if (!user || !checkParams || hasChecked.current) return;
    hasChecked.current = true;

    const alerts: CreateInput[] = [];

    // ROAS below threshold
    if (checkParams.avgRoas > 0 && checkParams.avgRoas < 1.0) {
      alerts.push({
        alertType: "low_roas",
        title: "ROAS abaixo de 1.0x",
        message: `Seu ROAS médio está em ${checkParams.avgRoas.toFixed(1)}x, indicando que você está gastando mais do que retorna. Revise suas campanhas.`,
        severity: "warning",
        platform: null,
        metricValue: checkParams.avgRoas,
        thresholdValue: 1.0,
      });
    }

    // Engagement drop
    if (checkParams.previousEngagement && checkParams.avgEngagement > 0) {
      const drop =
        ((checkParams.previousEngagement - checkParams.avgEngagement) /
          checkParams.previousEngagement) *
        100;
      if (drop > 20) {
        alerts.push({
          alertType: "engagement_drop",
          title: "Queda no engajamento",
          message: `Engajamento caiu ${drop.toFixed(0)}% em relação ao período anterior (de ${checkParams.previousEngagement.toFixed(1)}% para ${checkParams.avgEngagement.toFixed(1)}%).`,
          severity: "critical",
          platform: null,
          metricValue: checkParams.avgEngagement,
          thresholdValue: checkParams.previousEngagement,
        });
      }
    }

    // Campaign budget exhaustion
    checkParams.campaigns?.forEach((c) => {
      if (c.budget && c.budget > 0 && c.spend >= c.budget * 0.9 && c.status === "active") {
        alerts.push({
          alertType: "budget_exhaustion",
          title: `Budget quase esgotado: ${c.name}`,
          message: `A campanha "${c.name}" (${c.platform}) já consumiu ${((c.spend / c.budget) * 100).toFixed(0)}% do budget.`,
          severity: "warning",
          platform: c.platform,
          metricValue: c.spend,
          thresholdValue: c.budget,
        });
      }
    });

    // Fire alerts (skip duplicates by checking existing).
    if (alerts.length > 0) {
      const existingTypes = (query.data ?? []).map((a) => a.alertType + (a.platform || ""));
      alerts
        .filter((a) => !existingTypes.includes(a.alertType + (a.platform || "")))
        .forEach((a) => createAlert.mutate(a));
    }
  }, [user, checkParams, query.data, createAlert]);

  return {
    alerts: query.data ?? [],
    isLoading: query.isLoading,
    acknowledgeAlert: acknowledge.mutateAsync,
  };
}

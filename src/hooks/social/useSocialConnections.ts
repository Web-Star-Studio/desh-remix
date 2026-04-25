/**
 * useSocialConnections — Manages social platform connections via Composio
 * Uses integrations-connect/status for efficient batch checking instead of per-platform calls.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { SOCIAL_PLATFORMS, type SocialPlatformConfig } from "@/lib/social-integrations";
import { toast } from "sonner";

export interface ConnectedPlatform extends SocialPlatformConfig {
  connected: boolean;
  email?: string | null;
  connectedAt?: string | null;
  error?: string;
}

export function useSocialConnections() {
  const { user } = useAuth();
  const { activeWorkspaceId, defaultWorkspace } = useWorkspace();
  const effectiveWsId = activeWorkspaceId || defaultWorkspace?.id || "default";
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["social_connections", user?.id, effectiveWsId],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ConnectedPlatform[]> => {
      try {
        const { data: result, error } = await supabase.functions.invoke("integrations-connect", {
          body: {
            action: "status",
            workspace_id: effectiveWsId,
          },
        });

        if (error || !result) {
          return SOCIAL_PLATFORMS.map(p => ({ ...p, connected: false }));
        }

        const connectedToolkits = new Set<string>(
          (result.connected || []).map((t: string) => t.toLowerCase())
        );

        const detailedMap = new Map<string, { email?: string | null; connectedAt?: string | null }>();
        for (const d of result.detailed || []) {
          const slug = (d.toolkit || "").toLowerCase();
          detailedMap.set(slug, { email: d.email, connectedAt: d.connectedAt });
        }

        return SOCIAL_PLATFORMS.map(platform => {
          const toolkit = platform.composioToolkit.toLowerCase();
          const isConnected = connectedToolkits.has(toolkit);
          const detail = detailedMap.get(toolkit);

          return {
            ...platform,
            connected: isConnected,
            email: detail?.email ?? null,
            connectedAt: detail?.connectedAt ?? null,
          };
        });
      } catch {
        return SOCIAL_PLATFORMS.map(p => ({ ...p, connected: false }));
      }
    },
  });

  const platforms = data ?? SOCIAL_PLATFORMS.map(p => ({ ...p, connected: false }));
  const connectedPlatforms = platforms.filter(p => p.connected);
  const connectedIds = connectedPlatforms.map(p => p.id);

  const connect = async (platformId: string) => {
    const platform = SOCIAL_PLATFORMS.find(p => p.id === platformId);
    if (!platform) return;

    try {
      const { data: result, error } = await supabase.functions.invoke("integrations-connect", {
        body: {
          action: "connect",
          toolkit: platform.composioToolkit,
          workspace_id: effectiveWsId,
        },
      });

      if (error || !result?.url) {
        toast.error("Não foi possível iniciar a conexão");
        return;
      }

      window.open(result.url, "_blank", "noopener,noreferrer");
      // Auto-refresh after a delay to check new connection
      setTimeout(() => refetch(), 10_000);
    } catch {
      toast.error("Erro ao conectar plataforma");
    }
  };

  const disconnect = async (platformId: string) => {
    const platform = SOCIAL_PLATFORMS.find(p => p.id === platformId);
    if (!platform) return;

    try {
      const { data: result, error } = await supabase.functions.invoke("integrations-connect", {
        body: {
          action: "disconnect",
          toolkit: platform.composioToolkit,
          workspace_id: effectiveWsId,
        },
      });

      if (error || !result?.success) {
        toast.error("Não foi possível desconectar");
        return;
      }

      toast.success(`${platform.name} desconectado`);
      // Invalidate all social queries
      queryClient.invalidateQueries({ queryKey: ["social_connections"] });
      queryClient.invalidateQueries({ queryKey: ["social_overview"] });
      queryClient.invalidateQueries({ queryKey: ["platform_profile"] });
      queryClient.invalidateQueries({ queryKey: ["platform_posts"] });
    } catch {
      toast.error("Erro ao desconectar");
    }
  };

  return {
    platforms,
    connectedPlatforms,
    connectedIds,
    connect,
    disconnect,
    isLoading,
    refetch,
  };
}

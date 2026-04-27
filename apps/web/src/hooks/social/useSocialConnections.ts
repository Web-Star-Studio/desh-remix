/**
 * useSocialConnections — Manages social platform connections via Zernio.
 * Backed by apps/api `/workspaces/:id/zernio/{accounts,social/connect/:platform,
 * social/accounts/:accountId}`. Each workspace's Zernio profile id is injected
 * server-side; the SPA never sees other workspaces' accounts.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { SOCIAL_PLATFORMS, type SocialPlatformConfig } from "@/lib/social-integrations";
import { toast } from "sonner";

export interface ConnectedPlatform extends SocialPlatformConfig {
  connected: boolean;
  /** First connected account's username on this platform, when known. */
  email?: string | null;
  connectedAt?: string | null;
  /** Zernio account id, used by hooks that need to operate per-account. */
  zernioAccountId?: string | null;
  error?: string;
}

interface ZernioAccountRow {
  id: string;
  workspaceId: string;
  socialProfileId: string | null;
  zernioAccountId: string;
  platform: string;
  username: string | null;
  avatarUrl: string | null;
  status: string;
  meta: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export function useSocialConnections() {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["social_connections", user?.id, activeWorkspaceId],
    enabled: !!user && !!activeWorkspaceId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ConnectedPlatform[]> => {
      if (!activeWorkspaceId) return SOCIAL_PLATFORMS.map((p): ConnectedPlatform => ({
        ...p,
        connected: false,
        email: null,
        connectedAt: null,
        zernioAccountId: null,
      }));
      try {
        const res = await apiFetch<{ accounts: ZernioAccountRow[] }>(
          `/workspaces/${activeWorkspaceId}/zernio/accounts`,
        );

        // Index live accounts by Zernio platform slug. We pick the most
        // recent active row per platform so the card reflects current state.
        const activeByPlatform = new Map<string, ZernioAccountRow>();
        for (const row of res.accounts ?? []) {
          if (row.status !== "active") continue;
          const slug = (row.platform || "").toLowerCase();
          const existing = activeByPlatform.get(slug);
          if (!existing || new Date(row.updatedAt) > new Date(existing.updatedAt)) {
            activeByPlatform.set(slug, row);
          }
        }

        return SOCIAL_PLATFORMS.map((platform) => {
          const slug = platform.zernioPlatform.toLowerCase();
          const row = activeByPlatform.get(slug);
          return {
            ...platform,
            connected: Boolean(row),
            email: row?.username ?? null,
            connectedAt: row?.createdAt ?? null,
            zernioAccountId: row?.zernioAccountId ?? null,
          };
        });
      } catch {
        return SOCIAL_PLATFORMS.map((p): ConnectedPlatform => ({
        ...p,
        connected: false,
        email: null,
        connectedAt: null,
        zernioAccountId: null,
      }));
      }
    },
  });

  const platforms = data ?? SOCIAL_PLATFORMS.map((p): ConnectedPlatform => ({
        ...p,
        connected: false,
        email: null,
        connectedAt: null,
        zernioAccountId: null,
      }));
  const connectedPlatforms = platforms.filter((p) => p.connected);
  const connectedIds = connectedPlatforms.map((p) => p.id);

  const connect = async (platformId: string) => {
    const platform = SOCIAL_PLATFORMS.find((p) => p.id === platformId);
    if (!platform || !activeWorkspaceId) {
      toast.error("Selecione um workspace antes de conectar");
      return;
    }
    try {
      // Where Zernio should send the user back after OAuth — drop them on
      // /social with a hint flag so the page can resync accounts.
      const redirectUrl = `${window.location.origin}/social?zernio_callback=1&platform=${encodeURIComponent(platform.zernioPlatform)}`;
      const res = await apiFetch<{ authUrl: string }>(
        `/workspaces/${activeWorkspaceId}/zernio/social/connect/${encodeURIComponent(platform.zernioPlatform)}?redirectUrl=${encodeURIComponent(redirectUrl)}`,
      );
      if (!res.authUrl) {
        toast.error("Não foi possível iniciar a conexão");
        return;
      }
      window.open(res.authUrl, "_blank", "noopener,noreferrer");
      // Auto-refresh after a delay to pick up the new connection.
      setTimeout(() => {
        void refetch();
        // Also kick a sync so the freshly-connected account lands in
        // social_accounts before the next render.
        void apiFetch(`/workspaces/${activeWorkspaceId}/zernio/sync-accounts`, { method: "POST" }).catch(() => undefined);
      }, 10_000);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 503) {
          toast.error("Integração Zernio não configurada", {
            description: "Configure ZERNIO_API_KEY no servidor para habilitar conexões.",
          });
          return;
        }
        if (err.status === 409) {
          toast.error("Workspace ainda sem profile Zernio", {
            description:
              "Aguarde alguns segundos após criar o workspace — o profile é criado automaticamente.",
          });
          return;
        }
        // Surface upstream Zernio errors with code + message so the user can
        // see whether the platform is unsupported, the API key is rejected,
        // etc., without having to open devtools.
        const body = err.body as
          | { code?: string; message?: string; upstreamStatus?: number | null }
          | string
          | null;
        if (body && typeof body === "object") {
          toast.error(`Erro ao conectar ${platform.name}`, {
            description: `${body.message ?? "falha ao iniciar OAuth"}${body.code ? ` (${body.code})` : ""}${body.upstreamStatus ? ` · upstream ${body.upstreamStatus}` : ""}`,
          });
          return;
        }
      }
      toast.error(`Erro ao conectar ${platform.name}`);
    }
  };

  const disconnect = async (platformId: string) => {
    const platform = SOCIAL_PLATFORMS.find((p) => p.id === platformId);
    if (!platform || !activeWorkspaceId) return;
    const matching = platforms.find((p) => p.id === platformId);
    const accountId = matching?.zernioAccountId;
    if (!accountId) {
      toast.error("Conta não encontrada para desconectar");
      return;
    }
    try {
      await apiFetch(
        `/workspaces/${activeWorkspaceId}/zernio/social/accounts/${encodeURIComponent(accountId)}`,
        { method: "DELETE" },
      );
      toast.success(`${platform.name} desconectado`);
      // Invalidate every social-derived query so rows clear consistently.
      queryClient.invalidateQueries({ queryKey: ["social_connections"] });
      queryClient.invalidateQueries({ queryKey: ["social_overview"] });
      queryClient.invalidateQueries({ queryKey: ["platform_profile"] });
      queryClient.invalidateQueries({ queryKey: ["platform_posts"] });
      queryClient.invalidateQueries({ queryKey: ["ads_data"] });
      queryClient.invalidateQueries({ queryKey: ["analytics_data"] });
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

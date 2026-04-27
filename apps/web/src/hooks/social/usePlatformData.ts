/**
 * usePlatformData — Detail data for a single connected platform.
 * Backed by Zernio: profile/follower metadata comes from the synced
 * `social_accounts.meta` row (no upstream call needed); the posts feed
 * comes from `/workspaces/:id/zernio/social/posts?accountId=...`.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useSocialConnections } from "./useSocialConnections";

export interface PlatformProfile {
  name?: string;
  username?: string;
  followers?: number;
  bio?: string;
  avatarUrl?: string;
}

export interface PlatformPost {
  id: string;
  content?: string;
  timestamp?: string;
  likes?: number;
  comments?: number;
  shares?: number;
  mediaUrl?: string;
}

interface RawPost {
  _id?: string;
  id?: string;
  content?: string;
  text?: string;
  caption?: string;
  title?: string;
  createdAt?: string;
  publishedAt?: string;
  scheduledAt?: string;
  metrics?: { likes?: number; comments?: number; shares?: number };
  likes?: number;
  comments?: number;
  shares?: number;
  mediaUrl?: string;
  thumbnail_url?: string;
}

function readNumber(meta: unknown, key: string): number | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const v = (meta as Record<string, unknown>)[key];
  return typeof v === "number" ? v : undefined;
}

function readString(meta: unknown, key: string): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const v = (meta as Record<string, unknown>)[key];
  return typeof v === "string" ? v : undefined;
}

export function usePlatformData(platformId: string | null, isConnected = false) {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const { platforms } = useSocialConnections();
  const platform = platformId ? platforms.find((p) => p.id === platformId) : null;
  const accountId = platform?.zernioAccountId ?? null;

  // Profile metadata is derived from the locally-synced social_accounts.meta
  // jsonb (Zernio writes follower counts, bio, avatar there on every sync).
  // No upstream call needed — and that's the right move since
  // `social_accounts` rows are workspace-scoped at the DB layer.
  const profile: PlatformProfile | null = platform
    ? {
        name: readString(platform, "name") ?? platform.name,
        username: platform.email ?? undefined,
        followers: readNumber((platform as { meta?: unknown }).meta, "followers"),
        bio: readString((platform as { meta?: unknown }).meta, "bio"),
        avatarUrl: readString((platform as { meta?: unknown }).meta, "avatarUrl"),
      }
    : null;

  const postsQuery = useQuery({
    queryKey: ["platform_posts", platformId, user?.id, activeWorkspaceId, accountId],
    enabled: !!user && !!platform && !!activeWorkspaceId && !!accountId && isConnected,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async (): Promise<PlatformPost[]> => {
      if (!activeWorkspaceId || !accountId) return [];
      const res = await apiFetch<{ data: unknown }>(
        `/workspaces/${activeWorkspaceId}/zernio/social/posts?accountId=${encodeURIComponent(accountId)}&limit=20`,
      );
      const raw = res.data as { posts?: RawPost[]; data?: RawPost[] } | RawPost[] | null;
      const items: RawPost[] = Array.isArray(raw)
        ? raw
        : (raw?.posts ?? raw?.data ?? []);
      return items.slice(0, 20).map((item) => ({
        id: item._id ?? item.id ?? "",
        content: item.content ?? item.text ?? item.caption ?? item.title,
        timestamp: item.publishedAt ?? item.createdAt ?? item.scheduledAt,
        likes: item.metrics?.likes ?? item.likes ?? 0,
        comments: item.metrics?.comments ?? item.comments ?? 0,
        shares: item.metrics?.shares ?? item.shares ?? 0,
        mediaUrl: item.mediaUrl ?? item.thumbnail_url,
      }));
    },
  });

  return {
    profile,
    posts: postsQuery.data ?? [],
    isLoading: postsQuery.isLoading,
    error: postsQuery.error?.message ?? null,
  };
}

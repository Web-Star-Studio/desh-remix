/**
 * usePlatformData — Detailed data for a single connected social platform
 * Only fetches if the platform is confirmed connected.
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { getPlatformById } from "@/lib/social-integrations";

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

export function usePlatformData(platformId: string | null, isConnected = false) {
  const { user } = useAuth();
  const { activeWorkspaceId, defaultWorkspace } = useWorkspace();
  const effectiveWsId = activeWorkspaceId || defaultWorkspace?.id || "default";
  const platform = platformId ? getPlatformById(platformId) : null;

  const profileQuery = useQuery({
    queryKey: ["platform_profile", platformId, user?.id, effectiveWsId],
    enabled: !!user && !!platform && isConnected,
    staleTime: 10 * 60_000,
    retry: 1,
    queryFn: async (): Promise<PlatformProfile> => {
      const { data, error } = await supabase.functions.invoke("composio-proxy", {
        body: {
          service: platform!.composioToolkit,
          path: "/profile",
          method: "GET",
          workspace_id: effectiveWsId,
        },
      });
      if (error || data?.error) throw new Error(data?.error || "Failed to fetch profile");
      return {
        name: data?.name || data?.displayName,
        username: data?.username || data?.screen_name,
        followers: data?.followers_count || data?.subscriberCount || 0,
        bio: data?.biography || data?.description,
        avatarUrl: data?.profile_picture_url || data?.avatar_url,
      };
    },
  });

  const postsQuery = useQuery({
    queryKey: ["platform_posts", platformId, user?.id, effectiveWsId],
    enabled: !!user && !!platform && isConnected,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async (): Promise<PlatformPost[]> => {
      const { data, error } = await supabase.functions.invoke("composio-proxy", {
        body: {
          service: platform!.composioToolkit,
          path: "/posts",
          method: "GET",
          workspace_id: effectiveWsId,
        },
      });
      if (error || data?.error) return [];
      const items = Array.isArray(data) ? data : data?.data || data?.items || [];
      return items.slice(0, 20).map((item: any) => ({
        id: item.id || item._id,
        content: item.caption || item.text || item.title,
        timestamp: item.timestamp || item.created_at || item.publishedAt,
        likes: item.like_count || item.likes || 0,
        comments: item.comments_count || item.comments || 0,
        shares: item.shares_count || item.shares || 0,
        mediaUrl: item.media_url || item.thumbnail_url,
      }));
    },
  });

  return {
    profile: profileQuery.data ?? null,
    posts: postsQuery.data ?? [],
    isLoading: profileQuery.isLoading || postsQuery.isLoading,
    error: profileQuery.error?.message || postsQuery.error?.message || null,
  };
}

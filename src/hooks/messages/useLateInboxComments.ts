import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLateProxy } from "./useLateProxy";
import { useAuth } from "@/contexts/AuthContext";
import {
  withAccountIdQuery,
  withAccountIdBody,
  assertAccountId,
} from "./lateInboxHelpers";

export interface InboxComment {
  id: string;
  postId: string;
  postContent?: string;
  platform: string;
  accountId: string;
  author: {
    name: string;
    username?: string;
    avatar?: string;
  };
  text: string;
  createdAt: string;
  liked?: boolean;
  hidden?: boolean;
  replies?: InboxComment[];
}

/**
 * useLateInboxComments — Comments from social posts.
 *
 * Todas as mutações anexam `accountId` em query E body via helpers,
 * mantendo paridade com `useLateInboxActions` e evitando 400 da Late.
 */
export function useLateInboxComments(accountId?: string) {
  const { user } = useAuth();
  const { lateInvoke } = useLateProxy();
  const qc = useQueryClient();

  const commentsQuery = useQuery({
    queryKey: ["inbox_comments", accountId],
    enabled: !!user && !!accountId,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      assertAccountId(accountId);
      const route = withAccountIdQuery("/inbox/comments", accountId);
      const { data, error } = await lateInvoke<unknown>(route, "GET");
      if (error) throw new Error(error);
      const d = data as Record<string, unknown> | unknown[] | null;
      const raw = Array.isArray(d)
        ? d
        : ((d as Record<string, unknown>)?.comments
            ?? (d as Record<string, unknown>)?.data
            ?? []) as unknown[];
      return (raw as Array<Record<string, unknown>>).map((c) => {
        const author = (c.author ?? {}) as Record<string, unknown>;
        const from = (c.from ?? {}) as Record<string, unknown>;
        return {
          id: (c._id ?? c.id) as string,
          postId: (c.postId ?? c.post_id) as string,
          postContent: (c.postContent ?? c.post_content ?? c.postText) as string | undefined,
          platform: c.platform as string,
          accountId: (c.accountId ?? c.account_id ?? accountId) as string,
          author: {
            name: (author.name ?? c.authorName ?? from.name ?? "Desconhecido") as string,
            username: (author.username ?? c.authorUsername ?? from.username) as string | undefined,
            avatar: (author.avatar ?? author.picture ?? from.avatar) as string | undefined,
          },
          text: (c.text ?? c.message ?? c.content ?? "") as string,
          createdAt: (c.createdAt ?? c.created_at ?? c.date ?? new Date().toISOString()) as string,
          liked: (c.liked ?? c.isLiked ?? false) as boolean,
          hidden: (c.hidden ?? c.isHidden ?? false) as boolean,
          replies: (c.replies ?? []) as InboxComment[],
        } satisfies InboxComment;
      });
    },
  });

  const replyComment = useMutation({
    mutationFn: async ({ commentId, text }: { commentId: string; text: string }) => {
      assertAccountId(accountId);
      const route = withAccountIdQuery(`/inbox/comments/${commentId}/reply`, accountId);
      const body = withAccountIdBody({ text }, accountId);
      const { error } = await lateInvoke(route, "POST", body);
      if (error) throw new Error(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox_comments", accountId] }),
  });

  const likeComment = useMutation({
    mutationFn: async (commentId: string) => {
      assertAccountId(accountId);
      const route = withAccountIdQuery(`/inbox/comments/${commentId}/like`, accountId);
      const body = withAccountIdBody({}, accountId);
      const { error } = await lateInvoke(route, "POST", body);
      if (error) throw new Error(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox_comments", accountId] }),
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      assertAccountId(accountId);
      const route = withAccountIdQuery(`/inbox/comments/${commentId}`, accountId);
      const body = withAccountIdBody({}, accountId);
      const { error } = await lateInvoke(route, "DELETE", body);
      if (error) throw new Error(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox_comments", accountId] }),
  });

  return {
    comments: commentsQuery.data ?? [],
    isLoading: commentsQuery.isLoading,
    error: (commentsQuery.error as Error | null)?.message ?? null,
    refetch: commentsQuery.refetch,
    replyComment,
    likeComment,
    deleteComment,
  };
}

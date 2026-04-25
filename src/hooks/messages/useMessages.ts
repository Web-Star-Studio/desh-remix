/**
 * useMessages — Domain facade for the Messages module.
 */
import type { Conversation } from "@/lib/messageUtils";
import { useConversationSort } from "./useConversationSort";
import { useQuickReplies } from "./useQuickReplies";

export function useMessages(conversations: Conversation[] = []) {
  const sort = useConversationSort(conversations);
  const quickReplies = useQuickReplies();

  return {
    ...sort,
    quickReplies: quickReplies.replies,
    quickRepliesLoading: quickReplies.loading,
  } as const;
}

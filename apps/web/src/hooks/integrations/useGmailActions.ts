import { useCallback, useMemo } from "react";
import { executeComposioAction, ComposioExecuteError } from "@/lib/composio-client";
import { useComposioWorkspaceId } from "@/hooks/integrations/useComposioWorkspaceId";

/**
 * Typed wrapper around Composio's gmail toolkit. Replaces the legacy
 * `composio-proxy` edge function: the agent and the dashboard now share
 * one call path through `apps/api` -> `tools.execute()`.
 *
 * Action slug catalog mirrors the curated list maintained at
 * `components/admin/ComposioActionsTab.tsx`. Add new actions here as call
 * sites need them — keeping the catalog in this file means future updates
 * are localized.
 */

export const GMAIL_ACTIONS = {
  FETCH_EMAILS: "GMAIL_FETCH_EMAILS",
  FETCH_MESSAGE_BY_ID: "GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID",
  FETCH_THREAD_BY_ID: "GMAIL_FETCH_MESSAGE_BY_THREAD_ID",
  LIST_THREADS: "GMAIL_LIST_THREADS",
  LIST_LABELS: "GMAIL_LIST_LABELS",
  CREATE_LABEL: "GMAIL_CREATE_LABEL",
  DELETE_LABEL: "GMAIL_DELETE_LABEL",
  ADD_LABEL_TO_EMAIL: "GMAIL_ADD_LABEL_TO_EMAIL",
  BATCH_MODIFY_MESSAGES: "GMAIL_BATCH_MODIFY_MESSAGES",
  BATCH_DELETE_MESSAGES: "GMAIL_BATCH_DELETE_MESSAGES",
  MOVE_TO_TRASH: "GMAIL_MOVE_TO_TRASH",
  UNTRASH_MESSAGE: "GMAIL_UNTRASH_MESSAGE",
  DELETE_MESSAGE: "GMAIL_DELETE_MESSAGE",
  SEND_EMAIL: "GMAIL_SEND_EMAIL",
  CREATE_DRAFT: "GMAIL_CREATE_EMAIL_DRAFT",
  SEND_DRAFT: "GMAIL_SEND_DRAFT",
  REPLY_TO_THREAD: "GMAIL_REPLY_TO_THREAD",
  FORWARD_MESSAGE: "GMAIL_FORWARD_MESSAGE",
  GET_PROFILE: "GMAIL_GET_PROFILE",
  GET_ATTACHMENT: "GMAIL_GET_ATTACHMENT",
  LIST_DRAFTS: "GMAIL_LIST_DRAFTS",
  GET_DRAFT: "GMAIL_GET_DRAFT",
  LIST_HISTORY: "GMAIL_LIST_HISTORY",
} as const;

export type GmailAction = (typeof GMAIL_ACTIONS)[keyof typeof GMAIL_ACTIONS];

export function useGmailActions() {
  const workspaceId = useComposioWorkspaceId();

  const execute = useCallback(
    <T = unknown>(action: GmailAction, args: Record<string, unknown> = {}) =>
      executeComposioAction<T>(workspaceId, "gmail", action, args),
    [workspaceId],
  );

  return useMemo(
    () => ({
      execute,
      fetchEmails: <T = unknown>(args: Record<string, unknown> = {}) => execute<T>(GMAIL_ACTIONS.FETCH_EMAILS, args),
      fetchMessage: <T = unknown>(messageId: string) => execute<T>(GMAIL_ACTIONS.FETCH_MESSAGE_BY_ID, { message_id: messageId }),
      fetchThread: <T = unknown>(threadId: string) => execute<T>(GMAIL_ACTIONS.FETCH_THREAD_BY_ID, { thread_id: threadId }),
      listThreads: <T = unknown>(args: Record<string, unknown> = {}) => execute<T>(GMAIL_ACTIONS.LIST_THREADS, args),
      listLabels: <T = unknown>() => execute<T>(GMAIL_ACTIONS.LIST_LABELS),
      sendEmail: <T = unknown>(args: Record<string, unknown>) => execute<T>(GMAIL_ACTIONS.SEND_EMAIL, args),
      createDraft: <T = unknown>(args: Record<string, unknown>) => execute<T>(GMAIL_ACTIONS.CREATE_DRAFT, args),
      sendDraft: <T = unknown>(draftId: string) => execute<T>(GMAIL_ACTIONS.SEND_DRAFT, { draft_id: draftId }),
      replyToThread: <T = unknown>(args: Record<string, unknown>) => execute<T>(GMAIL_ACTIONS.REPLY_TO_THREAD, args),
      moveToTrash: <T = unknown>(messageId: string) => execute<T>(GMAIL_ACTIONS.MOVE_TO_TRASH, { message_id: messageId }),
      untrashMessage: <T = unknown>(messageId: string) => execute<T>(GMAIL_ACTIONS.UNTRASH_MESSAGE, { message_id: messageId }),
      deleteMessage: <T = unknown>(messageId: string) => execute<T>(GMAIL_ACTIONS.DELETE_MESSAGE, { message_id: messageId }),
      modifyLabels: <T = unknown>(args: { message_id: string; addLabelIds?: string[]; removeLabelIds?: string[] }) =>
        execute<T>(GMAIL_ACTIONS.ADD_LABEL_TO_EMAIL, args),
      batchModify: <T = unknown>(args: { ids: string[]; addLabelIds?: string[]; removeLabelIds?: string[] }) =>
        execute<T>(GMAIL_ACTIONS.BATCH_MODIFY_MESSAGES, args),
      batchDelete: <T = unknown>(ids: string[]) => execute<T>(GMAIL_ACTIONS.BATCH_DELETE_MESSAGES, { ids }),
      getProfile: <T = unknown>() => execute<T>(GMAIL_ACTIONS.GET_PROFILE),
    }),
    [execute],
  );
}

export { ComposioExecuteError };

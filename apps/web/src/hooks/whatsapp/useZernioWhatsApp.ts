import { useCallback, useMemo } from "react";
import { zernioClient } from "@/services/zernio/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { wrapResult, errResult, type WABAResultError } from "@/services/zernio/types";

/**
 * Re-exports from the canonical types module. Kept here so existing imports
 * `from "@/hooks/whatsapp/useZernioWhatsApp"` keep working — but the source of
 * truth is `@/services/zernio/types` (avoids circular dependency that would
 * stall the app boot).
 */
export type {
  WABAAccount,
  WABABroadcast,
  WABABusinessProfile,
  WABAContact,
  WABAPhoneNumber,
  WABATemplate,
  WABAResult,
  WABAResultError,
} from "@/services/zernio/types";

import type { WABAContact, WABABusinessProfile } from "@/services/zernio/types";

/** Shorthand: every method below funnels through this. */
const wrap = wrapResult;

const NO_WORKSPACE_ERROR: WABAResultError = {
  code: "no_workspace",
  message: "Selecione um workspace antes de operar.",
};

// ── Hook ───────────────────────────────────────────────
//
// Thin adapter over `zernioClient`. The public surface (method names + the
// `{ data, error }` envelope) is unchanged so existing components keep working
// — internals now hit apps/api typed routes scoped to the active workspace.

export function useZernioWhatsApp() {
  const { activeWorkspaceId } = useWorkspace();

  // Memoised bound client. When workspace changes, every callback below picks
  // it up via the dep array. When no workspace is active, every call returns
  // a structured `errResult` so component code branches are unchanged.
  const client = useMemo(
    () => (activeWorkspaceId ? zernioClient.forWorkspace(activeWorkspaceId) : null),
    [activeWorkspaceId],
  );

  function guard<T>(fn: (c: NonNullable<typeof client>) => Promise<T>) {
    if (!client) return Promise.resolve(errResult<T>(NO_WORKSPACE_ERROR));
    return wrap(fn(client));
  }

  // Connection
  const getAuthUrl = useCallback(
    (redirectUrl: string) => guard((c) => c.connect.getAuthUrl(redirectUrl)),
    [client],
  );
  const getSdkConfig = useCallback(() => guard((c) => c.connect.getSdkConfig()), [client]);
  const exchangeEmbeddedSignup = useCallback(
    (code: string, profileId: string) =>
      guard((c) => c.connect.exchangeEmbeddedSignup(code, profileId)),
    [client],
  );
  const connectCredentials = useCallback(
    (profileId: string, accessToken: string, wabaId: string, phoneNumberId: string) =>
      guard((c) => c.connect.connectCredentials(profileId, accessToken, wabaId, phoneNumberId)),
    [client],
  );

  // Accounts
  const getAccounts = useCallback(() => guard((c) => c.accounts.list()), [client]);

  // Templates
  const getTemplates = useCallback(
    (accountId: string) => guard((c) => c.whatsapp.templates.list(accountId)),
    [client],
  );
  const createTemplate = useCallback(
    (accountId: string, name: string, category: string, language: string, components: unknown[]) =>
      guard((c) => c.whatsapp.templates.create(accountId, name, category, language, components)),
    [client],
  );
  const deleteTemplate = useCallback(
    (accountId: string, templateName: string) =>
      guard((c) => c.whatsapp.templates.remove(accountId, templateName)),
    [client],
  );

  // Broadcasts
  const listBroadcasts = useCallback(
    (accountId: string) => guard((c) => c.whatsapp.broadcasts.list(accountId)),
    [client],
  );
  const createBroadcast = useCallback(
    (accountId: string, name: string, template: unknown, recipients: unknown[]) =>
      guard((c) => c.whatsapp.broadcasts.create(accountId, name, template, recipients)),
    [client],
  );
  const sendBroadcast = useCallback(
    (broadcastId: string) => guard((c) => c.whatsapp.broadcasts.send(broadcastId)),
    [client],
  );
  const scheduleBroadcast = useCallback(
    (broadcastId: string, scheduledAt: string) =>
      guard((c) => c.whatsapp.broadcasts.schedule(broadcastId, scheduledAt)),
    [client],
  );
  const addRecipients = useCallback(
    (broadcastId: string, recipients: unknown[]) =>
      guard((c) => c.whatsapp.broadcasts.addRecipients(broadcastId, recipients)),
    [client],
  );

  // Contacts
  const getContacts = useCallback(
    (accountId: string, page = 1) => guard((c) => c.whatsapp.contacts.list(accountId, page)),
    [client],
  );
  const createContact = useCallback(
    (accountId: string, contact: Partial<WABAContact>) =>
      guard((c) => c.whatsapp.contacts.create(accountId, contact)),
    [client],
  );
  const importContacts = useCallback(
    (accountId: string, contacts: Partial<WABAContact>[], defaultTags?: string[]) =>
      guard((c) => c.whatsapp.contacts.import(accountId, contacts, defaultTags)),
    [client],
  );
  const bulkUpdateContacts = useCallback(
    (action: string, contactIds: string[], tags?: string[], groups?: string[]) =>
      guard((c) => c.whatsapp.contacts.bulkUpdate(action, contactIds, tags, groups)),
    [client],
  );

  // Business Profile
  const getBusinessProfile = useCallback(
    (accountId: string) => guard((c) => c.whatsapp.businessProfile.get(accountId)),
    [client],
  );
  const updateBusinessProfile = useCallback(
    (accountId: string, profile: Partial<WABABusinessProfile>) =>
      guard((c) => c.whatsapp.businessProfile.update(accountId, profile)),
    [client],
  );

  // Phone Numbers
  const getPhoneNumbers = useCallback(
    () => guard((c) => c.whatsapp.phoneNumbers.list()),
    [client],
  );
  const purchasePhoneNumber = useCallback(
    (profileId?: string) => guard((c) => c.whatsapp.phoneNumbers.purchase(profileId)),
    [client],
  );

  return {
    // Connection
    getAuthUrl,
    getSdkConfig,
    exchangeEmbeddedSignup,
    connectCredentials,
    // Accounts
    getAccounts,
    // Templates
    getTemplates,
    createTemplate,
    deleteTemplate,
    // Broadcasts
    listBroadcasts,
    createBroadcast,
    sendBroadcast,
    scheduleBroadcast,
    addRecipients,
    // Contacts
    getContacts,
    createContact,
    importContacts,
    bulkUpdateContacts,
    // Business Profile
    getBusinessProfile,
    updateBusinessProfile,
    // Phone Numbers
    getPhoneNumbers,
    purchasePhoneNumber,
  };
}

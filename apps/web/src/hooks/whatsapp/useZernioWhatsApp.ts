import { useCallback } from "react";
import { zernioClient } from "@/services/zernio/client";
import { wrapResult } from "@/services/zernio/types";

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

// ── Hook ───────────────────────────────────────────────
//
// Thin adapter over `zernioClient`. The public surface (method names + the
// `{ data, error }` envelope) is unchanged so existing components keep working
// — internals now share retry/backoff/error semantics with `useSendWhatsAppMessage`.

export function useZernioWhatsApp() {
  // Connection
  const getSdkConfig = useCallback(() => wrap(zernioClient.connect.getSdkConfig()), []);
  const exchangeEmbeddedSignup = useCallback(
    (code: string, profileId: string) =>
      wrap(zernioClient.connect.exchangeEmbeddedSignup(code, profileId)),
    [],
  );
  const connectCredentials = useCallback(
    (profileId: string, accessToken: string, wabaId: string, phoneNumberId: string) =>
      wrap(zernioClient.connect.connectCredentials(profileId, accessToken, wabaId, phoneNumberId)),
    [],
  );

  // Accounts
  const getAccounts = useCallback(() => wrap(zernioClient.accounts.list()), []);

  // Templates
  const getTemplates = useCallback(
    (accountId: string) => wrap(zernioClient.whatsapp.templates.list(accountId)),
    [],
  );
  const createTemplate = useCallback(
    (accountId: string, name: string, category: string, language: string, components: any[]) =>
      wrap(zernioClient.whatsapp.templates.create(accountId, name, category, language, components)),
    [],
  );
  const deleteTemplate = useCallback(
    (accountId: string, templateName: string) =>
      wrap(zernioClient.whatsapp.templates.remove(accountId, templateName)),
    [],
  );

  // Broadcasts
  const listBroadcasts = useCallback(
    (accountId: string) => wrap(zernioClient.whatsapp.broadcasts.list(accountId)),
    [],
  );
  const createBroadcast = useCallback(
    (accountId: string, name: string, template: any, recipients: any[]) =>
      wrap(zernioClient.whatsapp.broadcasts.create(accountId, name, template, recipients)),
    [],
  );
  const sendBroadcast = useCallback(
    (broadcastId: string) => wrap(zernioClient.whatsapp.broadcasts.send(broadcastId)),
    [],
  );
  const scheduleBroadcast = useCallback(
    (broadcastId: string, scheduledAt: string) =>
      wrap(zernioClient.whatsapp.broadcasts.schedule(broadcastId, scheduledAt)),
    [],
  );
  const addRecipients = useCallback(
    (broadcastId: string, recipients: any[]) =>
      wrap(zernioClient.whatsapp.broadcasts.addRecipients(broadcastId, recipients)),
    [],
  );

  // Contacts
  const getContacts = useCallback(
    (accountId: string, page = 1) => wrap(zernioClient.whatsapp.contacts.list(accountId, page)),
    [],
  );
  const createContact = useCallback(
    (accountId: string, contact: Partial<WABAContact>) =>
      wrap(zernioClient.whatsapp.contacts.create(accountId, contact)),
    [],
  );
  const importContacts = useCallback(
    (accountId: string, contacts: Partial<WABAContact>[], defaultTags?: string[]) =>
      wrap(zernioClient.whatsapp.contacts.import(accountId, contacts, defaultTags)),
    [],
  );
  const bulkUpdateContacts = useCallback(
    (action: string, contactIds: string[], tags?: string[], groups?: string[]) =>
      wrap(zernioClient.whatsapp.contacts.bulkUpdate(action, contactIds, tags, groups)),
    [],
  );

  // Business Profile
  const getBusinessProfile = useCallback(
    (accountId: string) => wrap(zernioClient.whatsapp.businessProfile.get(accountId)),
    [],
  );
  const updateBusinessProfile = useCallback(
    (accountId: string, profile: Partial<WABABusinessProfile>) =>
      wrap(zernioClient.whatsapp.businessProfile.update(accountId, profile)),
    [],
  );

  // Phone Numbers
  const getPhoneNumbers = useCallback(() => wrap(zernioClient.whatsapp.phoneNumbers.list()), []);
  const purchasePhoneNumber = useCallback(
    (profileId: string) => wrap(zernioClient.whatsapp.phoneNumbers.purchase(profileId)),
    [],
  );

  // Bulk Send
  const sendBulk = useCallback(
    (accountId: string, recipients: any[], template: any) =>
      wrap(zernioClient.whatsapp.sendBulk(accountId, recipients, template)),
    [],
  );

  return {
    // Connection
    getSdkConfig, exchangeEmbeddedSignup, connectCredentials,
    // Accounts
    getAccounts,
    // Templates
    getTemplates, createTemplate, deleteTemplate,
    // Broadcasts
    listBroadcasts, createBroadcast, sendBroadcast, scheduleBroadcast, addRecipients,
    // Contacts
    getContacts, createContact, importContacts, bulkUpdateContacts,
    // Business Profile
    getBusinessProfile, updateBusinessProfile,
    // Phone Numbers
    getPhoneNumbers, purchasePhoneNumber,
    // Bulk
    sendBulk,
  };
}

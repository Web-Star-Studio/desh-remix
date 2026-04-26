import { and, eq, lt, sql } from "drizzle-orm";
import {
  composioConnections,
  gmailSyncState,
} from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { ServiceError } from "./errors.js";
import { entityIdFor, executeAction, isComposioConfigured } from "./composio.js";
import { deleteEmailsByGmailId, upsertEmails } from "./emails.js";

// Sync orchestration. Three entry points:
//
//  - registerWatch: called fire-and-forget on connection-create + by the
//    watch-renewal-tick cron. Calls Composio GMAIL_FETCH_WATCH (start watch),
//    persists the historyId baseline + watchExpiration.
//  - incrementalSync: called by the gmail.incremental-sync pg-boss job
//    triggered from the webhook. Fetches history since the stored historyId,
//    upserts new/changed messages into emails, removes deleted ones.
//  - findExpiringWatches: cron-side scan for watches due in <24h.
//
// The Composio action surface here is best-effort — Composio's exact action
// names for Gmail watch/history vary. We pick the closest names; if Composio
// returns no data, we degrade gracefully (log + skip).

function dbOrThrow() {
  const db = getDb();
  if (!db) throw new ServiceError(500, "db_unavailable");
  return db;
}

export interface RegisterWatchOptions {
  folder?: string;
  topicName?: string;
}

export interface RegisterWatchResult {
  historyId: bigint | null;
  expiration: Date | null;
}

export async function registerWatch(
  workspaceId: string,
  connectionId: string,
  opts: RegisterWatchOptions = {},
): Promise<RegisterWatchResult> {
  if (!isComposioConfigured()) throw new ServiceError(503, "composio_unconfigured");
  const db = dbOrThrow();

  const [conn] = await db
    .select()
    .from(composioConnections)
    .where(eq(composioConnections.id, connectionId))
    .limit(1);
  if (!conn) throw new ServiceError(404, "connection_not_found");
  if (!conn.userId) throw new ServiceError(400, "connection_unowned");
  if (conn.toolkit !== "gmail") throw new ServiceError(400, "not_a_gmail_connection");

  const folder = opts.folder ?? "inbox";
  const entity = entityIdFor(workspaceId, conn.userId);

  const args: Record<string, unknown> = {
    labelIds: [folder.toUpperCase()],
    labelFilterAction: "include",
  };
  if (opts.topicName) args.topicName = opts.topicName;

  const result = (await executeAction(entity, "GMAIL_FETCH_WATCH", args)) as {
    data?: { historyId?: string | number; expiration?: string | number; emailAddress?: string };
    historyId?: string | number;
    expiration?: string | number;
    emailAddress?: string;
  };
  const payload = result.data ?? result;
  const historyId = payload.historyId != null ? BigInt(payload.historyId.toString()) : null;
  const expirationMs =
    payload.expiration != null ? Number(payload.expiration) : null;
  const expiration = expirationMs && expirationMs > 0 ? new Date(expirationMs) : null;
  const emailAddress = payload.emailAddress ?? null;

  await db
    .insert(gmailSyncState)
    .values({
      workspaceId,
      connectionId,
      folder,
      emailAddress,
      historyId,
      watchExpiration: expiration,
      lastSyncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        gmailSyncState.workspaceId,
        gmailSyncState.connectionId,
        gmailSyncState.folder,
      ],
      set: {
        emailAddress: emailAddress ?? sql`${gmailSyncState.emailAddress}`,
        historyId: historyId ?? sql`${gmailSyncState.historyId}`,
        watchExpiration: expiration ?? sql`${gmailSyncState.watchExpiration}`,
        lastSyncedAt: new Date(),
      },
    });

  return { historyId, expiration };
}

interface ComposioHistoryRecord {
  id?: string;
  messages?: Array<{ id?: string; threadId?: string }>;
  messagesAdded?: Array<{ message?: { id?: string; threadId?: string } }>;
  messagesDeleted?: Array<{ message?: { id?: string } }>;
  labelsAdded?: Array<{ message?: { id?: string }; labelIds?: string[] }>;
  labelsRemoved?: Array<{ message?: { id?: string }; labelIds?: string[] }>;
}

interface ComposioMessageDetail {
  id: string;
  threadId?: string;
  snippet?: string;
  labelIds?: string[];
  internalDate?: string | number;
  payload?: { headers?: Array<{ name: string; value: string }> };
}

function extractHeader(detail: ComposioMessageDetail, name: string): string {
  const h = detail.payload?.headers?.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? "";
}

function parseFromHeader(value: string): { fromName: string; fromEmail: string } {
  const m = /^\s*(?:"?([^"<]*?)"?\s*)?<?([^<>\s]+@[^<>\s]+)>?\s*$/.exec(value);
  if (!m) return { fromName: "", fromEmail: value };
  return { fromName: (m[1] ?? "").trim(), fromEmail: (m[2] ?? "").trim() };
}

async function fetchMessageDetails(
  entity: string,
  ids: string[],
): Promise<ComposioMessageDetail[]> {
  if (ids.length === 0) return [];
  const out: ComposioMessageDetail[] = [];
  for (const id of ids) {
    try {
      const result = (await executeAction(entity, "GMAIL_FETCH_MESSAGE_BY_ID", {
        messageId: id,
        format: "metadata",
      })) as { data?: ComposioMessageDetail };
      if (result.data) out.push(result.data);
    } catch {
      // skip — partial sync is better than total failure
    }
  }
  return out;
}

export async function incrementalSync(
  workspaceId: string,
  connectionId: string,
): Promise<{ added: number; deleted: number; updated: number }> {
  if (!isComposioConfigured()) throw new ServiceError(503, "composio_unconfigured");
  const db = dbOrThrow();

  const [state] = await db
    .select()
    .from(gmailSyncState)
    .where(
      and(
        eq(gmailSyncState.workspaceId, workspaceId),
        eq(gmailSyncState.connectionId, connectionId),
      ),
    )
    .limit(1);
  if (!state || !state.historyId) {
    return { added: 0, deleted: 0, updated: 0 };
  }

  const [conn] = await db
    .select({ userId: composioConnections.userId })
    .from(composioConnections)
    .where(eq(composioConnections.id, connectionId))
    .limit(1);
  if (!conn?.userId) return { added: 0, deleted: 0, updated: 0 };

  const entity = entityIdFor(workspaceId, conn.userId);
  const result = (await executeAction(entity, "GMAIL_FETCH_HISTORY", {
    startHistoryId: state.historyId.toString(),
  })) as {
    data?: { history?: ComposioHistoryRecord[]; historyId?: string | number };
    history?: ComposioHistoryRecord[];
    historyId?: string | number;
  };
  const records = result.data?.history ?? result.history ?? [];
  const newHistoryId =
    result.data?.historyId ?? result.historyId ?? state.historyId.toString();

  const addedIds = new Set<string>();
  const deletedIds = new Set<string>();
  const labelTouchedIds = new Set<string>();

  for (const rec of records) {
    for (const a of rec.messagesAdded ?? []) {
      const id = a.message?.id;
      if (id) addedIds.add(id);
    }
    for (const d of rec.messagesDeleted ?? []) {
      const id = d.message?.id;
      if (id) deletedIds.add(id);
    }
    for (const l of [...(rec.labelsAdded ?? []), ...(rec.labelsRemoved ?? [])]) {
      const id = l.message?.id;
      if (id && !addedIds.has(id) && !deletedIds.has(id)) labelTouchedIds.add(id);
    }
  }

  if (deletedIds.size > 0) {
    await deleteEmailsByGmailId(workspaceId, [...deletedIds]);
  }

  const fetchIds = [...addedIds, ...labelTouchedIds].filter((id) => !deletedIds.has(id));
  const details = await fetchMessageDetails(entity, fetchIds);
  const upserts = details.map((d) => {
    const date = d.internalDate ? new Date(Number(d.internalDate)) : new Date();
    const from = parseFromHeader(extractHeader(d, "From"));
    return {
      workspaceId,
      connectionId,
      gmailId: d.id,
      threadId: d.threadId ?? null,
      fromName: from.fromName,
      fromEmail: from.fromEmail,
      subject: extractHeader(d, "Subject"),
      snippet: d.snippet ?? "",
      bodyPreview: d.snippet ?? "",
      date,
      isUnread: (d.labelIds ?? []).includes("UNREAD"),
      isStarred: (d.labelIds ?? []).includes("STARRED"),
      hasAttachment: false,
      labelIds: d.labelIds ?? [],
      folder: (d.labelIds ?? []).includes("INBOX") ? "inbox" : "archive",
    };
  });
  if (upserts.length > 0) await upsertEmails(upserts);

  const nextHistory = BigInt(newHistoryId.toString());
  await db
    .update(gmailSyncState)
    .set({ historyId: nextHistory, lastSyncedAt: new Date() })
    .where(
      and(
        eq(gmailSyncState.workspaceId, workspaceId),
        eq(gmailSyncState.connectionId, connectionId),
      ),
    );

  return {
    added: addedIds.size,
    deleted: deletedIds.size,
    updated: Math.max(0, upserts.length - addedIds.size),
  };
}

export async function findExpiringWatches(
  withinMs: number = 24 * 60 * 60 * 1000,
  limit = 50,
): Promise<{ workspaceId: string; connectionId: string; folder: string }[]> {
  const db = dbOrThrow();
  const cutoff = new Date(Date.now() + withinMs);
  const rows = await db
    .select({
      workspaceId: gmailSyncState.workspaceId,
      connectionId: gmailSyncState.connectionId,
      folder: gmailSyncState.folder,
    })
    .from(gmailSyncState)
    .where(lt(gmailSyncState.watchExpiration, cutoff))
    .limit(limit);
  return rows;
}

export async function findConnectionByEmailAddress(
  emailAddress: string,
): Promise<{ workspaceId: string; connectionId: string } | null> {
  const db = dbOrThrow();
  const [row] = await db
    .select({
      workspaceId: gmailSyncState.workspaceId,
      connectionId: gmailSyncState.connectionId,
    })
    .from(gmailSyncState)
    .where(eq(gmailSyncState.emailAddress, emailAddress))
    .limit(1);
  return row ?? null;
}

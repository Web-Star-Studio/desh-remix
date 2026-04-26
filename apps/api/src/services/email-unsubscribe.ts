import { and, desc, eq } from "drizzle-orm";
import { unsubscribeHistory } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { ServiceError } from "./errors.js";
import { entityIdFor, executeAction, isComposioConfigured } from "./composio.js";
import { assertWorkspaceMember } from "./workspace-members.js";

// Smart unsubscribe batch executor. Replaces the legacy `email-unsubscribe`
// edge fn. The SPA's smart-unsub flow first uses AI (still on `ai-router`,
// blocked on the AI feature wave) to identify newsletter senders + extract
// candidate URLs from the headers/HTML — then hands the batch off to this
// service for execution. We process up to 80 requests per call with a
// concurrency pool of 16 + 3 retries on transient errors.
//
// Security: HTTP URLs are filtered against private IP ranges + a blocked
// hostname set. mailto: addresses are validated and dispatched through
// Composio's GMAIL_SEND_EMAIL action so the unsub message is sent from the
// user's actual mailbox.

const MAX_BATCH = 80;
const CONCURRENCY = 16;
const FETCH_TIMEOUT_MS = 25_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 600;
const MAX_URL_LENGTH = 4096;
const MAX_POST_BODY_LENGTH = 2048;
const MAX_SENDER_NAME_LENGTH = 256;

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "169.254.169.254", // AWS instance-metadata
  "metadata.google.internal",
  "metadata.azure.internal",
]);

const PRIVATE_IP_RE = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|fc00::|fd00::|fe80::)/;

export type UnsubMethod = "GET" | "POST" | "mailto";

export interface UnsubRequest {
  url: string;
  method?: UnsubMethod;
  postBody?: string;
  senderName?: string;
  senderEmail?: string;
  category?: string;
  safetyScore?: number;
  emailsAffected?: number;
}

export interface UnsubResult {
  senderName: string;
  senderEmail: string;
  success: boolean;
  method: string;
  error?: string;
  retries?: number;
}

function isHttpUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTS.has(host)) return false;
    if (PRIVATE_IP_RE.test(host)) return false;
    if (url.length > MAX_URL_LENGTH) return false;
    return true;
  } catch {
    return false;
  }
}

function isMailtoSafe(url: string): boolean {
  if (!url.startsWith("mailto:")) return false;
  const [address] = url.replace("mailto:", "").split("?");
  return typeof address === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
}

function sanitize(s: string | undefined, max: number): string {
  return (s ?? "").slice(0, max).replace(/[\x00-\x1f\x7f]/g, "");
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isTransientError(message: string): boolean {
  return [
    "abort",
    "timeout",
    "ECONNRESET",
    "ENOTFOUND",
    "502",
    "503",
    "429",
    "ETIMEDOUT",
  ].some((needle) => message.includes(needle));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Send an unsubscribe email via Composio's Gmail toolkit. We construct a raw
// RFC 2822 message and rely on Composio to deliver it through the user's
// authenticated Gmail account.
async function sendMailtoUnsubscribe(
  workspaceId: string,
  actorUserId: string,
  mailtoUrl: string,
): Promise<boolean> {
  const mailto = mailtoUrl.replace("mailto:", "");
  const [address, queryString] = mailto.split("?");
  const params = new URLSearchParams(queryString || "");
  const subject = sanitize(params.get("subject") || "Unsubscribe", 256);
  const body = sanitize(params.get("body") || "Unsubscribe", 1024);

  const entity = entityIdFor(workspaceId, actorUserId);
  try {
    await executeAction(entity, "GMAIL_SEND_EMAIL", {
      recipient_email: address,
      subject,
      body,
    });
    return true;
  } catch {
    return false;
  }
}

async function processOne(
  workspaceId: string,
  actorUserId: string,
  req: UnsubRequest,
): Promise<UnsubResult> {
  const method: UnsubMethod = req.method ?? "GET";
  const senderName = sanitize(req.senderName, MAX_SENDER_NAME_LENGTH);
  const senderEmail = sanitize(req.senderEmail, MAX_SENDER_NAME_LENGTH);
  const baseResult = { senderName, senderEmail };

  if (method === "mailto") {
    if (!isMailtoSafe(req.url)) {
      return { ...baseResult, success: false, method, error: "Invalid mailto URL" };
    }
    if (!isComposioConfigured()) {
      return { ...baseResult, success: false, method, error: "composio_unconfigured" };
    }
    const ok = await sendMailtoUnsubscribe(workspaceId, actorUserId, req.url);
    return { ...baseResult, success: ok, method, retries: 0 };
  }

  if (!isHttpUrlSafe(req.url)) {
    return { ...baseResult, success: false, method, error: "URL blocked or invalid" };
  }

  const fetchOpts: RequestInit = {
    method: method === "POST" ? "POST" : "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    },
    redirect: "follow",
  };
  if (method === "POST" && req.postBody) {
    (fetchOpts.headers as Record<string, string>)["Content-Type"] =
      "application/x-www-form-urlencoded";
    fetchOpts.body = sanitize(req.postBody, MAX_POST_BODY_LENGTH);
  }

  let lastError = "";
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await fetchWithTimeout(req.url, fetchOpts);
      // Drain body to release the socket, even on success — many unsub
      // pages reply with substantial confirmation HTML we never read.
      await resp.text().catch(() => undefined);
      const success = resp.ok || resp.status === 301 || resp.status === 302 || resp.status === 303;
      return { ...baseResult, success, method, retries: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (isTransientError(lastError) && attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      break;
    }
  }
  return {
    ...baseResult,
    success: false,
    method,
    error: lastError.includes("abort") ? "Timeout" : lastError,
    retries: MAX_RETRIES,
  };
}

// Concurrency pool — preserves the legacy 16-worker semantics.
async function runPool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let cursor = 0;
  async function worker() {
    while (cursor < tasks.length) {
      const i = cursor++;
      results[i] = await tasks[i]!();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
  return results;
}

export interface ExecuteBatchInput {
  workspaceId: string;
  actorUserId: string;
  requests: UnsubRequest[];
}

export interface ExecuteBatchOutput {
  results: UnsubResult[];
  successCount: number;
  totalProcessed: number;
  retriedCount: number;
  blockedCount: number;
}

export async function executeBatch(input: ExecuteBatchInput): Promise<ExecuteBatchOutput> {
  await assertWorkspaceMember(input.workspaceId, input.actorUserId);
  if (input.requests.length === 0) {
    return { results: [], successCount: 0, totalProcessed: 0, retriedCount: 0, blockedCount: 0 };
  }

  const sliced = input.requests.slice(0, MAX_BATCH);
  const tasks = sliced.map((r) => () => processOne(input.workspaceId, input.actorUserId, r));
  const results = await runPool(tasks, CONCURRENCY);

  const successCount = results.filter((r) => r.success).length;
  const retriedCount = results.filter((r) => (r.retries ?? 0) > 0).length;
  const blockedCount = results.filter((r) => r.error?.includes("blocked") || r.error?.includes("Invalid")).length;

  // Persist the audit trail. Best-effort; if the insert fails we still
  // return the results so the caller knows what happened.
  try {
    const db = getDb();
    if (db) {
      const rows = sliced.map((req, idx) => {
        const r = results[idx]!;
        return {
          workspaceId: input.workspaceId,
          userId: input.actorUserId,
          senderName: sanitize(req.senderName, MAX_SENDER_NAME_LENGTH),
          senderEmail: sanitize(req.senderEmail, MAX_SENDER_NAME_LENGTH),
          category: sanitize(req.category, 80) || "outro",
          safetyScore: typeof req.safetyScore === "number" ? Math.max(0, Math.min(100, req.safetyScore)) : 50,
          method: r.method,
          success: r.success,
          trashed: false,
          emailsAffected: typeof req.emailsAffected === "number" ? req.emailsAffected : 0,
          errorMessage: r.error ?? null,
        };
      });
      await db.insert(unsubscribeHistory).values(rows);
    }
  } catch {
    // ignore — log table issues shouldn't block the unsub response
  }

  return { results, successCount, totalProcessed: results.length, retriedCount, blockedCount };
}

export interface HistoryRow {
  id: string;
  workspaceId: string | null;
  userId: string;
  senderName: string;
  senderEmail: string;
  category: string;
  safetyScore: number;
  method: string;
  success: boolean;
  trashed: boolean;
  emailsAffected: number;
  errorMessage: string | null;
  createdAt: string;
}

export async function listHistory(
  workspaceId: string,
  actorUserId: string,
  limit = 500,
): Promise<HistoryRow[]> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = getDb();
  if (!db) throw new ServiceError(500, "db_unavailable");
  const rows = await db
    .select()
    .from(unsubscribeHistory)
    .where(
      and(
        eq(unsubscribeHistory.workspaceId, workspaceId),
        eq(unsubscribeHistory.userId, actorUserId),
      ),
    )
    .orderBy(desc(unsubscribeHistory.createdAt))
    .limit(Math.max(1, Math.min(limit, 1000)));
  return rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspaceId,
    userId: r.userId,
    senderName: r.senderName,
    senderEmail: r.senderEmail,
    category: r.category,
    safetyScore: r.safetyScore,
    method: r.method,
    success: r.success,
    trashed: r.trashed,
    emailsAffected: r.emailsAffected,
    errorMessage: r.errorMessage,
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * @function email-unsubscribe
 * @description Gerencia unsubscribes de newsletters via Gmail
 * @status active
 * @calledBy EmailPage (unsubscribe action)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { verifyAuth } from "../_shared/auth.ts";
import { getComposioAccessToken, resolveWorkspaceId } from "../_shared/composio-client.ts";
import { corsHeaders } from "../_shared/utils.ts";

interface UnsubRequest {
  url: string;
  method: "GET" | "POST" | "mailto";
  postBody?: string;
  senderName: string;
  senderEmail?: string;
}

interface UnsubResult {
  senderName: string;
  senderEmail?: string;
  success: boolean;
  method: string;
  error?: string;
  retries?: number;
}

// ── Config ───────────────────────────────────────────────────────────
const MAX_BATCH = 80;
const CONCURRENCY = 16;
const FETCH_TIMEOUT_MS = 25_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 600;
const MAX_URL_LENGTH = 4096;
const MAX_POST_BODY_LENGTH = 2048;
const MAX_SENDER_NAME_LENGTH = 256;

// ── Blocked domains (never unsubscribe from these) ──────────────────
const BLOCKED_DOMAINS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "169.254.169.254", // AWS metadata
  "metadata.google.internal",
]);

// ── Helpers ──────────────────────────────────────────────────────────

function isUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (BLOCKED_DOMAINS.has(parsed.hostname)) return false;
    // Block private IPs
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(parsed.hostname)) return false;
    if (url.length > MAX_URL_LENGTH) return false;
    return true;
  } catch {
    return false;
  }
}

function isMailtoSafe(url: string): boolean {
  if (!url.startsWith("mailto:")) return false;
  const mailto = url.replace("mailto:", "");
  const [address] = mailto.split("?");
  // Basic email validation
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
}

function sanitizeString(str: string, maxLen: number): string {
  return (str || "").slice(0, maxLen).replace(/[\x00-\x1f\x7f]/g, "");
}

async function fetchWithTimeout(
  url: string,
  opts: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isTransientError(msg: string): boolean {
  return (
    msg.includes("abort") ||
    msg.includes("timeout") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("429")
  );
}

async function sendMailtoUnsubscribe(
  accessToken: string,
  mailtoUrl: string,
): Promise<boolean> {
  const mailto = mailtoUrl.replace("mailto:", "");
  const [address, queryString] = mailto.split("?");
  const params = new URLSearchParams(queryString || "");
  const subject = sanitizeString(params.get("subject") || "Unsubscribe", 256);
  const body = sanitizeString(params.get("body") || "Unsubscribe", 1024);

  const rawMessage = [
    `To: ${address}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=UTF-8`,
    "",
    body,
  ].join("\r\n");

  const encoded = btoa(rawMessage)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const resp = await fetchWithTimeout(
    "https://www.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encoded }),
    },
    FETCH_TIMEOUT_MS,
  );
  await resp.text();
  return resp.ok;
}

async function getGmailToken(userId: string, workspaceId?: string): Promise<string | null> {
  // Get Gmail access token via Composio with workspace-aware entityId
  return await getComposioAccessToken(userId, "gmail", workspaceId);
}

// ── Process a single request with retry ──────────────────────────────

async function processRequest(
  r: UnsubRequest,
  gmailToken: string | null,
): Promise<UnsubResult> {
  const baseResult = { senderName: r.senderName, senderEmail: r.senderEmail };
  let lastError = "";

  // Validate URL before processing
  if (r.method === "mailto") {
    if (!isMailtoSafe(r.url)) {
      return { ...baseResult, success: false, method: "mailto", error: "Invalid mailto URL" };
    }
  } else {
    if (!isUrlSafe(r.url)) {
      return { ...baseResult, success: false, method: r.method, error: "URL blocked or invalid" };
    }
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (r.method === "mailto") {
        if (!gmailToken) {
          return { ...baseResult, success: false, method: "mailto", error: "No Gmail token" };
        }
        const ok = await sendMailtoUnsubscribe(gmailToken, r.url);
        return { ...baseResult, success: ok, method: "mailto", retries: attempt };
      }

      const fetchOpts: RequestInit = {
        method: r.method === "POST" ? "POST" : "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        redirect: "follow",
      };

      if (r.method === "POST" && r.postBody) {
        const sanitizedBody = sanitizeString(r.postBody, MAX_POST_BODY_LENGTH);
        (fetchOpts.headers as Record<string, string>)["Content-Type"] =
          "application/x-www-form-urlencoded";
        fetchOpts.body = sanitizedBody;
      }

      const resp = await fetchWithTimeout(r.url, fetchOpts, FETCH_TIMEOUT_MS);
      await resp.text();

      const success =
        resp.ok ||
        resp.status === 301 ||
        resp.status === 302 ||
        resp.status === 303;

      return { ...baseResult, success, method: r.method, retries: attempt };
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Unknown error";

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
    method: r.method,
    error: lastError.includes("abort") ? "Timeout" : lastError,
    retries: MAX_RETRIES,
  };
}

// ── Concurrency pool ─────────────────────────────────────────────────

async function runPool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
  return results;
}

// ── Main handler ─────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await verifyAuth(req);
    if (authResult instanceof Response) {
      return new Response(authResult.body, {
        status: authResult.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { requests, workspace_id } = (await req.json()) as { requests: UnsubRequest[]; workspace_id?: string };

    if (!requests || !Array.isArray(requests) || requests.length === 0) {
      return new Response(
        JSON.stringify({ error: "No unsubscribe requests provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate and sanitize each request
    const sanitized: UnsubRequest[] = requests.slice(0, MAX_BATCH).map((r) => ({
      url: (r.url || "").slice(0, MAX_URL_LENGTH),
      method: ["GET", "POST", "mailto"].includes(r.method) ? r.method : "GET",
      postBody: r.postBody ? sanitizeString(r.postBody, MAX_POST_BODY_LENGTH) : undefined,
      senderName: sanitizeString(r.senderName || "Unknown", MAX_SENDER_NAME_LENGTH),
      senderEmail: sanitizeString(r.senderEmail || "", MAX_SENDER_NAME_LENGTH),
    }));


    // Resolve workspace for Composio entityId
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const wsId = await resolveWorkspaceId(supabaseAdmin, authResult.userId, workspace_id);

    // Pre-fetch Gmail token if any mailto requests
    let gmailToken: string | null = null;
    if (sanitized.some((r) => r.method === "mailto")) {
      gmailToken = await getGmailToken(authResult.userId, wsId);
    }

    const tasks = sanitized.map((r) => () => processRequest(r, gmailToken));
    const results = await runPool(tasks, CONCURRENCY);

    const successCount = results.filter((r) => r.success).length;
    const retriedCount = results.filter((r) => (r.retries || 0) > 0).length;
    const blockedCount = results.filter((r) => r.error?.includes("blocked") || r.error?.includes("Invalid")).length;


    return new Response(
      JSON.stringify({
        results,
        successCount,
        totalProcessed: results.length,
        retriedCount,
        blockedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("email-unsubscribe error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

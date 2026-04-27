// `unsubscribe_history` is a legacy Supabase table — its migration belongs
// in the email feature wave. Composio calls have moved to /composio/execute
// via useGmailActions; the supabase persistence call still hits Supabase
// and silently fails post-migration. The user-visible feature still works.
import { useState, useCallback, useRef } from "react";
import { useGmailActions } from "@/hooks/integrations/useGmailActions";
import { useWorkspaceFilter } from "@/hooks/workspace/useWorkspaceFilter";
import { apiFetch } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { notifyAiShortcutPending } from "@/lib/aiShortcuts";

export interface UnsubscribeSender {
  senderName: string;
  senderEmail: string;
  emailCount: number;
  category: string;
  safetyScore: number;
  safetyTier: "safe" | "caution" | "keep";
  reason: string;
  emailIds: string[];
  unsubscribeUrl?: string;
  unsubscribeMethod?: "GET" | "POST" | "mailto";
  postBody?: string;
  status: "pending" | "processing" | "success" | "failed" | "skipped";
}

interface EmailForScan {
  id: string;
  from: string;
  email: string;
  subject: string;
  body: string;
  date: string;
}

// ── Utility helpers ──────────────────────────────────────────────────

/** Validate a URL is safe (http/https only, no javascript:, no data:) */
function isUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** Extract unsubscribe URLs from HTML body – matches common unsubscribe patterns */
function extractUnsubscribeFromBody(htmlBody: string): string | null {
  if (!htmlBody) return null;

  // Priority-ordered patterns: most specific first
  // Use capture group that stops before the closing quote
  const patterns = [
    /href=["'](https?:\/\/[^"'\s>]+unsub[^"'\s>]*)/gi,
    /href=["'](https?:\/\/[^"'\s>]+opt[-_]?out[^"'\s>]*)/gi,
    /href=["'](https?:\/\/[^"'\s>]+remove[-_]?me[^"'\s>]*)/gi,
    /href=["'](https?:\/\/[^"'\s>]+manage[-_]?(?:subscription|preference|email|notification)[^"'\s>]*)/gi,
    /href=["'](https?:\/\/[^"'\s>]+email[-_]?preference[^"'\s>]*)/gi,
    /href=["'](https?:\/\/[^"'\s>]+subscription[-_]?center[^"'\s>]*)/gi,
    /href=["'](https?:\/\/[^"'\s>]+notification[-_]?settings[^"'\s>]*)/gi,
  ];

  for (const regex of patterns) {
    // Reset regex lastIndex since we reuse them
    regex.lastIndex = 0;
    const match = regex.exec(htmlBody);
    if (match?.[1]) {
      const url = match[1].replace(/["']$/, ""); // strip any trailing quote
      if (isUrlSafe(url)) return url;
    }
  }
  return null;
}

/** Decode Gmail's base64url content to UTF-8 string */
function decodeBase64Url(data: string): string {
  try {
    // Convert base64url → base64
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    // Decode to binary string
    const binaryString = atob(base64);
    // Convert binary → Uint8Array → UTF-8
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

/** Parse RFC 2369 / RFC 8058 List-Unsubscribe header */
function parseUnsubscribeHeader(
  unsubHeader: string,
  postHeader?: string,
): { url: string; method: "GET" | "POST" | "mailto"; postBody?: string } | null {
  // Prefer HTTP over mailto
  const httpMatch = unsubHeader.match(/<(https?:\/\/[^>]+)>/);
  const mailtoMatch = unsubHeader.match(/<(mailto:[^>]+)>/);

  if (httpMatch) {
    const url = httpMatch[1];
    if (!isUrlSafe(url)) return null;
    const isOneClick = !!postHeader?.includes("List-Unsubscribe=One-Click");
    return {
      url,
      method: isOneClick ? "POST" : "GET",
      postBody: isOneClick ? "List-Unsubscribe=One-Click" : undefined,
    };
  }
  if (mailtoMatch) {
    return { url: mailtoMatch[1], method: "mailto" };
  }
  return null;
}

/** Recursively extract text/html content from Gmail message parts */
function extractHtmlFromParts(body: string, parts: any[]): string {
  if (body) {
    const decoded = decodeBase64Url(body);
    if (decoded) return decoded;
  }
  if (!parts?.length) return "";

  const htmlPart = parts.find((p: any) => p.mimeType === "text/html");
  if (htmlPart?.body?.data) return decodeBase64Url(htmlPart.body.data);

  // Nested multipart
  for (const part of parts) {
    if (part.parts) {
      const nested = part.parts.find((p: any) => p.mimeType === "text/html");
      if (nested?.body?.data) return decodeBase64Url(nested.body.data);
    }
  }
  return "";
}

// ── Concurrency pool (thread-safe index) ─────────────────────────────

async function runPool<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let idx = 0;

  async function worker() {
    while (true) {
      const i = idx;
      if (i >= tasks.length) break;
      idx = i + 1; // JS is single-threaded, this is safe
      try {
        results[i] = { status: "fulfilled", value: await tasks[i]() };
      } catch (reason: any) {
        results[i] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
  return results;
}

// ── Constants ────────────────────────────────────────────────────────
const SCAN_BATCH_SIZE = 800;
const HEADER_FETCH_CONCURRENCY = 30;
const MAX_HEADER_SAMPLES = 250;
const UNSUBSCRIBE_BATCH_SIZE = 80;
const AI_SCAN_CHUNK = 200;

// ── Hook ─────────────────────────────────────────────────────────────

export function useSmartUnsubscribe() {
  const gmail = useGmailActions();
  const { activeWorkspaceId } = useWorkspaceFilter();
  const workspaceRef = useRef(activeWorkspaceId);
  workspaceRef.current = activeWorkspaceId;

  const [scanning, setScanning] = useState(false);
  const [senders, setSenders] = useState<UnsubscribeSender[] | null>(null);
  const [unsubscribing, setUnsubscribing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [fetchingHeaders, setFetchingHeaders] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number } | null>(null);
  const abortRef = useRef(false);
  // Keep gmail wrapper stable across the long-running scan — the wrapper
  // itself is memoized but ref-pinning it lets nested closures avoid
  // dep churn.
  const gmailRef = useRef(gmail);
  gmailRef.current = gmail;
  // ── Step 1 · AI scan ─────────────────────────────────────────────
  const scanEmails = useCallback(async (emails: EmailForScan[]) => {
    if (emails.length === 0) return;
    setScanning(false);
    setSenders([]);
    setScanProgress(null);
    abortRef.current = false;
    notifyAiShortcutPending("Smart Unsubscribe indisponível");
  }, []);

  // ── Step 2 · Two-pass header fetch ────────────────────────────────
  const fetchHeaders = useCallback(async (senderList: UnsubscribeSender[]) => {
    setFetchingHeaders(true);

    try {
      // Unique sample email IDs (one per sender)
      const samples = senderList
        .filter((s) => s.emailIds[0])
        .slice(0, MAX_HEADER_SAMPLES)
        .map((s) => ({ senderEmail: s.senderEmail, emailId: s.emailIds[0] }));

      // Deduplicate by emailId
      const seen = new Set<string>();
      const uniqueSamples = samples.filter((s) => {
        if (seen.has(s.emailId)) return false;
        seen.add(s.emailId);
        return true;
      });

      const headerMap = new Map<
        string,
        { url: string; method: "GET" | "POST" | "mailto"; postBody?: string }
      >();

      // Map emailId → senderEmail for applying results
      const emailToSender = new Map<string, string>();
      for (const s of uniqueSamples) {
        emailToSender.set(s.emailId, s.senderEmail);
      }

      // ── Pass 1: metadata format (lightweight) ──
      const pass1Tasks = uniqueSamples.map(({ emailId }) => async () => {
        const data = await gmailRef.current.fetchMessage<any>(emailId);
        const headers = data?.payload?.headers || data?.headers || [];
        return { emailId, headers };
      });

      const pass1Results = await runPool(pass1Tasks, HEADER_FETCH_CONCURRENCY);
      const needsFallback: string[] = [];

      for (const r of pass1Results) {
        if (r.status !== "fulfilled") continue;
        const { emailId, headers } = r.value;

        const unsubHeader = headers.find(
          (h: any) => h.name?.toLowerCase() === "list-unsubscribe",
        )?.value;
        const postHeader = headers.find(
          (h: any) => h.name?.toLowerCase() === "list-unsubscribe-post",
        )?.value;

        if (unsubHeader) {
          const parsed = parseUnsubscribeHeader(unsubHeader, postHeader);
          if (parsed) headerMap.set(emailId, parsed);
          else needsFallback.push(emailId);
        } else {
          needsFallback.push(emailId);
        }
      }

      // ── Pass 2: full format only for emails without header ──
      if (needsFallback.length > 0 && !abortRef.current) {
        const pass2Tasks = needsFallback.map((emailId) => async () => {
          const data = await gmailRef.current.fetchMessage<any>(emailId);
          const body = data?.payload?.body?.data || "";
          const parts = data?.payload?.parts || [];
          return { emailId, body, parts };
        });

        const pass2Results = await runPool(pass2Tasks, Math.min(HEADER_FETCH_CONCURRENCY, 6));

        for (const r of pass2Results) {
          if (r.status !== "fulfilled") continue;
          const { emailId, body, parts } = r.value;
          const html = extractHtmlFromParts(body, parts);
          const url = extractUnsubscribeFromBody(html);
          if (url) {
            headerMap.set(emailId, { url, method: "GET" });
          }
        }
      }

      // Apply results to senders using senderEmail as the key (not emailId)
      const senderUnsubMap = new Map<
        string,
        { url: string; method: "GET" | "POST" | "mailto"; postBody?: string }
      >();
      for (const [emailId, info] of headerMap) {
        const senderEmail = emailToSender.get(emailId);
        if (senderEmail) senderUnsubMap.set(senderEmail, info);
      }

      setSenders(
        (prev) =>
          prev?.map((s) => {
            const info = senderUnsubMap.get(s.senderEmail);
            if (!info) return s;
            return {
              ...s,
              unsubscribeUrl: info.url,
              unsubscribeMethod: info.method,
              postBody: info.postBody,
            };
          }) || null,
      );
    } catch (err) {
      console.warn("Error fetching unsubscribe headers:", err);
    } finally {
      setFetchingHeaders(false);
    }
  }, []);

  // ── Step 3 · Execute unsubscribe ──────────────────────────────────
  const executeUnsubscribe = useCallback(
    async (
      selectedSenders: UnsubscribeSender[],
      options: { trashAfter?: boolean; removeFromCache?: (ids: string[]) => void } = {},
    ) => {
      const actionable = selectedSenders.filter((s) => s.unsubscribeUrl);
      const trashOnly = selectedSenders.filter((s) => !s.unsubscribeUrl);

      if (actionable.length === 0 && trashOnly.length === 0) {
        toast({ title: "Nenhum sender selecionado", variant: "destructive" });
        return;
      }

      // If no actionable and trash not enabled, nothing to do
      if (actionable.length === 0 && !options.trashAfter) {
        toast({
          title: "Nenhuma ação possível",
          description:
            "Os remetentes selecionados não possuem link de descadastro. Use a opção '+ Excluir' para movê-los para a lixeira.",
          variant: "destructive",
        });
        return;
      }

      setUnsubscribing(true);
      abortRef.current = false;

      const trashOnlySenders = options.trashAfter ? trashOnly : [];
      const totalToProcess = actionable.length + trashOnlySenders.length;
      setProgress({ current: 0, total: totalToProcess });

      // Mark all as processing
      const allProcessingEmails = new Set([
        ...actionable.map((s) => s.senderEmail),
        ...trashOnlySenders.map((s) => s.senderEmail),
      ]);
      setSenders(
        (prev) =>
          prev?.map((s) =>
            allProcessingEmails.has(s.senderEmail) ? { ...s, status: "processing" as const } : s,
          ) || null,
      );

      let totalSuccess = 0;
      // Use senderEmail as key (unique) instead of senderName (can collide)
      const resultMap = new Map<string, boolean>();

      try {
        const workspaceId = workspaceRef.current;
        // ── Unsubscribe senders with links (apps/api batch executor) ──
        for (let i = 0; i < actionable.length; i += UNSUBSCRIBE_BATCH_SIZE) {
          if (abortRef.current) break;

          const chunk = actionable.slice(i, i + UNSUBSCRIBE_BATCH_SIZE);

          if (!workspaceId) {
            for (const s of chunk) resultMap.set(s.senderEmail, false);
            continue;
          }

          try {
            const data = await apiFetch<{
              results: Array<{
                senderName: string;
                senderEmail?: string;
                success: boolean;
                method: string;
              }>;
            }>(`/workspaces/${workspaceId}/email-unsubscribe`, {
              method: "POST",
              body: JSON.stringify({
                requests: chunk.map((s) => ({
                  url: s.unsubscribeUrl,
                  method: s.unsubscribeMethod || "GET",
                  postBody: s.postBody,
                  senderName: s.senderName,
                  senderEmail: s.senderEmail,
                  category: s.category,
                  safetyScore: s.safetyScore,
                  emailsAffected: s.emailCount,
                })),
              }),
            });
            for (const r of data.results) {
              const matchKey =
                r.senderEmail || actionable.find((s) => s.senderName === r.senderName)?.senderEmail;
              if (matchKey) {
                resultMap.set(matchKey, r.success);
                if (r.success) totalSuccess++;
              }
            }
          } catch (err) {
            for (const s of chunk) resultMap.set(s.senderEmail, false);
            console.warn(`Unsubscribe chunk ${i} failed:`, err);
          }

          const processed = Math.min(i + UNSUBSCRIBE_BATCH_SIZE, actionable.length);
          setProgress({ current: processed, total: totalToProcess });

          // Update statuses
          setSenders(
            (prev) =>
              prev?.map((s) => {
                const ok = resultMap.get(s.senderEmail);
                if (ok === undefined) return s;
                return { ...s, status: ok ? "success" : "failed" };
              }) || null,
          );
        }

        // ── Handle trash-only senders (no unsub link) ──
        if (trashOnlySenders.length > 0 && !abortRef.current) {
          const trashOnlyIds = trashOnlySenders.flatMap((s) => s.emailIds);
          if (trashOnlyIds.length > 0) {
            options.removeFromCache?.(trashOnlyIds);
            const TRASH_BATCH = 1000;
            for (let i = 0; i < trashOnlyIds.length; i += TRASH_BATCH) {
              if (abortRef.current) break;
              const ids = trashOnlyIds.slice(i, i + TRASH_BATCH);
              await gmailRef.current.batchModify({
                ids,
                addLabelIds: ["TRASH"],
                removeLabelIds: ["INBOX"],
              });
            }
          }
          // Mark trash-only senders as success
          for (const s of trashOnlySenders) {
            resultMap.set(s.senderEmail, true);
            totalSuccess++;
          }
          setSenders(
            (prev) =>
              prev?.map((s) =>
                trashOnlySenders.find((t) => t.senderEmail === s.senderEmail)
                  ? { ...s, status: "success" }
                  : s,
              ) || null,
          );
          setProgress({ current: totalToProcess, total: totalToProcess });
        }

        // History persistence is handled server-side by the apps/api batch
        // executor — no SPA-side insert needed. (Trash-only senders aren't
        // logged today; that ships in the inbox-cleaner wave alongside the
        // panel that surfaces them.)

        // Trash emails from successfully unsubscribed senders (actionable ones)
        if (options.trashAfter && totalSuccess > 0 && !abortRef.current) {
          const successSenders = actionable.filter((s) => resultMap.get(s.senderEmail));
          const allIds = successSenders.flatMap((s) => s.emailIds);

          if (allIds.length > 0) {
            options.removeFromCache?.(allIds);
            const TRASH_BATCH = 1000;
            for (let i = 0; i < allIds.length; i += TRASH_BATCH) {
              const ids = allIds.slice(i, i + TRASH_BATCH);
              await gmailRef.current.batchModify({
                ids,
                addLabelIds: ["TRASH"],
                removeLabelIds: ["INBOX"],
              });
            }
          }
        }

        const successUnsubCount = actionable.filter((s) => resultMap.get(s.senderEmail)).length;
        const successTrashOnlyCount = trashOnlySenders.filter((s) =>
          resultMap.get(s.senderEmail),
        ).length;

        toast({
          title: "Descadastramento concluído",
          description: [
            successUnsubCount > 0 ? `${successUnsubCount} descadastrado(s)` : null,
            successTrashOnlyCount > 0 ? `${successTrashOnlyCount} excluído(s)` : null,
            options.trashAfter && successUnsubCount > 0 ? "E-mails movidos para lixeira." : null,
          ]
            .filter(Boolean)
            .join(". "),
        });
      } catch (err: any) {
        toast({
          title: "Erro no descadastramento",
          description: err?.message,
          variant: "destructive",
        });
      } finally {
        setUnsubscribing(false);
        setProgress(null);
      }
    },
    [],
  );

  const cancel = useCallback(() => {
    abortRef.current = true;
  }, []);

  const reset = useCallback(() => {
    setSenders(null);
    setProgress(null);
    abortRef.current = true;
  }, []);

  return {
    scanning,
    senders,
    setSenders,
    unsubscribing,
    progress,
    fetchingHeaders,
    scanProgress,
    scanEmails,
    executeUnsubscribe,
    cancel,
    reset,
  };
}

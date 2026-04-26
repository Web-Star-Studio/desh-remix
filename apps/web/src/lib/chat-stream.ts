import { fetchAuthSession } from "aws-amplify/auth";
import { apiFetch } from "@/lib/api-client";

const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:3001";

// agent_events.type discriminator. Includes the legacy types
// (user_message/assistant_message/typing/error) plus the rich Hermes
// runtime events (tool.*/run.*/message.delta/reasoning.*/step.completed/
// status). Kept as a union of string literals so call sites can switch
// exhaustively when they care, while still accepting unknown types from
// future Hermes versions via the catch-all fallback.
export type AgentEventType =
  | "user_message"
  | "assistant_message"
  | "typing"
  | "error"
  | "run.started"
  | "run.completed"
  | "run.failed"
  | "message.delta"
  | "tool.started"
  | "tool.completed"
  | "tool.failed"
  | "step.completed"
  | "reasoning.started"
  | "reasoning.summary"
  | "status";

export interface AgentEventEnvelope {
  id: string;
  conversationId: string;
  workspaceId: string;
  type: AgentEventType | string;
  // Per-event payload shape. The discriminated-union schema in
  // @desh/shared/hermes is the source of truth; this is a structural mirror
  // that lets callers narrow by `type` without round-tripping through zod.
  payload: {
    // Legacy / message events.
    text?: string;
    content?: string;
    message_id?: string;
    seq?: number;
    reply_to?: string;
    metadata?: Record<string, unknown>;
    // run.* events.
    status?: string;
    duration_ms?: number;
    error?: string;
    run_id?: string;
    // message.delta.
    delta?: string;
    index?: number;
    // tool.* events.
    tool_call_id?: string;
    tool_name?: string;
    preview?: string;
    args_keys?: string[];
    result_preview?: string;
    // step.completed.
    iteration?: number;
    tool_names?: string[];
    // reasoning.summary.
    summary?: string;
    truncated?: boolean;
    // status (already covered by `status` above) — kept here for clarity.
  };
  createdAt: string;
}

export interface SendMessageResult {
  status: "accepted" | "duplicate";
  message_id: string;
  conversation_id: string;
}

export async function sendChatMessage(
  conversationId: string,
  text: string,
): Promise<SendMessageResult> {
  return apiFetch<SendMessageResult>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

interface StreamOpts {
  onEvent: (event: AgentEventEnvelope) => void;
  onOpen?: () => void;
  onError?: (err: Error) => void;
  after?: string;
  signal?: AbortSignal;
}

// Opens an SSE stream for a conversation. We use fetch + ReadableStream rather
// than EventSource because EventSource doesn't support custom headers (we need
// the Cognito ID token in Authorization). Returns when the connection closes.
export async function streamConversationEvents(
  conversationId: string,
  opts: StreamOpts,
): Promise<void> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) {
    opts.onError?.(new Error("not_authenticated"));
    return;
  }

  const params = new URLSearchParams();
  if (opts.after) params.set("after", opts.after);
  const url = `${BASE_URL}/conversations/${conversationId}/events${
    params.toString() ? `?${params.toString()}` : ""
  }`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream",
      },
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    opts.onError?.(err as Error);
    return;
  }

  if (!res.ok) {
    opts.onError?.(new Error(`stream HTTP ${res.status}`));
    return;
  }
  if (!res.body) {
    opts.onError?.(new Error("no response body"));
    return;
  }

  opts.onOpen?.();

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by blank lines. Each event has one or more
      // `field: value` lines. We only care about `data:`.
      let sepIdx: number;
      while ((sepIdx = buffer.indexOf("\n\n")) >= 0) {
        const rawEvent = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);

        const dataLines = rawEvent
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trimStart());
        if (dataLines.length === 0) continue;
        const data = dataLines.join("\n");
        try {
          const env = JSON.parse(data) as AgentEventEnvelope;
          opts.onEvent(env);
        } catch {
          // Likely a heartbeat or malformed line — ignore.
        }
      }
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      opts.onError?.(err as Error);
    }
  }
}

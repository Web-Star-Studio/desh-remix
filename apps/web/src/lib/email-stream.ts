import { fetchAuthSession } from "aws-amplify/auth";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:3001";

export interface EmailEventEnvelope {
  type: "upsert" | "delete";
  workspaceId: string;
  gmailIds: string[];
  ts: string;
}

interface StreamOpts {
  onEvent: (event: EmailEventEnvelope) => void;
  onOpen?: () => void;
  onError?: (err: Error) => void;
  signal?: AbortSignal;
}

// Opens an SSE stream for email-cache events on a workspace. Mirrors the
// `chat-stream.ts` pattern — fetch + ReadableStream because EventSource
// can't carry an Authorization header. Returns when the connection closes
// (caller usually wraps in a reconnect loop with backoff).
export async function streamEmailEvents(
  workspaceId: string,
  opts: StreamOpts,
): Promise<void> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) {
    opts.onError?.(new Error("not_authenticated"));
    return;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/workspaces/${workspaceId}/emails/events`, {
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
    opts.onError?.(new Error(`email stream HTTP ${res.status}`));
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

      let sepIdx: number;
      while ((sepIdx = buffer.indexOf("\n\n")) >= 0) {
        const rawEvent = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);

        const dataLines = rawEvent
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trimStart());
        if (dataLines.length === 0) continue;
        try {
          const env = JSON.parse(dataLines.join("\n")) as EmailEventEnvelope;
          opts.onEvent(env);
        } catch {
          // heartbeat / malformed — ignore
        }
      }
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      opts.onError?.(err as Error);
    }
  }
}

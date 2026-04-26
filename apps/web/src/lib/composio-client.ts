import { apiFetch, ApiError } from "@/lib/api-client";

/**
 * Wraps `POST /composio/execute` so all per-toolkit hooks share one transport
 * and one error-decoding path. The route's response is `{ ok, toolkit, action,
 * data }`; we return the `data` field unwrapped — that's whatever Composio's
 * SDK returned for the action call.
 *
 * `not_connected` is surfaced as a typed error code so callers can show
 * connect-this-toolkit affordances without re-parsing free-form messages.
 * `composio_not_configured` (503) means the backend has no Composio API key
 * set — usually only seen in dev.
 */

export type ComposioExecuteErrorCode =
  | "not_connected"
  | "composio_not_configured"
  | "execute_failed"
  | "unauthorized"
  | "unknown";

export class ComposioExecuteError extends Error {
  constructor(
    public code: ComposioExecuteErrorCode,
    public toolkit: string,
    public action: string,
    message: string,
    public cause?: unknown,
  ) {
    super(message);
  }
}

interface ExecuteResponse<T = unknown> {
  ok: boolean;
  toolkit: string;
  action: string;
  data: T;
}

export async function executeComposioAction<T = unknown>(
  workspaceId: string,
  toolkit: string,
  action: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (!workspaceId || workspaceId === "default") {
    throw new ComposioExecuteError(
      "not_connected",
      toolkit,
      action,
      "Sem workspace ativo — selecione um workspace antes de chamar uma ação.",
    );
  }
  try {
    const res = await apiFetch<ExecuteResponse<T>>("/composio/execute", {
      method: "POST",
      body: JSON.stringify({ workspaceId, toolkit, action, arguments: args }),
    });
    return res.data;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 503) {
        throw new ComposioExecuteError(
          "composio_not_configured",
          toolkit,
          action,
          "Composio não configurado no backend.",
          err,
        );
      }
      if (err.status === 401) {
        throw new ComposioExecuteError(
          "unauthorized",
          toolkit,
          action,
          "Sessão inválida.",
          err,
        );
      }
      if (err.status === 502) {
        const body = err.body as { message?: string } | null;
        const message = body?.message ?? "Erro ao executar ação no Composio.";
        // Composio SDK surfaces "no connected account" as part of the error
        // message; map it to the typed code so widgets can branch on it.
        const code = /not.connected|no.connected.account/i.test(message)
          ? "not_connected"
          : "execute_failed";
        throw new ComposioExecuteError(code, toolkit, action, message, err);
      }
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new ComposioExecuteError("unknown", toolkit, action, message, err);
  }
}

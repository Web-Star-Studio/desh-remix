/**
 * useSendWhatsAppMessage — TanStack mutation that sends a WhatsApp message
 * via Zernio and persists the attempt in `whatsapp_send_logs`.
 *
 * Error handling:
 * - Transport / network / 5xx are auto-retried inside `zernioClient` with
 *   exponential backoff + jitter.
 * - Final failures bubble up as `ZernioApiError` with a stable `code`, which
 *   `describeZernioError` translates into a user-friendly Portuguese toast.
 * - 402 (insufficient credits) is intentionally swallowed — handled globally
 *   by `CreditErrorGate` (UpgradeModal).
 */
import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ZernioApiError, verifyZernioCredentials } from "@/services/zernio/client";
import { whatsappMessenger, type DeliverySummary } from "@/services/zernio/whatsappMessenger";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  errResult,
  okResult,
  toWABAError,
  type WABAResult,
} from "@/services/zernio/types";

export type SendWhatsAppInput =
  | {
      kind: "text";
      accountId: string;
      to: string;
      text: string;
      contactId?: string | null;
    }
  | {
      kind: "template";
      accountId: string;
      to: string;
      templateName: string;
      language: string;
      variables?: string[];
      contactId?: string | null;
    };

interface SendOutcome {
  messageId?: string;
  status: "success" | "failed";
  summary?: DeliverySummary;
}

/**
 * The Late/Zernio upstream often collapses very different failure modes into a
 * single generic message ("All platforms failed"). When that happens we have
 * no machine-readable code, so we surface the three most likely causes the
 * operator can actually act on, instead of a useless generic error.
 *
 * Order matters: the most common cause for free-text sends (24 h window) is
 * shown first, followed by account-level issues and finally validation.
 */
const ALL_PLATFORMS_FAILED_RE = /all\s+platforms?\s+failed/i;

function isAllPlatformsFailed(err: ZernioApiError): boolean {
  return (
    err.code === "api_error" &&
    typeof err.message === "string" &&
    ALL_PLATFORMS_FAILED_RE.test(err.message)
  );
}

function describeAllPlatformsFailed(
  kind: "text" | "template",
): { title: string; description: string } {
  if (kind === "text") {
    return {
      title: "Não foi possível entregar a mensagem",
      description:
        "Causas mais prováveis: 1) o contato não respondeu nas últimas 24 h (texto livre é bloqueado pelo WhatsApp — use um template); 2) a conta WhatsApp Business está desconectada (verifique em Conexões); 3) o número de destino não existe no WhatsApp.",
    };
  }
  return {
    title: "Template recusado pelo WhatsApp",
    description:
      "Causas mais prováveis: 1) a conta WhatsApp Business está desconectada (verifique em Conexões); 2) o template não está aprovado ou foi pausado pela Meta; 3) o idioma/variáveis não correspondem ao template aprovado.",
  };
}

/** Map a ZernioApiError code to a short Portuguese user-facing message. */
function describeZernioError(
  err: unknown,
  kind: "text" | "template" = "text",
): { title: string; description: string } {
  if (!(err instanceof ZernioApiError)) {
    return {
      title: "Não foi possível enviar",
      description: (err as Error)?.message ?? "Erro desconhecido",
    };
  }
  if (isAllPlatformsFailed(err)) {
    return describeAllPlatformsFailed(kind);
  }
  switch (err.code) {
    case "rate_limited":
      return {
        title: "Muitas mensagens em pouco tempo",
        description: "Aguarde alguns segundos antes de tentar novamente.",
      };
    case "upstream_unavailable":
      return {
        title: "WhatsApp temporariamente indisponível",
        description: "Tentamos algumas vezes, mas o serviço ainda não respondeu. Tente em instantes.",
      };
    case "timeout":
      return {
        title: "Tempo limite ao enviar",
        description: "O WhatsApp demorou demais para responder. Tente novamente em instantes.",
      };
    case "aborted":
      return {
        title: "Envio cancelado",
        description: "O envio foi interrompido antes de concluir.",
      };
    case "network_error":
    case "transport_error":
    case "proxy_error":
      return {
        title: "Falha de conexão",
        description: "Verifique sua internet e tente novamente.",
      };
    case "unauthorized":
      return {
        title: "Conta desconectada",
        description: "Reconecte sua conta WhatsApp Business para continuar.",
      };
    case "missing_api_key":
      return {
        title: "Integração Zernio não configurada",
        description: "A chave da API Zernio (LATE_API_KEY) não está configurada no servidor. Adicione o secret nas configurações de Lovable Cloud.",
      };
    case "invalid_api_key":
      return {
        title: "Chave Zernio inválida ou expirada",
        description: "A LATE_API_KEY foi rejeitada pela Zernio. Gere uma nova chave no painel zernio.com e atualize o secret.",
      };
    case "forbidden":
      return {
        title: "Conta sem permissão",
        description: "Esta conta não tem autorização para enviar essa mensagem.",
      };
    case "not_found":
      return {
        title: "Destinatário ou template não encontrado",
        description: "Confira o número ou o nome do template.",
      };
    case "validation_error":
    case "bad_request":
      return {
        title: "Mensagem inválida",
        description: err.message || "Revise o conteúdo e tente novamente.",
      };
    default:
      return {
        title: "Não foi possível enviar",
        description: err.message || "Tente novamente em instantes.",
      };
  }
}

export function useSendWhatsAppMessage() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspace();

  const mutation = useMutation<SendOutcome, Error, SendWhatsAppInput>({
    mutationFn: async (input) => {
      const startedAt = performance.now();
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Sessão expirada");

      const health = await verifyZernioCredentials();
      if (health.ok !== true) {
        throw new ZernioApiError({
          message: health.message,
          code: health.code,
          retryable: false,
        });
      }

      const baseLog = {
        user_id: userId,
        workspace_id: activeWorkspaceId ?? null,
        account_id: input.accountId,
        contact_id: input.contactId ?? null,
        to_phone: input.to,
        message_type: input.kind,
        template_name: input.kind === "template" ? input.templateName : null,
        template_language: input.kind === "template" ? input.language : null,
        message_preview:
          input.kind === "text"
            ? input.text.slice(0, 280)
            : `[template:${input.templateName}]`,
      };

      try {
        const result =
          input.kind === "text"
            ? await whatsappMessenger.sendText({
                accountId: input.accountId,
                to: input.to,
                text: input.text,
                workspaceId: activeWorkspaceId,
              })
            : await whatsappMessenger.sendTemplate({
                accountId: input.accountId,
                to: input.to,
                templateName: input.templateName,
                language: input.language,
                variables: input.variables,
                workspaceId: activeWorkspaceId,
              });

        const latencyMs = Math.round(performance.now() - startedAt);
        await supabase.from("whatsapp_send_logs").insert({
          ...baseLog,
          status: "success",
          zernio_message_id: result.messageId ?? null,
          latency_ms: latencyMs,
        });

        return { messageId: result.messageId, status: "success", summary: result.__summary };
      } catch (err) {
        const latencyMs = Math.round(performance.now() - startedAt);
        const zErr = err instanceof ZernioApiError ? err : null;
        await supabase.from("whatsapp_send_logs").insert({
          ...baseLog,
          status: "failed",
          error_code: zErr?.code ?? (zErr?.status ? String(zErr.status) : null),
          error_message: (err as Error)?.message?.slice(0, 500) ?? "unknown",
          latency_ms: latencyMs,
        });
        throw err;
      }
    },
    onSuccess: () => {
      toast.success("Mensagem enviada via WhatsApp");
      queryClient.invalidateQueries({ queryKey: ["whatsapp_send_logs"] });
    },
    onError: (err, variables) => {
      if (err instanceof ZernioApiError && err.code === "insufficient_credits") return;
      const msg = err.message ?? "";
      if (/insufficient|402|cr[eé]dito/i.test(msg)) return;

      const kind = variables?.kind === "template" ? "template" : "text";
      const { title, description } = describeZernioError(err, kind);
      toast.error(title, { description });
    },
  });

  /**
   * Async helper that returns the canonical `WABAResult<SendOutcome>` envelope
   * (matching `useZernioWhatsApp`, `useZernioSyncAccounts`, …) instead of
   * throwing. Useful for callers that want to branch on `errorInfo.code`
   * without wiring `onError`. The full pipeline (toast + DB log) still runs.
   */
  const sendAsResult = useCallback(
    async (input: SendWhatsAppInput): Promise<WABAResult<SendOutcome>> => {
      try {
        const outcome = await mutation.mutateAsync(input);
        return okResult(outcome);
      } catch (err) {
        return errResult(toWABAError(err));
      }
    },
    [mutation],
  );

  return Object.assign(mutation, { sendAsResult });
}

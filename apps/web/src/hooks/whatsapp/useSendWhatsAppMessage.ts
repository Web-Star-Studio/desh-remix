/**
 * useSendWhatsAppMessage — TanStack mutation that sends a WhatsApp message
 * via apps/api `/workspaces/:id/zernio/whatsapp/messages`.
 *
 * The route persists `whatsapp_send_logs` server-side, so the hook's only job
 * is to dispatch + toast. Failures bubble up as `ZernioApiError` with a stable
 * `code`, which `describeZernioError` maps to user-friendly Portuguese copy.
 */
import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ZernioApiError, zernioClient } from "@/services/zernio/client";
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
}

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
        description:
          "Tentamos algumas vezes, mas o serviço ainda não respondeu. Tente em instantes.",
      };
    case "timeout":
      return {
        title: "Tempo limite ao enviar",
        description: "O WhatsApp demorou demais para responder. Tente novamente em instantes.",
      };
    case "network_error":
    case "transport_error":
      return {
        title: "Falha de conexão",
        description: "Verifique sua internet e tente novamente.",
      };
    case "unauthorized":
      return {
        title: "Conta desconectada",
        description: "Reconecte sua conta WhatsApp Business para continuar.",
      };
    case "not_configured":
      return {
        title: "Integração Zernio não configurada",
        description:
          "A chave da API Zernio não está definida no servidor. Adicione ZERNIO_API_KEY nas configurações.",
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
      if (!activeWorkspaceId) {
        throw new ZernioApiError({
          message: "Selecione um workspace antes de enviar.",
          code: "no_workspace",
        });
      }
      const client = zernioClient.forWorkspace(activeWorkspaceId);
      const result =
        input.kind === "text"
          ? await client.whatsapp.sendText({
              accountId: input.accountId,
              to: input.to,
              text: input.text,
            })
          : await client.whatsapp.sendTemplate({
              accountId: input.accountId,
              to: input.to,
              templateName: input.templateName,
              language: input.language,
              variables: input.variables,
            });
      return { messageId: result.messageId, status: "success" };
    },
    onSuccess: () => {
      toast.success("Mensagem enviada via WhatsApp");
      queryClient.invalidateQueries({ queryKey: ["whatsapp_send_logs"] });
    },
    onError: (err, variables) => {
      // 402 (insufficient credits) is handled globally by CreditErrorGate; skip toast here.
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
   * throwing.
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

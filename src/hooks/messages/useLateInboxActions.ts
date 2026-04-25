/**
 * useLateInboxActions — Send messages and update conversation status
 * via the Late Inbox API through late-proxy.
 *
 * Toda a montagem de URL/body é delegada a `lateInboxHelpers` para garantir
 * que `accountId` seja anexado da mesma forma em POST e PUT.
 *
 * Os payloads são validados via schemas leves antes do request — falhas de
 * formato lançam `LatePayloadValidationError` e nunca chegam ao proxy,
 * reduzindo erros 400 vindos da Late.
 */
import { useCallback } from "react";
import { useLateProxy } from "@/hooks/messages/useLateProxy";
import { toast } from "@/hooks/use-toast";
import {
  assertAccountId,
  assertSendMessagePayload,
  assertUpdateConversationPayload,
  buildLateInboxCall,
  lateInboxRoutes,
  LatePayloadValidationError,
  type LateConversationStatus,
} from "@/hooks/messages/lateInboxHelpers";

/**
 * Mensagem amigável para erro de "conta desconectada".
 * Mantida em sync com o guard de `useLateProxy`.
 */
const MISSING_ACCOUNT_MESSAGE =
  "Conta social desconectada. Reconecte sua integração para enviar mensagens.";

function isMissingAccountError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /accountId ausente/i.test(err.message);
}

export function useLateInboxActions() {
  const { lateInvoke } = useLateProxy();

  const sendMessage = useCallback(async (
    conversationId: string,
    accountId: string,
    message: string,
  ) => {
    try {
      assertAccountId(accountId);
      const payload = assertSendMessagePayload({ message });
      const { route, body } = buildLateInboxCall(
        lateInboxRoutes.sendMessage(conversationId),
        accountId,
        payload,
      );
      const { error } = await lateInvoke(route, "POST", body);
      if (error) throw new Error(error);
    } catch (err: unknown) {
      const error = err as Error;
      console.error("[sendLateMessage] Error:", error);

      // Toast amigável segmentado por tipo de erro.
      let title = "Erro ao enviar mensagem";
      let description = error?.message || "Tente novamente.";
      if (isMissingAccountError(err)) {
        title = "Conta desconectada";
        description = MISSING_ACCOUNT_MESSAGE;
      } else if (err instanceof LatePayloadValidationError) {
        title = "Mensagem inválida";
      }

      toast({ title, description, variant: "destructive" });
      throw error;
    }
  }, [lateInvoke]);

  const updateConversationStatus = useCallback(async (
    conversationId: string,
    accountId: string,
    status: LateConversationStatus,
  ) => {
    if (!accountId) return; // silent no-op for status updates
    try {
      const payload = assertUpdateConversationPayload({ status });
      const { route, body } = buildLateInboxCall(
        lateInboxRoutes.updateConversation(conversationId),
        accountId,
        payload,
      );
      await lateInvoke(route, "PUT", body);
    } catch (err: unknown) {
      console.error("[updateLateConversation] Error:", err);
    }
  }, [lateInvoke]);

  return { sendMessage, updateConversationStatus };
}

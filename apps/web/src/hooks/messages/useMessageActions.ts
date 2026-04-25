// TODO: Migrar para edge function — acesso direto ao Supabase
/**
 * useMessageActions — Consolidates message-level action handlers:
 * - React to message
 * - Star/unstar message
 * - Delete for me / for all
 * - Forward message (with dialog state)
 *
 * Extracted from MessagesPage.tsx for maintainability.
 */
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callWhatsappProxy } from "@/lib/whatsappProxy";
import { toast } from "@/hooks/use-toast";
import type { WhatsappMessage } from "@/hooks/whatsapp/useWhatsappMessages";

export interface UseMessageActionsParams {
  selectedConvoWsId: string | null | undefined;
  waMessages: WhatsappMessage[];
  refetchMessages: () => void;
}

export function useMessageActions({
  selectedConvoWsId,
  waMessages,
  refetchMessages,
}: UseMessageActionsParams) {
  const [forwardDialog, setForwardDialog] = useState<{ messageId: string; text: string } | null>(null);

  const handleReactToMessage = useCallback(async (messageId: string, emoji: string) => {
    try {
      await callWhatsappProxy("POST", "/send-reaction", { messageId, reaction: emoji }, selectedConvoWsId);
      toast({ title: `Reação ${emoji} enviada` });
    } catch (err: any) {
      toast({ title: "Erro ao enviar reação", description: err?.message || "Tente novamente.", variant: "destructive" });
    }
  }, [selectedConvoWsId]);

  const handleStarMessage = useCallback(async (messageId: string) => {
    try {
      const msg = waMessages.find(m => m.id === messageId);
      const newStarred = !msg?.starred;
      await callWhatsappProxy("POST", "/star-message", { messageId, starred: newStarred }, selectedConvoWsId);
      toast({ title: newStarred ? "⭐ Mensagem favoritada" : "Favorito removido" });
      refetchMessages();
    } catch (err: any) {
      toast({ title: "Erro ao favoritar", description: err?.message, variant: "destructive" });
    }
  }, [waMessages, refetchMessages, selectedConvoWsId]);

  const handleDeleteMessageForMe = useCallback(async (messageId: string) => {
    try {
      await supabase.from("whatsapp_messages").delete().eq("id", messageId);
      refetchMessages();
      toast({ title: "Mensagem apagada para você" });
    } catch (err: any) {
      toast({ title: "Erro ao apagar", description: err?.message, variant: "destructive" });
    }
  }, [refetchMessages]);

  const handleDeleteMessageForAll = useCallback(async (messageId: string) => {
    try {
      await callWhatsappProxy("POST", "/delete-message", { messageId }, selectedConvoWsId);
      refetchMessages();
      toast({ title: "Mensagem apagada para todos" });
    } catch (err: any) {
      toast({ title: "Erro ao apagar", description: err?.message, variant: "destructive" });
    }
  }, [refetchMessages, selectedConvoWsId]);

  const handleForwardMessage = useCallback((_messageId: string, text: string) => {
    setForwardDialog({ messageId: _messageId, text });
  }, []);

  const executeForward = useCallback(async (toContactId: string, convoName: string) => {
    if (!forwardDialog) return;
    try {
      await callWhatsappProxy("POST", "/forward-message", {
        messageId: forwardDialog.messageId,
        toContactId,
      }, selectedConvoWsId);
      toast({ title: `Encaminhada para ${convoName}` });
    } catch (err: any) {
      toast({ title: "Erro ao encaminhar", description: err?.message, variant: "destructive" });
    }
  }, [forwardDialog, selectedConvoWsId]);

  return {
    handleReactToMessage,
    handleStarMessage,
    handleDeleteMessageForMe,
    handleDeleteMessageForAll,
    forwardDialog,
    setForwardDialog,
    handleForwardMessage,
    executeForward,
  };
}

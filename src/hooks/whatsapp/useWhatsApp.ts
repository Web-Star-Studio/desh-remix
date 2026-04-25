/**
 * useWhatsApp — Domain facade for the WhatsApp module.
 */
import { useWhatsappConversations } from "./useWhatsappConversations";
import { useWhatsappAISettings } from "./useWhatsappAISettings";

export function useWhatsApp() {
  const conversations = useWhatsappConversations();
  const aiSettings = useWhatsappAISettings();

  return {
    conversations: conversations.conversations,
    conversationsLoading: conversations.isLoading,
    upsertConversation: conversations.upsertConversation,
    refetchConversations: conversations.refetch,
    aiSettings: aiSettings.settings,
    aiSettingsLoading: aiSettings.loading,
    upsertAISettings: aiSettings.upsertSettings,
    refetchAISettings: aiSettings.refetch,
  } as const;
}

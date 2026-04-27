import { toast } from "@/hooks/use-toast";

export const AI_SHORTCUT_PENDING_HERMES_TOOLS = "ai_shortcut_pending_hermes_tools";

export function notifyAiShortcutPending(title = "IA indisponível") {
  toast({
    title,
    description: AI_SHORTCUT_PENDING_HERMES_TOOLS,
    variant: "destructive",
  });
}

/**
 * useMessagesKeyboard — Keyboard navigation for the conversation list.
 * ↑/↓ or j/k to navigate, Enter to open, Escape to deselect.
 */
import { useCallback, useEffect } from "react";
import type { Conversation } from "@/lib/messageUtils";

interface UseMessagesKeyboardOptions {
  conversations: Conversation[];
  selectedId: string | null;
  onSelectConvo: (id: string) => void;
  onDeselectConvo: () => void;
  /** Whether the chat input is focused — disables shortcuts */
  isChatFocused?: boolean;
}

export function useMessagesKeyboard({
  conversations,
  selectedId,
  onSelectConvo,
  onDeselectConvo,
  isChatFocused = false,
}: UseMessagesKeyboardOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isChatFocused) return;
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const visible = conversations.filter(c => !c.archived);
      const currentIndex = selectedId ? visible.findIndex(c => c.id === selectedId) : -1;

      switch (e.key) {
        case "ArrowDown":
        case "j": {
          e.preventDefault();
          const next = currentIndex < visible.length - 1 ? currentIndex + 1 : currentIndex;
          if (visible[next]) onSelectConvo(visible[next].id);
          break;
        }
        case "ArrowUp":
        case "k": {
          e.preventDefault();
          const prev = currentIndex > 0 ? currentIndex - 1 : 0;
          if (visible[prev]) onSelectConvo(visible[prev].id);
          break;
        }
        case "Escape": {
          e.preventDefault();
          onDeselectConvo();
          break;
        }
      }
    },
    [conversations, selectedId, onSelectConvo, onDeselectConvo, isChatFocused]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * useEmailKeyboard — Keyboard navigation for the email list.
 * Arrow keys to navigate, Enter to open, Escape to deselect,
 * Delete/Backspace to trash, 'e' to archive, 'r' to reply, 's' to star.
 */
import { useCallback, useEffect } from "react";

interface UseEmailKeyboardOptions {
  emails: Array<{ id: string }>;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleStar?: (id: string) => void;
  onReply?: () => void;
  onCompose?: () => void;
  /** Whether compose/reply panel is open — disables shortcuts */
  isComposing?: boolean;
}

export function useEmailKeyboard({
  emails,
  selectedId,
  setSelectedId,
  onArchive,
  onDelete,
  onToggleStar,
  onReply,
  onCompose,
  isComposing = false,
}: UseEmailKeyboardOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip when composing, in input/textarea, or when modifier keys are held
      if (isComposing) return;
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const currentIndex = selectedId ? emails.findIndex((em) => em.id === selectedId) : -1;

      switch (e.key) {
        case "ArrowDown":
        case "j": {
          e.preventDefault();
          const next = currentIndex < emails.length - 1 ? currentIndex + 1 : currentIndex;
          if (emails[next]) setSelectedId(emails[next].id);
          break;
        }
        case "ArrowUp":
        case "k": {
          e.preventDefault();
          const prev = currentIndex > 0 ? currentIndex - 1 : 0;
          if (emails[prev]) setSelectedId(emails[prev].id);
          break;
        }
        case "Enter": {
          // Already selected — no-op (reader opens automatically)
          break;
        }
        case "Escape": {
          e.preventDefault();
          setSelectedId(null);
          break;
        }
        case "e": {
          if (selectedId && onArchive) {
            e.preventDefault();
            onArchive(selectedId);
          }
          break;
        }
        case "Delete":
        case "Backspace": {
          if (selectedId && onDelete) {
            e.preventDefault();
            onDelete(selectedId);
          }
          break;
        }
        case "s": {
          if (selectedId && onToggleStar) {
            e.preventDefault();
            onToggleStar(selectedId);
          }
          break;
        }
        case "r": {
          if (selectedId && onReply) {
            e.preventDefault();
            onReply();
          }
          break;
        }
        case "c": {
          if (onCompose) {
            e.preventDefault();
            onCompose();
          }
          break;
        }
      }
    },
    [emails, selectedId, setSelectedId, onArchive, onDelete, onToggleStar, onReply, onCompose, isComposing]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

import { useEffect, useRef } from "react";
import { Note } from "@/contexts/DashboardContext";

interface UseNoteListKeyboardOptions {
  notes: Note[];
  selectedId: string | null;
  onSelect: (note: Note) => void;
  enabled: boolean;
}

/**
 * Arrow-key (↑/↓ or j/k) navigation for the note list panel.
 * Only active when no note is open in the editor (enabled=true).
 */
export function useNoteListKeyboard({ notes, selectedId, onSelect, enabled }: UseNoteListKeyboardOptions) {
  const notesRef = useRef(notes);
  notesRef.current = notes;

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;

      const list = notesRef.current;
      if (list.length === 0) return;

      const currentIdx = selectedId ? list.findIndex(n => n.id === selectedId) : -1;

      switch (e.key) {
        case "ArrowDown":
        case "j": {
          e.preventDefault();
          const next = currentIdx < list.length - 1 ? currentIdx + 1 : 0;
          onSelect(list[next]);
          break;
        }
        case "ArrowUp":
        case "k": {
          e.preventDefault();
          const prev = currentIdx > 0 ? currentIdx - 1 : list.length - 1;
          onSelect(list[prev]);
          break;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, selectedId, onSelect]);
}

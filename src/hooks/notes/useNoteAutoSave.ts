/**
 * useNoteAutoSave — Saves note immediately when tab loses visibility.
 * Prevents data loss when users switch tabs or close the browser.
 */
import { useEffect, useRef } from "react";

interface UseNoteAutoSaveOptions {
  selectedId: string | null;
  getEditState: () => {
    title: string;
    content: string;
    tags: string[];
    color: string;
    notebook: string;
  };
  updateNote: (id: string, data: Record<string, any>) => void;
  autoSaveTimer: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
}

export function useNoteAutoSave({ selectedId, getEditState, updateNote, autoSaveTimer }: UseNoteAutoSaveOptions) {
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && selectedIdRef.current) {
        // Flush pending auto-save immediately
        if (autoSaveTimer.current) {
          clearTimeout(autoSaveTimer.current);
          autoSaveTimer.current = null;
        }
        const state = getEditState();
        updateNote(selectedIdRef.current, {
          title: state.title,
          content: state.content,
          tags: state.tags,
          color: state.color,
          notebook: state.notebook || undefined,
        });
      }
    };

    const handleBeforeUnload = () => {
      if (selectedIdRef.current) {
        const state = getEditState();
        updateNote(selectedIdRef.current, {
          title: state.title,
          content: state.content,
          tags: state.tags,
          color: state.color,
          notebook: state.notebook || undefined,
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [getEditState, updateNote, autoSaveTimer]);
}

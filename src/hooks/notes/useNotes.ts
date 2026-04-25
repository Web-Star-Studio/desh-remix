/**
 * useNotes — Domain facade for the Notes module.
 */
import { useNotesLogic } from "./useNotesLogic";
import { useNoteSearchHistory } from "./useNoteSearchHistory";

export function useNotes() {
  const logic = useNotesLogic();
  const searchHistory = useNoteSearchHistory();

  return {
    ...logic,
    searchHistory: searchHistory.history,
    addToSearchHistory: searchHistory.addToHistory,
    clearSearchHistory: searchHistory.clearHistory,
  } as const;
}

import { useEffect, useRef, useCallback, useState } from "react";

const STORAGE_KEY = "social_composer_draft";
const DEBOUNCE_MS = 2000;

export interface DraftState {
  content: string;
  selectedAccounts: string[];
  mediaItems: { url: string; type: string }[];
  firstComment: string;
  mode: string;
  scheduleDate: string;
  savedAt: number;
}

export function useAutoSaveDraft() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recovered, setRecovered] = useState(false);

  const saveDraft = useCallback((state: Omit<DraftState, "savedAt">) => {
    if (!state.content.trim() && state.mediaItems.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const draft: DraftState = { ...state, savedAt: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    }, DEBOUNCE_MS);
  }, []);

  const loadDraft = useCallback((): DraftState | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const draft = JSON.parse(raw) as DraftState;
      // Expire after 24h
      if (Date.now() - draft.savedAt > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      setRecovered(true);
      return draft;
    } catch {
      return null;
    }
  }, []);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setRecovered(false);
  }, []);

  const dismissRecovery = useCallback(() => {
    setRecovered(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { saveDraft, loadDraft, clearDraft, recovered, dismissRecovery };
}

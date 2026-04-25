import { useState, useCallback, useMemo } from "react";

const STORAGE_KEY = "desh-note-search-history";
const MAX_HISTORY = 8;

function readHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch { return []; }
}

function writeHistory(items: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
}

export function useNoteSearchHistory() {
  const [history, setHistory] = useState<string[]>(readHistory);

  const addToHistory = useCallback((query: string) => {
    const q = query.trim();
    if (!q || q.length < 2) return;
    setHistory(prev => {
      const next = [q, ...prev.filter(h => h !== q)].slice(0, MAX_HISTORY);
      writeHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const removeFromHistory = useCallback((query: string) => {
    setHistory(prev => {
      const next = prev.filter(h => h !== query);
      writeHistory(next);
      return next;
    });
  }, []);

  return { history, addToHistory, clearHistory, removeFromHistory };
}

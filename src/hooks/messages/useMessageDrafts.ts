/**
 * useMessageDrafts — Auto-save and restore message drafts per conversation.
 * Stores drafts in localStorage with a debounced write.
 */
import { useCallback, useEffect, useRef } from "react";

const STORAGE_KEY = "desh_message_drafts";
const DEBOUNCE_MS = 500;
const MAX_DRAFTS = 50;

function readDrafts(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeDrafts(drafts: Record<string, string>) {
  // Prune oldest if over limit
  const keys = Object.keys(drafts);
  if (keys.length > MAX_DRAFTS) {
    const pruned: Record<string, string> = {};
    keys.slice(-MAX_DRAFTS).forEach(k => { pruned[k] = drafts[k]; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  }
}

export function useMessageDrafts(
  conversationId: string | null,
  message: string,
  setMessage: (v: string) => void,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRestoredIdRef = useRef<string | null>(null);

  // Restore draft when conversation changes
  useEffect(() => {
    if (!conversationId || conversationId === lastRestoredIdRef.current) return;
    lastRestoredIdRef.current = conversationId;
    const drafts = readDrafts();
    const draft = drafts[conversationId];
    if (draft && draft.trim()) {
      setMessage(draft);
    } else if (message.trim()) {
      // Save current message as draft for previous conversation
      // (handled by the debounced save below)
      setMessage("");
    }
  }, [conversationId]);

  // Debounced save
  useEffect(() => {
    if (!conversationId) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const drafts = readDrafts();
      if (message.trim()) {
        drafts[conversationId] = message;
      } else {
        delete drafts[conversationId];
      }
      writeDrafts(drafts);
    }, DEBOUNCE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [conversationId, message]);

  // Clear draft for a conversation (call after sending)
  const clearDraft = useCallback((convoId: string) => {
    const drafts = readDrafts();
    delete drafts[convoId];
    writeDrafts(drafts);
  }, []);

  // Check if a conversation has a draft (for sidebar indicator)
  const hasDraft = useCallback((convoId: string): boolean => {
    const drafts = readDrafts();
    return !!drafts[convoId]?.trim();
  }, []);

  return { clearDraft, hasDraft };
}

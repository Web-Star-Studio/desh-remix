/**
 * useConversationSort — Advanced conversation sorting with multiple strategies.
 */
import { useState, useMemo, useCallback } from "react";
import type { Conversation } from "@/lib/messageUtils";

export type SortMode = "recent" | "unread-first" | "alphabetical";

export function useConversationSort(conversations: Conversation[]) {
  const [sortMode, setSortMode] = useState<SortMode>("recent");

  const sorted = useMemo(() => {
    const list = [...conversations];
    
    // Always put pinned first
    list.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;

      switch (sortMode) {
        case "unread-first":
          if (a.unread > 0 && b.unread === 0) return -1;
          if (a.unread === 0 && b.unread > 0) return 1;
          return b.lastMessageAt - a.lastMessageAt;
        case "alphabetical":
          return a.name.localeCompare(b.name, "pt-BR");
        case "recent":
        default:
          return b.lastMessageAt - a.lastMessageAt;
      }
    });

    return list;
  }, [conversations, sortMode]);

  const cycleSortMode = useCallback(() => {
    setSortMode(prev => {
      if (prev === "recent") return "unread-first";
      if (prev === "unread-first") return "alphabetical";
      return "recent";
    });
  }, []);

  const sortLabel = sortMode === "recent" ? "Recentes" : sortMode === "unread-first" ? "Não lidas" : "A-Z";
  const sortIcon = sortMode === "recent" ? "clock" : sortMode === "unread-first" ? "bell" : "type";

  return { sorted, sortMode, setSortMode, cycleSortMode, sortLabel, sortIcon };
}

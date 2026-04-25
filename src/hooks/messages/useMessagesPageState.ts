/**
 * useMessagesPageState — Consolidates UI state management for MessagesPage:
 * - Search, filters, bulk mode
 * - Pending media and file selection
 * - AI state
 * - Dialog states (save contact, new conversation)
 *
 * Extracted from MessagesPage.tsx for maintainability.
 */
import { useState, useRef, useCallback } from "react";
import { toast } from "@/hooks/use-toast";

export function useMessagesPageState() {
  // Selection & search
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [newMessage, setNewMessage] = useState("");

  // Filters
  const [platformFilter, setPlatformFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [typingConvos, setTypingConvos] = useState<Set<string>>(new Set());

  // Bulk mode
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedConvoIds, setSelectedConvoIds] = useState<Set<string>>(new Set());

  const toggleSelectConvo = useCallback((id: string) => {
    setSelectedConvoIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setBulkMode(false);
      return next;
    });
  }, []);

  const enterBulkMode = useCallback((id: string) => {
    if (!id) { setBulkMode(false); setSelectedConvoIds(new Set()); return; }
    setBulkMode(true);
    setSelectedConvoIds(new Set([id]));
  }, []);

  const clearBulk = useCallback(() => {
    setBulkMode(false);
    setSelectedConvoIds(new Set());
  }, []);

  // Media
  const [pendingMedia, setPendingMedia] = useState<{ file: File; base64: string; mediatype: string } | null>(null);
  const [sendingMedia, setSendingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O limite é 15MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const bytes = new Uint8Array(arrayBuffer);
      const CHUNK_SIZE = 8192;
      let binary = "";
      for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
        binary += String.fromCharCode(...chunk);
      }
      const base64 = `data:${file.type};base64,${btoa(binary)}`;
      const mime = file.type;
      const mediatype = mime.startsWith("image/") ? "image"
        : mime.startsWith("video/") ? "video"
        : mime.startsWith("audio/") ? "audio"
        : "document";
      setPendingMedia({ file, base64, mediatype });
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }, []);

  // Save contact dialog
  const [showSaveContact, setShowSaveContact] = useState(false);
  const [saveContactPhone, setSaveContactPhone] = useState("");
  const [saveContactName, setSaveContactName] = useState("");
  const [savingContact, setSavingContact] = useState(false);

  // AI state
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<"summarize" | "suggest" | "translate" | "improve" | null>(null);

  // New conversation dialog
  const [showNewConvoDialog, setShowNewConvoDialog] = useState(false);
  const [newConvoPhone, setNewConvoPhone] = useState("");
  const [newConvoText, setNewConvoText] = useState("");
  const [startingNewConvo, setStartingNewConvo] = useState(false);

  // Context menu
  const [showContextMenu, setShowContextMenu] = useState<string | null>(null);

  // Sync history
  const [syncingHistory, setSyncingHistory] = useState(false);

  return {
    selectedId, setSelectedId,
    searchQuery, setSearchQuery,
    chatSearchQuery, setChatSearchQuery,
    showChatSearch, setShowChatSearch,
    newMessage, setNewMessage,
    platformFilter, setPlatformFilter,
    showArchived, setShowArchived,
    typingConvos, setTypingConvos,
    bulkMode, selectedConvoIds, toggleSelectConvo, enterBulkMode, clearBulk,
    pendingMedia, setPendingMedia, sendingMedia, setSendingMedia, fileInputRef, handleFileSelect,
    showSaveContact, setShowSaveContact, saveContactPhone, setSaveContactPhone, saveContactName, setSaveContactName, savingContact, setSavingContact,
    aiSummary, setAiSummary, aiLoading, setAiLoading,
    showNewConvoDialog, setShowNewConvoDialog, newConvoPhone, setNewConvoPhone, newConvoText, setNewConvoText, startingNewConvo, setStartingNewConvo,
    showContextMenu, setShowContextMenu,
    syncingHistory, setSyncingHistory,
  };
}

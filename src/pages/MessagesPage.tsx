/**
 * MessagesPage — Main composition layer.
 * Components and logic extracted into focused modules:
 * - messageUtils.ts: types, helpers, constants
 * - ConversationList.tsx: sidebar component
 * - ChatView.tsx: main chat component
 * - useMessagesSyncEngine.ts: background sync, contacts, lastMsg
 * - useMessageActions.ts: react, star, delete, forward
 * - useMessagesPageState.ts: UI state management
 */
import PageLayout from "@/components/dashboard/PageLayout";
import DeshTooltip from "@/components/ui/DeshTooltip";
import HeaderActions from "@/components/dashboard/HeaderActions";
import { useConnections } from "@/contexts/ConnectionsContext";
import { useSharedWhatsappSession } from "@/contexts/WhatsappSessionContext";
import { useWhatsappConversations } from "@/hooks/whatsapp/useWhatsappConversations";
import { useWhatsappMessages } from "@/hooks/whatsapp/useWhatsappMessages";
import { useWhatsappPresence } from "@/hooks/whatsapp/useWhatsappPresence";
import { useMultiWhatsappSessions } from "@/hooks/whatsapp/useMultiWhatsappSessions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { callWhatsappProxy } from "@/lib/whatsappProxy";
import { useWorkspaceSafe } from "@/contexts/WorkspaceContext";

import GlassCard from "@/components/dashboard/GlassCard";
import ConnectionBadge from "@/components/dashboard/ConnectionBadge";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import {
  ArrowLeft, Send, Loader2, Wifi, WifiOff, Settings, RefreshCw, Download, Plus, Phone,
  UserPlus, Globe
} from "lucide-react";
import { useState, useRef, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDbContacts } from "@/hooks/contacts/useDbContacts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ForwardMessageDialog } from "@/components/messages/ForwardMessageDialog";
import WhatsAppDisconnectedBanner from "@/components/dashboard/WhatsAppDisconnectedBanner";

// Extracted modules
import type { Conversation, ChatMessage } from "@/lib/messageUtils";
import { extractMedia, extractQuote, formatPhoneDisplay, getMessageTypeLabel } from "@/lib/messageUtils";
import { ConversationListComponent } from "@/components/messages/ConversationList";

// Lazy-load heavy ChatView (783 lines + many sub-imports)
const ChatViewComponent = lazy(() =>
  import("@/components/messages/ChatView").then(m => ({ default: m.ChatViewComponent }))
);
import { useMessagesSyncEngine } from "@/hooks/messages/useMessagesSyncEngine";
import { useMessageActions } from "@/hooks/messages/useMessageActions";
import { useMessagesPageState } from "@/hooks/messages/useMessagesPageState";
import { useMessagesKeyboard } from "@/hooks/messages/useMessagesKeyboard";
import { useMessageDrafts } from "@/hooks/messages/useMessageDrafts";

// Late inbox (social DMs)
import { useLateInboxConversations } from "@/hooks/messages/useLateInboxConversations";
import { useLateInboxMessages } from "@/hooks/messages/useLateInboxMessages";
import { useLateInboxActions } from "@/hooks/messages/useLateInboxActions";
import { isMissingLateAccountId } from "@/hooks/messages/lateInboxHelpers";

// ─── Main Page ────────────────────────────────────────────────────────────────

const MessagesPage = () => {
  const { invoke } = useEdgeFn();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();

  // Multi-workspace support
  const wsCtx = useWorkspaceSafe();
  const workspaces = wsCtx?.workspaces ?? [];
  const activeWorkspaceId = wsCtx?.activeWorkspaceId ?? null;
  const isViewAll = !activeWorkspaceId;
  const [wsFilter, setWsFilter] = useState<string>("all");

  // Multi-session hook
  const multiWa = useMultiWhatsappSessions();

  const { session: waSession, loading: waLoading, sendMessage: waSendMessage, sendMedia: waSendMedia, downloadMedia: waDownloadMedia, createSession: waCreateSession, effectiveWorkspaceId: waWorkspaceId } = useSharedWhatsappSession();
  const waConnected = waSession.status === "CONNECTED";
  const waSessionRef = useRef(waSession);
  waSessionRef.current = waSession;

  const isConvoWsConnected = useCallback((convo: Conversation | null | undefined): boolean => {
    if (!isViewAll) return waConnected;
    if (!convo?.workspaceId) return waConnected;
    return multiWa.isWorkspaceConnected(convo.workspaceId) || waConnected;
  }, [isViewAll, waConnected, multiWa]);

  const anyWaConnected = useMemo(() => {
    if (waConnected) return true;
    return multiWa.connectedWorkspaceIds.length > 0;
  }, [waConnected, multiWa.connectedWorkspaceIds]);

  const { conversations: waConversations, isLoading: waConvosLoading, refetch: refetchConvos, markAsRead, markAsUnread, updateLabels, upsertConversation, deleteConversation } = useWhatsappConversations();

  // Late inbox (social DMs from connected social accounts)
  const lateInbox = useLateInboxConversations();
  const lateActions = useLateInboxActions();

  // ── Extracted hooks ─────────────────────────────────────────────────────────

  const syncEngine = useMessagesSyncEngine({
    userId: user?.id ?? null,
    anyWaConnected,
    waConversations,
    refetchConvos,
    isViewAll,
    connectedWorkspaceIds: multiWa.connectedWorkspaceIds,
    waWorkspaceId,
    waSessionStatus: waSession.status,
  });

  const pageState = useMessagesPageState();

  const { addContact } = useDbContacts();

  // Draft auto-save per conversation
  const drafts = useMessageDrafts(
    pageState.selectedId,
    pageState.newMessage,
    pageState.setNewMessage,
  );

  const {
    messages: waMessages, isLoading: waMsgsLoading, refetch: refetchMessages,
    addOptimistic, resolveOptimistic, appendFromRealtime, updateFromRealtime, hasMore, loadMore
  } = useWhatsappMessages(pageState.selectedId);

  // Late inbox messages — resolve accountId from Late conversations
  const selectedLateAccountId = useMemo(() => {
    if (!pageState.selectedId?.startsWith("late_")) return undefined;
    return lateInbox.conversations.find(c => c.id === pageState.selectedId)?.accountId;
  }, [pageState.selectedId, lateInbox.conversations]);

  const lateMessages = useLateInboxMessages(
    pageState.selectedId?.startsWith("late_") ? pageState.selectedId : null,
    selectedLateAccountId
  );

  // Presence hook
  const selectedChannelId = useMemo(() => {
    const convo = waConversations.find(c => c.id === pageState.selectedId);
    return convo?.externalContactId || null;
  }, [pageState.selectedId, waConversations]);
  const { presence, sendTypingPresence, formattedLastSeen } = useWhatsappPresence(selectedChannelId);

  // Message actions
  const selectedConvoWsId = useMemo(() => {
    const convo = waConversations.find(c => c.id === pageState.selectedId);
    return convo?.workspaceId || waWorkspaceId;
  }, [pageState.selectedId, waConversations, waWorkspaceId]);

  const msgActions = useMessageActions({
    selectedConvoWsId,
    waMessages,
    refetchMessages,
  });

  // Optimistic resolution timeout
  const optimisticTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fakeStatusTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scheduleOptimisticFallback = useCallback((tempId: string) => {
    if (optimisticTimeoutRef.current) clearTimeout(optimisticTimeoutRef.current);
    optimisticTimeoutRef.current = setTimeout(() => {
      refetchMessages();
    }, 5000);
  }, [refetchMessages]);

  useEffect(() => {
    return () => {
      if (optimisticTimeoutRef.current) clearTimeout(optimisticTimeoutRef.current);
      fakeStatusTimersRef.current.forEach(t => clearTimeout(t));
      fakeStatusTimersRef.current = [];
    };
  }, []);

  // Audio send handler (cross-cutting deps)
  const selectedConvoRef = useRef<Conversation | null>(null);
  const handleSendAudio = useCallback(async (base64: string, mimetype: string) => {
    const conv = selectedConvoRef.current;
    if (!conv) return;
    const wsId = conv.workspaceId || waWorkspaceId;
    const wsConnected = isViewAll ? multiWa.isWorkspaceConnected(conv.workspaceId ?? "") || waConnected : waConnected;
    if (!wsConnected) return;
    const tempMsg = addOptimistic({ contentText: "🎤 Áudio", type: "audio" });
    try {
      if (isViewAll && conv.workspaceId) {
        await multiWa.sendMediaViaWorkspace(conv.workspaceId, conv.channelId, base64, "audio", mimetype, `audio-${Date.now()}.ogg`);
      } else {
        await waSendMedia(conv.channelId, base64, "audio", mimetype, `audio-${Date.now()}.ogg`);
      }
      scheduleOptimisticFallback(tempMsg.id);
    } catch (err: any) {
      resolveOptimistic(tempMsg.id);
      toast({ title: "Erro ao enviar áudio", description: err?.message, variant: "destructive" });
    }
  }, [waConnected, addOptimistic, resolveOptimistic, waSendMedia, scheduleOptimisticFallback, isViewAll, multiWa]);

  const rawMessages: any[] = [];
  const isLoading = false;
  const unifiedConnected = false;
  const isSending = false;

  const [localConversations, setLocalConversations] = useState<Conversation[]>([]);
  const [localMessages, setLocalMessages] = useState<Record<string, ChatMessage[]>>({});

  const isUnsavedWhatsappContact = useCallback((convo: Conversation) => {
    return convo.platform === "whatsapp" && convo.channelId && !syncEngine.contactNameMap[convo.channelId];
  }, [syncEngine.contactNameMap]);

  const openSaveContactDialog = useCallback((convo: Conversation) => {
    pageState.setSaveContactPhone(convo.channelId);
    pageState.setSaveContactName(convo.name === formatPhoneDisplay(convo.channelId) ? "" : convo.name);
    pageState.setShowSaveContact(true);
    pageState.setShowContextMenu(null);
  }, []);

  const handleSaveAsContact = useCallback(async () => {
    if (!pageState.saveContactName.trim()) return;
    pageState.setSavingContact(true);
    try {
      await addContact({ name: pageState.saveContactName.trim(), phone: pageState.saveContactPhone });
      syncEngine.setContactNameMap(prev => ({ ...prev, [pageState.saveContactPhone]: pageState.saveContactName.trim() }));
      pageState.setShowSaveContact(false);
      toast({ title: "Contato salvo!", description: pageState.saveContactName.trim() });
    } catch {
      toast({ title: "Erro ao salvar contato", variant: "destructive" });
    } finally {
      pageState.setSavingContact(false);
    }
  }, [pageState.saveContactName, pageState.saveContactPhone, addContact]);

  // ── Derived conversations ───────────────────────────────────────────────────

  const waConvoIds = useMemo(() => new Set(waConversations.map(c => c.id)), [waConversations]);
  const waConvoIdsRef = useRef(waConvoIds);
  waConvoIdsRef.current = waConvoIds;

  const realWaConversations: Conversation[] = useMemo(() => {
    const isOwnName = (name: string | null) => {
      if (!name || !syncEngine.userDisplayName) return false;
      const n = name.toLowerCase().trim();
      const u = syncEngine.userDisplayName.toLowerCase().trim();
      if (n === u) return true;
      const nFirst = n.split(/[\s.]+/)[0];
      const uFirst = u.split(/[\s.]+/)[0];
      if (nFirst.length >= 3 && nFirst === uFirst) {
        if (n.length < u.length * 0.6) return true;
      }
      return false;
    };

    return waConversations.map(c => {
      const contactMatch = syncEngine.contactNameMap[c.externalContactId];
      const titleIsOwnName = isOwnName(c.title);
      const validTitle = c.title && !titleIsOwnName ? c.title : null;
      const inboundPushName = syncEngine.pushNameMap[c.id];
      const pushNameIsOwn = isOwnName(inboundPushName || null);
      const validPushName = inboundPushName && !pushNameIsOwn ? inboundPushName : null;
      const displayName = contactMatch || validTitle || validPushName || formatPhoneDisplay(c.externalContactId);
      const isGroup = c.externalContactId.endsWith("@g.us");
      return {
        id: c.id,
        name: isGroup ? (validTitle || c.externalContactId.replace("@g.us", "")) : displayName,
        platform: "whatsapp",
        lastMessage: syncEngine.lastMessageMap[c.id] || "",
        time: new Date(c.lastMessageAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        lastMessageAt: new Date(c.lastMessageAt).getTime(),
        unread: c.unreadCount,
        avatar: c.profilePictureUrl || (isGroup ? "👥" : (displayName || "📱")[0]),
        channelId: c.externalContactId,
        pinned: c.labels.includes("pinned"),
        archived: c.labels.includes("archived"),
        muted: c.labels.includes("muted"),
        workspaceId: c.workspaceId,
        labels: c.labels,
      };
    });
  }, [waConversations, syncEngine.lastMessageMap, syncEngine.contactNameMap, syncEngine.userDisplayName, syncEngine.pushNameMap]);

  const isConnected = unifiedConnected || waSession.status === "CONNECTED" || realWaConversations.length > 0 || lateInbox.conversations.length > 0;

  const unifiedConversations: Conversation[] = isConnected && rawMessages.length > 0
    ? rawMessages.reduce<Conversation[]>((acc, m: any) => {
        const channelId = m.channel_id || m.id || "";
        const existing = acc.find(c => c.channelId === channelId);
        if (!existing) {
          acc.push({
            id: channelId,
            name: m.channel?.name || m.author_member?.name || channelId,
            platform: m.platform || "messaging",
            lastMessage: (m.message || "").slice(0, 60),
            time: new Date(m.created_at || Date.now()).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            lastMessageAt: new Date(m.created_at || Date.now()).getTime(),
            unread: m.is_read ? 0 : 1,
            avatar: (m.channel?.name || m.author_member?.name || "?")[0],
            channelId,
            pinned: false, archived: false, muted: false,
          });
        }
        return acc;
      }, [])
    : [];

  const hasRealData = realWaConversations.length > 0 || (isConnected && unifiedConversations.length > 0) || lateInbox.conversations.length > 0;
  const allConversations = useMemo(() => {
    return hasRealData
      ? [...realWaConversations, ...unifiedConversations, ...lateInbox.conversations]
      : localConversations;
  }, [hasRealData, realWaConversations, unifiedConversations, lateInbox.conversations, localConversations]);

  const conversations = useMemo(() => {
    if (!isViewAll || wsFilter === "all") return allConversations;
    return allConversations.filter(c => c.workspaceId === wsFilter);
  }, [allConversations, isViewAll, wsFilter]);

  const selectedConvo = useMemo(() => conversations.find(c => c.id === pageState.selectedId) ?? null, [conversations, pageState.selectedId]);
  selectedConvoRef.current = selectedConvo;

  // Keyboard navigation for conversation list
  useMessagesKeyboard({
    conversations,
    selectedId: pageState.selectedId,
    onSelectConvo: (id) => {
      pageState.setSelectedId(id);
      pageState.setAiSummary(null);
      pageState.setShowChatSearch(false);
      pageState.setChatSearchQuery("");
      pageState.setPendingMedia(null);
    },
    onDeselectConvo: () => pageState.setSelectedId(null),
  });

  // Deep-link
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current) return;
    const toParam = searchParams.get("to");
    if (!toParam || conversations.length === 0) return;
    deepLinkHandled.current = true;
    setSearchParams(prev => { prev.delete("to"); return prev; }, { replace: true });
    const normalized = toParam.replace(/\D/g, "");
    const match = conversations.find(c => {
      const cNorm = c.channelId?.replace(/\D/g, "") || "";
      return cNorm.includes(normalized) || normalized.includes(cNorm);
    });
    if (match) {
      pageState.setSelectedId(match.id);
    } else {
      toast({ title: "Nova conversa", description: `Nenhuma conversa encontrada com ${formatPhoneDisplay(normalized)}. Inicie uma nova mensagem.` });
    }
  }, [conversations, searchParams]);

  const isCurrentLateConvo = pageState.selectedId?.startsWith("late_") ?? false;

  const isCurrentRealWaConvo = useMemo(() => {
    if (!pageState.selectedId) return false;
    return waConvoIds.has(pageState.selectedId);
  }, [pageState.selectedId, waConvoIds]);

  // For ChatView: show as "connected" for Late conversations too
  const effectiveWaConnected = waConnected || isCurrentLateConvo;

  // ── Map WA messages to ChatMessage ──────────────────────────────────────────

  const realChatMessages: ChatMessage[] = useMemo(() => {
    return waMessages.map(m => {
      const media = extractMedia(m.contentRaw);
      const quote = extractQuote(m.contentRaw);
      const fallbackText = media.mediaFileName
        ? `📎 ${media.mediaFileName}`
        : media.mediaType === "image" ? "📷 Imagem"
        : media.mediaType === "audio" ? "🎤 Áudio"
        : media.mediaType === "video" ? "🎥 Vídeo"
        : media.mediaType === "album" ? `📸 ${media.mediaFileName || "Álbum"}`
        : "";
      const isGroup = selectedConvoRef.current?.channelId?.endsWith("@g.us");
      let senderName: string;
      if (m.direction === "outbound") {
        senderName = "Você";
      } else if (isGroup && m.contentRaw) {
        const raw = m.contentRaw as any;
        const participant = raw?.key?.participant?.replace(/@.*/, "") || "";
        const pushName = raw?.pushName || "";
        const contactName = participant ? (syncEngine.contactNameMap[participant] || syncEngine.contactNameMap[participant.slice(-8)]) : null;
        senderName = contactName || pushName || formatPhoneDisplay(participant) || selectedConvoRef.current?.name || "Desconhecido";
      } else {
        senderName = selectedConvoRef.current?.name || formatPhoneDisplay(selectedConvoRef.current?.channelId || "");
      }
      return {
        id: m.id,
        sender: senderName,
        text: m.contentText || fallbackText,
        time: new Date(m.sentAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        rawDate: m.sentAt,
        isMe: m.direction === "outbound",
        status: m.status === "read" ? "read" as const
          : m.status === "delivered" ? "delivered" as const
          : m.status === "failed" ? "failed" as const
          : m.status === "pending" ? "sent" as const
          : m.status === "sending" ? "sending" as const
          : undefined,
        ...media,
        ...quote,
        reactions: m.reactions,
        starred: m.starred,
        deletedForEveryone: m.deletedForEveryone,
        contentRaw: m.contentRaw,
      };
    });
  }, [waMessages]);

  const getMessages = useCallback((convoId: string): ChatMessage[] => {
    // Late inbox conversations
    if (convoId.startsWith("late_")) return lateMessages.messages;
    if (waConvoIdsRef.current.has(convoId)) return realChatMessages;
    if (isConnected && rawMessages.length) {
      return rawMessages
        .filter((m: any) => (m.channel_id || m.id) === convoId)
        .map((m: any) => ({
          id: m.id || String(Math.random()),
          sender: m.author_member?.name || "Desconhecido",
          text: m.message || m.body || "",
          time: new Date(m.created_at || Date.now()).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          rawDate: m.created_at || new Date().toISOString(),
          isMe: m.is_me || false,
        }));
    }
    return localMessages[convoId] || [];
  }, [realChatMessages, isConnected, rawMessages, localMessages, lateMessages.messages]);

  // ── Realtime: typing indicators ─────────────────────────────────────────────
  // Use a ref for waConversations to avoid re-subscribing on every conversation update
  const waConversationsRef = useRef(waConversations);
  waConversationsRef.current = waConversations;

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("wa_presence_global_rt")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "whatsapp_presence",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        if (!payload.new) return;
        const row = payload.new as Record<string, unknown>;
        const contactJid = row.contact_jid as string;
        const status = row.status as string;
        const match = waConversationsRef.current.find(c => {
          const norm = c.externalContactId.replace(/@.*/, "");
          return norm === contactJid;
        });
        if (!match) return;
        pageState.setTypingConvos(prev => {
          const next = new Set(prev);
          if (status === "typing") next.add(match.id);
          else next.delete(match.id);
          return next;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const messages = getMessages(pageState.selectedId || "");

  // ── Realtime: messages ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!pageState.selectedId || !user) return;
    if (!waConvoIdsRef.current.has(pageState.selectedId)) return;
    const channel = supabase
      .channel(`wa_messages_rt_${pageState.selectedId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "whatsapp_messages",
        filter: `conversation_id=eq.${pageState.selectedId}`,
      }, (payload) => {
        if (payload.eventType === "INSERT") {
          appendFromRealtime(payload.new as Record<string, unknown>);
          const row = payload.new as any;
          const prefix = row.direction === "outbound" ? "Você: " : "";
          const typeLabel = getMessageTypeLabel(row.type);
          syncEngine.setLastMessageMap(prev => ({
            ...prev,
            [row.conversation_id]: `${prefix}${row.content_text || typeLabel || ""}`,
          }));
        } else if (payload.eventType === "UPDATE") {
          updateFromRealtime(payload.new as Record<string, unknown>);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [pageState.selectedId, user?.id, appendFromRealtime, updateFromRealtime]);

  // Global realtime for sidebar preview
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("wa_messages_global_rt")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "whatsapp_messages",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const row = payload.new as any;
        const convId = row.conversation_id;
        if (convId === pageState.selectedId) return;
        const prefix = row.direction === "outbound" ? "Você: " : "";
        const typeLabel = getMessageTypeLabel(row.type);
        syncEngine.setLastMessageMap(prev => ({
          ...prev,
          [convId]: `${prefix}${row.content_text || typeLabel || ""}`,
        }));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, pageState.selectedId]);

  const filteredChatMessages = useMemo(() => {
    if (!pageState.chatSearchQuery) return messages;
    const q = pageState.chatSearchQuery.toLowerCase();
    return messages.filter(m => m.text.toLowerCase().includes(q) || m.sender.toLowerCase().includes(q));
  }, [messages, pageState.chatSearchQuery]);

  const availablePlatforms = useMemo(() => {
    const platforms = new Set(conversations.filter(c => !c.archived).map(c => c.platform));
    return ["all", ...Array.from(platforms)];
  }, [conversations]);

  // ── Conversation action handlers ────────────────────────────────────────────

  const togglePin = useCallback(async (id: string) => {
    const isRealWa = waConvoIdsRef.current.has(id);
    if (isRealWa) {
      const convo = waConversations.find(c => c.id === id);
      if (!convo) return;
      const isPinned = convo.labels.includes("pinned");
      const newLabels = isPinned ? convo.labels.filter(l => l !== "pinned") : [...convo.labels, "pinned"];
      await updateLabels(id, newLabels);
      toast({ title: isPinned ? "Desafixada" : "Fixada no topo" });
    } else {
      setLocalConversations(prev => prev.map(c => c.id === id ? { ...c, pinned: !c.pinned } : c));
    }
    pageState.setShowContextMenu(null);
  }, [waConversations, updateLabels]);

  const toggleArchive = useCallback(async (id: string) => {
    // Late inbox conversations — archive/unarchive via Late API
    if (id.startsWith("late_")) {
      const lateConvo = lateInbox.conversations.find(c => c.id === id);
      if (!lateConvo?.accountId) return;
      const isArchived = lateConvo.archived;
      const newStatus = isArchived ? "active" : "archived";
      await lateActions.updateConversationStatus(id, lateConvo.accountId, newStatus);
      // Refresh conversations
      lateInbox.refetch();
      toast({ title: isArchived ? "Desarquivada" : "Conversa arquivada" });
      if (pageState.selectedId === id) pageState.setSelectedId(null);
      pageState.setShowContextMenu(null);
      return;
    }
    const isRealWa = waConvoIdsRef.current.has(id);
    if (isRealWa) {
      const convo = waConversations.find(c => c.id === id);
      if (!convo) return;
      const isArchived = convo.labels.includes("archived");
      const newLabels = isArchived ? convo.labels.filter(l => l !== "archived") : [...convo.labels, "archived"];
      await updateLabels(id, newLabels);
      toast({ title: isArchived ? "Desarquivada" : "Conversa arquivada" });
    } else {
      setLocalConversations(prev => prev.map(c => c.id === id ? { ...c, archived: !c.archived } : c));
    }
    if (pageState.selectedId === id) pageState.setSelectedId(null);
    pageState.setShowContextMenu(null);
  }, [waConversations, updateLabels, pageState.selectedId, lateInbox, lateActions]);

  const toggleMute = useCallback(async (id: string) => {
    const isRealWa = waConvoIdsRef.current.has(id);
    if (isRealWa) {
      const convo = waConversations.find(c => c.id === id);
      if (!convo) return;
      const isMuted = convo.labels.includes("muted");
      const newLabels = isMuted ? convo.labels.filter(l => l !== "muted") : [...convo.labels, "muted"];
      await updateLabels(id, newLabels);
      toast({ title: isMuted ? "Notificações ativadas" : "Conversa silenciada" });
    } else {
      setLocalConversations(prev => prev.map(c => c.id === id ? { ...c, muted: !c.muted } : c));
      const convo = localConversations.find(c => c.id === id);
      toast({ title: convo?.muted ? "Notificações ativadas" : "Conversa silenciada" });
    }
    pageState.setShowContextMenu(null);
  }, [waConversations, updateLabels, localConversations]);

  const handleDeleteConvo = useCallback(async (id: string) => {
    const isRealWa = waConvoIdsRef.current.has(id);
    if (isRealWa) {
      await deleteConversation(id);
      toast({ title: "Conversa excluída" });
    } else {
      setLocalConversations(prev => prev.filter(c => c.id !== id));
    }
    if (pageState.selectedId === id) pageState.setSelectedId(null);
    pageState.setShowContextMenu(null);
  }, [deleteConversation, pageState.selectedId]);

  const handleToggleReadStatus = useCallback(async (id: string, hasUnread: boolean) => {
    // Late inbox conversations
    if (id.startsWith("late_")) {
      const lateConvo = lateInbox.conversations.find(c => c.id === id);
      if (!lateConvo?.accountId) return;
      if (hasUnread) {
        lateInbox.markAsReadLocally(id);
        lateActions.updateConversationStatus(id, lateConvo.accountId, "read").catch(() => {});
        toast({ title: "Marcada como lida" });
      } else {
        // Late API may not support marking as unread — just toggle locally
        toast({ title: "Marcada como não lida" });
      }
      pageState.setShowContextMenu(null);
      return;
    }
    const isRealWa = waConvoIdsRef.current.has(id);
    if (isRealWa) {
      if (hasUnread) {
        markAsRead(id);
        const convo = waConversations.find(c => c.id === id);
        const wsId = convo?.workspaceId || waWorkspaceId;
        callWhatsappProxy("POST", "/mark-read", { conversationId: id }, wsId)
          .catch(e => console.error("[mark-read] Error:", e));
        toast({ title: "Marcada como lida" });
      } else {
        markAsUnread(id);
        toast({ title: "Marcada como não lida" });
      }
    } else {
      setLocalConversations(prev => prev.map(c => c.id === id ? { ...c, unread: hasUnread ? 0 : 1 } : c));
      toast({ title: hasUnread ? "Marcada como lida" : "Marcada como não lida" });
    }
    pageState.setShowContextMenu(null);
  }, [markAsRead, markAsUnread, waConversations, waWorkspaceId, lateInbox, lateActions]);

  const bulkMarkRead = useCallback(() => {
    pageState.selectedConvoIds.forEach(id => {
      if (waConvoIdsRef.current.has(id)) {
        markAsRead(id);
        const convo = waConversations.find(c => c.id === id);
        const wsId = convo?.workspaceId || waWorkspaceId;
        callWhatsappProxy("POST", "/mark-read", { conversationId: id }, wsId).catch(() => {});
      }
    });
    toast({ title: `${pageState.selectedConvoIds.size} conversa(s) marcada(s) como lida` });
    pageState.clearBulk();
  }, [pageState.selectedConvoIds, markAsRead, waConversations, waWorkspaceId]);

  // ── Send handler ────────────────────────────────────────────────────────────

  const handleSend = useCallback(async (quotedMessageId?: string) => {
    if (!pageState.selectedId) return;

    // ── Late inbox send (social DMs) ──
    const isLateConvo = pageState.selectedId.startsWith("late_");
    if (isLateConvo && selectedConvo) {
      if (!pageState.newMessage.trim()) return;
      if (isMissingLateAccountId(selectedConvo)) {
        toast({
          title: "Conta não identificada",
          description: "Esta conversa social não tem uma conta vinculada. Reconecte a integração e tente novamente.",
          variant: "destructive",
        });
        return;
      }
      const text = pageState.newMessage.trim();
      pageState.setNewMessage("");

      try {
        await lateActions.sendMessage(pageState.selectedId, selectedConvo.accountId, text);
        // Refresh messages after sending with short delay
        setTimeout(() => lateMessages.refetch(), 800);
        // Also refresh conversations to update lastMessage preview
        setTimeout(() => lateInbox.refetch(), 1500);
      } catch {
        // Error toast already handled in useLateInboxActions
        setTimeout(() => lateMessages.refetch(), 500);
      }
      return;
    }

    const hasRealDataForMedia = waConversations.length > 0;
    if (pageState.pendingMedia && (waConnected || hasRealDataForMedia) && selectedConvo) {
      const caption = pageState.newMessage.trim();
      pageState.setSendingMedia(true);
      pageState.setNewMessage("");
      const tempMsg = addOptimistic({
        contentText: caption || (pageState.pendingMedia.mediatype === "image" ? "📷 Imagem" : "📎 Arquivo"),
        type: pageState.pendingMedia.mediatype as any,
      });
      try {
        const targetWsId = selectedConvo.workspaceId || waWorkspaceId;
        if (isViewAll && targetWsId) {
          await multiWa.sendMediaViaWorkspace(
            targetWsId,
            selectedConvo.channelId,
            pageState.pendingMedia.base64,
            pageState.pendingMedia.mediatype,
            pageState.pendingMedia.file.type,
            pageState.pendingMedia.file.name,
            caption || undefined
          );
        } else {
          await waSendMedia(
            selectedConvo.channelId,
            pageState.pendingMedia.base64,
            pageState.pendingMedia.mediatype,
            pageState.pendingMedia.file.type,
            pageState.pendingMedia.file.name,
            caption || undefined
          );
        }
        pageState.setPendingMedia(null);
        scheduleOptimisticFallback(tempMsg.id);
      } catch (err: any) {
        resolveOptimistic(tempMsg.id);
        toast({ title: "Erro ao enviar mídia", description: err?.message || "Tente novamente.", variant: "destructive" });
      } finally {
        pageState.setSendingMedia(false);
      }
      return;
    }

    if (!pageState.newMessage.trim()) return;
    const text = pageState.newMessage.trim();
    pageState.setNewMessage("");
    if (pageState.selectedId) drafts.clearDraft(pageState.selectedId);

    const isRealWaConvo = waConvoIdsRef.current.has(pageState.selectedId);
    const isWhatsappConvo = isRealWaConvo || selectedConvo?.platform === "whatsapp";

    if (isWhatsappConvo && selectedConvo) {
      // Resilient send: allow sending if real WA conversations exist (API may be connected even if DB status is stale)
      const hasRealData = waConversations.length > 0;
      if (!waConnected && !hasRealData) {
        toast({ title: "WhatsApp desconectado", description: "Reconecte o WhatsApp para enviar mensagens.", variant: "destructive" });
        return;
      }
      const tempMsg = addOptimistic({ contentText: text });
      let success = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const targetWsId = selectedConvo.workspaceId || waWorkspaceId;
            if (isViewAll && targetWsId) {
              await multiWa.sendMessageViaWorkspace(targetWsId, selectedConvo.channelId, text, quotedMessageId);
            } else {
              await waSendMessage(selectedConvo.channelId, text, quotedMessageId);
            }
          success = true;
          scheduleOptimisticFallback(tempMsg.id);
          break;
        } catch (err: any) {
          console.error(`[handleSend] Send attempt ${attempt + 1} failed:`, err);
          if (attempt === 1) {
            resolveOptimistic(tempMsg.id);
            toast({ title: "Erro ao enviar", description: err?.message || "Tente novamente.", variant: "destructive" });
          } else {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }
      return;
    }

    if (isConnected && selectedConvo) {
      // No unified API — only WhatsApp sends are supported
      toast({ title: "Envio não suportado", description: "Use WhatsApp para enviar mensagens.", variant: "destructive" });
    } else {
      const msgId = `local-${Date.now()}`;
      const nowIso = new Date().toISOString();
      const newMsg: ChatMessage = {
        id: msgId, sender: "Você", text, time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        rawDate: nowIso, isMe: true, status: "sending",
      };
      setLocalMessages(prev => ({ ...prev, [pageState.selectedId!]: [...(prev[pageState.selectedId!] || []), newMsg] }));
      setLocalConversations(prev => prev.map(c =>
        c.id === pageState.selectedId ? { ...c, lastMessage: `Você: ${text}`, time: "Agora" } : c
      ));

      const sid = pageState.selectedId;
      const t1 = setTimeout(() => {
        setLocalMessages(prev => ({
          ...prev, [sid!]: (prev[sid!] || []).map(m => m.id === msgId ? { ...m, status: "sent" as const } : m),
        }));
      }, 600);
      const t2 = setTimeout(() => {
        setLocalMessages(prev => ({
          ...prev, [sid!]: (prev[sid!] || []).map(m => m.id === msgId ? { ...m, status: "delivered" as const } : m),
        }));
      }, 1500);
      const t3 = setTimeout(() => {
        setLocalMessages(prev => ({
          ...prev, [sid!]: (prev[sid!] || []).map(m => m.id === msgId ? { ...m, status: "read" as const } : m),
        }));
      }, 3000);
      const t4 = setTimeout(() => { pageState.setTypingConvos(prev => new Set(prev).add(sid!)); }, 2000);
      const t5 = setTimeout(() => { pageState.setTypingConvos(prev => { const next = new Set(prev); next.delete(sid!); return next; }); }, 5000);
      fakeStatusTimersRef.current.push(t1, t2, t3, t4, t5);
    }
  }, [pageState.selectedId, pageState.pendingMedia, waConnected, selectedConvo, pageState.newMessage, addOptimistic, resolveOptimistic, waSendMessage, waSendMedia, isConnected, refetchMessages, localConversations, isViewAll, multiWa, waWorkspaceId, lateActions, lateMessages]);

  const handleAiAction = useCallback(async (action: "summarize" | "suggest_reply" | "translate" | "improve", messageText?: string) => {
    if (!selectedConvo) return;
    const loadingKey = action === "summarize" ? "summarize" : action === "translate" ? "translate" : action === "improve" ? "improve" : "suggest";
    pageState.setAiLoading(loadingKey as any);
    try {
      const body: any = {
        action,
        conversation: {
          name: selectedConvo.name,
          platform: selectedConvo.platform,
          messages: messages.slice(-20),
        },
      };
      if (action === "translate" || action === "improve") {
        body.conversation.messageText = messageText || pageState.newMessage;
        if (action === "translate") body.conversation.targetLang = "inglês";
      }
      const { data, error } = await invoke<any>({ fn: "ai-router", body: { module: "messages", ...body } });
      if (error) throw new Error(error);
      if (action === "summarize") {
        pageState.setAiSummary(data.result);
      } else {
        pageState.setNewMessage(data.result);
      }
    } catch (err: any) {
      console.error("Messages AI error:", err);
      toast({ title: "Erro na IA", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      pageState.setAiLoading(null);
    }
  }, [selectedConvo, messages, invoke, pageState.newMessage]);

  const handleStartNewConvo = useCallback(async () => {
    if (!pageState.newConvoPhone.trim() || !waConnected) return;
    pageState.setStartingNewConvo(true);
    try {
      const phone = pageState.newConvoPhone.replace(/\D/g, "");
      if (pageState.newConvoText.trim()) {
        await waSendMessage(phone, pageState.newConvoText.trim());
      }
      const result = await upsertConversation({
        externalContactId: phone,
        title: null,
        unreadCount: 0,
        labels: [],
      });
      if (result) {
        pageState.setSelectedId(result.id);
      }
      pageState.setShowNewConvoDialog(false);
      pageState.setNewConvoPhone("");
      pageState.setNewConvoText("");
      toast({ title: "Conversa iniciada!" });
      refetchConvos();
    } catch (err: any) {
      toast({ title: "Erro ao iniciar conversa", description: err?.message, variant: "destructive" });
    } finally {
      pageState.setStartingNewConvo(false);
    }
  }, [pageState.newConvoPhone, pageState.newConvoText, waConnected, waSendMessage, upsertConversation, refetchConvos]);

  const openConvo = useCallback((id: string) => {
    pageState.setSelectedId(id);
    pageState.setAiSummary(null);
    pageState.setShowChatSearch(false);
    pageState.setChatSearchQuery("");
    pageState.setPendingMedia(null);

    // Late inbox — mark as read via API
    if (id.startsWith("late_")) {
      const lateConvo = lateInbox.conversations.find(c => c.id === id);
      if (lateConvo?.accountId && lateConvo.unread > 0) {
        lateInbox.markAsReadLocally(id);
        lateActions.updateConversationStatus(id, lateConvo.accountId, "read").catch(() => {});
      }
      return;
    }

    const convo = waConversations.find(c => c.id === id);
    const isRealWa = convo && convo.unreadCount > 0;
    if (isRealWa) {
      markAsRead(id);
      const wsId = convo?.workspaceId || waWorkspaceId;
      callWhatsappProxy("POST", "/mark-read", { conversationId: id }, wsId)
        .catch(e => console.error("[mark-read] Error:", e));
    }
  }, [waConversations, markAsRead, lateInbox.conversations, lateActions]);

  const handleBack = useCallback(() => pageState.setSelectedId(null), []);
  const handleUpdateLabels = useCallback(async (convoId: string, labels: string[]) => { await updateLabels(convoId, labels); }, [updateLabels]);

  const totalUnread = useMemo(() => {
    return conversations.filter(c => !c.archived && !c.muted).reduce((sum, c) => sum + c.unread, 0);
  }, [conversations]);

  const forwardConversations = useMemo(() => {
    return conversations.filter(c => !c.archived).map(c => ({
      id: c.id,
      name: c.name,
      channelId: c.channelId,
      avatar: c.avatar,
    }));
  }, [conversations]);

  const showList = isMobile ? !pageState.selectedId : true;
  const showChat = isMobile ? !!pageState.selectedId : true;

  // ── JSX ─────────────────────────────────────────────────────────────────────

  return (
    <PageLayout maxWidth="full">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-overlay-muted hover:text-overlay transition-colors touch-target">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <HeaderActions />
        </div>
        <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-sans font-semibold text-overlay">Mensagens</h1>
            {(() => {
              return totalUnread > 0 ? (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              ) : null;
            })()}
          </div>
          <div className="flex items-center gap-2">
            <ConnectionBadge isConnected={isConnected} isLoading={isLoading} size="lg" />
            <button
              onClick={() => refetchConvos()}
              className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-overlay-subtle backdrop-blur-sm text-overlay-muted hover:text-overlay transition-colors"
              title="Atualizar conversas"
            >
              <RefreshCw className={`h-4 w-4${waConvosLoading ? " animate-spin" : ""}`} />
            </button>
            {anyWaConnected && (
              <button
                onClick={async () => {
                  if (pageState.syncingHistory) return;
                  pageState.setSyncingHistory(true);
                  toast({ title: "Sincronizando histórico...", description: "Buscando conversas e mensagens antigas." });
                  try {
                    const result = await callWhatsappProxy("POST", "/sync-history", undefined, selectedConvoWsId || waWorkspaceId, 55_000);
                    toast({ title: "Histórico sincronizado!", description: `${(result as any).chatsSynced ?? 0} conversas e ${(result as any).messagesSynced ?? 0} mensagens importadas.` });
                    refetchConvos();
                  } catch (e: any) {
                    toast({ title: "Erro ao sincronizar", description: e.message, variant: "destructive" });
                  } finally {
                    pageState.setSyncingHistory(false);
                  }
                }}
                disabled={pageState.syncingHistory}
                className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-overlay-subtle backdrop-blur-sm text-overlay-muted hover:text-overlay transition-colors disabled:opacity-50"
                title="Sincronizar histórico antigo"
              >
                <Download className={`h-4 w-4${pageState.syncingHistory ? " animate-bounce" : ""}`} />
              </button>
            )}
            {anyWaConnected && (
              <button
                onClick={() => pageState.setShowNewConvoDialog(true)}
                className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-overlay-subtle backdrop-blur-sm text-overlay-muted hover:text-overlay transition-colors"
                title="Nova conversa"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
          {waLoading ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-overlay-subtle backdrop-blur-sm text-overlay-muted text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-pulse" />
              WhatsApp
            </span>
          ) : waConnected ? (
            <a href="/settings/whatsapp" onClick={(e) => { e.preventDefault(); navigate("/settings/whatsapp"); }} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/20 backdrop-blur-sm text-green-300 text-xs border border-green-400/20 hover:bg-green-500/30 transition-colors cursor-pointer">
              <Wifi className="w-3 h-3" />
              WhatsApp conectado
            </a>
          ) : (
            <button
              onClick={async () => {
                if (waSession.status === "connecting" || waSession.status === "RECONNECTING") return;
                try {
                  await waCreateSession();
                  await new Promise(r => setTimeout(r, 2500));
                  const currentStatus = waSessionRef.current?.status;
                  if (currentStatus === "QR_PENDING" || currentStatus === "ERROR") {
                    navigate("/settings/whatsapp");
                  }
                } catch {
                  navigate("/settings/whatsapp");
                }
              }}
              disabled={waSession.status === "connecting" || waSession.status === "RECONNECTING"}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-overlay-subtle backdrop-blur-sm text-overlay-muted hover:text-overlay text-xs border-overlay-subtle transition-all group"
              title="Reconectar WhatsApp"
            >
              {waSession.status === "connecting" || waSession.status === "RECONNECTING" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <WifiOff className="w-3 h-3" />
              )}
              {waSession.status === "connecting" || waSession.status === "RECONNECTING" ? "Reconectando..." : "WhatsApp desconectado"}
              <Settings className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </div>
      </motion.div>

      <WhatsAppDisconnectedBanner />

      {/* Workspace filter tabs */}
      {isViewAll && workspaces.length > 1 && (
        <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
          <button
            onClick={() => setWsFilter("all")}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              wsFilter === "all"
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-foreground/5 text-muted-foreground hover:text-foreground hover:bg-foreground/10"
            }`}
          >
            <Globe className="w-3 h-3" />
            Todos
            <span className="text-[10px] opacity-70">({allConversations.length})</span>
          </button>
          {workspaces.map(ws => {
            const wsConvoCount = allConversations.filter(c => c.workspaceId === ws.id).length;
            const wsConnected = multiWa.isWorkspaceConnected(ws.id);
            if (wsConvoCount === 0 && !wsConnected) return null;
            return (
              <button
                key={ws.id}
                onClick={() => setWsFilter(ws.id)}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  wsFilter === ws.id
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "bg-foreground/5 text-muted-foreground hover:text-foreground hover:bg-foreground/10"
                }`}
              >
                <span>{ws.icon}</span>
                {ws.name}
                <span className="text-[10px] opacity-70">({wsConvoCount})</span>
                <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? "bg-green-500" : "bg-muted-foreground/30"}`} />
              </button>
            );
          })}
        </div>
      )}

      <AnimatedItem index={0}>
        <GlassCard className="h-[calc(100vh-160px)] lg:h-[calc(100vh-140px)] xl:h-[calc(100vh-120px)] min-h-[500px] p-0 overflow-hidden">
          {isMobile ? (
            <div className="h-full">
              {showList && (
                <ConversationListComponent
                  conversations={conversations}
                  selectedId={pageState.selectedId}
                  searchQuery={pageState.searchQuery}
                  setSearchQuery={pageState.setSearchQuery}
                  platformFilter={pageState.platformFilter}
                  setPlatformFilter={pageState.setPlatformFilter}
                  showArchived={pageState.showArchived}
                  setShowArchived={pageState.setShowArchived}
                  availablePlatforms={availablePlatforms}
                   isLoading={waConvosLoading || isLoading || lateInbox.isLoading}
                  onSelectConvo={openConvo}
                  showContextMenu={pageState.showContextMenu}
                  setShowContextMenu={pageState.setShowContextMenu}
                  togglePin={togglePin}
                  toggleMute={toggleMute}
                  toggleArchive={toggleArchive}
                  toggleReadStatus={handleToggleReadStatus}
                  onDeleteConvo={handleDeleteConvo}
                  isUnsavedWhatsappContact={isUnsavedWhatsappContact}
                  openSaveContactDialog={openSaveContactDialog}
                  typingConvos={pageState.typingConvos}
                  bulkMode={pageState.bulkMode}
                  selectedConvoIds={pageState.selectedConvoIds}
                  onToggleSelect={pageState.toggleSelectConvo}
                  onEnterBulkMode={pageState.enterBulkMode}
                  onBulkMarkRead={bulkMarkRead}
                  hasDraft={drafts.hasDraft}
                />
              )}
               {showChat && (
                <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
                <ChatViewComponent
                  selectedConvo={selectedConvo || null}
                  messages={messages}
                  isMobile={isMobile}
                  onBack={handleBack}
                  typingConvos={pageState.typingConvos}
                   waConnected={effectiveWaConnected}
                  aiLoading={pageState.aiLoading}
                  aiSummary={pageState.aiSummary}
                  setAiSummary={pageState.setAiSummary}
                  handleAiAction={handleAiAction}
                  newMessage={pageState.newMessage}
                  setNewMessage={pageState.setNewMessage}
                  handleSend={handleSend}
                  isSending={isSending}
                  sendingMedia={pageState.sendingMedia}
                  pendingMedia={pageState.pendingMedia}
                  setPendingMedia={pageState.setPendingMedia}
                  fileInputRef={pageState.fileInputRef}
                  handleFileSelect={pageState.handleFileSelect}
                  isUnsavedWhatsappContact={isUnsavedWhatsappContact}
                  openSaveContactDialog={openSaveContactDialog}
                  waDownloadMedia={waDownloadMedia}
                   waMsgsLoading={waMsgsLoading || lateMessages.isLoading}
                   isRealWaConvo={isCurrentRealWaConvo || isCurrentLateConvo}
                  showChatSearch={pageState.showChatSearch}
                  setShowChatSearch={pageState.setShowChatSearch}
                  chatSearchQuery={pageState.chatSearchQuery}
                  setChatSearchQuery={pageState.setChatSearchQuery}
                  filteredChatMessages={filteredChatMessages}
                  hasMore={hasMore}
                  onLoadMore={loadMore}
                  onReactToMessage={msgActions.handleReactToMessage}
                  onStarMessage={msgActions.handleStarMessage}
                  onDeleteMessageForMe={msgActions.handleDeleteMessageForMe}
                  onDeleteMessageForAll={msgActions.handleDeleteMessageForAll}
                  onForwardMessage={msgActions.handleForwardMessage}
                  presenceStatus={presence.status}
                  formattedLastSeen={formattedLastSeen}
                  sendTypingPresence={sendTypingPresence}
                   onSendAudio={handleSendAudio}
                   onUpdateLabels={handleUpdateLabels}
                />
                </Suspense>
              )}
            </div>
          ) : (
            <ResizablePanelGroup direction="horizontal">
              <ResizablePanel defaultSize={35} minSize={25} maxSize={45}>
                <ConversationListComponent
                  conversations={conversations}
                  selectedId={pageState.selectedId}
                  searchQuery={pageState.searchQuery}
                  setSearchQuery={pageState.setSearchQuery}
                  platformFilter={pageState.platformFilter}
                  setPlatformFilter={pageState.setPlatformFilter}
                  showArchived={pageState.showArchived}
                  setShowArchived={pageState.setShowArchived}
                  availablePlatforms={availablePlatforms}
                  isLoading={waConvosLoading || isLoading || lateInbox.isLoading}
                  onSelectConvo={openConvo}
                  showContextMenu={pageState.showContextMenu}
                  setShowContextMenu={pageState.setShowContextMenu}
                  togglePin={togglePin}
                  toggleMute={toggleMute}
                  toggleArchive={toggleArchive}
                  toggleReadStatus={handleToggleReadStatus}
                  onDeleteConvo={handleDeleteConvo}
                  isUnsavedWhatsappContact={isUnsavedWhatsappContact}
                  openSaveContactDialog={openSaveContactDialog}
                  typingConvos={pageState.typingConvos}
                  bulkMode={pageState.bulkMode}
                  selectedConvoIds={pageState.selectedConvoIds}
                  onToggleSelect={pageState.toggleSelectConvo}
                  onEnterBulkMode={pageState.enterBulkMode}
                  onBulkMarkRead={bulkMarkRead}
                  hasDraft={drafts.hasDraft}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={65} minSize={40}>
                <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
                <ChatViewComponent
                  selectedConvo={selectedConvo || null}
                  messages={messages}
                  isMobile={isMobile}
                  onBack={handleBack}
                  typingConvos={pageState.typingConvos}
                  waConnected={effectiveWaConnected}
                  aiLoading={pageState.aiLoading}
                  aiSummary={pageState.aiSummary}
                  setAiSummary={pageState.setAiSummary}
                  handleAiAction={handleAiAction}
                  newMessage={pageState.newMessage}
                  setNewMessage={pageState.setNewMessage}
                  handleSend={handleSend}
                  isSending={isSending}
                  sendingMedia={pageState.sendingMedia}
                  pendingMedia={pageState.pendingMedia}
                  setPendingMedia={pageState.setPendingMedia}
                  fileInputRef={pageState.fileInputRef}
                  handleFileSelect={pageState.handleFileSelect}
                  isUnsavedWhatsappContact={isUnsavedWhatsappContact}
                  openSaveContactDialog={openSaveContactDialog}
                  waDownloadMedia={waDownloadMedia}
                   waMsgsLoading={waMsgsLoading || lateMessages.isLoading}
                   isRealWaConvo={isCurrentRealWaConvo || isCurrentLateConvo}
                  showChatSearch={pageState.showChatSearch}
                  setShowChatSearch={pageState.setShowChatSearch}
                  chatSearchQuery={pageState.chatSearchQuery}
                  setChatSearchQuery={pageState.setChatSearchQuery}
                  filteredChatMessages={filteredChatMessages}
                  hasMore={hasMore}
                  onLoadMore={loadMore}
                  onReactToMessage={msgActions.handleReactToMessage}
                  onStarMessage={msgActions.handleStarMessage}
                  onDeleteMessageForMe={msgActions.handleDeleteMessageForMe}
                  onDeleteMessageForAll={msgActions.handleDeleteMessageForAll}
                  onForwardMessage={msgActions.handleForwardMessage}
                  presenceStatus={presence.status}
                  formattedLastSeen={formattedLastSeen}
                  sendTypingPresence={sendTypingPresence}
                   onSendAudio={handleSendAudio}
                   onUpdateLabels={handleUpdateLabels}
                />
                </Suspense>
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
        </GlassCard>
      </AnimatedItem>

      {/* Save as contact dialog */}
      <Dialog open={pageState.showSaveContact} onOpenChange={pageState.setShowSaveContact}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Salvar como contato</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Telefone</label>
              <Input value={formatPhoneDisplay(pageState.saveContactPhone)} readOnly className="bg-muted/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nome</label>
              <Input
                value={pageState.saveContactName}
                onChange={e => pageState.setSaveContactName(e.target.value)}
                placeholder="Nome do contato"
                autoFocus
                onKeyDown={e => e.key === "Enter" && handleSaveAsContact()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => pageState.setShowSaveContact(false)}>Cancelar</Button>
            <Button onClick={handleSaveAsContact} disabled={!pageState.saveContactName.trim() || pageState.savingContact}>
              {pageState.savingContact ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <UserPlus className="w-4 h-4 mr-1" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New conversation dialog */}
      <Dialog open={pageState.showNewConvoDialog} onOpenChange={pageState.setShowNewConvoDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" />
              Nova conversa WhatsApp
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Número (com DDD e código do país)</label>
              <Input
                value={pageState.newConvoPhone}
                onChange={e => pageState.setNewConvoPhone(e.target.value)}
                placeholder="5511999999999"
                autoFocus
              />
              <p className="text-[10px] text-muted-foreground mt-1">Ex: 5511999999999 (Brasil)</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Mensagem inicial (opcional)</label>
              <Input
                value={pageState.newConvoText}
                onChange={e => pageState.setNewConvoText(e.target.value)}
                placeholder="Olá!"
                onKeyDown={e => e.key === "Enter" && handleStartNewConvo()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => pageState.setShowNewConvoDialog(false)}>Cancelar</Button>
            <Button onClick={handleStartNewConvo} disabled={!pageState.newConvoPhone.trim() || pageState.startingNewConvo}>
              {pageState.startingNewConvo ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
              Iniciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Forward message dialog */}
      <ForwardMessageDialog
        open={!!msgActions.forwardDialog}
        onOpenChange={(open) => { if (!open) msgActions.setForwardDialog(null); }}
        conversations={forwardConversations}
        onForward={msgActions.executeForward}
        messagePreview={msgActions.forwardDialog?.text || ""}
      />
    </PageLayout>
  );
};

export default MessagesPage;

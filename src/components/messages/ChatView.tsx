/**
 * ChatView — Memoized main chat interface component.
 * Extracted from MessagesPage.tsx for maintainability.
 */
import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageSquare, Search, Send, Loader2, BellOff, Sparkles, X, ChevronLeft,
  Check, CheckCheck, Mic, Video, FileText, Image, Download, Paperclip,
  UserPlus, ChevronUp, Languages, PenLine, Wand2, Info, Star, Pin, ArrowDown,
  AlertTriangle, Plug
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import DeshTooltip from "@/components/ui/DeshTooltip";
import { toast } from "@/hooks/use-toast";
import { EmojiPicker, ReactionPicker } from "@/components/messages/EmojiPicker";
import { ReactionBadge } from "@/components/messages/ReactionBadge";
import { QuotedMessagePreview } from "@/components/messages/QuotedMessagePreview";
import { MessageDropdownMenu } from "@/components/messages/MessageContextMenu";
import { AudioRecorder } from "@/components/messages/AudioRecorder";
import { LocationMessage } from "@/components/messages/LocationMessage";
import { ContactCardMessage } from "@/components/messages/ContactCardMessage";
import { StickerMessage } from "@/components/messages/StickerMessage";
import { LinkPreview, extractUrls } from "@/components/messages/LinkPreview";
import { ContactInfoPanel } from "@/components/messages/ContactInfoPanel";
import { MediaLightbox } from "@/components/messages/MediaLightbox";
import { downloadWhatsAppMedia } from "@/lib/mediaDownloadUtils";
import { QuickReplyPicker } from "@/components/messages/QuickReplyPicker";
import { LabelPicker } from "@/components/messages/ConversationLabels";
import { TypingIndicator } from "@/components/messages/TypingIndicator";
import { MessageInputMetrics } from "@/components/messages/MessageInputMetrics";
import { ChatSearchBar, highlightText } from "@/components/messages/ChatSearchBar";
import { PinnedMessagesBar } from "@/components/messages/PinnedMessagesBar";
import type { ChatMessage, Conversation } from "@/lib/messageUtils";
import { detectSpecialType, insertDateSeparators, platformLabels, platformColors } from "@/lib/messageUtils";
import { isMissingLateAccountId } from "@/hooks/messages/lateInboxHelpers";

export interface ChatViewProps {
  selectedConvo: Conversation | null;
  messages: ChatMessage[];
  isMobile: boolean;
  onBack: () => void;
  typingConvos: Set<string>;
  waConnected: boolean;
  aiLoading: "summarize" | "suggest" | "translate" | "improve" | null;
  aiSummary: string | null;
  setAiSummary: (v: string | null) => void;
  handleAiAction: (action: "summarize" | "suggest_reply" | "translate" | "improve", messageText?: string) => void;
  newMessage: string;
  setNewMessage: (v: string) => void;
  handleSend: (quotedMessageId?: string) => void;
  isSending: boolean;
  sendingMedia: boolean;
  pendingMedia: { file: File; base64: string; mediatype: string } | null;
  setPendingMedia: (v: any) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isUnsavedWhatsappContact: (c: Conversation) => boolean;
  openSaveContactDialog: (c: Conversation) => void;
  waDownloadMedia: (id: string) => Promise<any>;
  waMsgsLoading: boolean;
  isRealWaConvo: boolean;
  showChatSearch: boolean;
  setShowChatSearch: (v: boolean) => void;
  chatSearchQuery: string;
  setChatSearchQuery: (v: string) => void;
  filteredChatMessages: ChatMessage[];
  hasMore: boolean;
  onLoadMore: () => void;
  onReactToMessage: (messageId: string, emoji: string) => void;
  onStarMessage: (messageId: string) => void;
  onDeleteMessageForMe: (messageId: string) => void;
  onDeleteMessageForAll: (messageId: string) => void;
  onForwardMessage: (messageId: string, text: string) => void;
  presenceStatus: string;
  formattedLastSeen: string | null;
  sendTypingPresence: () => void;
  onSendAudio: (base64: string, mimetype: string) => void;
  onUpdateLabels?: (convoId: string, labels: string[]) => void;
}

export const ChatViewComponent = memo(function ChatViewComponent({
  selectedConvo, messages, isMobile, onBack, typingConvos,
  waConnected, aiLoading, aiSummary, setAiSummary, handleAiAction,
  newMessage, setNewMessage, handleSend, isSending, sendingMedia,
  pendingMedia, setPendingMedia, fileInputRef, handleFileSelect,
  isUnsavedWhatsappContact, openSaveContactDialog, waDownloadMedia,
  waMsgsLoading, isRealWaConvo, showChatSearch, setShowChatSearch,
  // isLateConvo is derived from selectedConvo
  chatSearchQuery, setChatSearchQuery, filteredChatMessages,
  hasMore, onLoadMore,
  onReactToMessage, onStarMessage, onDeleteMessageForMe, onDeleteMessageForAll, onForwardMessage,
  presenceStatus, formattedLastSeen, sendTypingPresence, onSendAudio, onUpdateLabels,
}: ChatViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevMsgCountRef = useRef(0);
  const navigate = useNavigate();

  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; type: "image" | "video"; fileName?: string; onDownload?: () => void } | null>(null);
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // Derive if current conversation is a Late (social) conversation
  const isLateConvo = selectedConvo?.isLateInbox ?? false;
  // Shared detection: keeps banners/blocks consistent across screens
  const lateAccountMissing = isMissingLateAccountId(selectedConvo);
  // For input area: allow sending if WA connected OR if it's a Late conversation
  const canSend = waConnected || isLateConvo;

  // Compute search matches
  const searchMatches = useMemo(() => {
    if (!chatSearchQuery || chatSearchQuery.length < 2) return [];
    const q = chatSearchQuery.toLowerCase();
    return messages.filter(m => m.text?.toLowerCase().includes(q));
  }, [messages, chatSearchQuery]);

  // Pinned messages
  const pinnedMessages = useMemo(() => messages.filter(m => m.starred), [messages]);

  // Navigate search results
  const scrollToMessage = useCallback((msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMsgId(msgId);
      setTimeout(() => setHighlightedMsgId(null), 2000);
    }
  }, []);

  const handleSearchNext = useCallback(() => {
    if (searchMatches.length === 0) return;
    const next = (searchMatchIndex + 1) % searchMatches.length;
    setSearchMatchIndex(next);
    scrollToMessage(searchMatches[next].id);
  }, [searchMatchIndex, searchMatches, scrollToMessage]);

  const handleSearchPrev = useCallback(() => {
    if (searchMatches.length === 0) return;
    const prev = (searchMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setSearchMatchIndex(prev);
    scrollToMessage(searchMatches[prev].id);
  }, [searchMatchIndex, searchMatches, scrollToMessage]);

  // Reset on conversation change
  useEffect(() => {
    setReplyingTo(null);
    setContextMenuId(null);
    setShowReactionPicker(null);
    setShowContactInfo(false);
  }, [selectedConvo?.id]);

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    isAtBottomRef.current = atBottom;
    setShowScrollToBottom(!atBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Ctrl+F keyboard shortcut for chat search
  useEffect(() => {
    if (!selectedConvo) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setShowChatSearch(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedConvo, setShowChatSearch]);

  // Auto-scroll on open
  useEffect(() => {
    if (!selectedConvo) return;
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      isAtBottomRef.current = true;
    }, 50);
    prevMsgCountRef.current = messages.length;
    return () => clearTimeout(timer);
  }, [selectedConvo?.id]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current && isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length]);

  // Reset search match index when query changes
  useEffect(() => {
    setSearchMatchIndex(0);
    if (searchMatches.length > 0) {
      scrollToMessage(searchMatches[0].id);
    }
  }, [chatSearchQuery]);

  if (!selectedConvo) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Selecione uma conversa</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Chat header */}
      <div className="p-3 border-b border-foreground/5 flex items-center gap-3">
        {isMobile && (
          <button onClick={onBack} className="p-1 -ml-1 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={() => setShowContactInfo(!showContactInfo)}
          className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center text-base overflow-hidden flex-shrink-0">
            {selectedConvo.avatar.startsWith("http") ? (
              <img src={selectedConvo.avatar} alt={selectedConvo.name} className="w-full h-full object-cover" loading="lazy" onError={(e) => { const img = e.target as HTMLImageElement; img.style.display = 'none'; if (img.parentElement) img.parentElement.textContent = selectedConvo.name[0] || '📱'; }} />
            ) : selectedConvo.avatar}
          </div>
          <div className="min-w-0">
             <div className="flex items-center gap-1">
               <p className="text-sm font-medium text-foreground truncate">{selectedConvo.name}</p>
               {selectedConvo.muted && <BellOff className="w-3 h-3 text-muted-foreground" />}
             </div>
             <p className="text-[10px] text-muted-foreground flex items-center gap-1">
               {isLateConvo && (
                 <span className={`inline-block w-2 h-2 rounded-full ${platformColors[selectedConvo.platform] || "bg-muted"}`} />
               )}
               {presenceStatus === "typing" ? (
                 <span className="text-primary italic">digitando...</span>
               ) : presenceStatus === "online" ? (
                 <span className="text-green-400">online</span>
               ) : isLateConvo ? (
                 <span>
                   {platformLabels[selectedConvo.platform] || selectedConvo.platform}
                   {selectedConvo.accountUsername && <span className="opacity-60"> · @{selectedConvo.accountUsername}</span>}
                 </span>
               ) : (
                 <span>{formattedLastSeen || (platformLabels[selectedConvo.platform] || selectedConvo.platform)}</span>
               )}
             </p>
          </div>
        </button>
        <div className="flex items-center gap-1">
          {isUnsavedWhatsappContact(selectedConvo) && (
            <DeshTooltip label="Salvar como contato">
              <button onClick={() => openSaveContactDialog(selectedConvo)} className="p-1.5 rounded-lg hover:bg-foreground/5 text-muted-foreground hover:text-primary transition-colors">
                <UserPlus className="w-4 h-4" />
              </button>
            </DeshTooltip>
          )}
          {onUpdateLabels && selectedConvo && (
            <LabelPicker
              currentLabels={(selectedConvo as any).labels || []}
              onUpdate={(labels) => onUpdateLabels(selectedConvo.id, labels)}
            />
          )}
          <DeshTooltip label="Info do contato">
            <button onClick={() => setShowContactInfo(!showContactInfo)} className={`p-1.5 rounded-lg hover:bg-foreground/5 transition-colors ${showContactInfo ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <Info className="w-4 h-4" />
            </button>
          </DeshTooltip>
          <DeshTooltip label="Resumir conversa com IA">
            <button onClick={() => handleAiAction("summarize")} disabled={aiLoading !== null} className="p-1.5 rounded-lg hover:bg-foreground/5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50">
              {aiLoading === "summarize" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            </button>
          </DeshTooltip>
          <DeshTooltip label="Buscar na conversa">
            <button onClick={() => { setShowChatSearch(!showChatSearch); setChatSearchQuery(""); }} className={`p-1.5 rounded-lg hover:bg-foreground/5 transition-colors ${showChatSearch ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <Search className="w-4 h-4" />
            </button>
          </DeshTooltip>
        </div>
      </div>

      {/* Chat search bar */}
      <AnimatePresence>
        {showChatSearch && (
          <ChatSearchBar
            query={chatSearchQuery}
            onQueryChange={setChatSearchQuery}
            totalMatches={searchMatches.length}
            currentMatchIndex={searchMatchIndex}
            onNext={handleSearchNext}
            onPrev={handleSearchPrev}
            onClose={() => { setShowChatSearch(false); setChatSearchQuery(""); }}
          />
        )}
      </AnimatePresence>

      {/* Pinned messages */}
      <PinnedMessagesBar
        pinnedMessages={pinnedMessages}
        onScrollToMessage={scrollToMessage}
        onUnpin={(id) => onStarMessage(id)}
      />

      {/* AI Summary */}
      <AnimatePresence>
        {aiSummary && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 bg-primary/5 border-b border-primary/10">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] uppercase tracking-wider text-primary font-medium">Resumo IA</span>
                <button onClick={() => setAiSummary(null)} className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="text-xs text-foreground/80 prose prose-sm max-w-none [&_p]:mb-1 [&_strong]:text-foreground">
                <ReactMarkdown>{aiSummary}</ReactMarkdown>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-3">
        {hasMore && isRealWaConvo && (
          <div className="flex justify-center pb-2">
            <button
              onClick={() => {
                const el = messagesContainerRef.current;
                const prevScrollHeight = el?.scrollHeight ?? 0;
                onLoadMore();
                setTimeout(() => {
                  requestAnimationFrame(() => {
                    if (el) el.scrollTop = el.scrollHeight - prevScrollHeight;
                  });
                });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/5 hover:bg-foreground/10 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              Carregar mais antigas
            </button>
          </div>
        )}
        {waMsgsLoading && isRealWaConvo && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {(() => {
          const displayMessages = chatSearchQuery ? filteredChatMessages : messages;
          const withSeparators = insertDateSeparators(displayMessages);
          return withSeparators.map((item, idx) => {
            if ("type" in item && item.type === "separator") {
              return (
                <div key={item.id} className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-foreground/10" />
                  <span className="text-[10px] text-muted-foreground font-medium px-2">{item.label}</span>
                  <div className="flex-1 h-px bg-foreground/10" />
                </div>
              );
            }
            const msg = item as ChatMessage;
            const specialType = detectSpecialType(msg.contentRaw);
            const urls = (!msg.mediaType && msg.text && !msg.deletedForEveryone) ? extractUrls(msg.text) : [];
            const isActiveSearchMatch = chatSearchQuery && searchMatches.length > 0 && searchMatches[searchMatchIndex]?.id === msg.id;
            const isSearchMatch = chatSearchQuery && chatSearchQuery.length >= 2 && msg.text?.toLowerCase().includes(chatSearchQuery.toLowerCase());

            // Message grouping: check if previous message is from same sender
            const prevItem = idx > 0 ? withSeparators[idx - 1] : null;
            const isSameSenderAsPrev = prevItem && !("type" in prevItem) && (prevItem as ChatMessage).isMe === msg.isMe && (prevItem as ChatMessage).sender === msg.sender;
            const isGrouped = !!isSameSenderAsPrev;

            return (
              <div key={msg.id} id={`msg-${msg.id}`} className={`flex ${msg.isMe ? "justify-end" : "justify-start"} ${isGrouped ? "mt-0.5" : "mt-2"} transition-colors duration-500 ${highlightedMsgId === msg.id ? "bg-primary/10 rounded-lg" : ""}`}>
                <div className="relative group/msg max-w-[75%] min-w-[80px]">
                  {/* Hover action bar */}
                  <div className={`absolute -top-2 ${msg.isMe ? "left-0" : "right-0"} opacity-0 group-hover/msg:opacity-100 transition-opacity z-20 flex items-center gap-0.5`}>
                    <MessageDropdownMenu
                      messageId={msg.id}
                      isMe={msg.isMe}
                      isStarred={msg.starred}
                      open={contextMenuId === msg.id}
                      onOpenChange={(open) => setContextMenuId(open ? msg.id : null)}
                      onReply={() => { setReplyingTo(msg); setContextMenuId(null); }}
                      onForward={() => { onForwardMessage(msg.id, msg.text); setContextMenuId(null); }}
                      onReact={() => { setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id); setContextMenuId(null); }}
                      onStar={() => { onStarMessage(msg.id); setContextMenuId(null); }}
                      onDeleteForMe={() => { onDeleteMessageForMe(msg.id); setContextMenuId(null); }}
                      onDeleteForAll={() => { onDeleteMessageForAll(msg.id); setContextMenuId(null); }}
                      onCopy={() => { navigator.clipboard.writeText(msg.text); toast({ title: "Copiado!" }); setContextMenuId(null); }}
                    />
                  </div>

                  {/* Reaction picker */}
                  <AnimatePresence>
                    {showReactionPicker === msg.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 5 }}
                        className={`absolute -top-10 ${msg.isMe ? "right-0" : "left-0"} z-30`}
                      >
                        <ReactionPicker onSelect={(emoji) => { onReactToMessage(msg.id, emoji); setShowReactionPicker(null); }} />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Message bubble */}
                  <div className={`relative px-2.5 py-1.5 text-[13px] leading-[19px] shadow-sm ${
                    msg.isMe
                      ? msg.status === "failed"
                        ? "bg-destructive/80 text-destructive-foreground rounded-lg rounded-tr-[3px]"
                        : "bg-primary text-primary-foreground rounded-lg rounded-tr-[3px]"
                      : "bg-[hsl(220_10%_25%)] text-white border border-white/10 rounded-lg rounded-tl-[3px]"
                  } ${msg.status === "sending" ? "opacity-70" : ""}`}>
                    {!msg.isMe && !isGrouped && <p className="text-[11px] font-semibold text-primary mb-0.5">{msg.sender}</p>}

                    {msg.quotedText && (
                      <QuotedMessagePreview
                        senderName={msg.quotedSender || ""}
                        text={msg.quotedText}
                        compact
                      />
                    )}

                    {msg.starred && (
                      <Pin className="w-3 h-3 text-primary inline mr-1 rotate-45" />
                    )}

                    {msg.deletedForEveryone ? (
                      <p className="italic opacity-50">🚫 Mensagem apagada</p>
                    ) : specialType === "location" ? (
                      (() => { const loc = (msg.contentRaw as any)?.message?.locationMessage || (msg.contentRaw as any)?.message?.liveLocationMessage; return <LocationMessage latitude={loc?.degreesLatitude ?? 0} longitude={loc?.degreesLongitude ?? 0} name={loc?.name} />; })()
                    ) : specialType === "contact" ? (
                      (() => { const ct = (msg.contentRaw as any)?.message?.contactMessage; return <ContactCardMessage displayName={ct?.displayName || "Contato"} phoneNumber={ct?.vcard?.match?.(/TEL[^:]*:([^\n]+)/)?.[1]} />; })()
                    ) : specialType === "sticker" ? (
                      <StickerMessage thumbnail={(msg.contentRaw as any)?.message?.stickerMessage?.jpegThumbnail ? `data:image/jpeg;base64,${(msg.contentRaw as any)?.message?.stickerMessage?.jpegThumbnail}` : undefined} />
                    ) : msg.mediaType === "image" && msg.mediaThumbnail ? (
                      <div className="mb-1 relative group/media -mx-1 -mt-0.5">
                        <img
                          src={msg.mediaThumbnail}
                          alt="Imagem"
                          loading="lazy"
                          className="rounded-lg max-w-[280px] w-full object-cover cursor-pointer hover:brightness-90 transition-all"
                          onClick={() => setLightbox({
                            src: msg.mediaThumbnail!,
                            type: "image",
                            onDownload: waConnected ? async () => {
                              const dl = await downloadWhatsAppMedia(msg.id, waDownloadMedia, { defaultMimetype: "image/jpeg", label: "Imagem" });
                              if (dl) setLightbox(prev => prev ? { ...prev, src: `data:${dl.mimetype};base64,${dl.base64}` } : null);
                            } : undefined,
                          })}
                        />
                        {(waConnected || (isLateConvo && msg.mediaThumbnail?.startsWith("http"))) && (
                          <button
                            onClick={() => {
                              if (isLateConvo && msg.mediaThumbnail?.startsWith("http")) {
                                window.open(msg.mediaThumbnail, "_blank");
                              } else {
                                downloadWhatsAppMedia(msg.id, waDownloadMedia, { defaultMimetype: "image/jpeg", label: "Imagem" });
                              }
                            }}
                            className="absolute bottom-2 right-2 p-1.5 rounded-full bg-background/80 backdrop-blur-sm text-foreground opacity-0 group-hover/media:opacity-100 transition-opacity"
                            title="Baixar imagem original"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {msg.text && !msg.text.startsWith("📷") && <p className="mt-1 mx-1">{msg.text}</p>}
                      </div>
                    ) : msg.mediaType === "audio" ? (
                      <div className="flex items-center gap-2.5 py-1 min-w-[200px]">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.isMe ? "bg-primary-foreground/20" : "bg-primary/10"}`}>
                          <Mic className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className={`h-1 rounded-full ${msg.isMe ? "bg-primary-foreground/30" : "bg-foreground/15"}`}>
                            <div className={`h-full rounded-full w-0 ${msg.isMe ? "bg-primary-foreground/60" : "bg-primary/60"}`} />
                          </div>
                          <span className="text-[10px] opacity-60 mt-0.5 block">Áudio</span>
                        </div>
                      </div>
                    ) : msg.mediaType === "video" ? (
                      <div className="mb-1 relative group/media -mx-1 -mt-0.5">
                        {isLateConvo && msg.mediaThumbnail?.startsWith("http") ? (
                          <video
                            src={msg.mediaThumbnail}
                            controls
                            preload="metadata"
                            className="rounded-lg max-w-[280px] w-full cursor-pointer"
                          />
                        ) : msg.mediaThumbnail ? (
                          <div className="relative cursor-pointer" onClick={() => setLightbox({ src: msg.mediaThumbnail!, type: "video" })}>
                            <img src={msg.mediaThumbnail} alt="Vídeo" className="rounded-lg max-w-[280px] w-full object-cover hover:brightness-90 transition-all" loading="lazy" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center">
                                <Video className="w-5 h-5 text-foreground" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5 py-1 min-w-[180px]">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${msg.isMe ? "bg-primary-foreground/15" : "bg-foreground/10"}`}>
                              <Video className="w-5 h-5 opacity-70" />
                            </div>
                            <div className="flex-1">
                              <span className="text-xs font-medium">Vídeo</span>
                              <span className="text-[10px] opacity-60 block">{msg.mediaMimetype?.split("/")[1]?.toUpperCase() || "MP4"}</span>
                            </div>
                          </div>
                        )}
                        {msg.text && !msg.text.startsWith("🎥") && <p className="mt-1 mx-1">{msg.text}</p>}
                      </div>
                    ) : msg.mediaType === "document" ? (
                      <div className={`flex items-center gap-2.5 py-1.5 px-2 -mx-1 rounded-lg min-w-[200px] ${msg.isMe ? "bg-primary-foreground/10" : "bg-foreground/5"}`}>
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${msg.isMe ? "bg-primary-foreground/20" : "bg-primary/10"}`}>
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{msg.mediaFileName || "Documento"}</p>
                          <span className="text-[10px] opacity-60">{msg.mediaMimetype?.split("/")[1]?.toUpperCase() || "PDF"}</span>
                        </div>
                        {(waConnected || isLateConvo) && (
                          <button
                            onClick={() => {
                              if (isLateConvo && msg.mediaThumbnail?.startsWith("http")) {
                                window.open(msg.mediaThumbnail, "_blank");
                              } else {
                                downloadWhatsAppMedia(msg.id, waDownloadMedia, { defaultMimetype: "application/pdf", fileName: msg.mediaFileName, label: "Documento" });
                              }
                            }}
                            className={`p-1 rounded-full flex-shrink-0 ${msg.isMe ? "hover:bg-primary-foreground/20" : "hover:bg-foreground/10"} transition-colors`}
                          >
                            <Download className="w-3.5 h-3.5 opacity-60" />
                          </button>
                        )}
                      </div>
                    ) : msg.mediaType === "album" ? (
                      <div className="flex items-center gap-2 py-1">
                        <Image className="w-4 h-4 flex-shrink-0 opacity-70" />
                        <span className="text-xs opacity-80">{msg.mediaFileName || "Álbum de fotos"}</span>
                      </div>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap break-words">
                          {isSearchMatch ? highlightText(msg.text, chatSearchQuery, !!isActiveSearchMatch) : msg.text}
                        </p>
                        {urls.length > 0 && <LinkPreview url={urls[0]} />}
                      </>
                    )}

                    {/* Time + status footer */}
                    <div className="flex items-center justify-end gap-1 -mb-0.5 mt-0.5">
                      <span className={`text-[10px] leading-none ${msg.isMe ? "text-primary-foreground/50" : "text-muted-foreground/70"}`}>{msg.time}</span>
                      {msg.isMe && msg.status && (
                        <span className={`flex-shrink-0 ${
                          msg.status === "read" ? "text-sky-300" 
                          : msg.status === "failed" ? "text-destructive-foreground/70" 
                          : msg.isMe ? "text-primary-foreground/40" 
                          : "text-muted-foreground"
                        }`}>
                          {msg.status === "sending" && <Loader2 className="w-3 h-3 animate-spin" />}
                          {msg.status === "sent" && <Check className="w-3 h-3" />}
                          {msg.status === "delivered" && <CheckCheck className="w-3 h-3" />}
                          {msg.status === "read" && <CheckCheck className="w-3 h-3" />}
                          {msg.status === "failed" && <X className="w-3 h-3" />}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Reactions */}
                  {msg.reactions && msg.reactions.length > 0 && (
                    <ReactionBadge reactions={msg.reactions} />
                  )}
                </div>
              </div>
            );
          });
        })()}

        {/* Typing indicator */}
        <AnimatePresence>
          {selectedConvo && typingConvos.has(selectedConvo.id) && (
            <TypingIndicator senderName={selectedConvo.channelId?.endsWith("@g.us") ? undefined : selectedConvo.name} />
          )}
        </AnimatePresence>

        {chatSearchQuery && filteredChatMessages.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhuma mensagem encontrada</p>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom FAB */}
      <AnimatePresence>
        {showScrollToBottom && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            onClick={scrollToBottom}
            className="absolute bottom-20 right-6 z-20 w-9 h-9 rounded-full bg-background/90 backdrop-blur-sm border border-foreground/10 shadow-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
            title="Ir para o final"
          >
            <ArrowDown className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="p-3 border-t border-foreground/5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          onChange={handleFileSelect}
          className="hidden"
        />

        {lateAccountMissing && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5">
            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground">Conta não vinculada</p>
              <p className="text-[11px] text-muted-foreground truncate">
                Esta conversa social não tem uma conta conectada. Reconecte a integração para enviar mensagens.
              </p>
            </div>
            <button
              onClick={() => navigate("/integrations")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 transition-colors flex-shrink-0"
              title="Abrir Integrações"
            >
              <Plug className="w-3.5 h-3.5" />
              Reconectar integração
            </button>
          </div>
        )}

        {replyingTo && (
          <div className="mb-2 flex items-center gap-2 bg-foreground/5 rounded-lg p-2 border-l-2 border-primary">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium text-primary truncate">{replyingTo.isMe ? "Você" : replyingTo.sender}</p>
              <p className="text-xs text-muted-foreground truncate">{replyingTo.text}</p>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-1 rounded hover:bg-foreground/10 text-muted-foreground flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {pendingMedia && (
          <div className="mb-2 flex items-center gap-2 bg-foreground/5 rounded-lg p-2">
            {pendingMedia.mediatype === "image" ? (
              <img src={pendingMedia.base64} alt="preview" className="w-12 h-12 rounded object-cover" />
            ) : (
              <div className="w-12 h-12 rounded bg-foreground/10 flex items-center justify-center">
                {pendingMedia.mediatype === "video" ? <Video className="w-5 h-5 text-muted-foreground" /> :
                 pendingMedia.mediatype === "audio" ? <Mic className="w-5 h-5 text-muted-foreground" /> :
                 <FileText className="w-5 h-5 text-muted-foreground" />}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{pendingMedia.file.name}</p>
              <p className="text-xs text-muted-foreground">{(pendingMedia.file.size / 1024).toFixed(0)} KB</p>
            </div>
            <button onClick={() => setPendingMedia(null)} className="p-1 rounded hover:bg-foreground/10 text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-1">
          <button
            onClick={() => handleAiAction("suggest_reply")}
            disabled={aiLoading !== null}
            className="p-2 rounded-lg hover:bg-foreground/5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 flex-shrink-0"
            title="Sugerir resposta com IA"
          >
            {aiLoading === "suggest" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          </button>
          {newMessage.trim().length > 0 && (
            <>
              <button
                onClick={() => handleAiAction("improve", newMessage)}
                disabled={aiLoading !== null}
                className="p-2 rounded-lg hover:bg-foreground/5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 flex-shrink-0"
                title="Melhorar texto com IA"
              >
                {aiLoading === "improve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}
              </button>
              <button
                onClick={() => handleAiAction("translate", newMessage)}
                disabled={aiLoading !== null}
                className="p-2 rounded-lg hover:bg-foreground/5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 flex-shrink-0"
                title="Traduzir para inglês"
              >
                {aiLoading === "translate" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
              </button>
            </>
          )}
          <QuickReplyPicker onSelect={(text) => setNewMessage(newMessage ? newMessage + " " + text : text)} />
          <EmojiPicker onSelect={(emoji: string) => setNewMessage(newMessage + emoji)} />
          {canSend && !isLateConvo && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={sendingMedia}
              className="p-2 rounded-lg hover:bg-foreground/5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 flex-shrink-0"
              title="Anexar arquivo"
            >
              <Paperclip className="w-4 h-4" />
            </button>
          )}
          <input
            type="text"
            placeholder={pendingMedia ? "Legenda (opcional)..." : replyingTo ? "Responder..." : "Digite uma mensagem..."}
            value={newMessage}
            onChange={e => { setNewMessage(e.target.value); sendTypingPresence(); }}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { handleSend(replyingTo?.id); setReplyingTo(null); }
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); handleSend(replyingTo?.id); setReplyingTo(null); }
              if (e.key === "Escape") { e.preventDefault(); if (replyingTo) setReplyingTo(null); else setNewMessage(""); }
            }}
            className="flex-1 bg-foreground/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            title="Enter enviar • Esc cancelar reply"
          />
          {newMessage.trim() || pendingMedia ? (
            <button
              onClick={() => { handleSend(replyingTo?.id); setReplyingTo(null); }}
              disabled={isSending || sendingMedia || (!newMessage.trim() && !pendingMedia)}
              className="bg-primary text-primary-foreground p-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {(isSending || sendingMedia) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          ) : canSend && !isLateConvo ? (
            <AudioRecorder onSend={(base64: string, mime: string) => onSendAudio(base64, mime)} onCancel={() => {}} />
          ) : canSend ? (
            <button
              onClick={() => {}}
              disabled
              className="bg-primary/50 text-primary-foreground p-2 rounded-lg flex-shrink-0 opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          ) : (
            <button disabled className="bg-primary/50 text-primary-foreground p-2 rounded-lg flex-shrink-0 opacity-50">
              <Send className="w-4 h-4" />
            </button>
          )}
          <MessageInputMetrics text={newMessage} />
        </div>
      </div>

      {/* Contact Info Panel */}
      <AnimatePresence>
        {showContactInfo && selectedConvo && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 300, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="absolute right-0 top-0 bottom-0 z-30 border-l border-foreground/10 bg-background overflow-y-auto"
          >
            <ContactInfoPanel
              open={true}
              contactId={selectedConvo.channelId}
              contactName={selectedConvo.name}
              avatarUrl={selectedConvo.avatar?.startsWith("http") ? selectedConvo.avatar : undefined}
              conversationId={selectedConvo.id}
              onClose={() => setShowContactInfo(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Media Lightbox */}
      <MediaLightbox
        open={!!lightbox}
        src={lightbox?.src || ""}
        type={lightbox?.type || "image"}
        fileName={lightbox?.fileName}
        onClose={() => setLightbox(null)}
        onDownload={lightbox?.onDownload}
      />
    </div>
  );
});

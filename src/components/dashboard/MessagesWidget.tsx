import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import DeshTooltip from "@/components/ui/DeshTooltip";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle, ExternalLink, Users, Search, Pin, BellOff, Archive,
  Sparkles, Loader2, BarChart3, Inbox, Clock, TrendingUp, Filter,
  ChevronRight, Star, Zap, RefreshCw, X, Send, Tag, Volume2,
  Reply, ArrowLeft,
} from "lucide-react";
import { useConnections } from "@/contexts/ConnectionsContext";
import { useDemo } from "@/contexts/DemoContext";
import { DEMO_MESSAGES } from "@/lib/demoData";

import { useWhatsappConversations } from "@/hooks/whatsapp/useWhatsappConversations";
import { useSharedWhatsappSession } from "@/contexts/WhatsappSessionContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import GlassCard from "./GlassCard";
import WidgetTitle from "./WidgetTitle";
import WidgetEmptyState from "./WidgetEmptyState";
import ConnectionBadge from "./ConnectionBadge";

type Platform = "whatsapp" | "telegram" | "slack" | "discord" | "teams";

interface UnifiedMessage {
  id: number | string;
  from: string;
  msg: string;
  time: string;
  timeObj: Date;
  unread: boolean;
  unreadCount: number;
  platform: Platform;
  avatar?: string | null;
  isGroup?: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
  isArchived?: boolean;
  /** WhatsApp external contact id for sending messages */
  externalContactId?: string;
  /** WhatsApp conversation db id */
  conversationDbId?: string;
}

const platformConfig: Record<Platform, { color: string; label: string; icon: string }> = {
  whatsapp: { color: "bg-green-500", label: "WhatsApp", icon: "💬" },
  telegram: { color: "bg-sky-500", label: "Telegram", icon: "✈️" },
  slack: { color: "bg-purple-600", label: "Slack", icon: "💼" },
  discord: { color: "bg-indigo-500", label: "Discord", icon: "🎮" },
  teams: { color: "bg-blue-600", label: "Teams", icon: "👥" },
};

const AVATAR_COLORS = [
  "bg-sky-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-orange-500", "bg-indigo-500",
];

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/#{1,6}\s?/g, "")
    .replace(/`{1,3}[^`]*`{1,3}/g, (m) => m.replace(/`/g, ""))
    .replace(/---/g, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .trim();
}

function formatPhoneDisplay(phone: string): string {
  if (!phone) return "Contato";
  const clean = phone.replace(/@.*$/, "");
  if (clean.length > 8) {
    return `+${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  return clean;
}

function timeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

const AvatarCircle = React.forwardRef<HTMLDivElement, { name: string; avatar?: string | null; isGroup?: boolean }>(({ name, avatar, isGroup }, ref) => {
  const color = AVATAR_COLORS[hashStr(name) % AVATAR_COLORS.length];
  const initials = name ? (name.length >= 2 ? name.slice(0, 2).toUpperCase() : name.toUpperCase()) : "?";

  if (avatar && avatar.startsWith("http")) {
    return (
      <div ref={ref} className="w-8 h-8 rounded-full overflow-hidden shrink-0">
        <img src={avatar} alt={name} className="w-full h-full object-cover"
          onError={(e) => { const img = e.target as HTMLImageElement; img.style.display = "none"; if (img.parentElement) { img.parentElement.className = `w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${color}`; img.parentElement.textContent = isGroup ? "👥" : initials; } }} />
      </div>
    );
  }

  return (
    <div ref={ref} className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${color}`}>
      {isGroup ? <Users className="w-3.5 h-3.5" /> : initials}
    </div>
  );
});
AvatarCircle.displayName = "AvatarCircle";

// ── Helper: fetch conversation messages for AI context ──
async function fetchConversationMessages(conversationId: string, limit: number, contactName: string) {
  const { data } = await supabase
    .from("whatsapp_messages")
    .select("direction, content_text, sent_at")
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: false })
    .limit(limit);
  if (!data) return [];
  return data.reverse().map((m: any) => ({
    sender: m.direction === "inbound" ? contactName : "Você",
    text: m.content_text || "(mídia)",
  }));
}

const MessagesWidget = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { invoke } = useEdgeFn();
  const { isDemoMode } = useDemo();

  const { getConnectionsByCategory } = useConnections();
  const msgConns = getConnectionsByCategory("messaging");
  const connectionIds = msgConns.map(c => c.id);

  const { conversations: waConversations, isLoading: waLoading } = useWhatsappConversations();
  const { session: waSession, sendMessage } = useSharedWhatsappSession();
  const waConnected = waSession.status === "CONNECTED";

  const isConnected = waConversations.length > 0 || waConnected || isDemoMode;
  const isLoading = isDemoMode ? false : waLoading;
  const sourceCount = waConversations.length > 0 ? 1 : 0;
  const sourceNames = waConversations.length > 0 ? ["WhatsApp Web"] : [];

  // ─── Contact name map ───
  const [contactNameMap, setContactNameMap] = useState<Record<string, string>>({});
  const contactsFetchedRef = useRef(false);

  useEffect(() => {
    if (!user || contactsFetchedRef.current) return;
    contactsFetchedRef.current = true;
    const fetchContacts = async () => {
      const { data: contacts } = await supabase.from("contacts").select("name, phone").eq("user_id", user.id);
      if (!contacts) return;
      const map: Record<string, string> = {};
      for (const c of contacts) {
        if (c.phone) {
          const normalized = c.phone.replace(/\D/g, "");
          if (normalized) map[normalized] = c.name;
        }
      }
      setContactNameMap(map);
    };
    fetchContacts();
  }, [user]);

  // ─── User display name ─────
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("user_id", user.id).single()
      .then(({ data }) => { if (data?.display_name) setUserDisplayName(data.display_name); });
  }, [user]);

  // ─── Last message preview per conversation ──────
  const [lastMessageMap, setLastMessageMap] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!waConversations.length) return;
    const fetchLastMessages = async () => {
      const convIds = waConversations.map(c => c.id);
      const { data: rows } = await supabase
        .from("whatsapp_messages")
        .select("conversation_id, content_text, direction, type, sent_at")
        .in("conversation_id", convIds)
        .order("sent_at", { ascending: false })
        .limit(convIds.length * 2);
      if (!rows) return;
      const map: Record<string, string> = {};
      for (const row of rows) {
        if (map[row.conversation_id]) continue;
        const prefix = row.direction === "outbound" ? "Você: " : "";
        const typeLabel = row.type === "image" ? "📷 Imagem" : row.type === "audio" ? "🎤 Áudio" : row.type === "video" ? "🎥 Vídeo" : row.type === "document" ? "📎 Documento" : null;
        map[row.conversation_id] = `${prefix}${row.content_text || typeLabel || ""}`;
      }
      setLastMessageMap(map);
    };
    fetchLastMessages();
  }, [waConversations]);

  // isDemoMode already declared at top of component

  const messages: UnifiedMessage[] = useMemo(() => {
    if (isDemoMode) {
      return DEMO_MESSAGES.map((m, i) => ({
        id: m.id,
        from: m.from,
        msg: m.msg,
        time: m.time,
        timeObj: new Date(Date.now() - i * 15 * 60000),
        unread: m.unread,
        unreadCount: m.unread ? 1 : 0,
        platform: m.platform as Platform,
      }));
    }
    const combined: UnifiedMessage[] = [];

    if (waConversations.length > 0) {
      waConversations.slice(0, 15).forEach((c) => {
        const contactMatch = contactNameMap[c.externalContactId];
        const titleIsOwnName = userDisplayName && c.title && c.title.toLowerCase().trim() === userDisplayName.toLowerCase().trim();
        const validTitle = c.title && !titleIsOwnName ? c.title : null;
        const isGroup = c.externalContactId.endsWith("@g.us");
        const displayName = isGroup
          ? (validTitle || c.externalContactId.replace("@g.us", ""))
          : (contactMatch || validTitle || formatPhoneDisplay(c.externalContactId));

        combined.push({
          id: c.id,
          from: displayName,
          msg: lastMessageMap[c.id] || "",
          time: new Date(c.lastMessageAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          timeObj: new Date(c.lastMessageAt),
          unread: c.unreadCount > 0,
          unreadCount: c.unreadCount || 0,
          platform: "whatsapp",
          avatar: c.profilePictureUrl || null,
          isGroup,
          isPinned: (c as any).pinned || false,
          isMuted: (c as any).muted || false,
          isArchived: (c as any).archived || false,
          externalContactId: c.externalContactId,
          conversationDbId: c.id,
        });
      });
    }

    combined.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      if (a.unread !== b.unread) return a.unread ? -1 : 1;
      return b.timeObj.getTime() - a.timeObj.getTime();
    });

    return combined.slice(0, 15);
  }, [isDemoMode, waConversations, contactNameMap, userDisplayName, lastMessageMap]);

  const unreadCount = messages.filter(m => m.unread).length;
  const groupCount = messages.filter(m => m.isGroup).length;
  const totalUnreadBadges = messages.reduce((sum, m) => sum + m.unreadCount, 0);

  // ─── Popup state ────
  const [searchQuery, setSearchQuery] = useState("");
  const [popupFilter, setPopupFilter] = useState<"all" | "unread" | "groups" | "pinned">("all");

  // ─── Inline Reply state ────
  const [activeConversation, setActiveConversation] = useState<UnifiedMessage | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);

  // ─── AI actions state ────
  const [aiReplyLoading, setAiReplyLoading] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState<string | null>(null);
  const [conversationSummaries, setConversationSummaries] = useState<Record<string, string>>({});

  // ─── Quick Reply handler ────
  const handleSendReply = useCallback(async () => {
    if (!activeConversation?.externalContactId || !replyText.trim()) return;
    setReplyLoading(true);
    try {
      await sendMessage(activeConversation.externalContactId, replyText.trim());
      toast({ title: "Mensagem enviada!", description: `Para ${activeConversation.from}` });
      setReplyText("");
    } catch (err) {
      toast({ title: "Erro ao enviar", description: err instanceof Error ? err.message : "Tente novamente", variant: "destructive" });
    } finally {
      setReplyLoading(false);
    }
  }, [activeConversation, replyText, sendMessage]);

  // ─── AI Suggest Reply handler ────
  const handleAiSuggestReply = useCallback(async (m: UnifiedMessage) => {
    if (!m.conversationDbId) return;
    setAiReplyLoading(String(m.id));
    setActiveConversation(m);
    try {
      const msgs = await fetchConversationMessages(m.conversationDbId, 15, m.from);
      if (msgs.length === 0) { toast({ title: "Sem mensagens para contexto" }); return; }
      const { data, error } = await invoke<any>({
        fn: "ai-router",
        body: {
          module: "messages",
          action: "suggest_reply",
          conversation: { name: m.from, platform: m.platform, messages: msgs },
        },
      });
      if (error) throw new Error(error);
      const suggestion = stripMarkdown(data?.result || "");
      setReplyText(suggestion);
    } catch (err) {
      toast({ title: "Erro ao gerar sugestão", description: err instanceof Error ? err.message : "Tente novamente", variant: "destructive" });
    } finally {
      setAiReplyLoading(null);
    }
  }, [invoke]);

  // ─── AI Summarize handler ────
  const handleSummarize = useCallback(async (m: UnifiedMessage) => {
    if (!m.conversationDbId) return;
    setSummaryLoading(String(m.id));
    try {
      const msgs = await fetchConversationMessages(m.conversationDbId, 20, m.from);
      if (msgs.length === 0) { toast({ title: "Sem mensagens para resumir" }); return; }
      const { data, error } = await invoke<any>({
        fn: "ai-router",
        body: {
          module: "messages",
          action: "summarize",
          conversation: { name: m.from, platform: m.platform, messages: msgs },
        },
      });
      if (error) throw new Error(error);
      setConversationSummaries(prev => ({ ...prev, [String(m.id)]: stripMarkdown(data?.result || "Sem resumo.") }));
    } catch (err) {
      toast({ title: "Erro ao resumir", description: err instanceof Error ? err.message : "Tente novamente", variant: "destructive" });
    } finally {
      setSummaryLoading(null);
    }
  }, [invoke]);

  // ─── AI Summary (global) ────
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const aiCacheRef = useRef<{ key: string; text: string; ts: number } | null>(null);

  const generateAiSummary = useCallback(async () => {
    const key = messages.map(m => m.id).join("|");
    if (aiCacheRef.current?.key === key && Date.now() - aiCacheRef.current.ts < 5 * 60 * 1000) {
      setAiSummary(aiCacheRef.current.text); return;
    }
    if (messages.length === 0) { setAiSummary("Nenhuma conversa para analisar."); return; }
    setAiSummaryLoading(true);
    try {
      const convList = messages.slice(0, 10).map(m =>
        `- [${m.unread ? `${m.unreadCount} não lidas` : "Lido"}] ${m.isGroup ? "[Grupo]" : ""} ${m.from}: "${m.msg}"`
      ).join("\n");
      const { data, error } = await invoke<any>({
        fn: "chat",
        body: {
          messages: [
            { role: "system", content: "Você é um assistente de mensagens. Analise as conversas e dê um resumo executivo em português: quais conversas precisam de atenção urgente, quais têm mensagens pendentes de resposta, e quais podem esperar. Máximo 4 frases curtas e diretas." },
            { role: "user", content: `Minhas conversas recentes:\n${convList}` }
          ]
        }
      });
      if (error) throw new Error(error);
      const raw = typeof data === "string" ? data : (data?.content || data?.choices?.[0]?.message?.content || "Sem resumo.");
      setAiSummary(stripMarkdown(raw));
      aiCacheRef.current = { key, text: stripMarkdown(raw), ts: Date.now() };
    } catch { setAiSummary("Não foi possível gerar resumo."); }
    finally { setAiSummaryLoading(false); }
  }, [messages, invoke]);

  // ─── Stats ────
  const stats = useMemo(() => {
    const total = messages.length;
    const unread = messages.filter(m => m.unread).length;
    const groups = messages.filter(m => m.isGroup).length;
    const pinned = messages.filter(m => m.isPinned).length;
    const platforms: Record<string, number> = {};
    for (const m of messages) platforms[m.platform] = (platforms[m.platform] || 0) + 1;
    const topPlatform = Object.entries(platforms).sort((a, b) => b[1] - a[1])[0];
    const avgHours = messages.length > 0
      ? Math.round(messages.reduce((sum, m) => sum + (Date.now() - m.timeObj.getTime()) / 3600000, 0) / messages.length)
      : 0;
    return { total, unread, groups, pinned, platforms, topPlatform, avgHours };
  }, [messages]);

  // ─── Filtered messages for popup ────
  const filteredMessages = useMemo(() => {
    let list = [...messages].filter(m => !m.isArchived);
    if (popupFilter === "unread") list = list.filter(m => m.unread);
    else if (popupFilter === "groups") list = list.filter(m => m.isGroup);
    else if (popupFilter === "pinned") list = list.filter(m => m.isPinned);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(m => m.from.toLowerCase().includes(q) || m.msg.toLowerCase().includes(q));
    }
    return list;
  }, [messages, popupFilter, searchQuery]);

  // ─── Popup message row with hover actions ────
  const PopupMessageRow = ({ m }: { m: UnifiedMessage }) => {
    const plat = platformConfig[m.platform];
    const isActive = activeConversation?.id === m.id;
    const hasSummary = !!conversationSummaries[String(m.id)];
    const isSummarizing = summaryLoading === String(m.id);
    const isAiLoading = aiReplyLoading === String(m.id);
    const canReply = !!m.externalContactId;

    return (
      <div className="group/row">
        <motion.div
          layout exit={{ opacity: 0, x: -20, height: 0 }} transition={{ duration: 0.2 }}
          onClick={() => {
            if (canReply) {
              setActiveConversation(isActive ? null : m);
              if (!isActive) setReplyText("");
            } else {
              navigate("/messages");
            }
          }}
          className={`rounded-xl p-3 transition-colors cursor-pointer relative ${
            isActive
              ? "bg-primary/10 border border-primary/20"
              : m.unread
                ? "bg-primary/5 hover:bg-primary/8 border border-primary/10"
                : "bg-foreground/5 hover:bg-foreground/8"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="relative">
              <AvatarCircle name={m.from} avatar={m.avatar} isGroup={m.isGroup} />
              <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background ${plat.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {m.isPinned && <Pin className="w-3 h-3 text-primary shrink-0" />}
                  {m.isGroup && <Users className="w-3 h-3 text-muted-foreground shrink-0" />}
                  <p className={`text-sm truncate ${m.unread ? "font-semibold text-foreground" : "text-foreground/70"}`}>{m.from}</p>
                  {m.isMuted && <BellOff className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] text-muted-foreground/70 font-medium">{plat.label}</span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(m.timeObj)}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{m.msg || "\u00A0"}</p>
              <div className="flex items-center justify-between mt-1.5">
                <div className="flex items-center gap-1.5">
                  {m.unreadCount > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20 tabular-nums">
                      {m.unreadCount}
                    </span>
                  )}
                  {m.isGroup && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-foreground/10 text-foreground/60">Grupo</span>}
                </div>

                {/* ─── Hover action buttons ─── */}
                {canReply && (
                  <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                    <DeshTooltip label="Responder">
                      <button
                        onClick={(e) => { e.stopPropagation(); setActiveConversation(m); setReplyText(""); }}
                        className="p-1 rounded-md hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>
                    </DeshTooltip>
                    <DeshTooltip label="Sugerir com IA">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAiSuggestReply(m); }}
                        disabled={isAiLoading}
                        className="p-1 rounded-md hover:bg-primary/15 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                      >
                        {isAiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      </button>
                    </DeshTooltip>
                    <DeshTooltip label="Resumir conversa">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSummarize(m); }}
                        disabled={isSummarizing}
                        className="p-1 rounded-md hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        {isSummarizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
                      </button>
                    </DeshTooltip>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ─── Per-conversation AI summary card ─── */}
        <AnimatePresence>
          {hasSummary && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mx-2 mt-1 mb-1 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium text-primary flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" /> Resumo IA
                  </span>
                  <button onClick={() => setConversationSummaries(prev => { const n = { ...prev }; delete n[String(m.id)]; return n; })}
                    className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap">{conversationSummaries[String(m.id)]}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Inline reply panel ─── */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mx-2 mt-1 mb-1 p-2.5 rounded-lg bg-foreground/5 border border-foreground/10">
                <div className="flex items-center gap-2">
                  <input
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                    placeholder={`Responder ${m.from}...`}
                    className="flex-1 bg-background rounded-md px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50 border border-foreground/10"
                    autoFocus
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={replyLoading || !replyText.trim()}
                    className="p-1.5 rounded-md bg-primary/15 text-primary hover:bg-primary/25 transition-colors disabled:opacity-40"
                  >
                    {replyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => setActiveConversation(null)} className="p-1.5 rounded-md hover:bg-foreground/10 text-muted-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {/* AI suggest shortcut inside reply */}
                <button
                  onClick={() => handleAiSuggestReply(m)}
                  disabled={!!aiReplyLoading}
                  className="mt-1.5 text-[10px] px-2 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {aiReplyLoading === String(m.id) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Sugerir com IA
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // === POPUP CONTENT ===
  const popupContent = (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        <div className="p-2.5 rounded-xl bg-foreground/5 text-center">
          <p className="text-lg font-bold text-foreground">{stats.total}</p>
          <p className="text-[10px] text-muted-foreground">Conversas</p>
        </div>
        <div className="p-2.5 rounded-xl bg-foreground/5 text-center">
          <p className="text-lg font-bold text-primary">{totalUnreadBadges}</p>
          <p className="text-[10px] text-muted-foreground">Não lidas</p>
        </div>
        <div className="p-2.5 rounded-xl bg-foreground/5 text-center">
          <p className="text-lg font-bold text-foreground">{stats.groups}</p>
          <p className="text-[10px] text-muted-foreground">Grupos</p>
        </div>
        <div className="p-2.5 rounded-xl bg-foreground/5 text-center">
          <p className="text-lg font-bold text-foreground">{stats.pinned}</p>
          <p className="text-[10px] text-muted-foreground">Fixadas</p>
        </div>
      </div>

      {/* AI Summary */}
      <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Resumo IA
          </span>
          <button onClick={generateAiSummary} disabled={aiSummaryLoading}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-primary/15 text-primary font-medium hover:bg-primary/25 transition-colors disabled:opacity-50 flex items-center gap-1">
            {aiSummaryLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            {aiSummaryLoading ? "Analisando..." : aiSummary ? "Atualizar" : "Gerar"}
          </button>
        </div>
        {aiSummary ? (
          <p className="text-xs text-foreground/80 leading-relaxed">{aiSummary}</p>
        ) : (
          <p className="text-xs text-muted-foreground/60 italic">Clique para um resumo inteligente das suas conversas recentes.</p>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="inbox" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-8">
          <TabsTrigger value="inbox" className="text-[11px] gap-1"><Inbox className="w-3 h-3" />Conversas</TabsTrigger>
          <TabsTrigger value="groups" className="text-[11px] gap-1"><Users className="w-3 h-3" />Grupos</TabsTrigger>
          <TabsTrigger value="insights" className="text-[11px] gap-1"><BarChart3 className="w-3 h-3" />Insights</TabsTrigger>
        </TabsList>

        {/* Inbox Tab */}
        <TabsContent value="inbox" className="space-y-3 mt-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar contato, mensagem..."
              className="w-full bg-foreground/5 rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50" />
          </div>

          {/* Filter chips */}
          <div className="flex gap-1">
            {([["all", `Todos (${stats.total})`], ["unread", `Não lidas (${stats.unread})`], ["pinned", `Fixadas (${stats.pinned})`]] as const).map(([key, label]) => (
              <button key={key} onClick={() => setPopupFilter(key as any)}
                className={`text-[10px] px-2.5 py-0.5 rounded-full font-medium transition-colors ${popupFilter === key ? "bg-primary/20 text-primary" : "bg-foreground/5 text-muted-foreground hover:text-foreground"}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Messages list */}
          <div className="space-y-2 max-h-[320px] overflow-y-auto scrollbar-thin">
            <AnimatePresence>
              {filteredMessages.filter(m => !m.isGroup || popupFilter !== "all" || m.isPinned || m.unread).concat(
                popupFilter === "all" ? filteredMessages.filter(m => m.isGroup && !m.isPinned && !m.unread) : []
              ).filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i).map(m => (
                <PopupMessageRow key={m.id} m={m} />
              ))}
            </AnimatePresence>
            {filteredMessages.length === 0 && <p className="text-xs text-muted-foreground/60 italic text-center py-6">{searchQuery ? "Nenhum resultado" : "Nenhuma conversa"}</p>}
          </div>
        </TabsContent>

        {/* Groups Tab */}
        <TabsContent value="groups" className="space-y-3 mt-3">
          {messages.filter(m => m.isGroup).length > 0 ? (
            <div className="space-y-2 max-h-[360px] overflow-y-auto scrollbar-thin">
              {messages.filter(m => m.isGroup).map(m => (
                <PopupMessageRow key={m.id} m={m} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground/60">Nenhum grupo encontrado</p>
            </div>
          )}
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-3 mt-3">
          {Object.entries(stats.platforms).length > 0 && (
            <div className="p-3 rounded-xl bg-foreground/5">
              <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-primary" /> Distribuição por plataforma
              </p>
              <div className="flex items-end gap-2 h-16">
                {Object.entries(stats.platforms).sort((a, b) => b[1] - a[1]).map(([plat, count]) => {
                  const config = platformConfig[plat as Platform];
                  const max = Math.max(...Object.values(stats.platforms), 1);
                  const height = Math.max((count / max) * 100, 15);
                  return (
                    <div key={plat} className="flex-1 flex flex-col items-center gap-0.5">
                      <span className="text-[9px] text-muted-foreground/70 tabular-nums">{count}</span>
                      <div className={`w-full rounded-t-sm transition-all ${config?.color || "bg-foreground/10"}`} style={{ height: `${height}%` }} />
                      <span className="text-[7px] text-muted-foreground/60 truncate w-full text-center">{config?.label || plat}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-foreground/5">
              <TrendingUp className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="text-xs font-medium text-foreground">Taxa de leitura</p>
                <p className="text-[10px] text-muted-foreground">
                  {stats.total > 0 ? Math.round(((stats.total - stats.unread) / stats.total) * 100) : 0}% das conversas lidas
                </p>
              </div>
            </div>
            {stats.avgHours > 0 && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-foreground/5">
                <Clock className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">Tempo médio</p>
                  <p className="text-[10px] text-muted-foreground">Conversas ativas há ~{stats.avgHours}h em média</p>
                </div>
              </div>
            )}
            {stats.topPlatform && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-foreground/5">
                <MessageCircle className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">Plataforma principal</p>
                  <p className="text-[10px] text-muted-foreground">{platformConfig[stats.topPlatform[0] as Platform]?.label || stats.topPlatform[0]} ({stats.topPlatform[1]} conversas)</p>
                </div>
              </div>
            )}
            {unreadCount > 0 && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-orange-500/5 border border-orange-500/10">
                <Zap className="w-4 h-4 text-orange-400 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">Atenção</p>
                  <p className="text-[10px] text-muted-foreground">{totalUnreadBadges} mensagen{totalUnreadBadges > 1 ? "s" : ""} não lida{totalUnreadBadges > 1 ? "s" : ""} em {unreadCount} conversa{unreadCount > 1 ? "s" : ""}</p>
                </div>
              </div>
            )}
          </div>

          <button onClick={() => navigate("/messages")}
            className="w-full py-2 rounded-lg bg-foreground/5 text-xs text-muted-foreground hover:text-primary hover:bg-foreground/10 transition-colors flex items-center justify-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5" /> Abrir mensagens <ChevronRight className="w-3 h-3" />
          </button>
        </TabsContent>
      </Tabs>
    </div>
  );

  // === COMPACT CARD ===
  return (
    <GlassCard className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2">
          <WidgetTitle
            label="Mensagens"
            icon={<MessageCircle className="w-3.5 h-3.5 text-green-400" />}
            popupIcon={<MessageCircle className="w-5 h-5 text-green-400" />}
            popupContent={popupContent}
          />
          <ConnectionBadge isConnected={isConnected} isLoading={isLoading} sourceCount={sourceCount} sourceNames={sourceNames} />
        </div>
        <div className="flex items-center gap-1.5">
          {totalUnreadBadges > 0 && (
            <button
              onClick={() => navigate("/messages")}
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20 tabular-nums hover:bg-green-500/25 transition-colors"
              title={`${totalUnreadBadges} não lidas`}
            >
              {totalUnreadBadges}
            </button>
          )}
          <DeshTooltip label="Abrir mensagens">
            <button onClick={() => navigate("/messages")} className="text-muted-foreground hover:text-foreground transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </DeshTooltip>
        </div>
      </div>

      {/* Mini stats bar */}
      {isConnected && messages.length > 0 && (
        <div className="flex items-center gap-3 mb-1.5 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" />{stats.total}</span>
          {stats.unread > 0 && <span className="flex items-center gap-0.5 text-green-400 font-medium"><Inbox className="w-3 h-3" />{stats.unread} não lidas</span>}
          {stats.groups > 0 && <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />{stats.groups}</span>}
          {stats.pinned > 0 && <span className="flex items-center gap-0.5 ml-auto"><Pin className="w-3 h-3" />{stats.pinned}</span>}
        </div>
      )}

      {!isConnected ? (
        <WidgetEmptyState
          icon={MessageCircle}
          title="Nenhuma mensagem"
          description="Conecte suas plataformas de mensagens"
          connectTo="/integrations"
          connectLabel="Conectar plataformas"
        />
      ) : (
        <div className="space-y-0.5 flex-1 overflow-y-auto min-h-0 scrollbar-thin">
          {messages.map((m, i) => {
            const plat = platformConfig[m.platform];
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => navigate("/messages")}
                className="flex items-start gap-2 p-2 rounded-lg hover:bg-foreground/5 transition-colors cursor-pointer group"
              >
                <div className="relative shrink-0 mt-0.5">
                  <AvatarCircle name={m.from} avatar={m.avatar} isGroup={m.isGroup} />
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${plat.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 min-w-0">
                      {m.isPinned && <Pin className="w-3 h-3 text-primary shrink-0" />}
                      {m.isGroup && <Users className="w-3 h-3 text-muted-foreground shrink-0" />}
                      <p className={`text-sm truncate ${m.unread ? "font-medium text-foreground" : "text-foreground/70"}`}>{m.from}</p>
                      {m.isMuted && <BellOff className="w-2.5 h-2.5 text-muted-foreground/40 shrink-0" />}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(m.timeObj)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{m.msg || "\u00A0"}</p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0 mt-1.5">
                  {m.unreadCount > 0 && (
                    <span className="text-[9px] font-bold w-4.5 h-4.5 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center tabular-nums">
                      {m.unreadCount > 9 ? "9+" : m.unreadCount}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
          {messages.length === 0 && (
            <WidgetEmptyState icon={MessageCircle} title="Nenhuma mensagem recente" />
          )}
        </div>
      )}
    </GlassCard>
  );
};

export default React.memo(MessagesWidget);

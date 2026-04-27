import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import DeshTooltip from "@/components/ui/DeshTooltip";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  MailOpen,
  ChevronDown,
  ChevronUp,
  Reply,
  ExternalLink,
  Trash2,
  Star,
  Archive,
  Zap,
  RefreshCw,
  Sparkles,
  MailCheck,
  Loader2,
  Send,
  X,
  Search,
  BarChart3,
  Inbox,
  Clock,
  TrendingUp,
  Filter,
  ChevronRight,
  AlertTriangle,
  FileText,
  Tag,
} from "lucide-react";
import { useConnections } from "@/contexts/ConnectionsContext";
import { useWorkspaceSafe } from "@/contexts/WorkspaceContext";
import { useDemo } from "@/contexts/DemoContext";
import { DEMO_EMAILS } from "@/lib/demoData";
import { supabase } from "@/integrations/supabase/client";
import { useComposioConnection } from "@/hooks/integrations/useComposioConnection";
import type { ComposioEmail, ComposioEmailListResponse } from "@/types/composio";
import { apiFetch } from "@/lib/api-client";

import { useGoogleServiceData } from "@/hooks/integrations/useGoogleServiceData";
import { useGmailActions, ComposioExecuteError } from "@/hooks/integrations/useGmailActions";
import { toast } from "@/hooks/use-toast";
import { notifyAiShortcutPending } from "@/lib/aiShortcuts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import GlassCard from "./GlassCard";
import WidgetTitle from "./WidgetTitle";
import WidgetEmptyState from "./WidgetEmptyState";
import ConnectionBadge from "./ConnectionBadge";
import GoogleSyncTimestamp from "./GoogleSyncTimestamp";
import ScopeRequestBanner from "./ScopeRequestBanner";

const AI_CAT_STYLES: Record<string, { badge: string; label: string }> = {
  urgente: { badge: "bg-red-500/15 text-red-400 border-red-500/20", label: "Urgente" },
  trabalho: { badge: "bg-blue-500/15 text-blue-400 border-blue-500/20", label: "Trabalho" },
  financeiro: {
    badge: "bg-yellow-500/15 text-yellow-500 border-yellow-500/20",
    label: "Financeiro",
  },
  reunião: { badge: "bg-violet-500/15 text-violet-400 border-violet-500/20", label: "Reunião" },
  projeto: { badge: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20", label: "Projeto" },
  pessoal: { badge: "bg-green-500/15 text-green-400 border-green-500/20", label: "Pessoal" },
  promoções: { badge: "bg-orange-500/15 text-orange-400 border-orange-500/20", label: "Promoções" },
};

const AVATAR_COLORS = [
  "bg-sky-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-indigo-500",
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const AvatarCircle = React.forwardRef<HTMLDivElement, { name: string }>(({ name }, ref) => {
  const color = AVATAR_COLORS[hashStr(name) % AVATAR_COLORS.length];
  return (
    <div
      ref={ref}
      className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${color}`}
    >
      {getInitials(name)}
    </div>
  );
});
AvatarCircle.displayName = "AvatarCircle";

type CatEntry = { category: string; priority: string; requires_action: boolean };
interface ApiEmail {
  gmailId: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  bodyPreview: string;
  date: string;
  isUnread: boolean;
  hasAttachment: boolean;
  labelIds: string[];
}
interface EmailListResponse {
  items: ApiEmail[];
}

function readAiCategories(wsId: string | null): Record<string, CatEntry> {
  try {
    const key = wsId ? `dashfy-${wsId}-email_ai_categories` : `dashfy-email_ai_categories`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const EmailWidget = () => {
  const navigate = useNavigate();
  const gmail = useGmailActions();
  const { isDemoMode } = useDemo();
  const workspaceCtx = useWorkspaceSafe();
  const activeWorkspaceId = workspaceCtx?.activeWorkspaceId ?? null;
  const { getConnectionsByCategory } = useConnections();
  const msgConns = getConnectionsByCategory("messaging");
  const connectionIds = msgConns.map((c) => c.id);

  // Composio connection check
  const { isConnected: isComposioConnectedFn, loading: composioConnLoading } =
    useComposioConnection();
  const composioGmailConnected = isComposioConnectedFn("gmail");

  const {
    data: googleMessages,
    isLoading: googleLoading,
    isConnected: googleConnected,
    connectionNames: googleNames,
    needsScope: gmailNeedsScope,
    requestScope: gmailRequestScope,
    lastSyncedAt: gmailLastSync,
    refetch: gmailRefetch,
  } = useGoogleServiceData<any[]>({
    service: "gmail",
    path: "/gmail/v1/users/me/messages",
    params: { maxResults: "10", format: "metadata" },
  });

  const { data: gmailLabels } = useGoogleServiceData<any[]>({
    service: "gmail",
    path: "/gmail/v1/users/me/labels",
    enabled: googleConnected,
  });

  // Composio email fetch
  const [composioEmails, setComposioEmails] = useState<
    Array<ComposioEmail & Record<string, unknown>>
  >([]);
  const [composioLoading, setComposioLoading] = useState(false);
  const [composioRefreshKey, setComposioRefreshKey] = useState(0);

  useEffect(() => {
    if (!composioGmailConnected) return;
    setComposioLoading(true);

    // Try cache first, then fetch from Composio
    (async () => {
      if (activeWorkspaceId) {
        const cached = await apiFetch<EmailListResponse>(
          `/workspaces/${activeWorkspaceId}/emails?folder=inbox&limit=12`,
        ).catch(() => null);
        if (cached?.items && cached.items.length > 0) {
          setComposioEmails(
            cached.items.map(
              (c) =>
                ({
                  _fromCache: true,
                  id: c.gmailId,
                  from: c.fromName || "Desconhecido",
                  fromEmail: c.fromEmail || "",
                  subject: c.subject || "Sem assunto",
                  body: c.bodyPreview || c.snippet || "",
                  labelIds: c.labelIds || [],
                  date: c.date,
                  is_read: !c.isUnread,
                  has_attachment: c.hasAttachment,
                }) as ComposioEmail & Record<string, unknown>,
            ),
          );
          setComposioLoading(false);
        }
      }

      // Also fetch fresh from Composio in background — single batch call, no N+1
      try {
        let data: ComposioEmailListResponse | null = null;
        try {
          data = await gmail.fetchEmails<ComposioEmailListResponse>({
            max_results: 12,
            label_ids: ["INBOX"],
          });
        } catch (err) {
          if (err instanceof ComposioExecuteError && err.code === "not_connected") {
            console.warn("[EmailWidget] Gmail not connected via Composio, using cache only");
            setComposioLoading(false);
            return;
          }
          throw err;
        }
        if (data?.messages) {
          const valid = (data.messages ?? []).slice(0, 12).filter(Boolean);
          if (valid.length > 0) {
            setComposioEmails(
              valid.map((m: ComposioEmail) => {
                const rawFrom = m.from || m.sender || "";
                const emailMatch = rawFrom.match(/<(.+?)>/);
                return {
                  id: m.messageId || m.id,
                  from:
                    rawFrom
                      .replace(/<[^>]+>/g, "")
                      .replace(/^["']|["']$/g, "")
                      .trim() || "Desconhecido",
                  fromEmail: emailMatch?.[1] || rawFrom || "",
                  subject: m.subject || "Sem assunto",
                  body: m.messageText || m.snippet || "",
                  labelIds: m.labelIds || [],
                  date: m.date || m.receivedAt || "",
                  is_read: !(m.labelIds || []).includes("UNREAD"),
                  has_attachment: (m.attachmentList?.length || 0) > 0,
                };
              }),
            );
          }
        }
      } catch {
        /* cache fallback is fine */
      }
      setComposioLoading(false);
    })();
  }, [composioGmailConnected, gmail, activeWorkspaceId, composioRefreshKey]); // eslint-disable-line

  const useLegacyGmail = googleConnected && !composioGmailConnected;
  const isConnectedRaw = useLegacyGmail || composioGmailConnected;
  const isConnected = isConnectedRaw || isDemoMode;
  const isLoading = composioGmailConnected ? composioLoading : googleLoading;
  const sourceNames = useLegacyGmail
    ? googleNames
    : composioGmailConnected
      ? ["Gmail (Composio)"]
      : [];
  const sourceCount = isConnectedRaw ? 1 : 0;

  const [dbUnreadCount, setDbUnreadCount] = useState<number | null>(null);
  const fetchDbUnread = useCallback(async () => {
    if (!activeWorkspaceId) return;
    const cached = await apiFetch<EmailListResponse>(
      `/workspaces/${activeWorkspaceId}/emails?folder=inbox&limit=200`,
    ).catch(() => null);
    if (cached?.items) {
      setDbUnreadCount(cached.items.filter((email) => email.isUnread).length);
    }
  }, [activeWorkspaceId]);

  const fetchLegacyUnread = useCallback(async () => {
    const { count } = await supabase
      .from("gmail_messages_cache" as any)
      .select("id", { count: "exact", head: true })
      .eq("is_unread", true)
      .eq("folder", "inbox");
    if (count !== null) setDbUnreadCount(count);
  }, []);

  useEffect(() => {
    fetchDbUnread();
    if (!activeWorkspaceId) fetchLegacyUnread();
    const iv = setInterval(fetchDbUnread, 30_000);
    return () => clearInterval(iv);
  }, [fetchDbUnread, fetchLegacyUnread, activeWorkspaceId]);

  const [refreshKey, setRefreshKey] = useState(0);
  const aiCats = useMemo(
    () => readAiCategories(activeWorkspaceId),
    [activeWorkspaceId, refreshKey],
  );

  const actionRequiredCount = useMemo(() => {
    return Object.values(aiCats).filter((e) => e.requires_action).length;
  }, [aiCats]);

  const labelMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    const LABEL_STYLES: Record<string, string> = {
      IMPORTANT: "bg-amber-500/20 text-amber-400",
      STARRED: "bg-yellow-500/20 text-yellow-400",
      CATEGORY_PERSONAL: "bg-blue-500/20 text-blue-400",
      CATEGORY_SOCIAL: "bg-green-500/20 text-green-400",
      CATEGORY_PROMOTIONS: "bg-purple-500/20 text-purple-400",
      CATEGORY_UPDATES: "bg-cyan-500/20 text-cyan-400",
      CATEGORY_FORUMS: "bg-orange-500/20 text-orange-400",
    };
    if (gmailLabels && gmailLabels.length > 0) {
      for (const l of gmailLabels) {
        if (
          l.id &&
          l.name &&
          !["INBOX", "SENT", "DRAFT", "TRASH", "SPAM", "UNREAD", "CHAT"].includes(l.id)
        ) {
          map.set(l.id, {
            name: l.name.replace("CATEGORY_", "").toLowerCase(),
            color: LABEL_STYLES[l.id] || "bg-foreground/10 text-foreground/70",
          });
        }
      }
    }
    return map;
  }, [gmailLabels]);

  // isDemoMode already declared at top of component

  const emails = useMemo(() => {
    if (isDemoMode) {
      return DEMO_EMAILS.map((e) => ({
        ...e,
        dateObj: new Date(),
        starred: false,
        body: e.body,
        labels: [] as { name: string; color: string }[],
        hasAttachment: false,
      }));
    }
    // Composio takes priority
    if (composioGmailConnected && composioEmails.length > 0) {
      return composioEmails.map((m: any, i: number) => {
        const dateStr = m.date || "";
        const dateObj = dateStr ? new Date(dateStr) : new Date();
        const time = !isNaN(dateObj.getTime())
          ? dateObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
          : "";
        const labelIds = Array.isArray(m.labelIds) ? m.labelIds : [];
        return {
          id: i,
          from: m.from || "Desconhecido",
          fromEmail: m.fromEmail || "",
          subject: m.subject || "Sem assunto",
          time,
          dateObj,
          read: m.is_read ?? !labelIds.includes("UNREAD"),
          starred: labelIds.includes("STARRED"),
          body: (m.body || "").substring(0, 200),
          labels: [] as { name: string; color: string }[],
          gmailId: m.id || String(i),
          hasAttachment: m.has_attachment || false,
        };
      });
    }
    if (useLegacyGmail && googleMessages.length > 0) {
      return googleMessages.slice(0, 12).map((m: any, i: number) => {
        const headers = m.payload?.headers || [];
        const fromHeader = headers.find((h: any) => h.name === "From")?.value || "";
        const subjectHeader =
          headers.find((h: any) => h.name === "Subject")?.value || "Sem assunto";
        const dateHeader = headers.find((h: any) => h.name === "Date")?.value || "";
        const fromName = fromHeader.replace(/<.*>/, "").trim() || "Desconhecido";
        const fromEmail = (fromHeader.match(/<(.+)>/) || [])[1] || fromHeader;
        const time = dateHeader
          ? new Date(dateHeader).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
          : "";
        const dateObj = dateHeader ? new Date(dateHeader) : new Date();
        const isRead = !(m.labelIds || []).includes("UNREAD");
        const isStarred = (m.labelIds || []).includes("STARRED");
        const emailLabels = (m.labelIds || [])
          .filter((id: string) => labelMap.has(id))
          .map((id: string) => labelMap.get(id)!);
        const hasAttachment = (m.payload?.parts || []).some(
          (p: any) => p.filename && p.filename.length > 0,
        );
        return {
          id: i,
          from: fromName,
          fromEmail,
          subject: subjectHeader,
          time,
          dateObj,
          read: isRead,
          starred: isStarred,
          body: m.snippet || "",
          labels: emailLabels,
          gmailId: m.id || "",
          hasAttachment,
        };
      });
    }
    return [];
  }, [
    isDemoMode,
    composioGmailConnected,
    composioEmails,
    useLegacyGmail,
    googleMessages,
    labelMap,
  ]);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [popupFilter, setPopupFilter] = useState<"all" | "unread" | "starred" | "action">("all");

  const sortedEmails = useMemo(() => {
    return [...emails].sort((a, b) => {
      const aCat = aiCats[a.gmailId];
      const bCat = aiCats[b.gmailId];
      const aUrgent = aCat?.requires_action || aCat?.category === "urgente" ? 1 : 0;
      const bUrgent = bCat?.requires_action || bCat?.category === "urgente" ? 1 : 0;
      if (aUrgent !== bUrgent) return bUrgent - aUrgent;
      if (a.read !== b.read) return a.read ? 1 : -1;
      return 0;
    });
  }, [emails, aiCats]);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleRefresh = useCallback(async () => {
    if (composioGmailConnected) {
      setComposioEmails([]);
      setComposioRefreshKey((k) => k + 1);
    } else {
      gmailRefetch?.();
    }
    await fetchDbUnread();
    setRefreshKey((k) => k + 1);
  }, [composioGmailConnected, gmailRefetch, fetchDbUnread]);

  const unreadCount = emails.filter((e) => !e.read).length;

  // ─── Quick action handlers ──────────────────────────────────
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});
  const [aiReplyFor, setAiReplyFor] = useState<string | null>(null);
  const [aiReplyText, setAiReplyText] = useState("");
  const [aiReplyLoading, setAiReplyLoading] = useState(false);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  const setLoading = (gmailId: string, action: string) =>
    setActionLoading((p) => ({ ...p, [gmailId]: action }));
  const clearLoading = (gmailId: string) =>
    setActionLoading((p) => {
      const n = { ...p };
      delete n[gmailId];
      return n;
    });

  const handlePopupDelete = useCallback(
    async (gmailId: string) => {
      if (!isConnectedRaw || !gmailId) return;
      setLoading(gmailId, "delete");
      try {
        await gmail.moveToTrash(gmailId);
        setRemovedIds((p) => new Set(p).add(gmailId));
        toast({ title: "E-mail movido para a lixeira" });
        handleRefresh();
      } catch {
        toast({ title: "Erro ao excluir", variant: "destructive" });
      } finally {
        clearLoading(gmailId);
      }
    },
    [isConnectedRaw, gmail, handleRefresh],
  );

  const handlePopupArchive = useCallback(
    async (gmailId: string) => {
      if (!isConnectedRaw || !gmailId) return;
      setLoading(gmailId, "archive");
      try {
        await gmail.modifyLabels({ message_id: gmailId, removeLabelIds: ["INBOX"] });
        setRemovedIds((p) => new Set(p).add(gmailId));
        toast({ title: "E-mail arquivado" });
        handleRefresh();
      } catch {
        toast({ title: "Erro ao arquivar", variant: "destructive" });
      } finally {
        clearLoading(gmailId);
      }
    },
    [isConnectedRaw, gmail, handleRefresh],
  );

  const handlePopupToggleRead = useCallback(
    async (gmailId: string, isRead: boolean) => {
      if (!isConnectedRaw || !gmailId) return;
      setLoading(gmailId, "read");
      try {
        await gmail.modifyLabels(
          isRead
            ? { message_id: gmailId, addLabelIds: ["UNREAD"] }
            : { message_id: gmailId, removeLabelIds: ["UNREAD"] },
        );
        toast({ title: isRead ? "Marcado como não lido" : "Marcado como lido" });
        handleRefresh();
      } catch {
        toast({ title: "Erro", variant: "destructive" });
      } finally {
        clearLoading(gmailId);
      }
    },
    [isConnectedRaw, gmail, handleRefresh],
  );

  const handlePopupStar = useCallback(
    async (gmailId: string, isStarred: boolean) => {
      if (!isConnectedRaw || !gmailId) return;
      setLoading(gmailId, "star");
      try {
        await gmail.modifyLabels(
          isStarred
            ? { message_id: gmailId, removeLabelIds: ["STARRED"] }
            : { message_id: gmailId, addLabelIds: ["STARRED"] },
        );
        toast({ title: isStarred ? "Estrela removida" : "Marcado com estrela" });
        handleRefresh();
      } catch {
        toast({ title: "Erro", variant: "destructive" });
      } finally {
        clearLoading(gmailId);
      }
    },
    [isConnectedRaw, gmail, handleRefresh],
  );

  const handleAiReply = useCallback(async (email: (typeof sortedEmails)[0]) => {
    void email;
    setAiReplyFor(email.gmailId);
    setAiReplyText("");
    setAiReplyLoading(false);
    notifyAiShortcutPending("Resposta por IA indisponível");
    setAiReplyFor(null);
  }, []);

  const handleSendAiReply = useCallback(
    async (email: (typeof sortedEmails)[0]) => {
      if (!aiReplyText.trim() || !isConnectedRaw) return;
      setAiReplyLoading(true);
      try {
        await gmail.sendEmail({
          recipient_email: email.fromEmail,
          subject: `Re: ${email.subject}`,
          body: aiReplyText,
        });
        toast({ title: "Resposta enviada!" });
        setAiReplyFor(null);
        setAiReplyText("");
        handleRefresh();
      } catch {
        toast({ title: "Erro ao enviar resposta", variant: "destructive" });
      } finally {
        setAiReplyLoading(false);
      }
    },
    [aiReplyText, isConnectedRaw, gmail, handleRefresh],
  );

  // === AI Summary ===
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const aiSummaryCacheRef = useRef<{ key: string; text: string; ts: number } | null>(null);

  const generateAiSummary = useCallback(async () => {
    const key = emails.map((e) => e.gmailId).join("|");
    if (
      aiSummaryCacheRef.current?.key === key &&
      Date.now() - aiSummaryCacheRef.current.ts < 5 * 60 * 1000
    ) {
      setAiSummary(aiSummaryCacheRef.current.text);
      return;
    }
    if (emails.length === 0) {
      setAiSummary("Nenhum e-mail para analisar.");
      return;
    }
    setAiSummaryLoading(true);
    notifyAiShortcutPending("Resumo de e-mails indisponível");
    setAiSummary("ai_shortcut_pending_hermes_tools");
    setAiSummaryLoading(false);
  }, [emails]);

  // === Stats ===
  const stats = useMemo(() => {
    const total = emails.length;
    const unread = emails.filter((e) => !e.read).length;
    const starred = emails.filter((e) => e.starred).length;
    const withAttachment = emails.filter((e) => e.hasAttachment).length;
    const catCounts: Record<string, number> = {};
    for (const e of emails) {
      const cat = aiCats[e.gmailId]?.category;
      if (cat) catCounts[cat] = (catCounts[cat] || 0) + 1;
    }
    const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
    return { total, unread, starred, withAttachment, catCounts, topCat };
  }, [emails, aiCats]);

  // === Filtered emails for popup ===
  const popupEmails = useMemo(() => {
    let list = sortedEmails.filter((e) => !removedIds.has(e.gmailId));
    // Apply filter
    if (popupFilter === "unread") list = list.filter((e) => !e.read);
    else if (popupFilter === "starred") list = list.filter((e) => e.starred);
    else if (popupFilter === "action")
      list = list.filter((e) => aiCats[e.gmailId]?.requires_action);
    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          e.from.toLowerCase().includes(q) ||
          e.subject.toLowerCase().includes(q) ||
          e.body.toLowerCase().includes(q),
      );
    }
    return list;
  }, [sortedEmails, removedIds, popupFilter, searchQuery, aiCats]);

  // === Email row for popup ===
  const PopupEmailRow = ({ e }: { e: (typeof emails)[0] }) => {
    const cat = aiCats[e.gmailId];
    const catStyle = cat?.category ? AI_CAT_STYLES[cat.category] : null;
    const loading = actionLoading[e.gmailId];
    const isAiReplyOpen = aiReplyFor === e.gmailId;

    return (
      <motion.div
        key={e.gmailId || e.id}
        layout
        exit={{ opacity: 0, x: -20, height: 0 }}
        transition={{ duration: 0.2 }}
        className={`rounded-xl p-3 transition-colors ${e.read ? "bg-foreground/5 hover:bg-foreground/8" : "bg-primary/5 hover:bg-primary/8 border border-primary/10"}`}
      >
        <div className="flex items-start gap-3">
          <AvatarCircle name={e.from} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <p
                  className={`text-sm truncate ${e.read ? "text-foreground/70" : "font-semibold text-foreground"}`}
                >
                  {e.from}
                </p>
                {e.starred && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 shrink-0" />}
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">{e.time}</span>
            </div>
            <p
              className={`text-xs mt-0.5 truncate ${e.read ? "text-muted-foreground" : "text-foreground/80 font-medium"}`}
            >
              {e.subject}
            </p>
            {e.body && (
              <p className="text-[11px] text-foreground/40 mt-1 line-clamp-2 leading-relaxed">
                {e.body}
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {!e.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
              {e.hasAttachment && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-foreground/10 text-foreground/60 flex items-center gap-0.5">
                  <FileText className="w-2.5 h-2.5" />
                  Anexo
                </span>
              )}
              {catStyle && (
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium border ${catStyle.badge}`}
                >
                  {catStyle.label}
                </span>
              )}
              {cat?.requires_action && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20 font-medium flex items-center gap-0.5">
                  <Zap className="w-2.5 h-2.5" />
                  Ação
                </span>
              )}
              {e.labels?.map((l, li) => (
                <span
                  key={li}
                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium capitalize ${l.color}`}
                >
                  {l.name}
                </span>
              ))}
            </div>

            {/* Quick actions */}
            {googleConnected && e.gmailId && (
              <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/20">
                <button
                  onClick={() => handlePopupArchive(e.gmailId)}
                  disabled={!!loading}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-foreground/5 hover:bg-foreground/10 text-foreground/60 hover:text-foreground transition-colors disabled:opacity-50"
                  title="Arquivar"
                >
                  {loading === "archive" ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Archive className="w-3 h-3" />
                  )}{" "}
                  Arquivar
                </button>
                <button
                  onClick={() => handlePopupDelete(e.gmailId)}
                  disabled={!!loading}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-foreground/5 hover:bg-destructive/15 text-foreground/60 hover:text-destructive transition-colors disabled:opacity-50"
                  title="Excluir"
                >
                  {loading === "delete" ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}{" "}
                  Excluir
                </button>
                <button
                  onClick={() => handlePopupToggleRead(e.gmailId, e.read)}
                  disabled={!!loading}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-foreground/5 hover:bg-foreground/10 text-foreground/60 hover:text-foreground transition-colors disabled:opacity-50"
                  title={e.read ? "Marcar não lido" : "Marcar lido"}
                >
                  {loading === "read" ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : e.read ? (
                    <Mail className="w-3 h-3" />
                  ) : (
                    <MailCheck className="w-3 h-3" />
                  )}
                  {e.read ? "Não lido" : "Lido"}
                </button>
                <button
                  onClick={() => handlePopupStar(e.gmailId, e.starred)}
                  disabled={!!loading}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-foreground/5 hover:bg-foreground/10 text-foreground/60 hover:text-foreground transition-colors disabled:opacity-50"
                  title="Estrela"
                >
                  {loading === "star" ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Star
                      className={`w-3 h-3 ${e.starred ? "fill-yellow-400 text-yellow-400" : ""}`}
                    />
                  )}
                </button>
                <button
                  onClick={() => handleAiReply(e)}
                  disabled={!!loading || aiReplyLoading}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-primary/10 hover:bg-primary/20 text-primary transition-colors disabled:opacity-50 ml-auto"
                  title="Responder com IA"
                >
                  <Sparkles className="w-3 h-3" /> Responder IA
                </button>
              </div>
            )}

            {/* AI Reply panel */}
            <AnimatePresence>
              {isAiReplyOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 overflow-hidden"
                >
                  <div className="rounded-lg border border-primary/15 bg-primary/5 p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-primary flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Resposta sugerida pela IA
                      </span>
                      <button
                        onClick={() => setAiReplyFor(null)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    {aiReplyLoading ? (
                      <div className="flex items-center gap-2 py-3 justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span className="text-xs text-muted-foreground">Gerando resposta...</span>
                      </div>
                    ) : (
                      <>
                        <textarea
                          value={aiReplyText}
                          onChange={(ev) => setAiReplyText(ev.target.value)}
                          className="w-full text-xs bg-background/60 rounded-lg p-2 border border-border/30 resize-none min-h-[60px] focus:outline-none focus:ring-1 focus:ring-primary/30"
                          rows={3}
                        />
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => handleAiReply(e)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-foreground/5 hover:bg-foreground/10 text-foreground/60 transition-colors"
                          >
                            <RefreshCw className="w-3 h-3" /> Regenerar
                          </button>
                          <button
                            onClick={() => handleSendAiReply(e)}
                            disabled={!aiReplyText.trim()}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                          >
                            <Send className="w-3 h-3" /> Enviar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    );
  };

  // === POPUP CONTENT ===
  const popupContent = (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        <div className="p-2.5 rounded-xl bg-foreground/5 text-center">
          <p className="text-lg font-bold text-foreground">{stats.total}</p>
          <p className="text-[10px] text-muted-foreground">Total</p>
        </div>
        <div className="p-2.5 rounded-xl bg-foreground/5 text-center">
          <p className="text-lg font-bold text-primary">{stats.unread}</p>
          <p className="text-[10px] text-muted-foreground">Não lidos</p>
        </div>
        <div className="p-2.5 rounded-xl bg-foreground/5 text-center">
          <p className="text-lg font-bold text-yellow-400">{stats.starred}</p>
          <p className="text-[10px] text-muted-foreground">Com estrela</p>
        </div>
        <div className="p-2.5 rounded-xl bg-foreground/5 text-center">
          <p className="text-lg font-bold text-foreground">{actionRequiredCount}</p>
          <p className="text-[10px] text-muted-foreground">Ações</p>
        </div>
      </div>

      {/* AI Summary */}
      <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Resumo IA
          </span>
          <button
            onClick={generateAiSummary}
            disabled={aiSummaryLoading}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-primary/15 text-primary font-medium hover:bg-primary/25 transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {aiSummaryLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Zap className="w-3 h-3" />
            )}
            {aiSummaryLoading ? "Analisando..." : aiSummary ? "Atualizar" : "Gerar"}
          </button>
        </div>
        {aiSummary ? (
          <p className="text-xs text-foreground/80 leading-relaxed">{aiSummary}</p>
        ) : (
          <p className="text-xs text-muted-foreground/60 italic">
            Clique para um resumo inteligente dos seus e-mails recentes.
          </p>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="inbox" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-8">
          <TabsTrigger value="inbox" className="text-[11px] gap-1">
            <Inbox className="w-3 h-3" />
            Caixa
          </TabsTrigger>
          <TabsTrigger value="categories" className="text-[11px] gap-1">
            <Tag className="w-3 h-3" />
            Categorias
          </TabsTrigger>
          <TabsTrigger value="insights" className="text-[11px] gap-1">
            <BarChart3 className="w-3 h-3" />
            Insights
          </TabsTrigger>
        </TabsList>

        {/* Inbox Tab */}
        <TabsContent value="inbox" className="space-y-3 mt-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar remetente, assunto..."
              className="w-full bg-foreground/5 rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>

          {/* Filter chips */}
          <div className="flex gap-1">
            {(
              [
                ["all", `Todos (${stats.total})`],
                ["unread", `Não lidos (${stats.unread})`],
                ["starred", `Estrela (${stats.starred})`],
                ["action", `Ações (${actionRequiredCount})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPopupFilter(key as any)}
                className={`text-[10px] px-2.5 py-0.5 rounded-full font-medium transition-colors ${popupFilter === key ? "bg-primary/20 text-primary" : "bg-foreground/5 text-muted-foreground hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Email list */}
          <div className="space-y-2 max-h-[320px] overflow-y-auto scrollbar-thin">
            <AnimatePresence>
              {popupEmails.map((e) => (
                <PopupEmailRow key={e.gmailId || e.id} e={e} />
              ))}
            </AnimatePresence>
            {popupEmails.length === 0 && (
              <p className="text-xs text-muted-foreground/60 italic text-center py-6">
                {searchQuery ? "Nenhum resultado" : "Nenhum e-mail"}
              </p>
            )}
          </div>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-3 mt-3">
          {Object.entries(stats.catCounts).length > 0 ? (
            Object.entries(stats.catCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, count]) => {
                const style = AI_CAT_STYLES[cat];
                if (!style) return null;
                const catEmails = emails.filter((e) => aiCats[e.gmailId]?.category === cat);
                return (
                  <div key={cat} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-medium flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${style.badge}`}
                      >
                        {style.label}
                      </span>
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                        {count}
                      </Badge>
                    </div>
                    {catEmails.slice(0, 3).map((e) => (
                      <div
                        key={e.gmailId || e.id}
                        className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-foreground/5 transition-colors"
                      >
                        <AvatarCircle name={e.from} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground/80 truncate">
                            {e.from}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">{e.subject}</p>
                        </div>
                        <span className="text-[9px] text-muted-foreground shrink-0">{e.time}</span>
                      </div>
                    ))}
                  </div>
                );
              })
          ) : (
            <div className="text-center py-8">
              <Tag className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground/60">
                Categorias IA aparecerão após a classificação automática dos e-mails.
              </p>
            </div>
          )}
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-3 mt-3">
          {/* Category distribution */}
          {Object.entries(stats.catCounts).length > 0 && (
            <div className="p-3 rounded-xl bg-foreground/5">
              <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-primary" /> Distribuição por categoria
              </p>
              <div className="flex items-end gap-1.5 h-16">
                {Object.entries(stats.catCounts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([cat, count]) => {
                    const style = AI_CAT_STYLES[cat];
                    const max = Math.max(...Object.values(stats.catCounts), 1);
                    const height = Math.max((count / max) * 100, 10);
                    return (
                      <div key={cat} className="flex-1 flex flex-col items-center gap-0.5">
                        <span className="text-[9px] text-muted-foreground/70 tabular-nums">
                          {count}
                        </span>
                        <div
                          className={`w-full rounded-t-sm transition-all ${style?.badge?.split(" ")[0] || "bg-foreground/10"}`}
                          style={{ height: `${height}%` }}
                        />
                        <span className="text-[7px] text-muted-foreground/60 truncate w-full text-center">
                          {style?.label || cat}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Quick insights */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-foreground/5">
              <TrendingUp className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="text-xs font-medium text-foreground">Taxa de leitura</p>
                <p className="text-[10px] text-muted-foreground">
                  {stats.total > 0
                    ? Math.round(((stats.total - stats.unread) / stats.total) * 100)
                    : 0}
                  % dos e-mails lidos
                </p>
              </div>
            </div>
            {stats.topCat && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-foreground/5">
                <Tag className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">Categoria principal</p>
                  <p className="text-[10px] text-muted-foreground">
                    {AI_CAT_STYLES[stats.topCat[0]]?.label || stats.topCat[0]} ({stats.topCat[1]}{" "}
                    e-mails)
                  </p>
                </div>
              </div>
            )}
            {actionRequiredCount > 0 && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-orange-500/5 border border-orange-500/10">
                <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">Atenção</p>
                  <p className="text-[10px] text-muted-foreground">
                    {actionRequiredCount} e-mail{actionRequiredCount > 1 ? "s" : ""} requer
                    {actionRequiredCount > 1 ? "em" : ""} ação
                  </p>
                </div>
              </div>
            )}
            {stats.withAttachment > 0 && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-foreground/5">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">Anexos</p>
                  <p className="text-[10px] text-muted-foreground">
                    {stats.withAttachment} e-mail{stats.withAttachment > 1 ? "s" : ""} com anexo
                  </p>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => navigate("/email")}
            className="w-full py-2 rounded-lg bg-foreground/5 text-xs text-muted-foreground hover:text-primary hover:bg-foreground/10 transition-colors flex items-center justify-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Abrir caixa de entrada{" "}
            <ChevronRight className="w-3 h-3" />
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
            label="E-mails"
            icon={<Mail className="w-3.5 h-3.5 text-primary" />}
            popupIcon={<Mail className="w-5 h-5 text-primary" />}
            popupContent={popupContent}
          />
          <ConnectionBadge
            isConnected={isConnected}
            isLoading={isLoading}
            sourceCount={sourceCount}
            sourceNames={sourceNames}
          />
        </div>
        <div className="flex items-center gap-1.5">
          {unreadCount > 0 && (
            <button
              onClick={() => navigate("/email?filter=unread")}
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20 tabular-nums hover:bg-primary/25 transition-colors cursor-pointer"
              title={`${unreadCount} não lidos`}
            >
              {unreadCount}
            </button>
          )}
          {googleConnected && (
            <GoogleSyncTimestamp
              lastSyncedAt={gmailLastSync}
              onRefresh={handleRefresh}
              isLoading={googleLoading}
            />
          )}
          {!googleConnected && isConnected && (
            <DeshTooltip label="Atualizar">
              <button
                onClick={handleRefresh}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </DeshTooltip>
          )}
          <DeshTooltip label="Abrir caixa de entrada">
            <button
              onClick={() => navigate("/email")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </DeshTooltip>
        </div>
      </div>

      {gmailNeedsScope && <ScopeRequestBanner service="gmail" onRequest={gmailRequestScope} />}

      {/* Mini stats bar */}
      {isConnected && emails.length > 0 && (
        <div className="flex items-center gap-3 mb-1.5 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <Inbox className="w-3 h-3" />
            {stats.total}
          </span>
          {stats.unread > 0 && (
            <span className="flex items-center gap-0.5 text-primary font-medium">
              <Mail className="w-3 h-3" />
              {stats.unread} não lidos
            </span>
          )}
          {stats.starred > 0 && (
            <span className="flex items-center gap-0.5">
              <Star className="w-3 h-3 text-yellow-400" />
              {stats.starred}
            </span>
          )}
          {stats.topCat && (
            <span className="flex items-center gap-0.5 ml-auto">
              <Tag className="w-3 h-3" />
              {AI_CAT_STYLES[stats.topCat[0]]?.label}
            </span>
          )}
        </div>
      )}

      {actionRequiredCount > 0 && (
        <motion.button
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => navigate("/email?filter=requires_action")}
          className="w-full flex items-center justify-between px-2.5 py-1.5 mb-2 rounded-lg bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/15 transition-colors shrink-0"
        >
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-orange-400">
            <Zap className="w-3 h-3" /> Ações necessárias
          </span>
          <span className="text-[11px] font-bold text-orange-400">{actionRequiredCount}</span>
        </motion.button>
      )}

      {!isConnected ? (
        <WidgetEmptyState
          icon={Mail}
          title="Nenhum e-mail"
          description="Conecte sua conta para ver seus e-mails"
          connectTo="/integrations"
          connectLabel="Conectar e-mail"
        />
      ) : (
        <div className="space-y-0.5 flex-1 overflow-y-auto min-h-0 scrollbar-thin">
          {sortedEmails.map((e, i) => {
            const cat = aiCats[e.gmailId];
            const catStyle = cat?.category ? AI_CAT_STYLES[cat.category] : null;
            const isUrgent = cat?.requires_action || cat?.category === "urgente";

            return (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="group"
              >
                <div
                  className={`flex items-start gap-2 p-2 rounded-lg transition-colors cursor-pointer ${
                    expandedId === e.id ? "bg-foreground/5" : "hover:bg-foreground/5"
                  }`}
                  onClick={() => toggleExpand(e.id)}
                >
                  <AvatarCircle name={e.from} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 min-w-0">
                        {isUrgent && <Zap className="w-3 h-3 text-orange-400 shrink-0" />}
                        <p
                          className={`text-sm truncate ${e.read ? "text-muted-foreground" : "font-medium text-foreground"}`}
                        >
                          {e.from}
                        </p>
                        {e.starred && (
                          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{e.time}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <p className="text-xs text-muted-foreground truncate flex-1">{e.subject}</p>
                      {e.hasAttachment && (
                        <FileText className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                      )}
                      {catStyle && (
                        <span
                          className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium border shrink-0 ${catStyle.badge}`}
                        >
                          {catStyle.label}
                        </span>
                      )}
                      {e.labels?.slice(0, 1).map((l, li) => (
                        <span
                          key={li}
                          className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium capitalize shrink-0 ${l.color}`}
                        >
                          {l.name}
                        </span>
                      ))}
                    </div>
                    {expandedId !== e.id && e.body && (
                      <p className="text-[10px] text-foreground/40 mt-0.5 line-clamp-1 leading-relaxed">
                        {e.body}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0 mt-1">
                    {expandedId === e.id ? (
                      <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </div>

                {expandedId === e.id && (
                  <div className="pl-11 pr-2 pb-2 animate-fade-in">
                    <p className="text-xs text-foreground/70 leading-relaxed mb-2">{e.body}</p>
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        onClick={() => navigate("/email")}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        <Reply className="w-3 h-3" /> Responder
                      </button>
                      {googleConnected && e.gmailId && (
                        <>
                          <button
                            onClick={() => handlePopupArchive(e.gmailId)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-foreground/5 text-foreground/60 hover:bg-foreground/10 transition-colors"
                          >
                            <Archive className="w-3 h-3" /> Arquivar
                          </button>
                          <button
                            onClick={() => handlePopupStar(e.gmailId, e.starred)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-foreground/5 text-foreground/60 hover:bg-foreground/10 transition-colors"
                          >
                            <Star
                              className={`w-3 h-3 ${e.starred ? "fill-yellow-400 text-yellow-400" : ""}`}
                            />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
          {emails.length === 0 && (
            <WidgetEmptyState
              icon={Mail}
              title="Nenhum e-mail"
              description="Seus e-mails aparecerão aqui"
            />
          )}
        </div>
      )}
    </GlassCard>
  );
};

export default React.memo(EmailWidget);

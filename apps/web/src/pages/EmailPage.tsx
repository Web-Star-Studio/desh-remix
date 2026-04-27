import type { ComposioEmail, GmailHeader, GmailLabel, GmailMessagePart } from "@/types/composio";
import { useComposioConnection } from "@/hooks/integrations/useComposioConnection";
import { useConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useConnections } from "@/contexts/ConnectionsContext";
// useGoogleServiceData removed — dead code path (useLegacyGmail always false)
import { useGmailSync } from "@/hooks/email/useGmailSync";
import { usePersistedWidget } from "@/hooks/ui/usePersistedWidget";
import { useEmailTemplates } from "@/hooks/email/useEmailTemplates";
import { useEmailBatchActions } from "@/hooks/email/useEmailBatchActions";
import { useEmailSnooze } from "@/hooks/email/useEmailSnooze";
import { useEmailAI } from "@/hooks/email/useEmailAI";
import { useSmartUnsubscribe } from "@/hooks/email/useSmartUnsubscribe";
import { useWorkspaceFilter } from "@/hooks/workspace/useWorkspaceFilter";
import { apiFetch } from "@/lib/api-client";
import { useGmailActions, ComposioExecuteError } from "@/hooks/integrations/useGmailActions";
import { useComposioWorkspaceId } from "@/hooks/integrations/useComposioWorkspaceId";
import { useEmailActions } from "@/hooks/email/useEmailActions";
import { useEmailKeyboard } from "@/hooks/email/useEmailKeyboard";
import { useVisibilityRefresh } from "@/hooks/common/useVisibilityRefresh";
import ScopeRequestBanner from "@/components/dashboard/ScopeRequestBanner";
import PageLayout from "@/components/dashboard/PageLayout";
import PageHeader from "@/components/dashboard/PageHeader";
import GlassCard from "@/components/dashboard/GlassCard";
import ConnectionBadge from "@/components/dashboard/ConnectionBadge";
import AnimatedItem from "@/components/dashboard/AnimatedItem";

import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Mail,
  Trash2,
  Inbox,
  Send,
  FileText,
  Plus,
  Loader2,
  Sparkles,
  Menu,
  ChevronDown,
  RefreshCw,
  CalendarDays,
  FolderInput,
  MailX,
  FolderArchive,
  Brain,
  BarChart3,
  CheckSquare,
  MailMinus,
} from "lucide-react";
import { setEmailUnreadCount } from "@/stores/emailUnreadStore";
import { useState, useMemo, useCallback, useEffect, useRef, lazy, Suspense } from "react";
import type { ComposioEmailListResponse } from "@/types/composio";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";

// Core components (always needed)
import FoldersSidebar from "@/components/email/FoldersSidebar";
import EmailListItem from "@/components/email/EmailListItem";
import EmailReader from "@/components/email/EmailReader";
import ComposePanel from "@/components/email/ComposePanel";
import BatchActionsBar from "@/components/email/BatchActionsBar";
import EmailSearchBar from "@/components/email/EmailSearchBar";
import EmailEmptyState from "@/components/email/EmailEmptyState";
import EmailLoadingSkeleton from "@/components/email/EmailLoadingSkeleton";

// Lazy-loaded panels (loaded on demand)
const TemplateManager = lazy(() => import("@/components/email/TemplateManager"));
const DailySummaryPanel = lazy(() => import("@/components/email/DailySummaryPanel"));
const InboxIntelligencePanel = lazy(() => import("@/components/email/InboxIntelligencePanel"));
const InboxCleanerPanel = lazy(() => import("@/components/email/InboxCleanerPanel"));
const AutoOrganizePanel = lazy(() => import("@/components/email/AutoOrganizePanel"));
const SmartUnsubscribePanel = lazy(() => import("@/components/email/SmartUnsubscribePanel"));
const UnsubscribeStatsPanel = lazy(() => import("@/components/email/UnsubscribeStatsPanel"));
const GmailSyncPanel = lazy(() => import("@/components/email/GmailSyncPanel"));
const EmailStatsPanel = lazy(() => import("@/components/email/EmailStatsPanel"));
import {
  EmailFolder,
  EmailItem,
  EmailLabel,
  LabelColor,
  AI_CATEGORY_STYLES,
  DEFAULT_LABELS,
  LABEL_TO_AI_CATEGORY,
} from "@/components/email/types";

const SYSTEM_LABELS = new Set([
  "INBOX",
  "SENT",
  "DRAFT",
  "TRASH",
  "SPAM",
  "UNREAD",
  "CHAT",
  "STARRED",
]);
const GMAIL_LABEL_STYLES: Record<string, { color: LabelColor }> = {
  IMPORTANT: { color: "yellow" },
  CATEGORY_PERSONAL: { color: "blue" },
  CATEGORY_SOCIAL: { color: "green" },
  CATEGORY_PROMOTIONS: { color: "purple" },
  CATEGORY_UPDATES: { color: "blue" },
  CATEGORY_FORUMS: { color: "orange" },
};

const EmailPage = () => {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const { getConnectionByCategory } = useConnections();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [activeFolder, setActiveFolder] = useState<EmailFolder>("inbox");
  const [composioNotConnected, setComposioNotConnected] = useState(false);
  const GMAIL_LABEL_MAP: Record<EmailFolder, string> = {
    inbox: "INBOX",
    sent: "SENT",
    drafts: "DRAFT",
    trash: "TRASH",
    archive: "__ARCHIVE__",
    spam: "SPAM",
  };

  // Dead legacy hooks removed — useLegacyGmail is always false
  const gmailLoading = false;
  const gmailMessages: any[] = [];
  const gmailRefetch = useCallback(() => {}, []);
  const gmailLabelsRaw: any[] = [];

  // Composio-only: legacy path permanently disabled
  const { isConnected: isComposioConnected, loading: composioLoading } = useComposioConnection();
  const composioGmailConnected = isComposioConnected("gmail") && !composioNotConnected;
  const useLegacyGmail = false;
  const isConnected = composioGmailConnected;

  // Gmail sync (multi-account) + labels
  const {
    cachedEmails,
    isSyncing,
    isLoadingCache,
    progress: syncProgress,
    syncState: gmailSyncState,
    syncError,
    hasCache,
    hasMore: syncHasMore,
    syncCompleted,
    startSync,
    continueSync,
    stopSync,
    incrementalSync,
    deltaSync,
    loadCachedEmails,
    loadMoreEmails,
    loadEmailsByLabel,
    accountCount,
    accountInfoMap,
    updateEmailInCache,
    removeEmailsFromCache,
    clearSyncError,
    syncFolder,
    folderUnreadCounts,
    // Labels from cache
    gmailCachedLabels,
    labelsLoading: gmailLabelsLoading,
    createGmailLabel,
    renameGmailLabel,
    deleteGmailLabel,
    refreshGmailLabels,
    // Per-account sync info
    accountSyncInfo,
    // Folder sync statuses
    folderSyncStatuses,
  } = useGmailSync();

  // Merge cached labels with API labels as fallback
  const gmailLabels = useMemo(() => {
    if (gmailCachedLabels && gmailCachedLabels.length > 0) {
      return gmailCachedLabels;
    }
    if (!gmailLabelsRaw || gmailLabelsRaw.length === 0) return [];
    return gmailLabelsRaw
      .filter((l: GmailLabel) => l.id && l.name && !SYSTEM_LABELS.has(l.id))
      .map((l: GmailLabel) => ({
        id: `gmail:${l.id}`,
        gmailId: l.id as string,
        name: l.name
          .replace("CATEGORY_", "")
          .toLowerCase()
          .replace(/^\w/, (c: string) => c.toUpperCase()),
        color: (GMAIL_LABEL_STYLES[l.id]?.color || "blue") as LabelColor,
        messageCount: l.messagesTotal || 0,
      }));
  }, [gmailCachedLabels, gmailLabelsRaw]);

  const gmail = useGmailActions();
  const { activeWorkspaceId } = useWorkspaceFilter();
  const _composioWsId = useComposioWorkspaceId();

  useEffect(() => {
    setComposioNotConnected(false);
  }, [_composioWsId]);

  useEffect(() => {
    if (useLegacyGmail) syncFolder(activeFolder);
    if (isConnected) loadCachedEmails(activeFolder);
    if (composioGmailConnected) {
      composioFetchedRef.current = false;
    }
  }, [
    activeFolder,
    useLegacyGmail,
    isConnected,
    composioGmailConnected,
    loadCachedEmails,
    syncFolder,
  ]);

  // Composio-only Gmail: fetch emails via /composio/execute (background refresh)
  const [composioEmails, setComposioEmails] = useState<ComposioEmail[]>([]);
  const [composioEmailsLoading, setComposioEmailsLoading] = useState(false);
  const composioFetchedRef = useRef(false);
  const isBackgroundRefreshing =
    isLoadingCache && (cachedEmails.length > 0 || composioEmails.length > 0);

  useEffect(() => {
    if (!composioGmailConnected || composioFetchedRef.current) return;
    composioFetchedRef.current = true;
    setComposioEmailsLoading(cachedEmails.length === 0);
    gmail
      .fetchEmails<ComposioEmailListResponse>({ max_results: 50, label_ids: ["INBOX"] })
      .then((data) => {
        if (!data?.messages) {
          setComposioEmailsLoading(false);
          return;
        }
        setComposioNotConnected(false);
        const validEmails = data.messages.slice(0, 50).filter(Boolean);
        setComposioEmails(validEmails);
        setComposioEmailsLoading(false);
      })
      .catch((err) => {
        if (err instanceof ComposioExecuteError && err.code === "not_connected") {
          setComposioNotConnected(true);
          setComposioEmails([]);
        }
        setComposioEmailsLoading(false);
      });
  }, [composioGmailConnected, gmail, _composioWsId, cachedEmails.length]);

  const isSending = false;

  const [localEmails, setLocalEmails] = useState<EmailItem[]>([]);

  // Extracted hooks
  const templateHook = useEmailTemplates();
  const batchHook = useEmailBatchActions({
    gmailConnected: useLegacyGmail,
    isConnected,
    gmailRefetch,
    setLocalEmails: setLocalEmails as any,
    confirm,
  });
  const snoozeHook = useEmailSnooze(useLegacyGmail);
  const aiHook = useEmailAI();
  const unsubHook = useSmartUnsubscribe();

  // Email data — memoized to avoid recalculating on every render
  // --- Improved Composio email metadata parsing ---
  /** Parse a raw Composio email into the app's EmailItem format */
  const parseComposioEmail = useCallback(
    (m: ComposioEmail, i: number): EmailItem => {
      const msgId = m.messageId || m.id || String(i);
      const msgText = m.messageText || m.snippet || "";
      const labelIds = m.labelIds || [];

      // Extract from: try structured fields first, then parse messageText header
      let rawFrom = m.from || m.sender || "";
      if (!rawFrom && msgText) {
        // Try "From: Name <email>" pattern in first lines
        const fromMatch = msgText.match(/^From:\s*(.+)/im);
        if (fromMatch) rawFrom = fromMatch[1].trim();
        else {
          // First non-empty line is often the sender name
          const firstLine = msgText.split("\n").find((l: string) => l.trim());
          if (firstLine && firstLine.length < 80 && !firstLine.includes("<!DOCTYPE")) {
            rawFrom = firstLine.trim();
          }
        }
      }

      // Parse name vs email from "Name <email>" format
      const emailMatch = rawFrom.match(/<(.+?)>/);
      const fromName = rawFrom
        ? rawFrom
            .replace(/<[^>]+>/g, "")
            .replace(/^["']|["']$/g, "")
            .trim() ||
          emailMatch?.[1] ||
          rawFrom
        : "Desconhecido";
      const fromEmail = emailMatch?.[1] || rawFrom || "";

      // Extract subject: try structured field, then messageText Subject: header, then first line
      let subject = m.subject || "";
      if (!subject && msgText) {
        const subjectMatch = msgText.match(/^Subject:\s*(.+)/im);
        if (subjectMatch) {
          subject = subjectMatch[1].trim();
        } else {
          const lines = msgText.split("\n").filter((l: string) => l.trim());
          // Skip lines that look like headers (From:, Date:, To:)
          const contentLine = lines.find(
            (l: string) => !/^(From|To|Date|Cc|Bcc|Reply-To|Content-Type):/i.test(l),
          );
          subject = contentLine?.trim()?.substring(0, 120) || "Sem assunto";
        }
      }
      if (!subject) subject = "Sem assunto";

      // Detect HTML body
      const isHtml =
        msgText.includes("<!DOCTYPE") || msgText.includes("<html") || msgText.includes("<div");
      // Body: for HTML keep full content; for plain text strip header-like lines
      let body = msgText;
      if (!isHtml && msgText) {
        const lines = msgText.split("\n");
        const bodyStartIdx = lines.findIndex((l: string) => l.trim() === "") + 1;
        if (bodyStartIdx > 0 && bodyStartIdx < lines.length) {
          body = lines.slice(bodyStartIdx).join("\n");
        }
      }

      const dateStr = m.date || m.receivedAt || m.internalDate || "";

      return {
        id: msgId,
        gmail_id: msgId,
        from: fromName,
        email: fromEmail,
        subject,
        body,
        date: dateStr,
        unread: labelIds.includes("UNREAD"),
        starred: labelIds.includes("STARRED"),
        hasAttachment: m.attachmentList?.length > 0,
        folder: activeFolder,
        labels: labelIds
          .filter((lid: string) => !SYSTEM_LABELS.has(lid))
          .map((lid: string) => `gmail:${lid}`),
      } as EmailItem;
    },
    [activeFolder],
  );

  const emails: EmailItem[] = useMemo(() => {
    // Composio live data takes priority
    if (composioGmailConnected && composioEmails.length > 0) {
      return composioEmails.map(parseComposioEmail);
    }
    // Cache-first: show apps/api Gmail cache while live data loads
    if (hasCache) return cachedEmails as EmailItem[];
    return localEmails;
  }, [
    hasCache,
    cachedEmails,
    localEmails,
    composioGmailConnected,
    composioEmails,
    parseComposioEmail,
  ]);

  const firstConnectionId = useMemo(() => {
    if (!useLegacyGmail) return undefined;
    const acctMap = accountInfoMap;
    return acctMap.size > 0 ? [...acctMap.keys()][0] : undefined;
  }, [useLegacyGmail, accountInfoMap]);

  const sendEmail = async (_data: any) => {
    /* stub — no unified */
  };
  const updateEmail = async (_id: string, _data: any) => {
    /* stub */
  };
  const removeEmail = async (_id: string) => {
    /* stub */
  };
  const handleComposioRefresh = useCallback(() => {
    composioFetchedRef.current = false;
    setComposioEmails([]);
    setComposioEmailsLoading(true);
    // Single batch call — no N+1 individual message fetches
    gmail
      .fetchEmails<ComposioEmailListResponse>({
        max_results: 50,
        label_ids: [GMAIL_LABEL_MAP[activeFolder] || "INBOX"],
      })
      .then((data) => {
        if (!data?.messages) {
          setComposioEmailsLoading(false);
          return;
        }
        setComposioEmails(data.messages.slice(0, 50).filter(Boolean));
        setComposioEmailsLoading(false);
      })
      .catch(() => setComposioEmailsLoading(false));
  }, [gmail, activeFolder]);

  const refetchEmails = () => {
    if (composioGmailConnected) handleComposioRefresh();
    else gmailRefetch();
  };

  const actionsHook = useEmailActions({
    gmailConnected: useLegacyGmail || composioGmailConnected,
    isConnected,
    emails,
    gmailRefetch,
    setLocalEmails,
    sendEmail,
    updateEmail,
    removeEmail,
    refetch: refetchEmails,
    confirm,
    updateEmailInCache,
    removeEmailsFromCache,
    activeConnectionId: firstConnectionId,
  });

  // Only show full loading when no cached data is available
  const hasCachedData = composioEmails.length > 0 || hasCache;
  const isLoading =
    !hasCachedData &&
    (gmailLoading ||
      isSending ||
      actionsHook.gmailSending ||
      batchHook.gmailSending ||
      isLoadingCache ||
      composioEmailsLoading);

  // Labels
  const {
    data: persistedLabels,
    save: saveLabels,
    loading: labelsLoading,
  } = usePersistedWidget<EmailLabel[]>({
    key: "email_labels",
    defaultValue: DEFAULT_LABELS,
    debounceMs: 500,
  });
  const [labels, setLabels] = useState<EmailLabel[]>(DEFAULT_LABELS);
  useEffect(() => {
    if (!labelsLoading && persistedLabels.length > 0) setLabels(persistedLabels);
  }, [labelsLoading]); // eslint-disable-line
  useEffect(() => {
    if (!labelsLoading) saveLabels(labels);
  }, [labels]); // eslint-disable-line

  const [filterLabel, setFilterLabel] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterAiCategory, setFilterAiCategory] = useState<string | null>(
    searchParams.get("category"),
  );
  const [filterRequiresAction, setFilterRequiresAction] = useState(
    searchParams.get("filter") === "requires_action",
  );
  const [filterUnread, setFilterUnread] = useState(searchParams.get("filter") === "unread");
  const [filterStarred, setFilterStarred] = useState(false);
  const [filterAccount, setFilterAccount] = useState<string | null>(null);

  // Cross-folder label filtering: load all emails with a Gmail label
  useEffect(() => {
    if (!useLegacyGmail || !hasCache || !filterLabel) return;
    if (filterLabel.startsWith("gmail:")) {
      const gmailLabelId = filterLabel.replace("gmail:", "");
      loadEmailsByLabel?.(gmailLabelId);
    }
  }, [filterLabel, useLegacyGmail, hasCache]); // eslint-disable-line

  // When label filter is cleared, reload current folder
  useEffect(() => {
    if (!useLegacyGmail || !hasCache) return;
    if (filterLabel === null) {
      loadCachedEmails(activeFolder);
    }
  }, [filterLabel]); // eslint-disable-line

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeCc, setComposeCc] = useState("");
  const [composeBcc, setComposeBcc] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [showReply, setShowReply] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [isReplyAll, setIsReplyAll] = useState(false);
  const [showForward, setShowForward] = useState(false);
  const [forwardTo, setForwardTo] = useState("");
  const [forwardNote, setForwardNote] = useState("");
  const [quickReplyText, setQuickReplyText] = useState("");
  const [autoOrganizeApplying, setAutoOrganizeApplying] = useState(false);
  const [showAutoOrganize, setShowAutoOrganize] = useState(false);
  const [organizeProgress, setOrganizeProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [showCleanerPanel, setShowCleanerPanel] = useState(false);
  const [cleanerDeleting, setCleanerDeleting] = useState(false);
  const [cleanProgress, setCleanProgress] = useState<{ current: number; total: number } | null>(
    null,
  );
  const [showStats, setShowStats] = useState(false);
  const [showUnsubStats, setShowUnsubStats] = useState(false);
  const [cleanerScanMode, setCleanerScanMode] = useState<"quick" | "deep" | "ultra">("quick");
  const [cleanerTotalScanned, setCleanerTotalScanned] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const scrollSentinelRef = useRef<HTMLDivElement | null>(null);
  const mobileScrollSentinelRef = useRef<HTMLDivElement | null>(null);

  // Infinite scroll observer
  useEffect(() => {
    if (!useLegacyGmail || !hasCache) return;
    const handleIntersect = async (entries: IntersectionObserverEntry[]) => {
      const entry = entries[0];
      if (entry?.isIntersecting && !isLoadingMore && !isLoadingCache) {
        setIsLoadingMore(true);
        await loadMoreEmails?.(activeFolder);
        setIsLoadingMore(false);
      }
    };
    const observer = new IntersectionObserver(handleIntersect, { rootMargin: "200px" });
    if (scrollSentinelRef.current) observer.observe(scrollSentinelRef.current);
    if (mobileScrollSentinelRef.current) observer.observe(mobileScrollSentinelRef.current);
    return () => observer.disconnect();
  }, [useLegacyGmail, hasCache, isLoadingMore, isLoadingCache, activeFolder, loadMoreEmails]);

  // Deep-link support
  useEffect(() => {
    const cat = searchParams.get("category");
    if (cat) {
      setFilterAiCategory(cat);
      setSearchParams(
        (prev) => {
          prev.delete("category");
          prev.delete("filter");
          return prev;
        },
        { replace: true },
      );
    }
    const composeParam = searchParams.get("compose");
    const toParam = searchParams.get("to");
    if (composeParam === "true") {
      setShowCompose(true);
      if (toParam) setComposeTo(decodeURIComponent(toParam));
      setSearchParams(
        (prev) => {
          prev.delete("compose");
          prev.delete("to");
          return prev;
        },
        { replace: true },
      );
    }
  }, []); // eslint-disable-line

  const selectedEmail = useMemo(
    () => emails.find((e) => e.id === selectedId),
    [emails, selectedId],
  );

  const resolveLabel = useCallback(
    (lid: string): { name: string; color: LabelColor } | null => {
      const local = labels.find((l) => l.id === lid);
      if (local) return local;
      const gl = gmailLabels.find((g: { id: string; name: string; color: string }) => g.id === lid);
      if (gl) return { name: gl.name, color: gl.color };
      return null;
    },
    [labels, gmailLabels],
  );

  const folderCounts = useMemo(
    () => ({
      inbox:
        folderUnreadCounts["inbox"] ??
        emails.filter((e) => e.folder === "inbox" && e.unread).length,
      sent: folderUnreadCounts["sent"] ?? emails.filter((e) => e.folder === "sent").length,
      drafts: folderUnreadCounts["drafts"] ?? emails.filter((e) => e.folder === "drafts").length,
      trash: folderUnreadCounts["trash"] ?? emails.filter((e) => e.folder === "trash").length,
    }),
    [emails, folderUnreadCounts],
  );

  const folderAiCounts = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};
    for (const email of emails) {
      const cat = aiHook.emailCategories[email.id]?.category;
      if (!cat || cat === "outro") continue;
      const folder = email.folder || "inbox";
      if (!result[folder]) result[folder] = {};
      result[folder][cat] = (result[folder][cat] || 0) + 1;
    }
    return result;
  }, [emails, aiHook.emailCategories]);

  const folderActionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const email of emails) {
      if (!aiHook.emailCategories[email.id]?.requires_action) continue;
      counts[email.folder] = (counts[email.folder] || 0) + 1;
    }
    return counts;
  }, [emails, aiHook.emailCategories]);

  const clearAllFilters = useCallback(() => {
    setFilterStarred(false);
    setFilterLabel(null);
    setFilterAiCategory(null);
    setFilterRequiresAction(false);
    setFilterUnread(false);
    setFilterAccount(null);
  }, []);
  const hasActiveFilter =
    filterStarred ||
    !!filterLabel ||
    !!filterAiCategory ||
    filterRequiresAction ||
    filterUnread ||
    !!filterAccount;

  const handleDropEmailOnLabel = useCallback(
    (emailId: string, labelId: string) => {
      const aiCat = LABEL_TO_AI_CATEGORY[labelId];
      if (aiCat) {
        aiHook.setEmailCategory(emailId, aiCat);
        const labelName = labels.find((l) => l.id === labelId)?.name || labelId;
        toast({ title: `E-mail movido para "${labelName}"` });
      } else if (isConnected && labelId.startsWith("gmail:")) {
        const gmailLabelId = labelId.replace("gmail:", "");
        actionsHook.moveToLabel(emailId, gmailLabelId, gmailLabelId);
      }
    },
    [aiHook, labels, isConnected, actionsHook],
  );

  const labelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    // Count Gmail native labels
    for (const e of emails) {
      if (e.labels)
        for (const lid of e.labels) {
          counts[lid] = (counts[lid] || 0) + 1;
        }
    }
    // Count AI-categorized emails for mapped default labels
    for (const label of labels) {
      const aiCat = LABEL_TO_AI_CATEGORY[label.id];
      if (!aiCat) continue;
      let count = 0;
      for (const e of emails) {
        if (aiHook.emailCategories[e.id]?.category === aiCat) count++;
      }
      counts[label.id] = (counts[label.id] || 0) + count;
    }
    return counts;
  }, [emails, labels, aiHook.emailCategories]);

  const availableAiCategories = useMemo(() => {
    const folderEmails = emails.filter((e) => e.folder === activeFolder);
    const counts: Record<string, number> = {};
    const unreadCounts: Record<string, number> = {};
    for (const e of folderEmails) {
      const cat = aiHook.emailCategories[e.id]?.category;
      if (cat && cat !== "outro") {
        counts[cat] = (counts[cat] || 0) + 1;
        if (e.unread) unreadCounts[cat] = (unreadCounts[cat] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => ({ cat, count, unreadCount: unreadCounts[cat] || 0 }));
  }, [emails, activeFolder, aiHook.emailCategories]);

  const filtered = useMemo(() => {
    // When filtering by Gmail label (cross-folder), show all loaded emails (already filtered by label from DB)
    const isGmailLabelFilter = filterLabel?.startsWith("gmail:");
    let result = isGmailLabelFilter ? [...emails] : emails.filter((e) => e.folder === activeFolder);
    if (filterStarred) result = result.filter((e) => e.starred);
    if (filterLabel && !isGmailLabelFilter) {
      const aiCat = LABEL_TO_AI_CATEGORY[filterLabel];
      if (aiCat) {
        result = result.filter((e) => aiHook.emailCategories[e.id]?.category === aiCat);
      } else {
        result = result.filter((e) => e.labels.includes(filterLabel));
      }
    }
    if (filterAiCategory)
      result = result.filter((e) => aiHook.emailCategories[e.id]?.category === filterAiCategory);
    if (filterRequiresAction)
      result = result.filter((e) => aiHook.emailCategories[e.id]?.requires_action === true);
    if (filterUnread) result = result.filter((e) => e.unread);
    if (filterAccount) result = result.filter((e) => e.connectionId === filterAccount);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.subject.toLowerCase().includes(q) ||
          e.from.toLowerCase().includes(q) ||
          e.body.toLowerCase().includes(q),
      );
    }
    return result;
  }, [
    emails,
    activeFolder,
    filterStarred,
    filterLabel,
    filterAiCategory,
    aiHook.emailCategories,
    searchQuery,
    filterRequiresAction,
    filterUnread,
    filterAccount,
  ]);

  // Auto-categorize
  useEffect(() => {
    const folderEmails = emails.filter((e) => e.folder === activeFolder);
    if (folderEmails.length === 0) return;
    const currentFolder = activeFolder;
    const timer = setTimeout(() => {
      if (currentFolder === activeFolder) aiHook.triggerAutoCategorize(folderEmails);
    }, 800);
    return () => clearTimeout(timer);
  }, [activeFolder, emails.length]); // eslint-disable-line

  // --- Actions wrappers ---
  const handleReply = useCallback(
    (email: EmailItem, replyAll = false) => {
      setShowReply(true);
      setShowForward(false);
      setIsReplyAll(replyAll);
      setReplyBody("");
      aiHook.setShowAiReplyOptions(false);
      aiHook.setAiReplyOptions(null);
    },
    [aiHook],
  );

  const handleSendReply = useCallback(async () => {
    if (!selectedEmail) return;
    const ok = await actionsHook.handleSendReply(selectedEmail, replyBody);
    if (ok) {
      setShowReply(false);
      setReplyBody("");
    }
  }, [selectedEmail, replyBody, actionsHook]);

  const handleForward = useCallback((_email: EmailItem) => {
    setShowForward(true);
    setShowReply(false);
    setForwardTo("");
    setForwardNote("");
  }, []);
  const parseEmails = (input: string) =>
    input
      .split(/[,;]\s*/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const forwardToErrors = forwardTo.trim()
    ? parseEmails(forwardTo).filter((e) => !isValidEmail(e))
    : [];
  const hasForwardErrors = forwardToErrors.length > 0;

  const handleSendForward = useCallback(async () => {
    if (!selectedEmail || hasForwardErrors) return;
    const ok = await actionsHook.handleSendForward(selectedEmail, forwardTo, forwardNote);
    if (ok) setShowForward(false);
  }, [selectedEmail, forwardTo, forwardNote, hasForwardErrors, actionsHook]);

  const handleDelete = useCallback(
    async (emailId: string) => {
      await actionsHook.handleDelete(emailId);
      setSelectedId(null);
    },
    [actionsHook],
  );

  const handleArchive = useCallback(
    async (emailId: string) => {
      await actionsHook.handleArchive(emailId);
      setSelectedId(null);
    },
    [actionsHook],
  );

  const handleQuickReply = useCallback(async () => {
    if (!selectedEmail) return;
    const ok = await actionsHook.handleQuickReply(selectedEmail, quickReplyText);
    if (ok) setQuickReplyText("");
  }, [selectedEmail, quickReplyText, actionsHook]);

  const selectEmail = useCallback(
    (id: string) => {
      if (batchHook.selectionMode) {
        batchHook.setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
        return;
      }
      setSelectedId(id);
      setShowReply(false);
      setShowForward(false);
      aiHook.setAiSummary(null);
      if (!isConnected)
        setLocalEmails((prev) => prev.map((e) => (e.id === id ? { ...e, unread: false } : e)));
      if (isConnected) actionsHook.fetchFullBody(id);
    },
    [isConnected, batchHook.selectionMode, actionsHook, aiHook],
  );

  const handleCompose = () => {
    setShowCompose(true);
    setComposeTo("");
    setComposeCc("");
    setComposeBcc("");
    setComposeSubject("");
    setComposeBody("");
  };

  // Keyboard navigation for email list
  useEmailKeyboard({
    emails: filtered,
    selectedId,
    setSelectedId: (id) => {
      if (id) selectEmail(id);
      else setSelectedId(null);
    },
    onArchive: handleArchive,
    onDelete: handleDelete,
    onToggleStar: actionsHook.toggleStar,
    onReply: () => {
      if (selectedEmail) handleReply(selectedEmail);
    },
    onCompose: handleCompose,
    isComposing: showCompose || showReply || showForward,
  });

  // Auto-refresh emails when user returns to tab after 1 min away
  useVisibilityRefresh({
    onRefresh: useCallback(() => {
      if (useLegacyGmail && hasCache) incrementalSync(activeFolder);
      if (composioGmailConnected) handleComposioRefresh();
    }, [
      useLegacyGmail,
      hasCache,
      incrementalSync,
      activeFolder,
      composioGmailConnected,
      handleComposioRefresh,
    ]),
    enabled: useLegacyGmail || composioGmailConnected,
    thresholdMs: 60_000,
  });

  // Sync unread count to global store for SideNav badge
  useEffect(() => {
    const unread = emails.filter((e) => e.unread).length;
    setEmailUnreadCount(unread);
    return () => setEmailUnreadCount(0);
  }, [emails]);

  const handleSendCompose = useCallback(async () => {
    const ok = await actionsHook.handleSendCompose(
      composeTo,
      composeSubject,
      composeBody,
      composeCc,
      composeBcc,
    );
    if (ok) setShowCompose(false);
  }, [composeTo, composeSubject, composeBody, composeCc, composeBcc, actionsHook]);

  const handleSaveDraft = useCallback(async () => {
    const ok = await actionsHook.handleSaveDraft(
      composeTo,
      composeSubject,
      composeBody,
      composeCc,
      composeBcc,
    );
    if (ok) setShowCompose(false);
  }, [composeTo, composeSubject, composeBody, composeCc, composeBcc, actionsHook]);

  // Quick unsubscribe + delete for a single open email
  const handleQuickUnsubscribe = useCallback(
    async (email: EmailItem) => {
      const ok = await confirm({
        title: `Descadastrar e excluir?`,
        description: `Descadastrar de "${email.from}" e mover este e-mail para a lixeira. Pressione Enter para confirmar.`,
        confirmLabel: "Descadastrar e Excluir",
        variant: "destructive",
      });
      if (!ok) return;

      toast({ title: "Processando descadastro…", description: email.from });

      try {
        // Fetch headers to find unsubscribe link
        const msgData = await gmail.fetchMessage<any>(email.id);

        let unsubUrl: string | null = null;
        let unsubMethod: "GET" | "POST" | "mailto" = "GET";
        let postBody: string | undefined;

        const headers = msgData?.result?.payload?.headers || msgData?.payload?.headers || [];
        const listUnsub = headers.find(
          (h: GmailHeader) => h.name?.toLowerCase() === "list-unsubscribe",
        )?.value;
        const listUnsubPost = headers.find(
          (h: GmailHeader) => h.name?.toLowerCase() === "list-unsubscribe-post",
        )?.value;

        if (listUnsub) {
          // Prefer HTTP URL
          const httpMatch = listUnsub.match(/<(https?:\/\/[^>]+)>/);
          if (httpMatch) {
            unsubUrl = httpMatch[1];
            const isOneClick = !!listUnsubPost?.includes("List-Unsubscribe=One-Click");
            unsubMethod = isOneClick ? "POST" : "GET";
            postBody = isOneClick ? "List-Unsubscribe=One-Click" : undefined;
          } else {
            // Fallback to mailto: if no HTTP URL
            const mailtoMatch = listUnsub.match(/<(mailto:[^>]+)>/);
            if (mailtoMatch) {
              unsubUrl = mailtoMatch[1];
              unsubMethod = "mailto";
            }
          }
        }

        // Fallback: fetch full body and parse HTML for unsub link
        if (!unsubUrl) {
          const fullData = await gmail.fetchMessage<any>(email.id);
          const payload = fullData?.result?.payload || fullData?.payload;
          if (payload) {
            // Extract HTML from parts recursively
            const getHtml = (p: GmailMessagePart): string => {
              if (p.mimeType === "text/html" && p.body?.data) {
                try {
                  return atob(p.body.data.replace(/-/g, "+").replace(/_/g, "/"));
                } catch {
                  return "";
                }
              }
              if (p.parts) {
                for (const sub of p.parts) {
                  const r = getHtml(sub);
                  if (r) return r;
                }
              }
              return "";
            };
            const htmlBody = getHtml(payload);
            if (htmlBody) {
              const regex = /href=["'](https?:\/\/[^"']*unsub[^"']*)/gi;
              const match = regex.exec(htmlBody);
              if (match) unsubUrl = match[1].replace(/^href=["']/, "");
            }
          }
        }

        // Single-email unsub uses the apps/api batch executor with one request.
        if (unsubUrl && activeWorkspaceId) {
          await apiFetch(`/workspaces/${activeWorkspaceId}/email-unsubscribe`, {
            method: "POST",
            body: JSON.stringify({
              requests: [
                {
                  url: unsubUrl,
                  method: unsubMethod,
                  postBody,
                  senderName: email.from,
                },
              ],
            }),
          });
        }

        // Delete (trash) the email directly – skip actionsHook.handleDelete to avoid a second confirmation
        removeEmailsFromCache?.([email.id]);
        await gmail.moveToTrash(email.id);
        setSelectedId(null);

        toast({
          title: unsubUrl
            ? "Descadastrado e excluído"
            : "Excluído (sem link de descadastro encontrado)",
          description: email.from,
        });
      } catch (err: any) {
        console.error("Quick unsubscribe error:", err);
        toast({ title: "Erro ao descadastrar", description: err?.message, variant: "destructive" });
      }
    },
    [confirm, gmail, actionsHook],
  );

  // Batch unsubscribe + delete for selected emails
  const handleBatchUnsubscribeAndDelete = useCallback(async () => {
    const ids = [...batchHook.selectedIds];
    if (ids.length === 0) return;

    const ok = await confirm({
      title: `Descadastrar e excluir ${ids.length} e-mail(s)?`,
      description: `Tentará descadastrar de cada remetente e mover os e-mails para a lixeira.`,
      confirmLabel: "Descadastrar e Excluir",
      variant: "destructive",
    });
    if (!ok) return;

    toast({ title: "Processando descadastro em lote…", description: `${ids.length} e-mail(s)` });

    let successCount = 0;
    const CONCURRENCY = 5;
    let idx = 0;

    const processEmail = async (emailId: string) => {
      try {
        // Pass 1: metadata headers
        const msgData = await gmail.fetchMessage<any>(emailId);

        let unsubUrl: string | null = null;
        let unsubMethod: "GET" | "POST" | "mailto" = "GET";
        let postBody: string | undefined;

        const headers = msgData?.result?.payload?.headers || msgData?.payload?.headers || [];
        const listUnsub = headers.find(
          (h: GmailHeader) => h.name?.toLowerCase() === "list-unsubscribe",
        )?.value;
        const listUnsubPost = headers.find(
          (h: GmailHeader) => h.name?.toLowerCase() === "list-unsubscribe-post",
        )?.value;

        if (listUnsub) {
          const httpMatch = listUnsub.match(/<(https?:\/\/[^>]+)>/);
          if (httpMatch) {
            unsubUrl = httpMatch[1];
            const isOneClick = !!listUnsubPost?.includes("List-Unsubscribe=One-Click");
            unsubMethod = isOneClick ? "POST" : "GET";
            postBody = isOneClick ? "List-Unsubscribe=One-Click" : undefined;
          } else {
            const mailtoMatch = listUnsub.match(/<(mailto:[^>]+)>/);
            if (mailtoMatch) {
              unsubUrl = mailtoMatch[1];
              unsubMethod = "mailto";
            }
          }
        }

        // Pass 2: HTML fallback
        if (!unsubUrl) {
          const fullData = await gmail.fetchMessage<any>(emailId);
          const payload = fullData?.result?.payload || fullData?.payload;
          if (payload) {
            const getHtml = (p: GmailMessagePart): string => {
              if (p.mimeType === "text/html" && p.body?.data) {
                try {
                  return atob(p.body.data.replace(/-/g, "+").replace(/_/g, "/"));
                } catch {
                  return "";
                }
              }
              if (p.parts) {
                for (const sub of p.parts) {
                  const r = getHtml(sub);
                  if (r) return r;
                }
              }
              return "";
            };
            const htmlBody = getHtml(payload);
            if (htmlBody) {
              const match = /href=["'](https?:\/\/[^"']*unsub[^"']*)/gi.exec(htmlBody);
              if (match) unsubUrl = match[1].replace(/^href=["']/, "");
            }
          }
        }

        if (unsubUrl && activeWorkspaceId) {
          await apiFetch(`/workspaces/${activeWorkspaceId}/email-unsubscribe`, {
            method: "POST",
            body: JSON.stringify({
              requests: [{ url: unsubUrl, method: unsubMethod, postBody, senderName: "" }],
            }),
          });
        }

        // Trash
        await gmail.moveToTrash(emailId);
        successCount++;
      } catch (err) {
        console.warn(`Batch unsub failed for ${emailId}:`, err);
      }
    };

    // Run with concurrency pool
    const worker = async () => {
      while (idx < ids.length) {
        const i = idx++;
        await processEmail(ids[i]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, () => worker()));

    removeEmailsFromCache?.(ids);
    batchHook.setSelectedIds(new Set());
    batchHook.setSelectionMode(false);
    setSelectedId(null);

    toast({
      title: "Descadastro em lote concluído",
      description: `${successCount}/${ids.length} processados com sucesso.`,
    });
  }, [batchHook.selectedIds, confirm, gmail, removeEmailsFromCache, batchHook]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable)
        return;
      if (!selectedEmail) return;
      switch (e.key.toLowerCase()) {
        case "r":
          e.preventDefault();
          handleReply(selectedEmail);
          break;
        case "f":
          e.preventDefault();
          handleForward(selectedEmail);
          break;
        case "s":
          e.preventDefault();
          actionsHook.toggleStar(selectedEmail.id);
          break;
        case "delete":
          e.preventDefault();
          handleDelete(selectedEmail.id);
          break;
        case "u":
          e.preventDefault();
          actionsHook.toggleRead(selectedEmail.id);
          break;
        case "q":
          e.preventDefault();
          handleQuickUnsubscribe(selectedEmail);
          break;
        case "escape":
          setSelectedId(null);
          setShowReply(false);
          setShowForward(false);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    selectedEmail,
    handleReply,
    handleForward,
    actionsHook,
    handleDelete,
    handleQuickUnsubscribe,
  ]);

  const selectAll = useCallback(() => {
    if (batchHook.selectedIds.size === filtered.length) batchHook.setSelectedIds(new Set());
    else batchHook.setSelectedIds(new Set(filtered.map((e) => e.id)));
  }, [filtered, batchHook]);

  const handleInsertTemplate = useCallback(
    (tpl: any, target: "reply" | "compose") => {
      const result = templateHook.insertTemplate(tpl, target);
      if (result.target === "reply")
        setReplyBody((prev) => (prev ? prev + "\n" + result.body : result.body));
      else setComposeBody((prev) => (prev ? prev + "\n" + result.body : result.body));
    },
    [templateHook],
  );

  const folders = [
    {
      id: "inbox",
      label: "Entrada",
      icon: Inbox,
      count: folderCounts.inbox,
      aiCounts: folderAiCounts["inbox"] || {},
    },
    {
      id: "sent",
      label: "Enviados",
      icon: Send,
      count: folderCounts.sent,
      aiCounts: folderAiCounts["sent"] || {},
    },
    {
      id: "drafts",
      label: "Rascunhos",
      icon: FileText,
      count: folderCounts.drafts,
      aiCounts: folderAiCounts["drafts"] || {},
    },
    { id: "archive", label: "Arquivo", icon: FolderArchive, count: 0, aiCounts: {} },
    { id: "spam", label: "Spam", icon: MailX, count: 0, aiCounts: {} },
    {
      id: "trash",
      label: "Lixeira",
      icon: Trash2,
      count: folderCounts.trash,
      aiCounts: folderAiCounts["trash"] || {},
    },
  ];

  // Shared EmailReader props
  const emailReaderProps = selectedEmail
    ? {
        email: selectedEmail,
        fullBody: actionsHook.fullBodyCache[selectedEmail.id] || null,
        loadingBody: actionsHook.loadingBody,
        gmailConnected: isConnected,
        isConnected,
        isSending,
        gmailSending: actionsHook.gmailSending || batchHook.gmailSending,
        emailCategories: aiHook.emailCategories,
        aiSummary: aiHook.aiSummary,
        setAiSummary: aiHook.setAiSummary,
        aiLoading: aiHook.aiLoading,
        aiReplyOptions: aiHook.aiReplyOptions,
        showAiReplyOptions: aiHook.showAiReplyOptions,
        setShowAiReplyOptions: aiHook.setShowAiReplyOptions,
        setAiReplyOptions: aiHook.setAiReplyOptions,
        handleAiAction: aiHook.handleAiAction,
        onReply: handleReply,
        onForward: handleForward,
        onDelete: handleDelete,
        onArchive: handleArchive,
        onToggleStar: actionsHook.toggleStar,
        onToggleRead: actionsHook.toggleRead,
        onUnsubscribe: handleQuickUnsubscribe,
        onSendReply: handleSendReply,
        onSendForward: handleSendForward,
        onQuickReply: handleQuickReply,
        onSaveAsTemplate: templateHook.saveAsTemplate,
        onSetShowTemplateMenu: templateHook.setShowTemplateMenu,
        onSetShowTemplateManager: templateHook.setShowTemplateManager,
        onSnooze: snoozeHook.snoozeEmail,
        labels,
        gmailLabels,
        onMoveToLabel: actionsHook.moveToLabel,
        resolveLabel,
        showReply,
        setShowReply,
        replyBody,
        setReplyBody,
        isReplyAll,
        showForward,
        setShowForward,
        forwardTo,
        setForwardTo,
        forwardNote,
        setForwardNote,
        hasForwardErrors,
        quickReplyText,
        setQuickReplyText,
      }
    : null;

  // ============== RENDER ==============

  if (!isConnected && emails.length === 0 && !isLoading) {
    return (
      <PageLayout>
        {confirmDialog}
        <PageHeader
          title="E-mail"
          icon={<Mail className="w-5 h-5" />}
          actions={<ConnectionBadge isConnected={false} size="lg" />}
        />
        <AnimatedItem index={0}>
          <GlassCard size="auto" className="text-center py-16">
            <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Conecte seu e-mail</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Conecte sua conta Google para acessar seus e-mails, enviar mensagens e usar recursos
              inteligentes de IA.
            </p>
            <button
              onClick={() => navigate("/integrations")}
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Conectar conta
            </button>
          </GlassCard>
        </AnimatedItem>
      </PageLayout>
    );
  }

  return (
    <PageLayout noPadding scrollable maxWidth="full">
      {confirmDialog}

      {/* Standard PageHeader */}
      <div className="p-3 sm:p-4 lg:p-6 pb-0 pt-1 sm:pt-2 lg:pt-3 flex-shrink-0">
        <PageHeader
          title="E-mail"
          icon={<Mail className="w-5 h-5 sm:w-6 sm:h-6 text-overlay-muted" />}
          subtitle={
            useLegacyGmail ? (
              <GmailSyncPanel
                isSyncing={isSyncing}
                isLoadingCache={isLoadingCache}
                syncCompleted={syncCompleted}
                syncHasMore={syncHasMore}
                hasCache={hasCache}
                cachedCount={cachedEmails.length}
                syncProgress={syncProgress}
                syncState={
                  gmailSyncState
                    ? {
                        totalSynced: gmailSyncState.totalSynced,
                        lastSyncedAt: gmailSyncState.lastSyncedAt,
                      }
                    : null
                }
                syncError={syncError}
                activeFolder={activeFolder}
                onStartSync={startSync}
                onContinueSync={continueSync}
                onStopSync={stopSync}
                onIncrementalSync={incrementalSync}
                onClearError={clearSyncError}
                accountSyncInfo={accountSyncInfo}
              />
            ) : undefined
          }
          actions={
            <div className="flex items-center gap-1.5 flex-wrap">
              {isBackgroundRefreshing && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="hidden sm:inline">Atualizando...</span>
                </span>
              )}
              <ConnectionBadge
                isConnected={isConnected}
                isLoading={false}
                sourceNames={isConnected ? ["Gmail"] : undefined}
                size="lg"
              />
              {isConnected && (
                <button
                  onClick={refetchEmails}
                  disabled={composioEmailsLoading || gmailLoading || isBackgroundRefreshing}
                  className="p-2 rounded-lg bg-foreground/10 text-overlay-muted hover:text-overlay hover:bg-foreground/15 transition-colors disabled:opacity-40"
                  title="Atualizar e-mails"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${composioEmailsLoading || gmailLoading || isBackgroundRefreshing ? "animate-spin" : ""}`}
                  />
                </button>
              )}
              {isMobile && (
                <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
                  <SheetTrigger asChild>
                    <button className="relative p-2 rounded-lg bg-foreground/10 text-overlay-muted hover:text-overlay hover:bg-foreground/15 transition-colors">
                      <Menu className="w-4 h-4" />
                      {folderCounts.inbox > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1">
                          {folderCounts.inbox > 99 ? "99+" : folderCounts.inbox}
                        </span>
                      )}
                    </button>
                  </SheetTrigger>
                  <SheetContent
                    side="left"
                    className="w-72 p-0 bg-background/95 backdrop-blur-xl border-foreground/10"
                  >
                    <FoldersSidebar
                      activeFolder={activeFolder}
                      setActiveFolder={setActiveFolder}
                      setSelectedId={setSelectedId}
                      setMobileDrawerOpen={setMobileDrawerOpen}
                      filterStarred={filterStarred}
                      setFilterStarred={setFilterStarred}
                      filterLabel={filterLabel}
                      setFilterLabel={setFilterLabel}
                      filterAiCategory={filterAiCategory}
                      setFilterAiCategory={setFilterAiCategory}
                      filterAccount={filterAccount}
                      setFilterAccount={setFilterAccount}
                      labels={labels}
                      setLabels={setLabels}
                      gmailConnected={isConnected}
                      gmailLabels={gmailLabels}
                      folders={folders}
                      accountInfoMap={accountInfoMap}
                      labelCounts={labelCounts}
                      isMobileDrawer
                      onDropEmailOnLabel={handleDropEmailOnLabel}
                      onCreateGmailLabel={createGmailLabel}
                      onRenameGmailLabel={renameGmailLabel}
                      onDeleteGmailLabel={deleteGmailLabel}
                      onRefreshLabels={refreshGmailLabels}
                      labelsLoading={gmailLabelsLoading}
                      folderSyncStatuses={folderSyncStatuses}
                    />
                  </SheetContent>
                </Sheet>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 bg-foreground/10 text-overlay-muted hover:text-overlay hover:bg-foreground/15 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">IA</span>
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem
                    onClick={() =>
                      aiHook.showDailySummary
                        ? aiHook.setShowDailySummary(false)
                        : aiHook.handleDailySummary(emails)
                    }
                    disabled={aiHook.aiLoading === "daily" || emails.length === 0}
                  >
                    <CalendarDays className="w-4 h-4 mr-2" /> Resumo do Dia{" "}
                    {aiHook.aiLoading === "daily" && (
                      <Loader2 className="w-3 h-3 animate-spin ml-auto" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => aiHook.handleInboxIntelligence(emails)}
                    disabled={aiHook.aiLoading === "inbox" || emails.length === 0}
                  >
                    <Brain className="w-4 h-4 mr-2" /> Análise Inteligente{" "}
                    {aiHook.aiLoading === "inbox" && (
                      <Loader2 className="w-3 h-3 animate-spin ml-auto" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setShowCleanerPanel(true);
                      const limit =
                        cleanerScanMode === "ultra" ? 1500 : cleanerScanMode === "deep" ? 700 : 200;
                      const scanEmails = emails.slice(0, limit);
                      setCleanerTotalScanned(scanEmails.length);
                      aiHook.handleInboxCleaner(scanEmails);
                    }}
                    disabled={aiHook.cleanerLoading}
                  >
                    <span className="mr-2">🧹</span> Limpeza Inteligente{" "}
                    {aiHook.cleanerLoading && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      unsubHook.scanEmails(emails);
                    }}
                    disabled={unsubHook.scanning || emails.length === 0}
                  >
                    <MailMinus className="w-4 h-4 mr-2" /> Smart Unsubscribe{" "}
                    {unsubHook.scanning && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setShowAutoOrganize(true);
                      aiHook.handleAutoOrganize(
                        emails,
                        gmailLabels.map((l) => ({ id: l.gmailId, name: l.name })),
                      );
                    }}
                    disabled={aiHook.autoOrganizeLoading || emails.length === 0}
                  >
                    <FolderInput className="w-4 h-4 mr-2" /> Organizar com IA{" "}
                    {aiHook.autoOrganizeLoading && (
                      <Loader2 className="w-3 h-3 animate-spin ml-auto" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowStats(!showStats)}
                    disabled={emails.length === 0}
                  >
                    <BarChart3 className="w-4 h-4 mr-2" /> Estatísticas{" "}
                    {showStats && <span className="ml-auto text-xs text-primary">●</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowUnsubStats(!showUnsubStats)}>
                    <MailMinus className="w-4 h-4 mr-2" /> Histórico Unsubscribe{" "}
                    {showUnsubStats && <span className="ml-auto text-xs text-primary">●</span>}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                onClick={() => {
                  batchHook.setSelectionMode(!batchHook.selectionMode);
                  batchHook.setSelectedIds(new Set());
                }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${batchHook.selectionMode ? "bg-primary/30 text-primary-foreground" : "bg-foreground/10 text-overlay-muted hover:text-overlay hover:bg-foreground/15"}`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {batchHook.selectionMode ? "Cancelar" : "Selecionar"}
                </span>
              </button>
              <button
                onClick={handleCompose}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Compor</span>
              </button>
            </div>
          }
        />
      </div>

      {/* Legacy scope banner removed — Composio-only path */}

      {/* AI Panels */}
      <div className="px-3 sm:px-4 lg:px-6">
        <EmailStatsPanel
          show={showStats}
          onClose={() => setShowStats(false)}
          emails={emails}
          emailCategories={aiHook.emailCategories}
        />
        <UnsubscribeStatsPanel show={showUnsubStats} onClose={() => setShowUnsubStats(false)} />
        <DailySummaryPanel
          show={aiHook.showDailySummary}
          onClose={() => aiHook.setShowDailySummary(false)}
          data={aiHook.dailySummary}
          loading={aiHook.aiLoading === "daily"}
        />
        <InboxIntelligencePanel
          show={aiHook.showInboxPanel}
          onClose={() => aiHook.setShowInboxPanel(false)}
          data={aiHook.inboxIntelligence}
        />
        <SmartUnsubscribePanel
          show={unsubHook.senders !== null || unsubHook.scanning}
          onClose={() => unsubHook.reset()}
          senders={unsubHook.senders}
          scanning={unsubHook.scanning}
          unsubscribing={unsubHook.unsubscribing}
          fetchingHeaders={unsubHook.fetchingHeaders}
          progress={unsubHook.progress}
          scanProgress={unsubHook.scanProgress}
          onUnsubscribe={(selected, opts) =>
            unsubHook.executeUnsubscribe(selected, {
              trashAfter: opts.trashAfter,
              removeFromCache: removeEmailsFromCache,
            })
          }
          onCancel={() => unsubHook.cancel()}
        />
        <InboxCleanerPanel
          show={showCleanerPanel}
          onClose={() => {
            setShowCleanerPanel(false);
            aiHook.setCleanerGroups(null);
            setCleanProgress(null);
          }}
          groups={aiHook.cleanerGroups}
          loading={aiHook.cleanerLoading}
          deleting={cleanerDeleting}
          cleanProgress={cleanProgress}
          scanMode={cleanerScanMode}
          onScanModeChange={setCleanerScanMode}
          totalScanned={cleanerTotalScanned}
          chunkProgress={aiHook.cleanerProgress}
          onCancel={() => aiHook.cancelCleaner()}
          onRescan={(mode) => {
            const limit = mode === "ultra" ? 1500 : mode === "deep" ? 700 : 200;
            const scanEmails = emails.slice(0, limit);
            setCleanerTotalScanned(scanEmails.length);
            aiHook.handleInboxCleaner(scanEmails);
          }}
          onCleanGroup={async (group) => {
            if (!isConnected) return;
            setCleanerDeleting(true);
            try {
              const BATCH_SIZE = 1000;
              for (let i = 0; i < group.emailIds.length; i += BATCH_SIZE) {
                const ids = group.emailIds.slice(i, i + BATCH_SIZE);
                if (group.action === "trash") {
                  await gmail.batchModify({
                    ids,
                    addLabelIds: ["TRASH"],
                    removeLabelIds: ["INBOX"],
                  });
                } else {
                  await gmail.batchModify({ ids, removeLabelIds: ["INBOX"] });
                }
              }
              // Only remove from cache after API succeeds
              removeEmailsFromCache?.(group.emailIds);
              toast({
                title: `${group.count} e-mail(s) ${group.action === "trash" ? "excluídos" : "arquivados"}`,
              });
              aiHook.setCleanerGroups((prev) => prev?.filter((g) => g !== group) || null);
            } catch (err: any) {
              toast({ title: "Erro ao limpar", description: err?.message, variant: "destructive" });
            } finally {
              setCleanerDeleting(false);
            }
          }}
          onCleanSelected={async (selectedGroups) => {
            if (!isConnected || selectedGroups.length === 0) return;
            setCleanerDeleting(true);
            const totalEmailCount = selectedGroups.reduce((sum, g) => sum + g.emailIds.length, 0);
            setCleanProgress({ current: 0, total: totalEmailCount });

            // Track successfully processed IDs for partial failure recovery
            const successfulIds: string[] = [];
            const failedBatches: number = 0;
            let processed = 0;
            const BATCH_SIZE = 1000;

            try {
              // Group all IDs by action for bulk processing
              const trashIds: string[] = [];
              const archiveIds: string[] = [];
              for (const group of selectedGroups) {
                if (group.action === "trash") trashIds.push(...group.emailIds);
                else archiveIds.push(...group.emailIds);
              }

              // Batch trash with per-batch error recovery
              for (let i = 0; i < trashIds.length; i += BATCH_SIZE) {
                const ids = trashIds.slice(i, i + BATCH_SIZE);
                try {
                  await gmail.batchModify({
                    ids,
                    addLabelIds: ["TRASH"],
                    removeLabelIds: ["INBOX"],
                  });
                  successfulIds.push(...ids);
                } catch (batchErr) {
                  console.warn("Trash batch failed:", batchErr);
                }
                processed += ids.length;
                setCleanProgress({ current: processed, total: totalEmailCount });
              }

              // Batch archive with per-batch error recovery
              for (let i = 0; i < archiveIds.length; i += BATCH_SIZE) {
                const ids = archiveIds.slice(i, i + BATCH_SIZE);
                try {
                  await gmail.batchModify({ ids, removeLabelIds: ["INBOX"] });
                  successfulIds.push(...ids);
                } catch (batchErr) {
                  console.warn("Archive batch failed:", batchErr);
                }
                processed += ids.length;
                setCleanProgress({ current: processed, total: totalEmailCount });
              }

              // Remove only successfully processed emails from cache
              if (successfulIds.length > 0) {
                removeEmailsFromCache?.(successfulIds);
              }

              setCleanProgress({ current: totalEmailCount, total: totalEmailCount });

              if (successfulIds.length === totalEmailCount) {
                toast({
                  title: `${successfulIds.length} e-mail(s) limpos em ${selectedGroups.length} grupos`,
                });
              } else if (successfulIds.length > 0) {
                toast({
                  title: "Limpeza parcial",
                  description: `${successfulIds.length}/${totalEmailCount} e-mails processados. Alguns lotes falharam.`,
                  variant: "destructive",
                });
              } else {
                toast({
                  title: "Erro na limpeza",
                  description: "Nenhum e-mail foi processado.",
                  variant: "destructive",
                });
              }

              // Remove cleaned groups from UI based on successfully processed IDs
              const processedIdSet = new Set(successfulIds);
              aiHook.setCleanerGroups((prev) => {
                if (!prev) return null;
                return prev
                  .map((g) => {
                    const remaining = g.emailIds.filter((id) => !processedIdSet.has(id));
                    if (remaining.length === 0) return null;
                    return { ...g, emailIds: remaining, count: remaining.length };
                  })
                  .filter(Boolean) as typeof prev;
              });
            } catch (err: any) {
              // Even on unexpected error, remove successfully processed emails
              if (successfulIds.length > 0) {
                removeEmailsFromCache?.(successfulIds);
                toast({
                  title: "Limpeza parcial",
                  description: `${successfulIds.length} e-mails processados antes do erro.`,
                  variant: "destructive",
                });
              } else {
                toast({
                  title: "Erro na limpeza em lote",
                  description: err?.message,
                  variant: "destructive",
                });
              }
            } finally {
              setCleanerDeleting(false);
              setCleanProgress(null);
            }
          }}
        />
        <AutoOrganizePanel
          show={showAutoOrganize}
          onClose={() => {
            setShowAutoOrganize(false);
            aiHook.setAutoOrganizeResults(null);
            setOrganizeProgress(null);
          }}
          results={aiHook.autoOrganizeResults}
          loading={aiHook.autoOrganizeLoading}
          applying={autoOrganizeApplying}
          applyProgress={organizeProgress}
          analyzeProgress={aiHook.organizeProgress}
          onToggleSelect={(emailId) => {
            aiHook.setAutoOrganizeResults((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                assignments: prev.assignments.map((a) =>
                  a.emailId === emailId ? { ...a, selected: !a.selected } : a,
                ),
              };
            });
          }}
          onSelectAll={() => {
            aiHook.setAutoOrganizeResults((prev) =>
              prev
                ? { ...prev, assignments: prev.assignments.map((a) => ({ ...a, selected: true })) }
                : prev,
            );
          }}
          onDeselectAll={() => {
            aiHook.setAutoOrganizeResults((prev) =>
              prev
                ? { ...prev, assignments: prev.assignments.map((a) => ({ ...a, selected: false })) }
                : prev,
            );
          }}
          onApply={async (assignments) => {
            if (!isConnected || assignments.length === 0) return;
            setAutoOrganizeApplying(true);
            setOrganizeProgress({ current: 0, total: assignments.length });
            let successCount = 0;
            let failedOps = 0;

            try {
              // 1. Create all new labels in parallel (handle duplicates gracefully)
              const newLabelsToCreate = [
                ...new Set(assignments.flatMap((a) => (a as any).newLabels || [])),
              ];
              const newLabelIdMap: Record<string, string> = {};
              if (newLabelsToCreate.length > 0) {
                const createResults = await Promise.allSettled(
                  newLabelsToCreate.map(async (labelName) => {
                    try {
                      const data = await gmail.execute<any>("GMAIL_CREATE_LABEL", {
                        name: labelName,
                        label_list_visibility: "labelShow",
                        message_list_visibility: "show",
                      });
                      return { labelName, id: data?.id };
                    } catch (err: any) {
                      // If label already exists, try to find it in existing labels
                      const existing = gmailLabels.find(
                        (l) => l.name.toLowerCase() === labelName.toLowerCase(),
                      );
                      if (existing) return { labelName, id: existing.gmailId };
                      throw err;
                    }
                  }),
                );
                for (const r of createResults) {
                  if (r.status === "fulfilled" && r.value.id)
                    newLabelIdMap[r.value.labelName] = r.value.id;
                }
              }

              // 2. Group emails by label to apply via batchModify
              const labelToEmailIds = new Map<string, string[]>();
              const removeOps: Array<{ emailId: string; removeLabels: string[] }> = [];

              for (const a of assignments as any[]) {
                const allLabels = [
                  ...(a.suggestedLabels || []),
                  ...(a.newLabels || []).map((nl: string) => newLabelIdMap[nl]).filter(Boolean),
                ];
                for (const lid of allLabels) {
                  if (!labelToEmailIds.has(lid)) labelToEmailIds.set(lid, []);
                  labelToEmailIds.get(lid)!.push(a.emailId);
                }
                if (a.removeLabels?.length > 0) {
                  removeOps.push({ emailId: a.emailId, removeLabels: a.removeLabels });
                }
              }

              // 3. Apply labels in batch with per-batch error recovery
              let processed = 0;
              const totalOps = labelToEmailIds.size + (removeOps.length > 0 ? 1 : 0);
              const BATCH_SIZE = 1000;

              for (const [labelId, emailIds] of labelToEmailIds) {
                try {
                  for (let i = 0; i < emailIds.length; i += BATCH_SIZE) {
                    const ids = emailIds.slice(i, i + BATCH_SIZE);
                    await gmail.batchModify({ ids, addLabelIds: [labelId] });
                    successCount += ids.length;
                  }
                } catch (batchErr) {
                  failedOps++;
                  console.warn("Organize batch add failed for label:", labelId, batchErr);
                }
                processed++;
                setOrganizeProgress({
                  current: Math.round((processed / totalOps) * assignments.length),
                  total: assignments.length,
                });
              }

              // 4. Batch remove labels with error recovery
              if (removeOps.length > 0) {
                const removeByLabels = new Map<string, string[]>();
                for (const op of removeOps) {
                  const key = op.removeLabels.sort().join(",");
                  if (!removeByLabels.has(key)) removeByLabels.set(key, []);
                  removeByLabels.get(key)!.push(op.emailId);
                }
                for (const [labelsKey, ids] of removeByLabels) {
                  const removeLabelIds = labelsKey.split(",");
                  try {
                    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
                      const batch = ids.slice(i, i + BATCH_SIZE);
                      await gmail.batchModify({ ids: batch, removeLabelIds });
                    }
                  } catch (batchErr) {
                    failedOps++;
                    console.warn("Organize batch remove failed:", labelsKey, batchErr);
                  }
                }
              }

              setOrganizeProgress({ current: assignments.length, total: assignments.length });
              const nc = Object.keys(newLabelIdMap).length;

              if (failedOps === 0) {
                toast({
                  title:
                    nc > 0
                      ? `${assignments.length} e-mail(s) organizados · ${nc} label(s) criado(s)`
                      : `${assignments.length} e-mail(s) organizados com sucesso`,
                });
              } else {
                toast({
                  title: "Organização parcial",
                  description: `${failedOps} operação(ões) falharam. A maioria foi aplicada com sucesso.`,
                  variant: "destructive",
                });
              }

              // Mark applied emails as organized to prevent duplicates
              aiHook.markAsOrganized(assignments.map((a: any) => a.emailId));
              setShowAutoOrganize(false);
              aiHook.setAutoOrganizeResults(null);
              refreshGmailLabels?.();
            } catch (err: any) {
              toast({
                title: "Erro ao organizar",
                description: err?.message,
                variant: "destructive",
              });
            } finally {
              setAutoOrganizeApplying(false);
              setOrganizeProgress(null);
            }
          }}
        />
      </div>

      {/* Batch actions bar */}
      <AnimatePresence>
        {batchHook.selectionMode && batchHook.selectedIds.size > 0 && (
          <BatchActionsBar
            selectedCount={batchHook.selectedIds.size}
            totalCount={filtered.length}
            onSelectAll={selectAll}
            onMarkRead={batchHook.batchMarkRead}
            onArchive={() => batchHook.batchArchive(setSelectedId)}
            onDelete={() => batchHook.batchDelete(setSelectedId)}
            onMarkUnread={batchHook.batchMarkUnread}
            onStar={batchHook.batchStar}
            onUnsubscribeAndDelete={handleBatchUnsubscribeAndDelete}
            onMoveToLabel={batchHook.batchMoveToLabel}
            gmailConnected={isConnected}
            gmailLabels={gmailLabels}
          />
        )}
      </AnimatePresence>

      {/* Main email content */}
      <div className="h-[calc(100vh-9rem)] md:h-[calc(100vh-6.5rem)] overflow-hidden mx-3 sm:mx-4 lg:mx-6 -mt-1 mb-4 lg:mb-6 rounded-xl border border-foreground/10">
        {isMobile ? (
          selectedId && selectedEmail && emailReaderProps ? (
            <div className="h-full flex flex-col bg-background/90 backdrop-blur-md">
              <div className="flex items-center gap-2 p-3 border-b border-foreground/5 flex-shrink-0">
                <button
                  onClick={() => setSelectedId(null)}
                  className="p-1.5 rounded-lg hover:bg-foreground/10 text-muted-foreground"
                  aria-label="Voltar"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-muted-foreground truncate flex-1">
                  {selectedEmail.subject}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <EmailReader {...emailReaderProps} />
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col bg-background/90 backdrop-blur-md">
              <EmailSearchBar
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                aiSmartSearch={aiHook.aiSmartSearch}
                setAiSmartSearch={aiHook.setAiSmartSearch}
                smartSearchLoading={aiHook.smartSearchLoading}
                onSmartSearch={aiHook.handleSmartSearch}
                availableAiCategories={availableAiCategories}
                filterAiCategory={filterAiCategory}
                setFilterAiCategory={setFilterAiCategory}
                filterRequiresAction={filterRequiresAction}
                setFilterRequiresAction={setFilterRequiresAction}
                filterUnread={filterUnread}
                setFilterUnread={setFilterUnread}
                folderActionCount={folderActionCounts[activeFolder] ?? 0}
                hasActiveFilter={hasActiveFilter}
                clearAllFilters={clearAllFilters}
              />
              <div className="flex-1 overflow-y-auto">
                {filtered.map((email) => (
                  <EmailListItem
                    key={email.id}
                    email={email}
                    isSelected={email.id === selectedId}
                    isBatchSelected={batchHook.selectedIds.has(email.id)}
                    selectionMode={batchHook.selectionMode}
                    emailCategories={aiHook.emailCategories}
                    onSelect={selectEmail}
                    onToggleRead={actionsHook.toggleRead}
                    onToggleStar={actionsHook.toggleStar}
                    onArchive={handleArchive}
                    onDelete={handleDelete}
                    onReply={handleReply}
                    onForward={handleForward}
                    onUnsubscribe={handleQuickUnsubscribe}
                  />
                ))}
                {filtered.length === 0 && !isLoading && (
                  <EmailEmptyState
                    folder={activeFolder}
                    hasActiveFilter={hasActiveFilter}
                    onClearFilters={clearAllFilters}
                    searchQuery={searchQuery}
                  />
                )}
                {isLoading && filtered.length === 0 && <EmailLoadingSkeleton count={6} />}
                {isLoadingMore && (
                  <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs">Carregando mais...</span>
                  </div>
                )}
                <div ref={mobileScrollSentinelRef} className="h-1" />
              </div>
            </div>
          )
        ) : (
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={15} minSize={10} maxSize={20} className="hidden lg:block">
              <div className="h-full border-r border-foreground/5 bg-background/90 backdrop-blur-md">
                <FoldersSidebar
                  activeFolder={activeFolder}
                  setActiveFolder={setActiveFolder}
                  setSelectedId={setSelectedId}
                  setMobileDrawerOpen={setMobileDrawerOpen}
                  filterStarred={filterStarred}
                  setFilterStarred={setFilterStarred}
                  filterLabel={filterLabel}
                  setFilterLabel={setFilterLabel}
                  filterAiCategory={filterAiCategory}
                  setFilterAiCategory={setFilterAiCategory}
                  filterAccount={filterAccount}
                  setFilterAccount={setFilterAccount}
                  labels={labels}
                  setLabels={setLabels}
                  gmailConnected={isConnected}
                  gmailLabels={gmailLabels}
                  folders={folders}
                  accountInfoMap={accountInfoMap}
                  labelCounts={labelCounts}
                  onDropEmailOnLabel={handleDropEmailOnLabel}
                  onCreateGmailLabel={createGmailLabel}
                  onRenameGmailLabel={renameGmailLabel}
                  onDeleteGmailLabel={deleteGmailLabel}
                  onRefreshLabels={refreshGmailLabels}
                  labelsLoading={gmailLabelsLoading}
                  folderSyncStatuses={folderSyncStatuses}
                />
              </div>
            </ResizablePanel>
            <ResizableHandle className="hidden lg:flex" />
            <ResizablePanel defaultSize={35} minSize={25}>
              <div className="h-full flex flex-col bg-background/90 backdrop-blur-md">
                <EmailSearchBar
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  aiSmartSearch={aiHook.aiSmartSearch}
                  setAiSmartSearch={aiHook.setAiSmartSearch}
                  smartSearchLoading={aiHook.smartSearchLoading}
                  onSmartSearch={aiHook.handleSmartSearch}
                  availableAiCategories={availableAiCategories}
                  filterAiCategory={filterAiCategory}
                  setFilterAiCategory={setFilterAiCategory}
                  filterRequiresAction={filterRequiresAction}
                  setFilterRequiresAction={setFilterRequiresAction}
                  filterUnread={filterUnread}
                  setFilterUnread={setFilterUnread}
                  folderActionCount={folderActionCounts[activeFolder] ?? 0}
                  hasActiveFilter={hasActiveFilter}
                  clearAllFilters={clearAllFilters}
                />
                <div className="flex-1 overflow-y-auto">
                  {filtered.map((email) => (
                    <EmailListItem
                      key={email.id}
                      email={email}
                      isSelected={email.id === selectedId}
                      isBatchSelected={batchHook.selectedIds.has(email.id)}
                      selectionMode={batchHook.selectionMode}
                      emailCategories={aiHook.emailCategories}
                      onSelect={selectEmail}
                      onToggleRead={actionsHook.toggleRead}
                      onToggleStar={actionsHook.toggleStar}
                      onArchive={handleArchive}
                      onDelete={handleDelete}
                      onReply={handleReply}
                      onForward={handleForward}
                      onUnsubscribe={handleQuickUnsubscribe}
                    />
                  ))}
                  {filtered.length === 0 && !isLoading && (
                    <EmailEmptyState
                      folder={activeFolder}
                      hasActiveFilter={hasActiveFilter}
                      onClearFilters={clearAllFilters}
                      searchQuery={searchQuery}
                    />
                  )}
                  {isLoading && filtered.length === 0 && <EmailLoadingSkeleton />}
                  {isLoadingMore && (
                    <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs">Carregando mais...</span>
                    </div>
                  )}
                  <div ref={scrollSentinelRef} className="h-1" />
                </div>
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={50} minSize={30}>
              <div className="h-full overflow-y-auto p-5 bg-background/90 backdrop-blur-md">
                {emailReaderProps ? (
                  <EmailReader {...emailReaderProps} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Mail className="w-12 h-12 opacity-30 mb-3" />
                    <p className="text-sm">Selecione um e-mail para ler</p>
                  </div>
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>

      {/* Floating Compose Panel */}
      {showCompose && (
        <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[480px] lg:w-[540px] max-h-[85vh] overflow-y-auto shadow-2xl rounded-xl border border-foreground/10 bg-background/95 backdrop-blur-xl">
          <ComposePanel
            composeTo={composeTo}
            setComposeTo={setComposeTo}
            composeCc={composeCc}
            setComposeCc={setComposeCc}
            composeBcc={composeBcc}
            setComposeBcc={setComposeBcc}
            composeSubject={composeSubject}
            setComposeSubject={setComposeSubject}
            composeBody={composeBody}
            setComposeBody={setComposeBody}
            onSend={handleSendCompose}
            onSaveDraft={handleSaveDraft}
            onClose={() => setShowCompose(false)}
            isSending={isSending || actionsHook.gmailSending}
            gmailConnected={isConnected}
            gmailSending={actionsHook.gmailSending}
            onComposeAi={aiHook.handleComposeAi}
            aiLoading={aiHook.aiLoading}
          />
        </div>
      )}

      {/* Template Manager */}
      {templateHook.showTemplateManager && <TemplateManager hook={templateHook} />}
    </PageLayout>
  );
};

export default EmailPage;

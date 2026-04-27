import { useState, useCallback, useRef } from "react";
import { usePersistedWidget } from "@/hooks/ui/usePersistedWidget";
import { notifyAiShortcutPending } from "@/lib/aiShortcuts";

interface EmailItem {
  id: string;
  from: string;
  email: string;
  subject: string;
  body: string;
  date: string;
  unread: boolean;
  starred: boolean;
  hasAttachment: boolean;
  folder: string;
  labels: string[];
}

export type EmailCategoryMap = Record<
  string,
  { category: string; priority: string; requires_action: boolean }
>;

export function useEmailAI() {
  // AI state
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<
    "summarize" | "suggest" | "inbox" | "compose_ai" | "daily" | "cleaner" | null
  >(null);
  const [aiReplyOptions, setAiReplyOptions] = useState<Array<{
    tone: string;
    label: string;
    body: string;
  }> | null>(null);
  const [showAiReplyOptions, setShowAiReplyOptions] = useState(false);
  const [inboxIntelligence, setInboxIntelligence] = useState<{
    total_unread: number;
    urgent_count: number;
    main_senders: string[];
    categories: Array<{ name: string; count: number; icon: string }>;
    priority_emails: Array<{
      index: number;
      from: string;
      subject: string;
      urgency: "critical" | "high" | "medium";
      reason: string;
    }>;
    suggested_actions: Array<{
      action: string;
      description: string;
      email_count: number;
      impact: "high" | "medium" | "low";
    }>;
    inbox_score: number;
    insight: string;
    trends: { newsletter_percentage: number; needs_response: number; pattern: string };
    focus_email_index?: number;
  } | null>(null);
  const [showInboxPanel, setShowInboxPanel] = useState(false);
  const [aiComposeSuggestion, setAiComposeSuggestion] = useState<string | null>(null);
  const [composeAiPrompt, setComposeAiPrompt] = useState("");
  const [showComposeAiPrompt, setShowComposeAiPrompt] = useState(false);
  const [aiSmartSearch, setAiSmartSearch] = useState("");
  const [smartSearchLoading, setSmartSearchLoading] = useState(false);

  // Daily Summary
  const [showDailySummary, setShowDailySummary] = useState(false);
  const [dailySummary, setDailySummary] = useState<{
    overall_insight: string;
    total_today: number;
    unread_today: number;
    categories: Array<{
      name: string;
      count: number;
      unread: number;
      top_senders?: string[];
      suggested_actions: Array<{ label: string; description: string }>;
    }>;
  } | null>(null);

  // Auto-categorization
  const {
    data: emailCategories,
    save: saveEmailCategories,
    loading: emailCategoriesLoading,
  } = usePersistedWidget<EmailCategoryMap>({
    key: "email_ai_categories",
    defaultValue: {},
    debounceMs: 2000,
  });
  const [categorizingIds] = useState<Set<string>>(new Set());
  const categorizedIdsRef = useRef<string>("");

  const setEmailCategory = useCallback(
    (emailId: string, category: string) => {
      const updated = {
        ...emailCategories,
        [emailId]: { category, priority: "normal", requires_action: false },
      };
      saveEmailCategories(updated);
    },
    [emailCategories, saveEmailCategories],
  );

  // AI actions on selected email
  const handleAiAction = useCallback(
    async (
      action: "summarize" | "suggest_reply" | "suggest_replies_multiple",
      selectedEmail: EmailItem,
    ) => {
      if (!selectedEmail) return;
      setAiLoading(null);
      notifyAiShortcutPending(
        action === "summarize" ? "Resumo por IA indisponível" : "Resposta por IA indisponível",
      );
      return null;
    },
    [],
  );

  const handleInboxIntelligence = useCallback(async (emails: EmailItem[]) => {
    if (emails.length === 0) return;
    setAiLoading(null);
    notifyAiShortcutPending("Análise inteligente indisponível");
  }, []);

  const handleDailySummary = useCallback(async (emails: EmailItem[]) => {
    if (emails.length === 0) return;
    setAiLoading(null);
    setShowDailySummary(false);
    setDailySummary(null);
    notifyAiShortcutPending("Resumo diário indisponível");
  }, []);

  const handleComposeAi = useCallback(
    async (composeBody: string, composeTo: string) => {
      if (!composeAiPrompt.trim() && !composeBody.trim()) return null;
      setAiLoading(null);
      setAiComposeSuggestion(null);
      notifyAiShortcutPending("Composição por IA indisponível");
      return null;
    },
    [composeAiPrompt],
  );

  const handleSmartSearch = useCallback(async () => {
    if (!aiSmartSearch.trim()) return null;
    setSmartSearchLoading(false);
    notifyAiShortcutPending("Busca inteligente indisponível");
    return null;
  }, [aiSmartSearch]);

  // Auto-organize: analyze emails and suggest/apply Gmail labels
  const [autoOrganizeLoading, setAutoOrganizeLoading] = useState(false);
  const [organizeProgress, setOrganizeProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  // Track already-organized email IDs to avoid duplicates
  const [, setOrganizedEmailIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("email_organized_ids");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return new Set(parsed.slice(-2000)); // cap at 2000
      }
    } catch {}
    return new Set();
  });

  const markAsOrganized = useCallback((ids: string[]) => {
    setOrganizedEmailIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      // Persist (cap at 2000 most recent)
      try {
        const arr = [...next].slice(-2000);
        localStorage.setItem("email_organized_ids", JSON.stringify(arr));
      } catch {}
      return next;
    });
  }, []);
  const [autoOrganizeResults, setAutoOrganizeResults] = useState<{
    assignments: Array<{
      emailId: string;
      subject: string;
      from: string;
      suggestedLabels: string[];
      newLabels: string[];
      removeLabels: string[];
      reason: string;
      confidence: "high" | "medium" | "low";
      emailType: string;
      selected: boolean;
    }>;
    summary: string;
    stats: {
      total_to_organize: number;
      already_organized: number;
      newsletters_found: number;
      high_priority: number;
    };
  } | null>(null);

  const handleAutoOrganize = useCallback(
    async (emails: EmailItem[], _availableLabels?: Array<{ id: string; name: string }>) => {
      if (emails.length === 0) return null;
      setAutoOrganizeLoading(false);
      setOrganizeProgress(null);
      setAutoOrganizeResults(null);
      notifyAiShortcutPending("Organização por IA indisponível");
      return null;
    },
    [],
  );

  // Inbox cleaner: scan for low-value/bulk emails (chunked processing)
  const [cleanerLoading, setCleanerLoading] = useState(false);
  const [cleanerGroups, setCleanerGroups] = useState<Array<{
    sender: string;
    icon: string;
    count: number;
    emailIds: string[];
    suggestion: string;
    action: "trash" | "archive";
    reason: string;
    isNewsletter: boolean;
    estimatedSpace: string;
  }> | null>(null);
  const [cleanerProgress, setCleanerProgress] = useState<{ current: number; total: number } | null>(
    null,
  );
  const cleanerAbortRef = useRef(false);

  const handleInboxCleaner = useCallback(async (emails: EmailItem[]) => {
    if (emails.length === 0) return null;
    setCleanerLoading(false);
    setCleanerGroups([]);
    setCleanerProgress(null);
    cleanerAbortRef.current = false;
    notifyAiShortcutPending("Limpeza inteligente indisponível");
    return [];
  }, []);

  const cancelCleaner = useCallback(() => {
    cleanerAbortRef.current = true;
  }, []);

  // Auto-categorize visible emails (debounced, only new IDs)
  const autoCategorizeEmails = useCallback(async (emailList: EmailItem[]) => {
    void emailList;
  }, []);

  // Trigger auto-categorization based on folder emails (not filtered)
  const triggerAutoCategorize = useCallback(
    (folderEmails: EmailItem[]) => {
      if (folderEmails.length === 0) return;
      // Build a key from the first 15 IDs to avoid re-triggering for same set
      const key = folderEmails
        .slice(0, 15)
        .map((e) => e.id)
        .join(",");
      if (key === categorizedIdsRef.current) return;
      categorizedIdsRef.current = key;
      autoCategorizeEmails(folderEmails.slice(0, 15));
    },
    [autoCategorizeEmails],
  );

  return {
    aiSummary,
    setAiSummary,
    aiLoading,
    setAiLoading,
    aiReplyOptions,
    setAiReplyOptions,
    showAiReplyOptions,
    setShowAiReplyOptions,
    inboxIntelligence,
    showInboxPanel,
    setShowInboxPanel,
    aiComposeSuggestion,
    setAiComposeSuggestion,
    composeAiPrompt,
    setComposeAiPrompt,
    showComposeAiPrompt,
    setShowComposeAiPrompt,
    aiSmartSearch,
    setAiSmartSearch,
    smartSearchLoading,
    showDailySummary,
    setShowDailySummary,
    dailySummary,
    emailCategories,
    emailCategoriesLoading,
    categorizingIds,
    setEmailCategory,
    handleAiAction,
    handleInboxIntelligence,
    handleDailySummary,
    handleComposeAi,
    handleSmartSearch,
    autoCategorizeEmails,
    triggerAutoCategorize,
    // Auto-organize
    autoOrganizeLoading,
    autoOrganizeResults,
    setAutoOrganizeResults,
    handleAutoOrganize,
    organizeProgress,
    markAsOrganized,
    // Inbox cleaner
    cleanerLoading,
    cleanerGroups,
    setCleanerGroups,
    handleInboxCleaner,
    cleanerProgress,
    cancelCleaner,
  };
}

import { useState, useCallback, useEffect, useRef } from "react";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { usePersistedWidget } from "@/hooks/ui/usePersistedWidget";
import { toast } from "@/hooks/use-toast";
import { isCreditError, emitCreditError } from "@/hooks/common/useCreditError";

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

export type EmailCategoryMap = Record<string, { category: string; priority: string; requires_action: boolean }>;

export function useEmailAI() {
  const { invoke } = useEdgeFn();

  // AI state
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<"summarize" | "suggest" | "inbox" | "compose_ai" | "daily" | "cleaner" | null>(null);
  const [aiReplyOptions, setAiReplyOptions] = useState<Array<{tone: string; label: string; body: string}> | null>(null);
  const [showAiReplyOptions, setShowAiReplyOptions] = useState(false);
  const [inboxIntelligence, setInboxIntelligence] = useState<{
    total_unread: number; urgent_count: number; main_senders: string[];
    categories: Array<{name: string; count: number; icon: string}>;
    priority_emails: Array<{index: number; from: string; subject: string; urgency: "critical" | "high" | "medium"; reason: string}>;
    suggested_actions: Array<{action: string; description: string; email_count: number; impact: "high" | "medium" | "low"}>;
    inbox_score: number; insight: string;
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
      name: string; count: number; unread: number; top_senders?: string[];
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
  const [categorizingIds, setCategorizingIds] = useState<Set<string>>(new Set());
  const categorizedIdsRef = useRef<string>("");

  const setEmailCategory = useCallback((emailId: string, category: string) => {
    const updated = { ...emailCategories, [emailId]: { category, priority: "normal", requires_action: false } };
    saveEmailCategories(updated);
  }, [emailCategories, saveEmailCategories]);

  // AI actions on selected email
  const handleAiAction = useCallback(async (action: "summarize" | "suggest_reply" | "suggest_replies_multiple", selectedEmail: EmailItem) => {
    if (!selectedEmail) return;
    setAiLoading(action === "summarize" ? "summarize" : "suggest");
    try {
      const { data, error } = await invoke<any>({
        fn: "ai-router",
        body: { module: "email", action, email: selectedEmail },
      });
      if (error) throw new Error(error);
      if (action === "summarize") {
        setAiSummary(data.result);
      } else if (action === "suggest_replies_multiple") {
        const opts = data.result?.options;
        if (opts && opts.length > 0) {
          setAiReplyOptions(opts);
          setShowAiReplyOptions(true);
        }
      }
      return data.result;
    } catch (err: any) {
      const msg = err?.message || "";
      if (isCreditError(msg)) { emitCreditError(); return; }
      toast({ title: "Erro na IA", description: msg || "Tente novamente.", variant: "destructive" });
    } finally {
      setAiLoading(null);
    }
  }, [invoke]);

  const handleInboxIntelligence = useCallback(async (emails: EmailItem[]) => {
    if (emails.length === 0) return;
    setAiLoading("inbox");
    try {
      const batch = emails.slice(0, 40);
      const { data, error } = await invoke<any>({
        fn: "ai-router",
        body: {
          module: "email",
          action: "batch_analyze",
          emails: batch.map(e => ({
            from: e.from, subject: e.subject, body: e.body,
            unread: e.unread, date: e.date, starred: e.starred,
            hasAttachment: e.hasAttachment,
          })),
        },
      });
      if (error) throw new Error(error);
      setInboxIntelligence(data.result);
      setShowInboxPanel(true);
    } catch (err: any) {
      const msg = err?.message || "";
      if (isCreditError(msg)) { emitCreditError(); return; }
      toast({ title: "Erro na análise", description: msg, variant: "destructive" });
    } finally {
      setAiLoading(null);
    }
  }, [invoke]);

  const handleDailySummary = useCallback(async (emails: EmailItem[]) => {
    if (emails.length === 0) return;
    setAiLoading("daily");
    setShowDailySummary(true);
    setDailySummary(null);
    try {
      const todayStr = new Date().toLocaleDateString("pt-BR");
      const { data, error } = await invoke<any>({
        fn: "ai-router",
        body: {
          module: "email",
          action: "daily_summary",
          today_date: todayStr,
          emails: emails.slice(0, 60).map(e => ({
            from: e.from, subject: e.subject, body: e.body,
            unread: e.unread, date: e.date, starred: e.starred,
            hasAttachment: e.hasAttachment,
          })),
        },
      });
      if (error) throw new Error(error);
      setDailySummary(data.result);
    } catch (err: any) {
      const msg = err?.message || "";
      if (isCreditError(msg)) { emitCreditError(); return; }
      toast({ title: "Erro no resumo diário", description: msg, variant: "destructive" });
      setShowDailySummary(false);
    } finally {
      setAiLoading(null);
    }
  }, [invoke]);

  const handleComposeAi = useCallback(async (composeBody: string, composeTo: string) => {
    if (!composeAiPrompt.trim() && !composeBody.trim()) return null;
    setAiLoading("compose_ai");
    try {
      const { data, error } = await invoke<any>({
        fn: "ai-router",
        body: {
          module: "email",
          action: "compose_ai",
          context: {
            prompt: composeAiPrompt || "Melhore este e-mail",
            recipient: composeTo,
            tone: "profissional",
            existingBody: composeBody || undefined,
          },
        },
      });
      if (error) throw new Error(error);
      if (data.result) {
        setAiComposeSuggestion(null);
        setShowComposeAiPrompt(false);
        setComposeAiPrompt("");
        toast({ title: "Texto gerado pela IA", description: "Conteúdo inserido no e-mail." });
        return data.result as string;
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (isCreditError(msg)) { emitCreditError(); return null; }
      toast({ title: "Erro na IA", description: msg, variant: "destructive" });
    } finally {
      setAiLoading(null);
    }
    return null;
  }, [composeAiPrompt, invoke]);

  const handleSmartSearch = useCallback(async () => {
    if (!aiSmartSearch.trim()) return null;
    setSmartSearchLoading(true);
    try {
      const { data, error } = await invoke<any>({
        fn: "ai-router",
        body: { module: "email", action: "smart_search", query: aiSmartSearch },
      });
      if (error) throw new Error(error);
      const gmailQuery = data.result?.trim() || "";
      if (gmailQuery) {
        toast({ title: "Busca inteligente", description: `Query: ${gmailQuery}` });
        return gmailQuery;
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (isCreditError(msg)) { emitCreditError(); return null; }
      toast({ title: "Erro na busca", description: msg, variant: "destructive" });
    } finally {
      setSmartSearchLoading(false);
    }
    return null;
  }, [aiSmartSearch, invoke]);

  // Auto-organize: analyze emails and suggest/apply Gmail labels
  const [autoOrganizeLoading, setAutoOrganizeLoading] = useState(false);
  const [organizeProgress, setOrganizeProgress] = useState<{ current: number; total: number } | null>(null);

  // Track already-organized email IDs to avoid duplicates
  const [organizedEmailIds, setOrganizedEmailIds] = useState<Set<string>>(() => {
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
    setOrganizedEmailIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
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
      emailId: string; subject: string; from: string;
      suggestedLabels: string[]; newLabels: string[]; removeLabels: string[];
      reason: string; confidence: "high" | "medium" | "low";
      emailType: string; selected: boolean;
    }>;
    summary: string;
    stats: { total_to_organize: number; already_organized: number; newsletters_found: number; high_priority: number };
  } | null>(null);

  const handleAutoOrganize = useCallback(async (emails: EmailItem[], availableLabels?: Array<{ id: string; name: string }>) => {
    if (emails.length === 0) return null;
    setAutoOrganizeLoading(true);
    setOrganizeProgress(null);
    try {
      // Filter out already-organized emails
      const unorganized = emails.filter(e => !organizedEmailIds.has(e.id));
      if (unorganized.length === 0) {
        toast({ title: "Tudo organizado!", description: "Todos os e-mails já foram organizados anteriormente." });
        setAutoOrganizeLoading(false);
        return null;
      }
      // Process up to 300 emails in chunks of 80 (smaller chunks = better AI accuracy)
      const fullBatch = unorganized.slice(0, 300);
      const ORGANIZE_CHUNK = 80;
      const chunks: EmailItem[][] = [];
      for (let i = 0; i < fullBatch.length; i += ORGANIZE_CHUNK) {
        chunks.push(fullBatch.slice(i, i + ORGANIZE_CHUNK));
      }

      let allRaw: any[] = [];
      let lastSummary = "";
      let mergedStats = { total_to_organize: 0, already_organized: 0, newsletters_found: 0, high_priority: 0 };
      let failedChunks = 0;

      for (let ci = 0; ci < chunks.length; ci++) {
        const chunk = chunks[ci];
        setOrganizeProgress({ current: ci, total: chunks.length });
        try {
          const { data, error } = await invoke<any>({
            fn: "ai-router",
            body: {
              module: "email",
              action: "auto_organize",
              emails: chunk.map(e => ({
                id: e.id,
                from: String(e.from || "").slice(0, 120),
                subject: String(e.subject || "").slice(0, 200),
                body: String(e.body || "").slice(0, 250),
                labels: (e.labels || []).slice(0, 10),
              })),
              context: { available_labels: (availableLabels || []).slice(0, 100) },
            },
          });
          if (error) {
            failedChunks++;
            console.warn("Auto-organize chunk failed:", error);
            continue;
          }

          const assignments = data?.result?.assignments;
          if (!Array.isArray(assignments)) {
            failedChunks++;
            console.warn("Auto-organize: unexpected response", data?.result);
            continue;
          }

          const chunkRaw = assignments
            .filter((a: any) => typeof a.index === "number" && a.index >= 0 && a.index < chunk.length)
            .map((a: any) => ({
              ...a,
              _email: chunk[a.index],
            }));
          allRaw = [...allRaw, ...chunkRaw];
          lastSummary = data?.result?.summary || lastSummary;
          const cs = data?.result?.stats || {};
          mergedStats.total_to_organize += cs.total_to_organize || 0;
          mergedStats.already_organized += cs.already_organized || 0;
          mergedStats.newsletters_found += cs.newsletters_found || 0;
          mergedStats.high_priority += cs.high_priority || 0;
        } catch (chunkErr) {
          failedChunks++;
          console.warn("Auto-organize chunk error:", chunkErr);
        }
      }

      if (allRaw.length === 0 && failedChunks > 0) {
        toast({ title: "Erro na organização", description: "Todas as análises falharam. Tente novamente.", variant: "destructive" });
        return null;
      }

      const labelNameMap = new Map(
        (availableLabels || []).map(l => [l.id, l.name])
      );
      const resolveLabelName = (l: any) => {
        const s = String(l).slice(0, 100);
        return labelNameMap.get(s) || s;
      };

      const assignments = allRaw
        .filter((a: any) => (a.add_labels?.length > 0) || (a.new_labels?.length > 0))
        .map((a: any) => {
          const email = a._email;
          if (!email) return null;
          const suggestedLabels = (a.add_labels || []).map(resolveLabelName);
          const newLabels = (a.new_labels || []).map((l: any) => String(l).slice(0, 50));
          // Filter out redundant: if email already has all suggested labels, skip
          const currentLabels = new Set((email.labels || []).map((l: string) => l.toLowerCase()));
          const hasAllSuggested = suggestedLabels.length > 0 &&
            suggestedLabels.every((sl: string) => currentLabels.has(sl.toLowerCase()));
          const hasNoNewLabels = newLabels.length === 0;
          if (hasAllSuggested && hasNoNewLabels) return null;
          return {
            emailId: email.id,
            subject: String(email.subject || "").slice(0, 200),
            from: String(email.from || "").slice(0, 120),
            suggestedLabels,
            newLabels,
            removeLabels: (a.remove_labels || []).map(resolveLabelName),
            reason: String(a.reason || "").slice(0, 200),
            confidence: (["high", "medium", "low"].includes(a.confidence) ? a.confidence : "medium") as "high" | "medium" | "low",
            emailType: String(a.email_type || "personal").slice(0, 20),
            selected: a.confidence !== "low",
          };
        })
        .filter(Boolean);
      
      setAutoOrganizeResults({ assignments, summary: lastSummary, stats: mergedStats });

      if (failedChunks > 0 && assignments.length > 0) {
        toast({
          title: "Análise parcial",
          description: `${failedChunks} lote(s) falharam, mas ${assignments.length} sugestões foram geradas.`,
        });
      }

      return { assignments, summary: lastSummary, stats: mergedStats };
    } catch (err: any) {
      const msg = err?.message || "";
      if (isCreditError(msg)) { emitCreditError(); return null; }
      toast({ title: "Erro na organização", description: msg, variant: "destructive" });
      return null;
    } finally {
      setAutoOrganizeLoading(false);
      setOrganizeProgress(null);
    }
  }, [invoke, organizedEmailIds]);

  // Inbox cleaner: scan for low-value/bulk emails (chunked processing)
  const [cleanerLoading, setCleanerLoading] = useState(false);
  const [cleanerGroups, setCleanerGroups] = useState<Array<{
    sender: string; icon: string; count: number; emailIds: string[];
    suggestion: string; action: "trash" | "archive"; reason: string;
    isNewsletter: boolean; estimatedSpace: string;
  }> | null>(null);
  const [cleanerProgress, setCleanerProgress] = useState<{ current: number; total: number } | null>(null);
  const cleanerAbortRef = useRef(false);

  // Process a single chunk for cleanup analysis
  const processCleanerChunk = useCallback(async (chunkEmails: EmailItem[]) => {
    // Add timeout protection per chunk (60s)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    
    try {
      const { data, error } = await invoke<any>({
        fn: "ai-router",
        body: {
          module: "email",
          action: "cleanup_analysis",
          emails: chunkEmails.map(e => ({
            id: e.id, from: e.from, email: e.email, subject: e.subject,
            body: (e.body || "").slice(0, 300), date: e.date, unread: e.unread,
          })),
        },
      });
      if (error) throw new Error(error);
      
      const rawGroups = data?.result?.cleanup_groups;
      if (!Array.isArray(rawGroups)) {
        console.warn("Cleaner: unexpected response format", data?.result);
        return [];
      }
      
      return rawGroups.map((g: any) => {
        // Validate email_indices are within bounds
        const validIndices = (Array.isArray(g.email_indices) ? g.email_indices : [])
          .filter((idx: any) => typeof idx === "number" && idx >= 0 && idx < chunkEmails.length);
        
        return {
          sender: String(g.group_name || "Grupo").slice(0, 100),
          icon: String(g.icon || "📧").slice(0, 4),
          count: validIndices.length,
          emailIds: validIndices.map((idx: number) => chunkEmails[idx]?.id).filter(Boolean),
          suggestion: g.recommended_action === "trash" ? "Excluir" : "Arquivar",
          action: (g.recommended_action === "trash" ? "trash" : "archive") as "trash" | "archive",
          reason: String(g.reason || "").slice(0, 200),
          isNewsletter: !!g.is_newsletter,
          estimatedSpace: String(g.estimated_space_saved || "").slice(0, 20),
        };
      }).filter((g: any) => g.emailIds.length > 0);
    } finally {
      clearTimeout(timeout);
    }
  }, [invoke]);

  // Merge groups from multiple chunks by normalized sender name
  const mergeCleanerGroups = useCallback((allGroups: Array<any[]>) => {
    const merged = new Map<string, any>();
    for (const chunkGroups of allGroups) {
      for (const g of chunkGroups) {
        const key = g.sender.toLowerCase().trim();
        if (merged.has(key)) {
          const existing = merged.get(key)!;
          // Deduplicate emailIds
          const idSet = new Set([...existing.emailIds, ...g.emailIds]);
          existing.emailIds = [...idSet];
          existing.count = existing.emailIds.length;
          if (g.action === "trash" && existing.action !== "trash") existing.action = "trash";
          if (g.isNewsletter) existing.isNewsletter = true;
          // Keep the longer/more descriptive reason
          if (g.reason && g.reason.length > (existing.reason?.length || 0)) existing.reason = g.reason;
        } else {
          merged.set(key, { ...g, emailIds: [...new Set(g.emailIds)] });
        }
      }
    }
    return Array.from(merged.values()).sort((a, b) => b.count - a.count);
  }, []);

  // Chunked inbox cleaner with concurrency control
  const handleInboxCleaner = useCallback(async (emails: EmailItem[]) => {
    if (emails.length === 0) return null;
    setCleanerLoading(true);
    setCleanerGroups(null);
    setCleanerProgress(null);
    cleanerAbortRef.current = false;

    const maxEmails = Math.min(emails.length, 1500);
    const CHUNK_SIZE = 150;
    const CONCURRENCY = 3;
    const chunks: EmailItem[][] = [];
    for (let i = 0; i < maxEmails; i += CHUNK_SIZE) {
      chunks.push(emails.slice(i, i + CHUNK_SIZE));
    }

    const totalChunks = chunks.length;
    setCleanerProgress({ current: 0, total: totalChunks });

    try {
      const allResults: Array<any[]> = [];
      let completed = 0;
      let failedChunks = 0;

      // Process chunks with concurrency limit
      for (let i = 0; i < chunks.length; i += CONCURRENCY) {
        if (cleanerAbortRef.current) break;

        const batch = chunks.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map((chunk) => processCleanerChunk(chunk))
        );
        for (const r of results) {
          completed++;
          if (r.status === "fulfilled") {
            allResults.push(r.value);
          } else {
            failedChunks++;
            console.warn("Cleaner chunk failed:", r.reason);
          }
        }
        setCleanerProgress({ current: completed, total: totalChunks });
      }

      const merged = mergeCleanerGroups(allResults);
      setCleanerGroups(merged);
      setCleanerProgress(null);

      if (failedChunks > 0 && merged.length > 0) {
        toast({
          title: "Análise parcial",
          description: `${failedChunks} lote(s) falharam, mas ${merged.length} grupos foram identificados.`,
        });
      }

      return merged;
    } catch (err: any) {
      toast({ title: "Erro na limpeza", description: err?.message, variant: "destructive" });
      return null;
    } finally {
      setCleanerLoading(false);
    }
  }, [processCleanerChunk, mergeCleanerGroups]);

  const cancelCleaner = useCallback(() => {
    cleanerAbortRef.current = true;
  }, []);

  // Auto-categorize visible emails (debounced, only new IDs)
  const autoCategorizeEmails = useCallback(async (emailList: EmailItem[]) => {
    const uncached = emailList.filter(e => !emailCategories[e.id] && !categorizingIds.has(e.id));
    if (uncached.length === 0) return;
    const ids = uncached.map(e => e.id);
    setCategorizingIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
    try {
      const { data, error } = await invoke<any>({
        fn: "ai-router",
        body: {
          module: "email",
          action: "batch_categorize",
          emails: uncached.map(e => ({ id: e.id, from: e.from, subject: e.subject, body: e.body })),
        },
      });
      if (error || !data?.result?.results) return;
      const newCategories: EmailCategoryMap = {};
      for (const r of data.result.results) {
        const email = uncached[r.index];
        if (email) {
          newCategories[email.id] = { category: r.category, priority: r.priority, requires_action: r.requires_action };
        }
      }
      const merged = { ...emailCategories, ...newCategories };
      saveEmailCategories(merged);
    } catch (err) {
      console.warn("Auto-categorize error:", err);
    } finally {
      setCategorizingIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    }
  }, [emailCategories, categorizingIds, invoke, saveEmailCategories]);

  // Trigger auto-categorization based on folder emails (not filtered)
  const triggerAutoCategorize = useCallback((folderEmails: EmailItem[]) => {
    if (folderEmails.length === 0) return;
    // Build a key from the first 15 IDs to avoid re-triggering for same set
    const key = folderEmails.slice(0, 15).map(e => e.id).join(",");
    if (key === categorizedIdsRef.current) return;
    categorizedIdsRef.current = key;
    autoCategorizeEmails(folderEmails.slice(0, 15));
  }, [autoCategorizeEmails]);

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

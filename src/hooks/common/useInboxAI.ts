import { useState, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { isCreditError, emitCreditError } from "@/hooks/common/useCreditError";
import { invokeAI } from "@/lib/ai-router";

export interface SmartGroup {
  label: string;
  icon: string;
  itemIds: string[];
  reason: string;
}

export interface PriorityOverride {
  itemId: string;
  newPriority: number;
  reason: string;
}

export interface SuggestedAction {
  itemId: string;
  actions: { label: string; icon: string; type: "navigate" | "complete" | "defer" | "delegate" | "reply" }[];
}

export interface AutoTriageLabel {
  itemId: string;
  label: string;
  color: "red" | "blue" | "green" | "yellow" | "purple";
}

export interface QuickReply {
  text: string;
  tone: "formal" | "casual" | "assertive";
}

export interface InboxAIAnalysis {
  summary: string;
  urgentAlert: string | null;
  smartGroups: SmartGroup[];
  priorityOverrides: PriorityOverride[];
  suggestedActions: SuggestedAction[];
  autoTriageLabels: AutoTriageLabel[];
}

interface InboxItemForAI {
  id: string;
  type: "task" | "event" | "email" | "whatsapp";
  title: string;
  subtitle?: string;
  priority: number;
  timestamp: string;
  overdue?: boolean;
}

export type EmailCategoryMap = Record<string, { category: string; requires_action?: boolean }>;

export function useInboxAI() {
  const [analysis, setAnalysis] = useState<InboxAIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [quickReplies, setQuickReplies] = useState<Record<string, QuickReply[]>>({});
  const [quickReplyLoading, setQuickReplyLoading] = useState<string | null>(null);

  const analyzeInbox = useCallback(async (items: InboxItemForAI[]) => {
    if (items.length === 0) return;
    setLoading(true);
    try {
      const data = await invokeAI("inbox", { items, action: "analyze" });

      setAnalysis({
        summary: data.summary || "",
        urgentAlert: data.urgentAlert || null,
        smartGroups: data.smartGroups || [],
        priorityOverrides: data.priorityOverrides || [],
        suggestedActions: data.suggestedActions || [],
        autoTriageLabels: data.autoTriageLabels || [],
      });
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (isCreditError(msg)) { emitCreditError(); return; }
      console.error("Inbox AI error:", err);
      toast({ title: "Erro na análise IA", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  const getQuickReplies = useCallback(async (item: InboxItemForAI) => {
    setQuickReplyLoading(item.id);
    try {
      const data = await invokeAI("inbox", { items: [item], action: "quickReply" });
      setQuickReplies(prev => ({ ...prev, [item.id]: data.replies || [] }));
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (isCreditError(msg)) { emitCreditError(); return; }
      console.error("Quick reply error:", err);
      toast({ title: "Erro ao gerar respostas", variant: "destructive" });
    } finally {
      setQuickReplyLoading(null);
    }
  }, []);

  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
    setQuickReplies({});
  }, []);

  return {
    analysis,
    loading,
    analyzeInbox,
    clearAnalysis,
    quickReplies,
    quickReplyLoading,
    getQuickReplies,
  };
}

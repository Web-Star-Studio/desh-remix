// TODO: Migrar para edge function — acesso direto ao Supabase
import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { computeRelationshipScore } from "@/lib/contactScoring";

import { useAutomationEngine } from "@/hooks/automation/useAutomationEngine";

const STORAGE_KEY = "desh-contact-followup-alerted";
const CHECK_INTERVAL = 3_600_000; // 1 hour
const SCORE_THRESHOLD = 30;
const INACTIVITY_DAYS = 30;

export interface FollowupAlert {
  contactId: string;
  contactName: string;
  contactCompany: string;
  score: number;
  daysSince: number;
  reason: "low_score" | "inactive";
  aiSuggestion?: {
    subject: string;
    message: string;
    channel: string;
    urgency: string;
  } | null;
  loadingSuggestion: boolean;
}

function getAlerted(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function markAlerted(contactId: string) {
  const data = getAlerted();
  data[contactId] = Date.now();
  const cutoff = Date.now() - 259200000;
  for (const key of Object.keys(data)) {
    if (data[key] < cutoff) delete data[key];
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function useContactFollowupAlerts() {
  const { user } = useAuth();

  const { fireLowScoreAlert } = useAutomationEngine();
  const [alerts, setAlerts] = useState<FollowupAlert[]>([]);
  const checkedRef = useRef(false);

  const fetchAISuggestion = useCallback(
    async (alert: FollowupAlert): Promise<FollowupAlert["aiSuggestion"]> => {
      void alert;
      return null;
    },
    [],
  );

  const loadSuggestion = useCallback(
    async (contactId: string) => {
      setAlerts((prev) =>
        prev.map((a) => (a.contactId === contactId ? { ...a, loadingSuggestion: true } : a)),
      );
      const alert = alerts.find((a) => a.contactId === contactId);
      if (!alert) return;
      const suggestion = await fetchAISuggestion(alert);
      setAlerts((prev) =>
        prev.map((a) =>
          a.contactId === contactId
            ? { ...a, aiSuggestion: suggestion, loadingSuggestion: false }
            : a,
        ),
      );
    },
    [alerts, fetchAISuggestion],
  );

  const dismissAlert = useCallback((contactId: string) => {
    markAlerted(contactId);
    setAlerts((prev) => prev.filter((a) => a.contactId !== contactId));
  }, []);

  const checkContacts = useCallback(async () => {
    if (!user) return;

    // 1. Fetch contacts with their interaction summaries
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, name, company")
      .eq("user_id", user.id)
      .limit(200);

    if (!contacts || contacts.length === 0) return;

    const contactIds = contacts.map((c) => c.id);

    // 2. Fetch all interactions for these contacts in a single query
    const { data: interactions } = await supabase
      .from("contact_interactions")
      .select("contact_id, type, interaction_date")
      .eq("user_id", user.id)
      .in("contact_id", contactIds);

    // 3. Build summary map
    const summaryMap: Record<
      string,
      { count: number; lastDate: string | null; typeCounts: Record<string, number> }
    > = {};
    for (const ci of interactions || []) {
      if (!summaryMap[ci.contact_id]) {
        summaryMap[ci.contact_id] = { count: 0, lastDate: null, typeCounts: {} };
      }
      const s = summaryMap[ci.contact_id];
      s.count++;
      s.typeCounts[ci.type] = (s.typeCounts[ci.type] || 0) + 1;
      if (!s.lastDate || ci.interaction_date > s.lastDate) {
        s.lastDate = ci.interaction_date;
      }
    }

    const now = Date.now();
    const alerted = getAlerted();
    const newAlerts: FollowupAlert[] = [];

    for (const contact of contacts) {
      // Skip if already alerted recently
      if (alerted[contact.id]) continue;

      const summary = summaryMap[contact.id] ?? { count: 0, lastDate: null, typeCounts: {} };
      const score = computeRelationshipScore(summary);

      const daysSince = summary.lastDate
        ? Math.floor((now - new Date(summary.lastDate).getTime()) / 86400000)
        : 999;

      const isLowScore = summary.count > 0 && score < SCORE_THRESHOLD;
      const isInactive = daysSince >= INACTIVITY_DAYS;

      if (isLowScore || isInactive) {
        newAlerts.push({
          contactId: contact.id,
          contactName: contact.name,
          contactCompany: contact.company || "",
          score,
          daysSince,
          reason: isLowScore ? "low_score" : "inactive",
          aiSuggestion: null,
          loadingSuggestion: false,
        });

        // Fire automation rule for low-score contacts
        if (isLowScore) {
          fireLowScoreAlert(contact.id, contact.name, score, daysSince);
        }
      }
    }

    if (newAlerts.length > 0) {
      setAlerts(newAlerts.slice(0, 5)); // Cap at 5 alerts

      // Auto-fetch AI suggestion for the first alert
      const first = newAlerts[0];
      const suggestion = await fetchAISuggestion(first);
      setAlerts((prev) =>
        prev.map((a) =>
          a.contactId === first.contactId
            ? { ...a, aiSuggestion: suggestion, loadingSuggestion: false }
            : a,
        ),
      );
    }
  }, [user, fetchAISuggestion, fireLowScoreAlert]);

  // Check on mount + interval
  useEffect(() => {
    if (!user || checkedRef.current) return;
    checkedRef.current = true;

    // Delay first check to avoid blocking initial load
    const timer = setTimeout(checkContacts, 15000);
    const interval = setInterval(checkContacts, CHECK_INTERVAL);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [user, checkContacts]);

  return { alerts, dismissAlert, loadSuggestion };
}

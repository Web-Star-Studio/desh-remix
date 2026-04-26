// `email_snoozes` is a legacy Supabase table — its migration to apps/api
// belongs in the email feature wave. We've migrated the Composio calls but
// the persistence layer still hits Supabase (and will fail with the dead
// session). Acceptable: snooze is a non-critical feature; widget callers
// silently ignore failures here.
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGmailActions } from "@/hooks/integrations/useGmailActions";
import { toast } from "@/hooks/use-toast";

export function useEmailSnooze(gmailConnected: boolean) {
  const { user } = useAuth();
  const gmail = useGmailActions();
  const [snoozedIds, setSnoozedIds] = useState<Set<string>>(new Set());
  const [showSnoozePopover, setShowSnoozePopover] = useState<string | null>(null);

  // Load snoozed emails from DB on mount, poll for expired snoozes
  useEffect(() => {
    if (!user) return;
    const loadSnoozes = async () => {
      const { data } = await supabase
        .from("email_snoozes" as any)
        .select("gmail_id")
        .eq("restored", false);
      if (data) setSnoozedIds(new Set(data.map((s: any) => s.gmail_id)));
    };
    loadSnoozes();
    const interval = setInterval(async () => {
      const { data: expired } = await supabase
        .from("email_snoozes" as any)
        .select("*")
        .eq("restored", false)
        .lte("snooze_until", new Date().toISOString());
      if (expired && expired.length > 0 && gmailConnected) {
        for (const s of expired) {
          try {
            await gmail.modifyLabels({
              message_id: (s as any).gmail_id,
              addLabelIds: (s as any).original_labels || ["INBOX"],
            });
            await supabase.from("email_snoozes" as any).update({ restored: true }).eq("id", (s as any).id);
            setSnoozedIds(prev => { const next = new Set(prev); next.delete((s as any).gmail_id); return next; });
            toast({ title: "⏰ E-mail retornou!", description: (s as any).subject || "E-mail adiado restaurado." });
          } catch { /* ignore */ }
        }
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [user, gmailConnected, gmail]);

  const snoozeEmail = useCallback(async (emailId: string, snoozeUntil: Date, email?: { subject?: string; from?: string; labels?: string[] }) => {
    if (!gmailConnected || !user) return;
    try {
      await gmail.modifyLabels({ message_id: emailId, removeLabelIds: ["INBOX"] });
      // Save snooze record
      await supabase.from("email_snoozes" as any).insert({
        user_id: user.id,
        gmail_id: emailId,
        snooze_until: snoozeUntil.toISOString(),
        subject: email?.subject || null,
        from_name: email?.from || null,
        original_labels: email?.labels || ["INBOX"],
      });
      setSnoozedIds(prev => new Set(prev).add(emailId));
      toast({
        title: "⏰ E-mail adiado",
        description: `Retornará em ${snoozeUntil.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`,
      });
    } catch (err: any) {
      toast({ title: "Erro ao adiar", description: err?.message, variant: "destructive" });
    }
  }, [gmailConnected, user, gmail]);

  return {
    snoozedIds,
    showSnoozePopover,
    setShowSnoozePopover,
    snoozeEmail,
  };
}

// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { useComposioWorkspaceId } from "@/hooks/integrations/useComposioWorkspaceId";
import { toast } from "@/hooks/use-toast";

export function useEmailSnooze(gmailConnected: boolean) {
  const { user } = useAuth();
  const { invoke } = useEdgeFn();
  const composioWsId = useComposioWorkspaceId();
  const [snoozedIds, setSnoozedIds] = useState<Set<string>>(new Set());
  const [showSnoozePopover, setShowSnoozePopover] = useState<string | null>(null);

  // Workspace-aware invoke wrapper
  const wsInvoke = useCallback(<T,>(opts: { fn: string; body: Record<string, any> }) => {
    const body = { ...opts.body, workspace_id: composioWsId, default_workspace_id: composioWsId };
    return invoke<T>({ ...opts, body });
  }, [invoke, composioWsId]);

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
            await wsInvoke<any>({
              fn: "composio-proxy",
              body: {
                service: "gmail",
                path: `/gmail/v1/users/me/messages/${(s as any).gmail_id}/modify`,
                method: "POST",
                body: { addLabelIds: (s as any).original_labels || ["INBOX"], removeLabelIds: [] },
              },
            });
            await supabase.from("email_snoozes" as any).update({ restored: true }).eq("id", (s as any).id);
            setSnoozedIds(prev => { const next = new Set(prev); next.delete((s as any).gmail_id); return next; });
            toast({ title: "⏰ E-mail retornou!", description: (s as any).subject || "E-mail adiado restaurado." });
          } catch { /* ignore */ }
        }
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [user, gmailConnected, wsInvoke]);

  const snoozeEmail = useCallback(async (emailId: string, snoozeUntil: Date, email?: { subject?: string; from?: string; labels?: string[] }) => {
    if (!gmailConnected || !user) return;
    try {
      await wsInvoke<any>({
        fn: "composio-proxy",
        body: {
          service: "gmail",
          path: `/gmail/v1/users/me/messages/${emailId}/modify`,
          method: "POST",
          body: { removeLabelIds: ["INBOX"] },
        },
      });
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
  }, [gmailConnected, user, wsInvoke]);

  return {
    snoozedIds,
    showSnoozePopover,
    setShowSnoozePopover,
    snoozeEmail,
  };
}

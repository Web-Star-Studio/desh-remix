// `gmail_labels_cache` is a legacy Supabase table — its migration belongs in
// the email feature wave. The Composio create/delete/rename calls have moved
// to /composio/execute via useGmailActions; the local cache + realtime
// channel still hit Supabase and will fail with the dead session. The label
// sidebar will simply show whatever was last cached locally.
import { useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { useGmailActions } from "@/hooks/integrations/useGmailActions";
import { toast } from "@/hooks/use-toast";
import type { LabelColor } from "@/components/email/types";

export interface GmailLabelCached {
  id: string;
  gmailLabelId: string;
  connectionId: string;
  name: string;
  labelType: string;
  colorBg: string | null;
  colorText: string | null;
  messagesTotal: number;
  messagesUnread: number;
}

/** Maps Gmail label colors to our LabelColor system */
function mapGmailColor(bgColor: string | null): LabelColor {
  if (!bgColor) return "blue";
  const lower = bgColor.toLowerCase();
  if (lower.includes("#fb4c2f") || lower.includes("#cc3a21") || lower.includes("#ac2b16")) return "red";
  if (lower.includes("#16a765") || lower.includes("#094228") || lower.includes("#2da2bb")) return "green";
  if (lower.includes("#ffad47") || lower.includes("#fad165") || lower.includes("#ebdbde")) return "yellow";
  if (lower.includes("#a46a21") || lower.includes("#f691b3") || lower.includes("#cf8933")) return "orange";
  if (lower.includes("#653e9b") || lower.includes("#b694e8") || lower.includes("#a479e2")) return "purple";
  return "blue";
}

export function useGmailLabels(gmailConnections: Array<{ id: string }>) {
  const { user } = useAuth();
  const { invoke } = useEdgeFn();
  const gmail = useGmailActions();
  const [labels, setLabels] = useState<GmailLabelCached[]>([]);
  const [loading, setLoading] = useState(false);

  /** Load labels from cache */
  const loadLabels = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("gmail_labels_cache" as any)
      .select("*")
      .eq("user_id", user.id);
    if (error) {
      console.error("[useGmailLabels] Load error:", error);
      return;
    }
    setLabels((data || []).map((r: any) => ({
      id: `gmail:${r.connection_id}:${r.gmail_label_id}`,
      gmailLabelId: r.gmail_label_id,
      connectionId: r.connection_id,
      name: r.name,
      labelType: r.label_type,
      colorBg: r.color_bg,
      colorText: r.color_text,
      messagesTotal: r.messages_total || 0,
      messagesUnread: r.messages_unread || 0,
    })));
  }, [user]);

  useEffect(() => {
    if (user && gmailConnections.length > 0) loadLabels();
  }, [user, gmailConnections.length, loadLabels]);

  // Realtime subscription for label changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`gmail-labels-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "gmail_labels_cache", filter: `user_id=eq.${user.id}` }, () => {
        loadLabels();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadLabels]);

  /** User labels only (filtered) */
  const userLabels = useMemo(() =>
    labels.filter(l => l.labelType === "user"),
    [labels]
  );

  /** System/category labels */
  const systemLabels = useMemo(() =>
    labels.filter(l => l.labelType !== "user"),
    [labels]
  );

  /** Labels formatted for sidebar display */
  /** Deduplicated labels for sidebar — merge counts across connections for same label name */
  const sidebarLabels = useMemo(() => {
    // Group by name to merge cross-account duplicates
    const byName = new Map<string, { gmailId: string; name: string; colorBg: string | null; total: number; unread: number; connectionId: string }>();
    for (const l of userLabels) {
      const existing = byName.get(l.name);
      if (existing) {
        existing.total += l.messagesTotal;
        existing.unread += l.messagesUnread;
      } else {
        byName.set(l.name, { gmailId: l.gmailLabelId, name: l.name, colorBg: l.colorBg, total: l.messagesTotal, unread: l.messagesUnread, connectionId: l.connectionId });
      }
    }
    return Array.from(byName.values()).map(l => ({
      id: `gmail:${l.gmailId}`,
      gmailId: l.gmailId,
      name: l.name,
      color: mapGmailColor(l.colorBg),
      messageCount: l.total,
      unreadCount: l.unread,
      connectionId: l.connectionId,
    }));
  }, [userLabels]);

  /** Create a new Gmail label */
  const createLabel = useCallback(async (name: string, connectionId?: string) => {
    setLoading(true);
    try {
      const connId = connectionId || gmailConnections[0]?.id;
      if (!connId) throw new Error("No Gmail connection");
      
      const data = await gmail.execute<any>("GMAIL_CREATE_LABEL", {
        name,
        label_list_visibility: "labelShow",
        message_list_visibility: "show",
      });

      // Cache locally
      if (data?.id) {
        await supabase.from("gmail_labels_cache" as any).upsert({
          user_id: user!.id,
          connection_id: connId,
          gmail_label_id: data.id,
          name: data.name || name,
          label_type: "user",
          messages_total: 0,
          messages_unread: 0,
          synced_at: new Date().toISOString(),
        }, { onConflict: "user_id,connection_id,gmail_label_id" });
        await loadLabels();
      }
      toast({ title: `Etiqueta "${name}" criada no Gmail` });
      return data;
    } catch (err: any) {
      toast({ title: "Erro ao criar etiqueta", description: err.message, variant: "destructive" });
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, gmailConnections, gmail, loadLabels]);

  /** Rename a Gmail label. Composio's catalog (as of this migration) doesn't
   * expose a dedicated rename action, so this updates the local cache only.
   * The remote Gmail label keeps its original name until rename support lands.
   */
  const renameLabel = useCallback(async (gmailLabelId: string, newName: string, _connectionId?: string) => {
    setLoading(true);
    try {
      await supabase.from("gmail_labels_cache" as any)
        .update({ name: newName, synced_at: new Date().toISOString() })
        .eq("user_id", user!.id)
        .eq("gmail_label_id", gmailLabelId);
      await loadLabels();
      toast({ title: `Etiqueta renomeada para "${newName}"` });
    } catch (err: any) {
      toast({ title: "Erro ao renomear etiqueta", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, loadLabels]);

  /** Delete a Gmail label */
  const deleteLabel = useCallback(async (gmailLabelId: string, _connectionId?: string) => {
    setLoading(true);
    try {
      await gmail.execute("GMAIL_DELETE_LABEL", { label_id: gmailLabelId });

      await supabase.from("gmail_labels_cache" as any)
        .delete()
        .eq("user_id", user!.id)
        .eq("gmail_label_id", gmailLabelId);
      await loadLabels();
      toast({ title: "Etiqueta removida do Gmail" });
    } catch (err: any) {
      toast({ title: "Erro ao remover etiqueta", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, gmail, loadLabels]);

  /** Trigger label sync for all connections (legacy gmail-gateway edge fn —
   * stays bound to Supabase until the email feature wave migrates it). */
  const refreshLabels = useCallback(async () => {
    if (gmailConnections.length === 0) return;
    setLoading(true);
    try {
      for (const conn of gmailConnections) {
        await invoke({ fn: "gmail-gateway", body: { action: "sync", folder: "inbox", syncLabels: true, connectionId: conn.id, mode: "full", batchSize: 1 } });
      }
      await loadLabels();
    } catch (err) {
      console.error("[useGmailLabels] Refresh error:", err);
    } finally {
      setLoading(false);
    }
  }, [gmailConnections, invoke, loadLabels]);

  return {
    labels,
    userLabels,
    systemLabels,
    sidebarLabels,
    loading,
    loadLabels,
    createLabel,
    renameLabel,
    deleteLabel,
    refreshLabels,
  };
}

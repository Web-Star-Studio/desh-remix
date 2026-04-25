import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export interface NoteShareRecord {
  id: string;
  note_id: string;
  owner_id: string;
  shared_with_id: string;
  permission: "view" | "edit";
  created_at: string;
  user_email?: string;
}

export interface NotePresenceRecord {
  id: string;
  note_id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  is_editing: boolean;
  last_seen_at: string;
}

const HEARTBEAT_MS = 30_000; // 30s heartbeat

export function useNoteSharing(noteId: string | null) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;
  const userName = session?.user?.user_metadata?.full_name || session?.user?.email?.split("@")[0] || "Anônimo";

  const [shares, setShares] = useState<NoteShareRecord[]>([]);
  const [presence, setPresence] = useState<NotePresenceRecord[]>([]);
  const [editLock, setEditLock] = useState<NotePresenceRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch shares for current note ────────────────────────────
  const fetchShares = useCallback(async () => {
    if (!noteId || !userId) return;
    const { data } = await supabase
      .from("note_shares")
      .select("*")
      .eq("note_id", noteId);
    if (data) setShares(data as NoteShareRecord[]);
  }, [noteId, userId]);

  // ── Fetch presence for current note ──────────────────────────
  const fetchPresence = useCallback(async () => {
    if (!noteId) return;
    // Clean stale first
    await supabase.rpc("cleanup_stale_note_presence" as any);
    const { data } = await supabase
      .from("note_presence")
      .select("*")
      .eq("note_id", noteId);
    if (data) {
      const records = data as NotePresenceRecord[];
      setPresence(records);
      const editor = records.find(p => p.is_editing && p.user_id !== userId);
      setEditLock(editor || null);
    }
  }, [noteId, userId]);

  // ── Register presence (upsert) ───────────────────────────────
  const registerPresence = useCallback(async (editing = false) => {
    if (!noteId || !userId) return;
    await supabase
      .from("note_presence")
      .upsert({
        note_id: noteId,
        user_id: userId,
        user_email: userEmail || null,
        user_name: userName,
        is_editing: editing,
        last_seen_at: new Date().toISOString(),
      } as any, { onConflict: "note_id,user_id" });
  }, [noteId, userId, userEmail, userName]);

  // ── Remove presence ──────────────────────────────────────────
  const removePresence = useCallback(async () => {
    if (!noteId || !userId) return;
    await supabase
      .from("note_presence")
      .delete()
      .eq("note_id", noteId)
      .eq("user_id", userId);
  }, [noteId, userId]);

  // ── Acquire edit lock ────────────────────────────────────────
  const acquireEditLock = useCallback(async (): Promise<boolean> => {
    if (!noteId || !userId) return false;
    // Check if someone else is editing
    const { data } = await supabase
      .from("note_presence")
      .select("*")
      .eq("note_id", noteId)
      .eq("is_editing", true)
      .neq("user_id", userId);
    if (data && data.length > 0) {
      const editor = data[0] as NotePresenceRecord;
      toast({
        title: "Nota bloqueada",
        description: `${editor.user_name || editor.user_email} está editando esta nota`,
        variant: "destructive",
      });
      return false;
    }
    await registerPresence(true);
    return true;
  }, [noteId, userId, registerPresence]);

  // ── Release edit lock ────────────────────────────────────────
  const releaseEditLock = useCallback(async () => {
    await registerPresence(false);
  }, [registerPresence]);

  // ── Share a note with a user ─────────────────────────────────
  const shareNote = useCallback(async (email: string, permission: "view" | "edit" = "view") => {
    if (!noteId || !userId) return;
    setLoading(true);
    try {
      // Look up user by email via profiles or auth
      const { data: profiles } = await supabase
        .from("profiles" as any)
        .select("id, email")
        .eq("email", email)
        .limit(1) as any;

      const targetUserId = (profiles as any[])?.[0]?.id;
      if (!targetUserId) {
        toast({ title: "Usuário não encontrado", description: `Nenhuma conta encontrada para ${email}`, variant: "destructive" });
        return;
      }
      if (targetUserId === userId) {
        toast({ title: "Não é possível compartilhar consigo mesmo", variant: "destructive" });
        return;
      }

      const { error } = await supabase
        .from("note_shares")
        .upsert({
          note_id: noteId,
          owner_id: userId,
          shared_with_id: targetUserId,
          permission,
        } as any, { onConflict: "note_id,shared_with_id" });

      if (error) throw error;
      toast({ title: "Nota compartilhada", description: `Compartilhada com ${email}` });
      await fetchShares();
    } catch (err: any) {
      toast({ title: "Erro ao compartilhar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [noteId, userId, fetchShares]);

  // ── Remove share ─────────────────────────────────────────────
  const removeShare = useCallback(async (shareId: string) => {
    await supabase.from("note_shares").delete().eq("id", shareId);
    await fetchShares();
    toast({ title: "Acesso removido" });
  }, [fetchShares]);

  // ── Update permission ────────────────────────────────────────
  const updatePermission = useCallback(async (shareId: string, permission: "view" | "edit") => {
    await supabase.from("note_shares").update({ permission } as any).eq("id", shareId);
    await fetchShares();
  }, [fetchShares]);

  // ── Check if current user has access to a note ───────────────
  const checkAccess = useCallback(async (nId: string): Promise<"owner" | "edit" | "view" | null> => {
    if (!userId) return null;
    // Check if owner (note in user_data belongs to user)
    const { data: noteRow } = await supabase
      .from("user_data")
      .select("user_id")
      .eq("id", nId)
      .single();
    if (noteRow && (noteRow as any).user_id === userId) return "owner";

    // Check share record
    const { data: share } = await supabase
      .from("note_shares")
      .select("permission")
      .eq("note_id", nId)
      .eq("shared_with_id", userId)
      .single();
    if (share) return (share as any).permission as "view" | "edit";
    return null;
  }, [userId]);

  // ── Get notes shared with me ─────────────────────────────────
  const getSharedWithMe = useCallback(async () => {
    if (!userId) return [];
    const { data } = await supabase
      .from("note_shares")
      .select("note_id, permission, owner_id")
      .eq("shared_with_id", userId);
    if (!data || data.length === 0) return [];

    // Fetch actual note data
    const noteIds = data.map((d: any) => d.note_id);
    const { data: notes } = await supabase
      .from("user_data")
      .select("id, data, user_id")
      .in("id", noteIds)
      .eq("data_type", "note");

    return (notes || []).map((n: any) => ({
      ...n.data,
      id: n.id,
      shared: true,
      permission: data.find((d: any) => d.note_id === n.id)?.permission || "view",
    }));
  }, [userId]);

  // ── Realtime subscription for presence changes ───────────────
  useEffect(() => {
    if (!noteId) return;
    fetchShares();
    fetchPresence();
    registerPresence(false);

    // Heartbeat to keep presence alive
    heartbeatRef.current = setInterval(() => {
      registerPresence(false);
    }, HEARTBEAT_MS);

    // Subscribe to presence changes
    const channel = supabase
      .channel(`note-presence-${noteId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "note_presence",
        filter: `note_id=eq.${noteId}`,
      }, () => {
        fetchPresence();
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "note_shares",
        filter: `note_id=eq.${noteId}`,
      }, () => {
        fetchShares();
      })
      .subscribe();

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      removePresence();
      supabase.removeChannel(channel);
    };
  }, [noteId]);

  return {
    shares,
    presence,
    editLock,
    loading,
    shareNote,
    removeShare,
    updatePermission,
    acquireEditLock,
    releaseEditLock,
    checkAccess,
    getSharedWithMe,
    fetchShares,
    fetchPresence,
    isOwner: shares.length === 0 || shares.some(s => s.owner_id === userId),
    otherViewers: presence.filter(p => p.user_id !== userId),
  };
}

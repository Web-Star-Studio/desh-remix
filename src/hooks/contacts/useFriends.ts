// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Types — canonical definitions live in /src/types/auth.ts
export type { Friend, FriendRequest } from "@/types/auth";
import type { Friend, FriendRequest } from "@/types/auth";

export function useFriends() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [myFriendCode, setMyFriendCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);

  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  const fetchAll = useCallback(async () => {
    if (!user || fetchingRef.current) return;
    fetchingRef.current = true;
    setIsLoading(true);

    try {
      const [profileRes, friendshipsRes, incomingRes, outgoingRes] = await Promise.all([
        supabase.from("profiles").select("friend_code").eq("user_id", user.id).single(),
        supabase.from("friendships" as any).select("id, friend_id").eq("user_id", user.id).limit(500),
        supabase.from("friend_requests" as any).select("id, from_user_id, created_at").eq("to_user_id", user.id).eq("status", "pending").limit(500),
        supabase.from("friend_requests" as any).select("id, to_user_id, created_at").eq("from_user_id", user.id).eq("status", "pending").limit(500),
      ]);

      if (!mountedRef.current) return;

      if (profileRes.data?.friend_code) setMyFriendCode(profileRes.data.friend_code);

      const allUserIds = new Set<string>();
      const friendships = (friendshipsRes.data as any[]) || [];
      const incoming = (incomingRes.data as any[]) || [];
      const outgoing = (outgoingRes.data as any[]) || [];

      friendships.forEach(f => allUserIds.add(f.friend_id));
      incoming.forEach(r => allUserIds.add(r.from_user_id));
      outgoing.forEach(r => allUserIds.add(r.to_user_id));

      let profileMap: Record<string, { display_name: string | null; avatar_url: string | null; email: string | null }> = {};
      if (allUserIds.size > 0) {
        const { data: profiles } = await supabase.rpc("get_profiles_with_email", { _user_ids: Array.from(allUserIds) });
        if (!mountedRef.current) return;
        for (const p of (Array.isArray(profiles) ? profiles : []) as any[]) {
          profileMap[p.user_id] = { display_name: p.display_name || null, avatar_url: p.avatar_url, email: p.email || null };
        }
      }

      const mappedFriends: Friend[] = friendships.map(f => {
        const p = profileMap[f.friend_id];
        return {
          user_id: f.friend_id,
          display_name: p?.display_name || null,
          avatar_url: p?.avatar_url || null,
          email: p?.email || null,
          friendship_id: f.id,
        };
      });
      setFriends(mappedFriends);

      setPendingRequests(incoming.length > 0
        ? incoming.map(r => {
            const p = profileMap[r.from_user_id];
            return { ...r, from_display_name: p?.display_name, from_avatar_url: p?.avatar_url, from_email: p?.email };
          })
        : []);

      setSentRequests(outgoing.length > 0
        ? outgoing.map(r => {
            const p = profileMap[r.to_user_id];
            return { ...r, to_display_name: p?.display_name, to_email: p?.email };
          })
        : []);
    } finally {
      fetchingRef.current = false;
      if (mountedRef.current) setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("friend-requests-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_requests" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchAll]);

  const findByCode = useCallback(async (code: string) => {
    const { data, error } = await supabase.rpc("find_user_by_friend_code", { _code: code });
    if (error || !data) return null;
    return data as { user_id: string; display_name: string; avatar_url: string };
  }, []);

  const findByEmail = useCallback(async (email: string) => {
    const { data, error } = await supabase.rpc("find_user_by_email", { _email: email });
    if (error || !data) return null;
    return data as { user_id: string; display_name: string; avatar_url: string };
  }, []);

  // All mutations now use secure RPCs
  const sendRequest = useCallback(async (toUserId: string) => {
    if (!user) return;
    const { error } = await supabase.rpc("send_friend_request", { _to_user_id: toUserId });
    if (error) {
      if (error.message.includes("Already friends")) toast.error("Vocês já são amigos!");
      else if (error.message.includes("yourself")) toast.error("Você não pode adicionar a si mesmo!");
      else if (error.message.includes("duplicate") || error.message.includes("unique") || error.code === "23505") toast.error("Solicitação já enviada!");
      else toast.error("Erro ao enviar solicitação");
      return;
    }
    toast.success("Solicitação enviada!");
    fetchAll();
  }, [user, fetchAll]);

  const acceptRequest = useCallback(async (requestId: string) => {
    const { error } = await supabase.rpc("accept_friend_request", { _request_id: requestId });
    if (error) { toast.error("Erro ao aceitar"); return; }
    toast.success("Amigo adicionado! 🎉");
    fetchAll();
  }, [fetchAll]);

  const rejectRequest = useCallback(async (requestId: string) => {
    const { error } = await supabase.rpc("reject_friend_request", { _request_id: requestId });
    if (error) { toast.error("Erro ao recusar"); return; }
    toast("Solicitação recusada");
    fetchAll();
  }, [fetchAll]);

  const cancelRequest = useCallback(async (requestId: string) => {
    const { error } = await supabase.rpc("cancel_friend_request", { _request_id: requestId });
    if (error) { toast.error("Erro ao cancelar"); return; }
    toast("Solicitação cancelada");
    fetchAll();
  }, [fetchAll]);

  const removeFriend = useCallback(async (friendUserId: string) => {
    if (!user) return;
    const { error } = await supabase.rpc("remove_friend", { _friend_user_id: friendUserId });
    if (error) { toast.error("Erro ao remover amigo"); return; }
    toast("Amigo removido");
    fetchAll();
  }, [user, fetchAll]);

  return {
    friends, pendingRequests, sentRequests, myFriendCode, isLoading,
    findByCode, findByEmail, sendRequest, acceptRequest, rejectRequest, cancelRequest, removeFriend,
    refresh: fetchAll,
  };
}

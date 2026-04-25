// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { callWhatsappProxy } from "@/lib/whatsappProxy";

export interface PresenceState {
  status: "online" | "typing" | "unavailable";
  lastSeenAt: string | null;
}

export function useWhatsappPresence(contactId: string | null) {
  const { user } = useAuth();
  const [presence, setPresence] = useState<PresenceState>({ status: "unavailable", lastSeenAt: null });
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user || !contactId) return;
    const normalized = contactId.replace(/@.*/, "");

    const fetchPresence = async () => {
      const { data } = await supabase
        .from("whatsapp_presence")
        .select("status, last_seen_at")
        .eq("user_id", user.id)
        .eq("contact_jid", normalized)
        .maybeSingle();

      if (data) {
        setPresence({
          status: data.status as PresenceState["status"],
          lastSeenAt: data.last_seen_at,
        });
      }
    };

    fetchPresence();

    const channel = supabase
      .channel(`wa_presence_${normalized}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "whatsapp_presence",
        filter: `contact_jid=eq.${normalized}`,
      }, (payload) => {
        if (payload.new) {
          const row = payload.new as Record<string, unknown>;
          if (row.user_id === user.id) {
            setPresence({
              status: (row.status as PresenceState["status"]) || "unavailable",
              lastSeenAt: (row.last_seen_at as string) || null,
            });
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, contactId]);

  const sendTypingPresence = useCallback(async () => {
    if (!contactId) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Fire-and-forget composing
    callWhatsappProxy("POST", "/update-presence", {
      contactId,
      presence: "composing",
    }).catch(() => {});

    // Auto-stop after 5s
    typingTimeoutRef.current = setTimeout(() => {
      callWhatsappProxy("POST", "/update-presence", {
        contactId,
        presence: "paused",
      }).catch(() => {});
    }, 5000);
  }, [contactId]);

  const formattedLastSeen = presence.lastSeenAt
    ? `visto por último às ${new Date(presence.lastSeenAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    : null;

  return { presence, sendTypingPresence, formattedLastSeen };
}

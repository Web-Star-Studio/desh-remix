// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useWorkspaceFilter } from "@/hooks/workspace/useWorkspaceFilter";

// Types — canonical definitions live in /src/types/contacts.ts
export type { ContactPhone, ContactEmail, ContactAddress, ContactSocialLinks, DbContact, DbInteraction } from "@/types/contacts";
import type { DbContact, DbInteraction } from "@/types/contacts";

// ── Module-level in-memory cache (survives remounts, not page reloads) ──
const CONTACTS_STALE_MS = 10 * 60 * 1000; // 10 minutes
const contactsCache: { key: string; data: DbContact[]; ts: number } = { key: "", data: [], ts: 0 };

const parseContact = (raw: any): DbContact => ({
  ...raw,
  email: raw.email || "",
  phone: raw.phone || "",
  company: raw.company || "",
  role: raw.role || "",
  notes: raw.notes || "",
  tags: raw.tags || [],
  contact_type: raw.contact_type || "person",
  phones: Array.isArray(raw.phones) ? raw.phones : [],
  emails: Array.isArray(raw.emails) ? raw.emails : [],
  addresses: Array.isArray(raw.addresses) ? raw.addresses : [],
  social_links: raw.social_links && typeof raw.social_links === "object" ? raw.social_links : {},
  website: raw.website || "",
  company_description: raw.company_description || "",
  company_industry: raw.company_industry || "",
  company_size: raw.company_size || "",
  custom_fields: raw.custom_fields && typeof raw.custom_fields === "object" ? raw.custom_fields : {},
});

export function useDbContacts() {
  const { user } = useAuth();
  const { activeWorkspaceId, getInsertWorkspaceId } = useWorkspaceFilter();
  const [contacts, setContacts] = useState<DbContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const contactsRef = useRef<DbContact[]>([]);
  contactsRef.current = contacts;

  const cacheKey = `${user?.id}|${activeWorkspaceId ?? ""}`;

  const fetchContacts = useCallback(async (force = false) => {
    if (!user) return;
    if (!force && contactsCache.key === cacheKey && Date.now() - contactsCache.ts < CONTACTS_STALE_MS) {
      setContacts(contactsCache.data);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    let query = supabase
      .from("contacts")
      .select("*")
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (activeWorkspaceId) {
      query = query.eq("workspace_id", activeWorkspaceId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching contacts:", error);
    } else {
      const parsed = (data || []).map(parseContact);
      setContacts(parsed);
      contactsCache.key = cacheKey;
      contactsCache.data = parsed;
      contactsCache.ts = Date.now();
    }
    setIsLoading(false);
  }, [user, activeWorkspaceId, cacheKey]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const invalidateCache = useCallback(() => { contactsCache.ts = 0; }, []);

  const addContact = useCallback(async (contact: Partial<DbContact>) => {
    if (!user) return;
    const wsId = getInsertWorkspaceId();
    const { data, error } = await supabase
      .from("contacts")
      .insert({ ...contact, user_id: user.id, name: contact.name || "Sem nome", ...(wsId ? { workspace_id: wsId } : {}) } as any)
      .select("*")
      .single();

    if (error) {
      toast({ title: "Erro", description: "Falha ao criar contato.", variant: "destructive" });
    } else if (data) {
      setContacts(prev => [...prev, parseContact(data)].sort((a, b) => a.name.localeCompare(b.name)));
      invalidateCache();
      toast({ title: "Contato criado", description: contact.name });
    }
    return data ? parseContact(data) : undefined;
  }, [user, getInsertWorkspaceId, invalidateCache]);

  const updateContact = useCallback(async (id: string, updates: Partial<DbContact>) => {
    const { error } = await supabase.from("contacts").update(updates as any).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: "Falha ao atualizar contato.", variant: "destructive" });
    } else {
      setContacts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
      invalidateCache();
    }
  }, [invalidateCache]);

  const deleteContact = useCallback(async (id: string) => {
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: "Falha ao remover contato.", variant: "destructive" });
    } else {
      setContacts(prev => prev.filter(c => c.id !== id));
      invalidateCache();
    }
  }, [invalidateCache]);

  const toggleFavorite = useCallback(async (id: string) => {
    const contact = contactsRef.current.find(c => c.id === id);
    if (!contact) return;
    await updateContact(id, { favorited: !contact.favorited });
  }, [updateContact]);

  // Batch operations — parallel with chunks
  const batchDelete = useCallback(async (ids: string[]) => {
    const chunks = [];
    for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
    for (const chunk of chunks) {
      await Promise.all(chunk.map(id => deleteContact(id)));
    }
  }, [deleteContact]);

  const batchUpdate = useCallback(async (updates: { id: string; data: Partial<DbContact> }[]) => {
    const chunks = [];
    for (let i = 0; i < updates.length; i += 10) chunks.push(updates.slice(i, i + 10));
    for (const chunk of chunks) {
      await Promise.all(chunk.map(u => updateContact(u.id, u.data)));
    }
  }, [updateContact]);

  // Interactions
  const fetchInteractions = useCallback(async (contactId: string) => {
    const { data, error } = await supabase
      .from("contact_interactions")
      .select("*")
      .eq("contact_id", contactId)
      .order("interaction_date", { ascending: false });
    if (error) { console.error("Error fetching interactions:", error); return []; }
    return (data || []) as unknown as DbInteraction[];
  }, []);

  const addInteraction = useCallback(async (interaction: Partial<DbInteraction>) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("contact_interactions")
      .insert({ ...interaction, user_id: user.id, title: interaction.title || "", contact_id: interaction.contact_id! })
      .select("*")
      .single();
    if (error) {
      toast({ title: "Erro", description: "Falha ao registrar interação.", variant: "destructive" });
    } else {
      toast({ title: "Interação registrada" });
    }
    return data as unknown as DbInteraction | undefined;
  }, [user]);

  const deleteInteraction = useCallback(async (id: string) => {
    const { error } = await supabase.from("contact_interactions").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: "Falha ao remover interação.", variant: "destructive" });
    }
  }, []);

  return {
    contacts, isLoading, addContact, updateContact, deleteContact,
    toggleFavorite, fetchInteractions, addInteraction, deleteInteraction,
    batchDelete, batchUpdate,
    refetch: () => fetchContacts(true),
  };
}

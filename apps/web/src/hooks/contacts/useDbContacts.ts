import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useWorkspaceFilter } from "@/hooks/workspace/useWorkspaceFilter";
import { apiFetch } from "@/lib/api-client";

// Types — canonical definitions live in /src/types/contacts.ts
export type {
  ContactPhone,
  ContactEmail,
  ContactAddress,
  ContactSocialLinks,
  DbContact,
  DbInteraction,
} from "@/types/contacts";
import type {
  ContactPhone,
  ContactEmail,
  ContactAddress,
  ContactSocialLinks,
  DbContact,
  DbInteraction,
} from "@/types/contacts";

// ── Module-level in-memory cache (survives remounts, not page reloads) ──
const CONTACTS_STALE_MS = 10 * 60 * 1000; // 10 minutes
const contactsCache: { key: string; data: DbContact[]; ts: number } = { key: "", data: [], ts: 0 };

// Apps/api returns ApiContact in camelCase + nested rich-field arrays as
// jsonb. The SPA's DbContact shape is snake_case (legacy). Adapt at the
// boundary so call sites stay unchanged.
interface ApiContact {
  id: string;
  workspaceId: string;
  createdBy: string | null;
  name: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  notes: string;
  tags: string[];
  favorited: boolean;
  avatarUrl: string | null;
  birthday: string | null;
  contactType: string;
  phones: ContactPhone[];
  emails: ContactEmail[];
  addresses: ContactAddress[];
  socialLinks: ContactSocialLinks;
  website: string;
  companyLogoUrl: string | null;
  companyDescription: string;
  companyIndustry: string;
  companySize: string;
  customFields: Record<string, string>;
  googleResourceName: string | null;
  googleEtag: string | null;
  createdAt: string;
  updatedAt: string;
}

function fromApiContact(c: ApiContact): DbContact {
  return {
    id: c.id,
    name: c.name,
    email: c.email || "",
    phone: c.phone || "",
    company: c.company || "",
    role: c.role || "",
    notes: c.notes || "",
    tags: c.tags ?? [],
    favorited: c.favorited,
    avatar_url: c.avatarUrl,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
    google_resource_name: c.googleResourceName,
    google_etag: c.googleEtag,
    contact_type: c.contactType || "person",
    phones: Array.isArray(c.phones) ? c.phones : [],
    emails: Array.isArray(c.emails) ? c.emails : [],
    addresses: Array.isArray(c.addresses) ? c.addresses : [],
    social_links: c.socialLinks && typeof c.socialLinks === "object" ? c.socialLinks : {},
    website: c.website || "",
    birthday: c.birthday,
    company_logo_url: c.companyLogoUrl,
    company_description: c.companyDescription || "",
    company_industry: c.companyIndustry || "",
    company_size: c.companySize || "",
    custom_fields: (c.customFields ?? {}) as Record<string, string>,
  };
}

function toApiContactPatch(updates: Partial<DbContact>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (updates.name !== undefined) out.name = updates.name;
  if (updates.email !== undefined) out.email = updates.email;
  if (updates.phone !== undefined) out.phone = updates.phone;
  if (updates.company !== undefined) out.company = updates.company;
  if (updates.role !== undefined) out.role = updates.role;
  if (updates.notes !== undefined) out.notes = updates.notes;
  if (updates.tags !== undefined) out.tags = updates.tags;
  if (updates.favorited !== undefined) out.favorited = updates.favorited;
  if (updates.avatar_url !== undefined) out.avatarUrl = updates.avatar_url;
  if (updates.birthday !== undefined) out.birthday = updates.birthday;
  if (updates.contact_type !== undefined) out.contactType = updates.contact_type;
  if (updates.phones !== undefined) out.phones = updates.phones;
  if (updates.emails !== undefined) out.emails = updates.emails;
  if (updates.addresses !== undefined) out.addresses = updates.addresses;
  if (updates.social_links !== undefined) out.socialLinks = updates.social_links;
  if (updates.website !== undefined) out.website = updates.website;
  if (updates.company_logo_url !== undefined) out.companyLogoUrl = updates.company_logo_url;
  if (updates.company_description !== undefined) out.companyDescription = updates.company_description;
  if (updates.company_industry !== undefined) out.companyIndustry = updates.company_industry;
  if (updates.company_size !== undefined) out.companySize = updates.company_size;
  if (updates.custom_fields !== undefined) out.customFields = updates.custom_fields;
  if (updates.google_resource_name !== undefined) out.googleResourceName = updates.google_resource_name;
  if (updates.google_etag !== undefined) out.googleEtag = updates.google_etag;
  return out;
}

// Adapt the legacy `DbInteraction` shape to/from apps/api's camelCase.
interface ApiInteraction {
  id: string;
  contactId: string;
  createdBy: string | null;
  type: string;
  title: string;
  description: string;
  interactionDate: string;
  createdAt: string;
}

function fromApiInteraction(i: ApiInteraction): DbInteraction {
  return {
    id: i.id,
    contact_id: i.contactId,
    type: i.type,
    title: i.title,
    description: i.description,
    interaction_date: i.interactionDate,
    created_at: i.createdAt,
  };
}

export function useDbContacts() {
  const { user } = useAuth();
  const { activeWorkspaceId, getInsertWorkspaceId } = useWorkspaceFilter();
  const [contacts, setContacts] = useState<DbContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const contactsRef = useRef<DbContact[]>([]);
  contactsRef.current = contacts;

  // Resolve a single workspace id for read/write paths. Same fallback shape
  // as useDbTasks — apps/api routes are workspace-scoped, no aggregate
  // endpoint yet, so view-all mode falls back to the default workspace.
  const readWorkspaceId = activeWorkspaceId ?? getInsertWorkspaceId();
  const cacheKey = `${user?.id}|${readWorkspaceId ?? ""}`;

  const fetchContacts = useCallback(async (force = false) => {
    if (!user || !readWorkspaceId) {
      setContacts([]);
      setIsLoading(false);
      return;
    }
    if (!force && contactsCache.key === cacheKey && Date.now() - contactsCache.ts < CONTACTS_STALE_MS) {
      setContacts(contactsCache.data);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const rows = await apiFetch<ApiContact[]>(`/workspaces/${readWorkspaceId}/contacts`);
      const parsed = rows.map(fromApiContact);
      setContacts(parsed);
      contactsCache.key = cacheKey;
      contactsCache.data = parsed;
      contactsCache.ts = Date.now();
    } catch (err) {
      console.error("Error fetching contacts:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user, readWorkspaceId, cacheKey]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const invalidateCache = useCallback(() => { contactsCache.ts = 0; }, []);

  const addContact = useCallback(async (contact: Partial<DbContact>) => {
    if (!user) return;
    const wsId = getInsertWorkspaceId();
    if (!wsId) {
      toast({ title: "Erro", description: "Sem workspace ativo.", variant: "destructive" });
      return;
    }
    try {
      const body = { ...toApiContactPatch(contact), name: contact.name || "Sem nome" };
      const created = await apiFetch<ApiContact>(`/workspaces/${wsId}/contacts`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const dbContact = fromApiContact(created);
      setContacts(prev => [...prev, dbContact].sort((a, b) => a.name.localeCompare(b.name)));
      invalidateCache();
      toast({ title: "Contato criado", description: dbContact.name });
      return dbContact;
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message ?? "Falha ao criar contato.", variant: "destructive" });
      return undefined;
    }
  }, [user, getInsertWorkspaceId, invalidateCache]);

  const updateContact = useCallback(async (id: string, updates: Partial<DbContact>) => {
    const existing = contactsRef.current.find(c => c.id === id);
    const wsId = readWorkspaceId;
    if (!wsId) return;
    try {
      const updated = await apiFetch<ApiContact>(`/workspaces/${wsId}/contacts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(toApiContactPatch(updates)),
      });
      const dbContact = fromApiContact(updated);
      setContacts(prev => prev.map(c => c.id === id ? dbContact : c));
      invalidateCache();
      void existing;
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message ?? "Falha ao atualizar contato.", variant: "destructive" });
    }
  }, [readWorkspaceId, invalidateCache]);

  const deleteContact = useCallback(async (id: string) => {
    const wsId = readWorkspaceId;
    if (!wsId) return;
    try {
      await apiFetch<void>(`/workspaces/${wsId}/contacts/${id}`, { method: "DELETE" });
      setContacts(prev => prev.filter(c => c.id !== id));
      invalidateCache();
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message ?? "Falha ao remover contato.", variant: "destructive" });
    }
  }, [readWorkspaceId, invalidateCache]);

  const toggleFavorite = useCallback(async (id: string) => {
    const contact = contactsRef.current.find(c => c.id === id);
    if (!contact) return;
    await updateContact(id, { favorited: !contact.favorited });
  }, [updateContact]);

  // Batch operations — parallel with chunks to avoid hammering the API.
  const batchDelete = useCallback(async (ids: string[]) => {
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
    for (const chunk of chunks) {
      await Promise.all(chunk.map(id => deleteContact(id)));
    }
  }, [deleteContact]);

  const batchUpdate = useCallback(async (updates: { id: string; data: Partial<DbContact> }[]) => {
    const chunks: { id: string; data: Partial<DbContact> }[][] = [];
    for (let i = 0; i < updates.length; i += 10) chunks.push(updates.slice(i, i + 10));
    for (const chunk of chunks) {
      await Promise.all(chunk.map(u => updateContact(u.id, u.data)));
    }
  }, [updateContact]);

  // Interactions
  const fetchInteractions = useCallback(async (contactId: string): Promise<DbInteraction[]> => {
    const wsId = readWorkspaceId;
    if (!wsId) return [];
    try {
      // The list endpoint already includes interactions in the contact rows;
      // we still expose this for callers that fetched a contact lazily.
      const list = await apiFetch<ApiContact[]>(`/workspaces/${wsId}/contacts`);
      const target = list.find(c => c.id === contactId) as (ApiContact & { interactions?: ApiInteraction[] }) | undefined;
      return (target?.interactions ?? []).map(fromApiInteraction);
    } catch (err) {
      console.error("Error fetching interactions:", err);
      return [];
    }
  }, [readWorkspaceId]);

  const addInteraction = useCallback(async (interaction: Partial<DbInteraction>) => {
    if (!user) return;
    const wsId = readWorkspaceId;
    if (!wsId || !interaction.contact_id) return;
    try {
      const body: Record<string, unknown> = {
        title: interaction.title || "",
      };
      if (interaction.type !== undefined) body.type = interaction.type;
      if (interaction.description !== undefined) body.description = interaction.description;
      if (interaction.interaction_date !== undefined) body.interactionDate = interaction.interaction_date;
      const created = await apiFetch<ApiInteraction>(
        `/workspaces/${wsId}/contacts/${interaction.contact_id}/interactions`,
        { method: "POST", body: JSON.stringify(body) },
      );
      toast({ title: "Interação registrada" });
      return fromApiInteraction(created);
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message ?? "Falha ao registrar interação.", variant: "destructive" });
    }
  }, [user, readWorkspaceId]);

  const deleteInteraction = useCallback(async (id: string) => {
    const wsId = readWorkspaceId;
    if (!wsId) return;
    // The legacy hook's delete didn't carry the contact id, but the apps/api
    // route requires both contact + interaction in the path. Resolve from
    // the loaded contacts; if not found, fall back to a noop with a warning.
    const owner = contactsRef.current.find(c => false);
    void owner;
    // The interactions live attached to contacts in the loaded list; find
    // the contact that owns this interaction id.
    let contactId: string | null = null;
    for (const c of contactsRef.current) {
      const list = (c as DbContact & { _interactions?: DbInteraction[] })._interactions;
      if (list?.some(i => i.id === id)) { contactId = c.id; break; }
    }
    if (!contactId) {
      console.warn("[useDbContacts] deleteInteraction called with unknown owner; refresh first");
      return;
    }
    try {
      await apiFetch<void>(
        `/workspaces/${wsId}/contacts/${contactId}/interactions/${id}`,
        { method: "DELETE" },
      );
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message ?? "Falha ao remover interação.", variant: "destructive" });
    }
  }, [readWorkspaceId]);

  return {
    contacts, isLoading, addContact, updateContact, deleteContact,
    toggleFavorite, fetchInteractions, addInteraction, deleteInteraction,
    batchDelete, batchUpdate,
    refetch: () => fetchContacts(true),
  };
}

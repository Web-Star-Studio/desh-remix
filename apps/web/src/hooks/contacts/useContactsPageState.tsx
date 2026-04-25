/**
 * useContactsPageState — all state & logic for ContactsPage.
 * The page component becomes a pure render layer.
 */
import { useConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import type { ContactFormData } from "@/components/contacts/ContactAddForm";
import { useConnections } from "@/contexts/ConnectionsContext";
import { useDbContacts, type DbContact, type DbInteraction } from "@/hooks/contacts/useDbContacts";
import { useGoogleServiceData } from "@/hooks/integrations/useGoogleServiceData";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { useComposioWorkspaceId } from "@/hooks/integrations/useComposioWorkspaceId";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { exportToCsv } from "@/lib/exportCsv";
import { parseVCardFile, type ParsedVCardContact } from "@/lib/parseVCard";
import { computeRelationshipScore, getScoreLabel, type InteractionSummary } from "@/lib/contactScoring";

// ── Pure helpers (no hooks) ─────────────────────────────────────────────────
export { computeCompleteness } from "@/lib/contactScoring";

export const getCompletenessLabel = (pct: number) => {
  if (pct >= 80) return { label: "Completo", color: "text-green-400" };
  if (pct >= 50) return { label: "Bom", color: "text-primary" };
  if (pct >= 25) return { label: "Básico", color: "text-amber-400" };
  return { label: "Incompleto", color: "text-muted-foreground" };
};

export const highlightMatch = (text: string, query: string) => {
  if (!query || !text) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>{text.slice(0, idx)}<mark className="bg-primary/20 text-foreground rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>{text.slice(idx + query.length)}</>
  );
};

export const getUpcomingBirthdays = (contacts: DbContact[], days = 30) => {
  const now = new Date();
  return contacts
    .filter(c => c.birthday)
    .map(c => {
      const bd = new Date(c.birthday + "T12:00:00");
      const next = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
      if (next < now) next.setFullYear(now.getFullYear() + 1);
      const diff = Math.floor((next.getTime() - now.getTime()) / 86400000);
      return { contact: c, daysUntil: diff };
    })
    .filter(x => x.daysUntil <= days && x.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil);
};

export const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
};

export const AVATAR_PALETTES = [
  { bg: "bg-orange-500/25", text: "text-orange-300", ring: "ring-orange-500/30" },
  { bg: "bg-emerald-500/25", text: "text-emerald-300", ring: "ring-emerald-500/30" },
  { bg: "bg-sky-500/25", text: "text-sky-300", ring: "ring-sky-500/30" },
  { bg: "bg-violet-500/25", text: "text-violet-300", ring: "ring-violet-500/30" },
  { bg: "bg-rose-500/25", text: "text-rose-300", ring: "ring-rose-500/30" },
  { bg: "bg-amber-500/25", text: "text-amber-300", ring: "ring-amber-500/30" },
  { bg: "bg-teal-500/25", text: "text-teal-300", ring: "ring-teal-500/30" },
  { bg: "bg-fuchsia-500/25", text: "text-fuchsia-300", ring: "ring-fuchsia-500/30" },
  { bg: "bg-cyan-500/25", text: "text-cyan-300", ring: "ring-cyan-500/30" },
  { bg: "bg-lime-500/25", text: "text-lime-300", ring: "ring-lime-500/30" },
];

export const getAvatarPalette = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
};

export const interactionTypes: Record<string, { icon: any; label: string; color: string }> = {
  call: { icon: null, label: "Ligação", color: "text-green-400" },
  email: { icon: null, label: "E-mail", color: "text-primary" },
  meeting: { icon: null, label: "Reunião", color: "text-yellow-500" },
  note: { icon: null, label: "Nota", color: "text-muted-foreground" },
};

const CONTACTS_PER_PAGE = 50;

export function useContactsPageState() {
  const navigate = useNavigate();
  const { invoke } = useEdgeFn();
  const composioWsId = useComposioWorkspaceId();
  const wsInvoke = useCallback(<T,>(opts: { fn: string; body: Record<string, any> }) => {
    const body = { ...opts.body, workspace_id: composioWsId, default_workspace_id: composioWsId };
    return invoke<T>({ ...opts, body });
  }, [invoke, composioWsId]);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const { getConnectionByCategory } = useConnections();

  const { data: googleContacts, isLoading: googleContactsLoading, isConnected: googleContactsConnected, connectionNames: googleContactsNames, refetch: googleContactsRefetch, needsScope: contactsNeedsScope, requestScope: contactsRequestScope } = useGoogleServiceData<any[]>({
    service: "people",
    path: "/people/me/connections",
    params: { personFields: "names,emailAddresses,phoneNumbers,organizations,photos", pageSize: "200" },
  });

  const isConnected = googleContactsConnected;

  const {
    contacts, isLoading: dbLoading, addContact, updateContact, deleteContact,
    toggleFavorite, fetchInteractions, addInteraction, deleteInteraction,
    batchDelete, batchUpdate, refetch: refetchContacts,
  } = useDbContacts();

  const isLoading = dbLoading || googleContactsLoading;

  // ── State ─────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterTag, setFilterTag] = useState("all");
  const [filterFav, setFilterFav] = useState(false);
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterType, setFilterType] = useState<"all" | "person" | "company">("all");
  const [groupBy, setGroupBy] = useState<"alpha" | "company" | "tag">("alpha");
  const [sortBy, setSortBy] = useState<"name" | "score" | "recent" | "created">("name");
  const [contactPage, setContactPage] = useState(1);

  const [interactions, setInteractions] = useState<DbInteraction[]>([]);
  const [loadingInteractions, setLoadingInteractions] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiNextAction, setAiNextAction] = useState<string | null>(null);
  const [aiFollowup, setAiFollowup] = useState<Record<string, string>>({});
  const [importingGoogle, setImportingGoogle] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [lastInteractionMap, setLastInteractionMap] = useState<Record<string, string>>({});
  const [lastInteractionTypeMap, setLastInteractionTypeMap] = useState<Record<string, string>>({});
  const [interactionSummaryMap, setInteractionSummaryMap] = useState<Record<string, InteractionSummary>>({});
  const [allInteractionsRaw, setAllInteractionsRaw] = useState<{ contact_id: string; interaction_date: string; type: string }[]>([]);
  const [showRanking, setShowRanking] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showBirthdays, setShowBirthdays] = useState(false);
  const [batchTagInput, setBatchTagInput] = useState("");
  const [vcardContacts, setVcardContacts] = useState<ParsedVCardContact[] | null>(null);
  const [importingVcard, setImportingVcard] = useState(false);
  const vcardInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectedContact = contacts.find(c => c.id === selectedId);

  // ── Derived data ──────────────────────────────────────────────────────────
  const allTags = useMemo(() => {
    const set = new Set<string>(contacts.flatMap(c => c.tags || []));
    return Array.from(set).sort();
  }, [contacts]);

  const contactsWithScores = useMemo(() => {
    return contacts.map(c => ({
      contact: c,
      summary: interactionSummaryMap[c.id] ?? { count: 0, lastDate: null, typeCounts: {} },
      score: computeRelationshipScore(interactionSummaryMap[c.id] ?? { count: 0, lastDate: null, typeCounts: {} }),
    }));
  }, [contacts, interactionSummaryMap]);

  const topContacts = useMemo(() =>
    [...contactsWithScores].sort((a, b) => b.score - a.score).slice(0, 5),
    [contactsWithScores]
  );

  // O(1) lookup map for pre-computed scores
  const scoreMap = useMemo(() => {
    const m = new Map<string, { score: number; summary: InteractionSummary }>();
    contactsWithScores.forEach(x => m.set(x.contact.id, { score: x.score, summary: x.summary }));
    return m;
  }, [contactsWithScores]);

  const atRiskContacts = useMemo(() =>
    [...contactsWithScores]
      .filter(x => x.summary.lastDate !== null)
      .sort((a, b) => a.score - b.score)
      .slice(0, 5),
    [contactsWithScores]
  );

  const allCompanies = useMemo(() => {
    const set = new Set<string>(contacts.filter(c => c.company).map(c => c.company));
    return Array.from(set).sort();
  }, [contacts]);

  const activeFiltersCount = [filterTag !== "all", filterFav, filterCompany !== "all", filterType !== "all"].filter(Boolean).length;

  const upcomingBirthdays = useMemo(() => getUpcomingBirthdays(contacts), [contacts]);

  const filtered = useMemo(() => {
    let result = contacts;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) || c.tags?.some(t => t.includes(q)) ||
        c.phones?.some(p => p.number.includes(q)) ||
        c.emails?.some(e => e.email.toLowerCase().includes(q)) ||
        c.role.toLowerCase().includes(q)
      );
    }
    if (filterTag !== "all") result = result.filter(c => c.tags?.includes(filterTag));
    if (filterFav) result = result.filter(c => c.favorited);
    if (filterCompany !== "all") result = result.filter(c => c.company === filterCompany);
    if (filterType !== "all") result = result.filter(c => c.contact_type === filterType);
    if (sortBy === "score") {
      const scoreMap = new Map(contactsWithScores.map(x => [x.contact.id, x.score]));
      result = [...result].sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0));
    } else if (sortBy === "recent") {
      result = [...result].sort((a, b) => {
        const da = interactionSummaryMap[a.id]?.lastDate || "";
        const db = interactionSummaryMap[b.id]?.lastDate || "";
        return db.localeCompare(da);
      });
    } else if (sortBy === "created") {
      result = [...result].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    }
    return result;
  }, [contacts, searchQuery, filterTag, filterFav, filterCompany, filterType, sortBy, interactionSummaryMap, contactsWithScores]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / CONTACTS_PER_PAGE));
  const safeContactPage = Math.min(contactPage, totalPages);
  const paginatedContacts = filtered.slice((safeContactPage - 1) * CONTACTS_PER_PAGE, safeContactPage * CONTACTS_PER_PAGE);

  const summaryStats = useMemo(() => ({
    total: contacts.length,
    people: contacts.filter(c => c.contact_type !== "company").length,
    companies: contacts.filter(c => c.contact_type === "company").length,
    favorites: contacts.filter(c => c.favorited).length,
    withInteractions: Object.keys(interactionSummaryMap).length,
    avgScore: contactsWithScores.length
      ? Math.round(contactsWithScores.reduce((s, x) => s + x.score, 0) / contactsWithScores.length)
      : 0,
  }), [contacts, interactionSummaryMap, contactsWithScores]);

  const grouped = useMemo(() => {
    const groups: Record<string, DbContact[]> = {};
    paginatedContacts.forEach(c => {
      let key = "";
      if (groupBy === "alpha") key = c.name[0]?.toUpperCase() || "#";
      else if (groupBy === "company") key = c.company || "Sem empresa";
      else if (groupBy === "tag") {
        if (!c.tags?.length) { key = "Sem tag"; }
        else { key = c.tags[0]; }
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [paginatedContacts, groupBy]);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedId) {
      setLoadingInteractions(true);
      fetchInteractions(selectedId).then(data => {
        setInteractions(data);
        setLoadingInteractions(false);
      });
    }
  }, [selectedId, fetchInteractions]);

  const prevContactIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const ids = contacts.map(c => c.id).sort();
    // Skip if contact list hasn't actually changed
    if (ids.length === prevContactIdsRef.current.length && ids.every((id, i) => id === prevContactIdsRef.current[i])) return;
    prevContactIdsRef.current = ids;
    if (ids.length === 0) return;
    const loadSummaries = async () => {
      const { data, error } = await supabase
        .from("contact_interactions")
        .select("contact_id, interaction_date, type")
        .in("contact_id", ids)
        .order("interaction_date", { ascending: false })
        .limit(5000);
      if (error || !data) return;
      setAllInteractionsRaw(data as any);
      const summaryMap: Record<string, InteractionSummary> = {};
      const lastMap: Record<string, string> = {};
      const lastTypeMap: Record<string, string> = {};
      for (const row of data) {
        const cid = row.contact_id;
        if (!summaryMap[cid]) summaryMap[cid] = { count: 0, lastDate: null, typeCounts: {} };
        summaryMap[cid].count++;
        if (!summaryMap[cid].lastDate) summaryMap[cid].lastDate = row.interaction_date;
        summaryMap[cid].typeCounts[row.type] = (summaryMap[cid].typeCounts[row.type] || 0) + 1;
        if (!lastMap[cid]) { lastMap[cid] = row.interaction_date; lastTypeMap[cid] = row.type; }
      }
      setInteractionSummaryMap(summaryMap);
      setLastInteractionMap(lastMap);
      setLastInteractionTypeMap(lastTypeMap);
    };
    loadSummaries();
  }, [contacts]);

  // ── Google sync ───────────────────────────────────────────────────────────
  const syncContactToGoogle = useCallback(async (action: "create" | "update" | "delete", opts: { name?: string; email?: string; phone?: string; company?: string; role?: string; resourceName?: string }): Promise<any> => {
    if (!googleContactsConnected) return null;
    try {
      if (action === "create") {
        const body: any = {
          names: [{ givenName: opts.name }],
          ...(opts.email ? { emailAddresses: [{ value: opts.email }] } : {}),
          ...(opts.phone ? { phoneNumbers: [{ value: opts.phone }] } : {}),
          ...(opts.company ? { organizations: [{ name: opts.company, title: opts.role || "" }] } : {}),
        };
        const { data } = await wsInvoke<any>({
          fn: "composio-proxy",
          body: { service: "people", path: "/people:createContact", method: "POST", params: { personFields: "names,emailAddresses,phoneNumbers,organizations" }, body },
        });
        return data;
      } else if (action === "update" && opts.resourceName) {
        const body: any = {
          names: [{ givenName: opts.name }],
          ...(opts.email ? { emailAddresses: [{ value: opts.email }] } : {}),
          ...(opts.phone ? { phoneNumbers: [{ value: opts.phone }] } : {}),
          ...(opts.company ? { organizations: [{ name: opts.company, title: opts.role || "" }] } : {}),
        };
        await wsInvoke<any>({
          fn: "composio-proxy",
          body: { service: "people", path: `/${opts.resourceName}:updateContact`, method: "PATCH", params: { updatePersonFields: "names,emailAddresses,phoneNumbers,organizations" }, body },
        });
      } else if (action === "delete" && opts.resourceName) {
        await wsInvoke<any>({
          fn: "composio-proxy",
          body: { service: "people", path: `/${opts.resourceName}:deleteContact`, method: "DELETE" },
        });
      }
    } catch (err) {
      console.warn("Google Contacts sync error:", err);
    }
    return null;
  }, [googleContactsConnected, wsInvoke]);

  const handleUpdateContact = useCallback(async (id: string, updates: Partial<DbContact>) => {
    await updateContact(id, updates);
    if (googleContactsConnected) {
      const contact = contacts.find(c => c.id === id);
      const resourceName = (contact as any)?.google_resource_name ||
        (googleContacts as any[])?.find((g: any) => g.names?.[0]?.displayName === contact?.name)?.resourceName;
      if (resourceName) {
        await syncContactToGoogle("update", {
          name: updates.name ?? contact?.name,
          email: updates.email ?? contact?.email,
          phone: updates.phone ?? contact?.phone,
          company: updates.company ?? contact?.company,
          role: updates.role ?? contact?.role,
          resourceName,
        });
      }
    }
  }, [updateContact, googleContactsConnected, contacts, googleContacts, syncContactToGoogle]);

  // ── AI handlers ───────────────────────────────────────────────────────────
  const handleAiEnrich = useCallback(async (contact: DbContact) => {
    setAiLoading("enrich-" + contact.id);
    try {
      const { data, error } = await invoke<any>({
        fn: "ai-router",
        body: { module: "contacts", action: "enrich", contact: { name: contact.name, company: contact.company, email: contact.email } },
      });
      if (error) throw new Error(error);
      const r = data.result;
      const updates: Partial<DbContact> = {};
      if (r.role && !contact.role) updates.role = r.role;
      if (r.tags) updates.tags = [...new Set([...(contact.tags || []), ...r.tags])];
      if (r.note && !contact.notes) updates.notes = r.note;
      if (Object.keys(updates).length) {
        await updateContact(contact.id, updates);
        toast({ title: "Contato enriquecido!", description: `${r.role ? `Cargo: ${r.role}` : ""}${r.tags ? ` • Tags: ${r.tags.join(", ")}` : ""}` });
      } else {
        toast({ title: "Nada a enriquecer", description: "Contato já está completo." });
      }
    } catch (err: any) {
      toast({ title: "Erro na IA", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally { setAiLoading(null); }
  }, [updateContact, invoke]);

  const handleAiFindDuplicates = useCallback(async () => {
    setAiLoading("duplicates");
    try {
      const contactsData = contacts.map(c => ({ id: c.id, name: c.name, email: c.email, phone: c.phone }));
      const { data, error } = await invoke<any>({
        fn: "ai-router",
        body: { module: "contacts", action: "find_duplicates", contacts: contactsData },
      });
      if (error) throw new Error(error);
      const r = data.result;
      if (r.duplicates?.length > 0) {
        const msgs = r.duplicates.map((d: any) => d.reason).join("\n");
        toast({ title: `${r.duplicates.length} possível(is) duplicata(s)`, description: msgs });
      } else {
        toast({ title: "Nenhuma duplicata encontrada!" });
      }
    } catch (err: any) {
      toast({ title: "Erro na IA", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally { setAiLoading(null); }
  }, [contacts, invoke]);

  const handleAiSummarize = useCallback(async () => {
    if (!selectedContact || interactions.length === 0) return;
    setAiLoading("summarize");
    try {
      const { data, error } = await invoke<any>({
        fn: "ai-router",
        body: {
          module: "contacts",
          action: "summarize_interactions",
          contact: { name: selectedContact.name, company: selectedContact.company },
          interactions: interactions.slice(0, 20).map(i => ({
            type: i.type, title: i.title, description: i.description, date: i.interaction_date,
          })),
        },
      });
      if (error) throw new Error(error);
      toast({ title: "Resumo gerado", description: data.result?.summary || "Sem resumo." });
    } catch (err: any) {
      toast({ title: "Erro na IA", description: err?.message, variant: "destructive" });
    } finally { setAiLoading(null); }
  }, [selectedContact, interactions, invoke]);

  const handleAiSuggestAction = useCallback(async () => {
    if (!selectedContact) return;
    setAiLoading("next-action");
    setAiNextAction(null);
    try {
      const { data, error } = await invoke<any>({
        fn: "ai-router",
        body: {
          module: "contacts",
          action: "suggest_next_action",
          contact: {
            name: selectedContact.name,
            company: selectedContact.company,
            role: selectedContact.role,
            tags: selectedContact.tags,
            interactions: interactions.slice(0, 10).map(i => ({ type: i.type, title: i.title, date: i.interaction_date })),
            last_interaction: lastInteractionMap[selectedContact.id] || null,
          },
        },
      });
      if (error) throw new Error(error);
      setAiNextAction(data.result?.suggestion || data.result?.next_action || "Sem sugestão disponível.");
    } catch (err: any) {
      toast({ title: "Erro na IA", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally { setAiLoading(null); }
  }, [selectedContact, interactions, lastInteractionMap, invoke]);

  // ── Contact CRUD ──────────────────────────────────────────────────────────
  const handleAdd = useCallback(async (formData: ContactFormData) => {
    if (!formData.name.trim()) return;
    const phones = formData.phones.length > 0
      ? formData.phones
      : formData.phone.trim() ? [{ number: formData.phone.trim(), label: "Principal" }] : [];
    const emails = formData.emails.length > 0
      ? formData.emails
      : formData.email.trim() ? [{ email: formData.email.trim(), label: "Principal" }] : [];

    await addContact({
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      company: formData.company.trim(),
      role: formData.role.trim(),
      contact_type: formData.contact_type,
      avatar_url: formData.avatar_url.trim() || null,
      website: formData.website.trim(),
      birthday: formData.birthday || null,
      phones: phones as any,
      emails: emails as any,
      addresses: formData.addresses as any,
      social_links: formData.social_links as any,
      company_logo_url: formData.company_logo_url.trim() || null,
      company_industry: formData.company_industry.trim(),
      company_size: formData.company_size,
      company_description: formData.company_description.trim(),
    });
    const googleResult = await syncContactToGoogle("create", {
      name: formData.name.trim(), email: formData.email.trim(), phone: formData.phone.trim(),
      company: formData.company.trim(), role: formData.role.trim(),
    });
    if (googleResult?.resourceName) {
      const newC = contacts.find(c => c.name === formData.name.trim());
      if (newC) {
        await updateContact(newC.id, {
          google_resource_name: googleResult.resourceName,
          google_etag: googleResult.etag || null,
        } as any);
      }
    }
    googleContactsRefetch();
    setShowAddForm(false);

    if (formData.name.trim()) {
      const newC = contacts.find(c => c.name === formData.name.trim());
      if (newC) {
        setTimeout(() => handleAiEnrich(newC), 500);
      }
    }
  }, [addContact, syncContactToGoogle, contacts, updateContact, googleContactsRefetch, handleAiEnrich]);

  const handleAddTag = useCallback(async (contactId: string) => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag) return;
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    const newTags = [...new Set([...(contact.tags || []), tag])];
    await handleUpdateContact(contactId, { tags: newTags });
    setTagInput("");
  }, [tagInput, contacts, handleUpdateContact]);

  const removeTag = useCallback(async (contactId: string, tag: string) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    await handleUpdateContact(contactId, { tags: (contact.tags || []).filter(t => t !== tag) });
  }, [contacts, handleUpdateContact]);

  const handleDeleteInteraction = useCallback(async (id: string) => {
    await deleteInteraction(id);
    setInteractions(prev => prev.filter(i => i.id !== id));
  }, [deleteInteraction]);

  // ── Batch operations ──────────────────────────────────────────────────────
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => setSelectedIds(new Set(filtered.map(c => c.id))), [filtered]);

  const handleBatchDelete = useCallback(async () => {
    const ok = await confirm({ title: `Excluir ${selectedIds.size} contato(s)?`, description: "Esta ação é irreversível.", confirmLabel: "Excluir" });
    if (!ok) return;
    const count = selectedIds.size;
    // Sync Google deletes first (sequential — external API)
    if (googleContactsConnected) {
      for (const id of selectedIds) {
        const c = contacts.find(ct => ct.id === id);
        if (c && (c as any).google_resource_name) {
          await syncContactToGoogle("delete", { resourceName: (c as any).google_resource_name });
        }
      }
    }
    // Batch delete in parallel chunks
    await batchDelete([...selectedIds]);
    setSelectedIds(new Set());
    setSelectMode(false);
    toast({ title: `${count} contato(s) excluído(s)` });
  }, [selectedIds, contacts, googleContactsConnected, syncContactToGoogle, batchDelete, confirm]);

  const handleBatchFavorite = useCallback(async () => {
    const updates = [...selectedIds]
      .map(id => ({ id, c: contacts.find(ct => ct.id === id) }))
      .filter(x => x.c && !x.c.favorited)
      .map(x => ({ id: x.id, data: { favorited: true } as Partial<DbContact> }));
    await batchUpdate(updates);
    toast({ title: "Contatos favoritados!" });
  }, [selectedIds, contacts, batchUpdate]);

  const handleBatchAddTag = useCallback(async () => {
    const tag = batchTagInput.trim().toLowerCase();
    if (!tag || selectedIds.size === 0) return;
    const updates = [...selectedIds]
      .map(id => ({ id, c: contacts.find(ct => ct.id === id) }))
      .filter(x => !!x.c)
      .map(x => ({ id: x.id, data: { tags: [...new Set([...(x.c!.tags || []), tag])] } as Partial<DbContact> }));
    await batchUpdate(updates);
    setBatchTagInput("");
    toast({ title: `Tag "${tag}" adicionada a ${selectedIds.size} contato(s)` });
  }, [batchTagInput, selectedIds, contacts, batchUpdate]);

  const handleBatchEnrich = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setAiLoading("batch-enrich");
    let enriched = 0;
    for (const id of selectedIds) {
      const c = contacts.find(ct => ct.id === id);
      if (c) {
        try {
          const { data, error } = await invoke<any>({
            fn: "ai-router",
            body: { module: "contacts", action: "enrich", contact: { name: c.name, company: c.company, email: c.email } },
          });
          if (!error && data?.result) {
            const r = data.result;
            const updates: Partial<DbContact> = {};
            if (r.role && !c.role) updates.role = r.role;
            if (r.tags) updates.tags = [...new Set([...(c.tags || []), ...r.tags])];
            if (r.note && !c.notes) updates.notes = r.note;
            if (Object.keys(updates).length) {
              await updateContact(c.id, updates);
              enriched++;
            }
          }
        } catch { /* continue */ }
      }
    }
    setAiLoading(null);
    toast({ title: `${enriched} contato(s) enriquecido(s) com IA` });
  }, [selectedIds, contacts, invoke, updateContact]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const showAddFormRef = useRef(showAddForm);
  showAddFormRef.current = showAddForm;
  const selectModeRef = useRef(selectMode);
  selectModeRef.current = selectMode;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const handleBatchDeleteRef = useRef(handleBatchDelete);
  handleBatchDeleteRef.current = handleBatchDelete;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName);
      if (e.key === "Escape") {
        if (selectedIdRef.current) { setSelectedId(null); e.preventDefault(); }
        else if (showAddFormRef.current) { setShowAddForm(false); e.preventDefault(); }
        else if (selectModeRef.current) { setSelectMode(false); setSelectedIds(new Set()); e.preventDefault(); }
      }
      if (isInput) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "n") { e.preventDefault(); setShowAddForm(true); }
      if ((e.ctrlKey || e.metaKey) && e.key === "a" && selectModeRef.current) { e.preventDefault(); selectAll(); }
      if (e.key === "/" && !isInput) { e.preventDefault(); searchInputRef.current?.focus(); }
      if ((e.key === "Delete" || e.key === "Backspace") && selectModeRef.current && selectedIdsRef.current.size > 0 && !isInput) { e.preventDefault(); handleBatchDeleteRef.current(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectAll]);

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExportCsv = useCallback(() => {
    const data = (selectedIds.size > 0 ? filtered.filter(c => selectedIds.has(c.id)) : filtered);
    const headers = ["Nome", "Email", "Telefone", "Empresa", "Cargo", "Tags", "Favorito", "Notas"];
    const rows = data.map(c => [
      c.name, c.email, c.phone, c.company, c.role,
      (c.tags || []).join("; "), c.favorited ? "Sim" : "Não", c.notes,
    ]);
    exportToCsv("contatos", headers, rows);
    toast({ title: "CSV exportado!" });
  }, [selectedIds, filtered]);

  // ── vCard import ──────────────────────────────────────────────────────────
  const handleVcardFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const parsed = parseVCardFile(text);
      if (parsed.length === 0) {
        toast({ title: "Nenhum contato encontrado", description: "O arquivo .vcf não contém contatos válidos.", variant: "destructive" });
      } else {
        setVcardContacts(parsed);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const handleVcardImportConfirm = useCallback(async () => {
    if (!vcardContacts?.length) return;
    setImportingVcard(true);
    try {
      const { data, error } = await invoke<any>({
        fn: "data-io",
        body: { action: "import", type: "contacts-vcard", data: vcardContacts },
      });
      if (error) throw new Error(error);
      const count = data?.imported?.contacts || 0;
      toast({ title: `${count} contato(s) importado(s)!`, description: "Os contatos do iPhone foram adicionados ao DESH." });
      setVcardContacts(null);
      refetchContacts();
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setImportingVcard(false);
    }
  }, [vcardContacts, invoke, refetchContacts]);

  // ── Google import ─────────────────────────────────────────────────────────
  const handleImportGoogleContacts = useCallback(async () => {
    if (!googleContacts || googleContacts.length === 0) return;
    setImportingGoogle(true);
    let imported = 0;
    let updated = 0;
    try {
      const byResourceName = new Map<string, DbContact>(
        contacts.filter(c => !!(c as any).google_resource_name).map(c => [(c as any).google_resource_name as string, c])
      );
      const byEmail = new Map<string, DbContact>(
        contacts.filter(c => !!c.email).map(c => [c.email.toLowerCase(), c])
      );

      for (const gc of googleContacts as any[]) {
        if (!gc.resourceName) continue;
        const email = gc.emailAddresses?.[0]?.value?.toLowerCase() || "";
        const name = gc.names?.[0]?.displayName || gc.names?.[0]?.givenName || "Sem nome";
        const phone = gc.phoneNumbers?.[0]?.value || "";
        const company = gc.organizations?.[0]?.name || "";
        const role = gc.organizations?.[0]?.title || "";
        const avatar_url = gc.photos?.[0]?.url?.replace(/=s\d+$/, "=s200") || null;

        const existingByRN = byResourceName.get(gc.resourceName) as DbContact | undefined;
        if (existingByRN) {
          const needsUpdate =
            (avatar_url && existingByRN.avatar_url !== avatar_url) ||
            (!existingByRN.google_resource_name);
          const etagChanged = gc.etag && (existingByRN as any).google_etag !== gc.etag;
          if (needsUpdate || etagChanged) {
            const patch: Partial<DbContact> = {};
            if (avatar_url) patch.avatar_url = avatar_url;
            if (!(existingByRN as any).google_resource_name) (patch as any).google_resource_name = gc.resourceName;
            if (gc.etag) (patch as any).google_etag = gc.etag;
            await updateContact(existingByRN.id, patch);
            updated++;
          }
          continue;
        }

        const existingByEmail = email ? byEmail.get(email) as DbContact | undefined : undefined;
        if (existingByEmail) {
          const patch: any = { google_resource_name: gc.resourceName };
          if (avatar_url && existingByEmail.avatar_url !== avatar_url) patch.avatar_url = avatar_url;
          if (gc.etag) patch.google_etag = gc.etag;
          await updateContact(existingByEmail.id, patch);
          updated++;
          continue;
        }

        const newContact = await addContact({
          name, email, phone, company, role,
          google_resource_name: gc.resourceName,
          google_etag: gc.etag || null,
          avatar_url,
        } as any);
        if (newContact) imported++;
      }

      const parts = [];
      if (imported > 0) parts.push(`${imported} importado(s)`);
      if (updated > 0) parts.push(`${updated} atualizado(s)`);
      toast({
        title: parts.length ? parts.join(" • ") : "Nada novo para importar",
        description: parts.length ? "Sincronização com Google Contacts concluída ✓" : "Todos os contatos já estão sincronizados.",
      });
      googleContactsRefetch();
    } catch (err: any) {
      toast({ title: "Erro ao importar", description: err?.message, variant: "destructive" });
    } finally {
      setImportingGoogle(false);
    }
  }, [googleContacts, contacts, addContact, updateContact, googleContactsRefetch]);

  // ── Auto-import ───────────────────────────────────────────────────────────
  const autoImportTriggered = useRef(false);
  useEffect(() => {
    if (!googleContactsConnected || autoImportTriggered.current) return;
    const flag = sessionStorage.getItem("desh-contacts-auto-imported");
    if (flag) return;
    autoImportTriggered.current = true;
    const timer = setTimeout(() => {
      if (googleContacts && (googleContacts as any[]).length > 0) {
        sessionStorage.setItem("desh-contacts-auto-imported", "1");
        handleImportGoogleContacts();
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [googleContactsConnected, googleContacts, handleImportGoogleContacts]);

  // ── Follow-up check ───────────────────────────────────────────────────────
  const contactsRef = useRef(contacts);
  contactsRef.current = contacts;
  const lastInteractionMapRef = useRef(lastInteractionMap);
  lastInteractionMapRef.current = lastInteractionMap;
  const aiFollowupRef = useRef(aiFollowup);
  aiFollowupRef.current = aiFollowup;

  const checkFollowup = useCallback(async (contactId: string) => {
    const contact = contactsRef.current.find(c => c.id === contactId);
    if (!contact) return;
    const lastInt = lastInteractionMapRef.current[contactId];
    const daysSince = lastInt ? Math.floor((Date.now() - new Date(lastInt).getTime()) / 86400000) : null;
    if (daysSince === null || daysSince <= 30) return;
    if (aiFollowupRef.current[contactId]) return;
    try {
      const { data } = await invoke<any>({
        fn: "ai-router",
        body: {
          module: "contacts",
          action: "suggest_followup",
          contact: { name: contact.name, company: contact.company, role: contact.role, last_interaction: lastInt },
        },
      });
      if (data?.result?.suggestion) {
        setAiFollowup(prev => ({ ...prev, [contactId]: data.result.suggestion }));
      }
    } catch {/* silent */ }
  }, [invoke]);

  const computeScoreComponents = useCallback((summary: InteractionSummary) => {
    const freq = Math.min(summary.count * 2, 40);
    const diversity = Math.min(
      Object.entries(summary.typeCounts).reduce((s, [t, c]) => s + (({ meeting: 4, call: 3, email: 2, note: 1 } as Record<string, number>)[t] || 1) * Math.min(c, 3), 0),
      20
    );
    const total = computeRelationshipScore(summary);
    const recency = total - freq - diversity;
    return { freq, recency, diversity };
  }, []);

  const clearFilters = useCallback(() => {
    setFilterTag("all");
    setFilterFav(false);
    setFilterCompany("all");
    setFilterType("all");
    setContactPage(1);
  }, []);

  return {
    navigate,
    confirmDialog,

    // Google
    googleContacts, googleContactsConnected, googleContactsNames,
    isConnected, isLoading,
    contactsNeedsScope, contactsRequestScope,
    importingGoogle,

    // Contacts data
    contacts, selectedContact,
    addContact, updateContact, deleteContact, toggleFavorite, addInteraction,
    refetchContacts,

    // State
    searchQuery, setSearchQuery,
    selectedId, setSelectedId,
    showAddForm, setShowAddForm,
    showFilters, setShowFilters,
    filterTag, setFilterTag,
    filterFav, setFilterFav,
    filterCompany, setFilterCompany,
    filterType, setFilterType,
    groupBy, setGroupBy,
    sortBy, setSortBy,
    contactPage, setContactPage,
    interactions, loadingInteractions,
    tagInput, setTagInput,
    aiLoading, aiNextAction, setAiNextAction,
    aiFollowup,
    selectMode, setSelectMode,
    selectedIds, setSelectedIds,
    lastInteractionMap, lastInteractionTypeMap,
    interactionSummaryMap,
    allInteractionsRaw,
    showRanking, setShowRanking,
    showExportModal, setShowExportModal,
    showBirthdays, setShowBirthdays,
    batchTagInput, setBatchTagInput,
    vcardContacts, setVcardContacts,
    importingVcard,
    vcardInputRef, searchInputRef,

    // Derived
    allTags, allCompanies, activeFiltersCount,
    contactsWithScores, scoreMap, topContacts, atRiskContacts,
    upcomingBirthdays,
    filtered, totalPages, safeContactPage, paginatedContacts,
    summaryStats, grouped,

    // Handlers
    handleAdd,
    handleUpdateContact,
    handleAddTag, removeTag,
    handleDeleteInteraction,
    handleAiEnrich, handleAiFindDuplicates, handleAiSummarize, handleAiSuggestAction,
    handleImportGoogleContacts,
    handleExportCsv,
    handleVcardFileChange, handleVcardImportConfirm,
    handleBatchDelete, handleBatchFavorite, handleBatchAddTag, handleBatchEnrich,
    toggleSelect, selectAll,
    syncContactToGoogle,
    checkFollowup,
    computeScoreComponents, clearFilters,
    computeRelationshipScore, getScoreLabel,
    CONTACTS_PER_PAGE,
  };
}

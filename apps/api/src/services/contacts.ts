import { and, asc, desc, eq, inArray, ilike, or } from "drizzle-orm";
import { contactInteractions, contacts } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { ServiceError } from "./errors.js";
import { assertWorkspaceMember } from "./workspace-members.js";
import { emitAutomationEvent } from "./automations.js";

// Service layer for contacts + interactions. Same dual-target design as
// services/tasks.ts — REST routes and MCP tools share these functions.

export type InteractionType = "note" | "call" | "email" | "meeting" | "message" | "other";

// Rich-field shapes — kept loose intentionally. The legacy SPA schema has
// per-array shapes ({number,label,is_primary} for phones, etc.) but we
// don't want the apps/api layer to validate them strictly: the contacts
// page is the authority on what fields it stores. Treat as opaque jsonb
// at the API layer; tighten if a tool consumer needs typed access.
export type ContactPhone = Record<string, unknown>;
export type ContactEmail = Record<string, unknown>;
export type ContactAddress = Record<string, unknown>;
export type ContactSocialLinks = Record<string, unknown>;
export type ContactCustomFields = Record<string, unknown>;

export interface ApiContact {
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
  // Rich fields (jsonb-backed). Defaults: arrays empty, objects empty.
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
  customFields: ContactCustomFields;
  googleResourceName: string | null;
  googleEtag: string | null;
  createdAt: string;
  updatedAt: string;
  interactions: ApiInteraction[];
}

export interface ApiInteraction {
  id: string;
  contactId: string;
  createdBy: string | null;
  type: string;
  title: string;
  description: string;
  interactionDate: string;
  createdAt: string;
}

function toApiContact(
  row: typeof contacts.$inferSelect,
  interactions: (typeof contactInteractions.$inferSelect)[] = [],
): ApiContact {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    createdBy: row.createdBy,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    role: row.role,
    notes: row.notes,
    tags: row.tags,
    favorited: row.favorited,
    avatarUrl: row.avatarUrl,
    birthday: row.birthday,
    contactType: row.contactType,
    phones: (row.phones as ContactPhone[] | null) ?? [],
    emails: (row.emails as ContactEmail[] | null) ?? [],
    addresses: (row.addresses as ContactAddress[] | null) ?? [],
    socialLinks: (row.socialLinks as ContactSocialLinks | null) ?? {},
    website: row.website,
    companyLogoUrl: row.companyLogoUrl,
    companyDescription: row.companyDescription,
    companyIndustry: row.companyIndustry,
    companySize: row.companySize,
    customFields: (row.customFields as ContactCustomFields | null) ?? {},
    googleResourceName: row.googleResourceName,
    googleEtag: row.googleEtag,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    interactions: interactions.map(toApiInteraction),
  };
}

function toApiInteraction(row: typeof contactInteractions.$inferSelect): ApiInteraction {
  return {
    id: row.id,
    contactId: row.contactId,
    createdBy: row.createdBy,
    type: row.type,
    title: row.title,
    description: row.description,
    interactionDate: row.interactionDate.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function dbOrThrow() {
  const db = getDb();
  if (!db) throw new ServiceError(500, "db_unavailable");
  return db;
}

// ─── Contacts ───────────────────────────────────────────────────────

export async function listContacts(
  workspaceId: string,
  actorUserId: string,
): Promise<ApiContact[]> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();

  const rows = await db
    .select()
    .from(contacts)
    .where(eq(contacts.workspaceId, workspaceId))
    .orderBy(desc(contacts.favorited), asc(contacts.name));

  const ids = rows.map((c) => c.id);
  const interactions = ids.length
    ? await db
        .select()
        .from(contactInteractions)
        .where(inArray(contactInteractions.contactId, ids))
        .orderBy(desc(contactInteractions.interactionDate))
    : [];

  const byContact = new Map<string, (typeof contactInteractions.$inferSelect)[]>();
  for (const i of interactions) {
    const list = byContact.get(i.contactId) ?? [];
    list.push(i);
    byContact.set(i.contactId, list);
  }

  return rows.map((c) => toApiContact(c, byContact.get(c.id) ?? []));
}

// Free-text search across name/email/phone/company, case-insensitive. Used
// by the MCP `find_contact` tool. Returns a slim shape (no interactions) —
// the agent can call `get_contact` for details if needed.
export async function findContacts(
  workspaceId: string,
  actorUserId: string,
  query: string,
  limit = 10,
): Promise<ApiContact[]> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();

  const trimmed = query.trim();
  if (!trimmed) return [];

  const pattern = `%${trimmed}%`;
  const rows = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.workspaceId, workspaceId),
        or(
          ilike(contacts.name, pattern),
          ilike(contacts.email, pattern),
          ilike(contacts.phone, pattern),
          ilike(contacts.company, pattern),
        ),
      ),
    )
    .orderBy(desc(contacts.favorited), asc(contacts.name))
    .limit(limit);
  return rows.map((c) => toApiContact(c));
}

export interface CreateContactInput {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  notes?: string;
  tags?: string[];
  favorited?: boolean;
  avatarUrl?: string | null;
  birthday?: string | null;
  // Rich fields — all optional. jsonb-backed; defaults applied if absent.
  contactType?: string;
  phones?: ContactPhone[];
  emails?: ContactEmail[];
  addresses?: ContactAddress[];
  socialLinks?: ContactSocialLinks;
  website?: string;
  companyLogoUrl?: string | null;
  companyDescription?: string;
  companyIndustry?: string;
  companySize?: string;
  customFields?: ContactCustomFields;
  googleResourceName?: string | null;
  googleEtag?: string | null;
}

export async function createContact(
  workspaceId: string,
  actorUserId: string,
  input: CreateContactInput,
): Promise<ApiContact> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();

  const [created] = await db
    .insert(contacts)
    .values({
      workspaceId,
      createdBy: actorUserId,
      name: input.name,
      email: input.email ?? "",
      phone: input.phone ?? "",
      company: input.company ?? "",
      role: input.role ?? "",
      notes: input.notes ?? "",
      tags: input.tags ?? [],
      favorited: input.favorited ?? false,
      avatarUrl: input.avatarUrl ?? null,
      birthday: input.birthday ?? null,
      contactType: input.contactType ?? "person",
      phones: input.phones ?? [],
      emails: input.emails ?? [],
      addresses: input.addresses ?? [],
      socialLinks: input.socialLinks ?? {},
      website: input.website ?? "",
      companyLogoUrl: input.companyLogoUrl ?? null,
      companyDescription: input.companyDescription ?? "",
      companyIndustry: input.companyIndustry ?? "",
      companySize: input.companySize ?? "",
      customFields: input.customFields ?? {},
      googleResourceName: input.googleResourceName ?? null,
      googleEtag: input.googleEtag ?? null,
    })
    .returning();
  if (!created) throw new ServiceError(500, "insert_failed");
  emitAutomationEvent(workspaceId, "contact_added", {
    contactId: created.id,
    name: created.name,
    email: created.email,
    company: created.company,
  });
  return toApiContact(created);
}

export type UpdateContactInput = Partial<CreateContactInput>;

export async function updateContact(
  workspaceId: string,
  actorUserId: string,
  contactId: string,
  input: UpdateContactInput,
): Promise<ApiContact> {
  if (Object.keys(input).length === 0) throw new ServiceError(400, "empty_patch");
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();

  const [updated] = await db
    .update(contacts)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(contacts.id, contactId), eq(contacts.workspaceId, workspaceId)))
    .returning();
  if (!updated) throw new ServiceError(404, "contact_not_found");

  const interactions = await db
    .select()
    .from(contactInteractions)
    .where(eq(contactInteractions.contactId, updated.id))
    .orderBy(desc(contactInteractions.interactionDate));
  return toApiContact(updated, interactions);
}

export async function deleteContact(
  workspaceId: string,
  actorUserId: string,
  contactId: string,
): Promise<void> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();
  const result = await db
    .delete(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.workspaceId, workspaceId)))
    .returning({ id: contacts.id });
  if (!result[0]) throw new ServiceError(404, "contact_not_found");
}

// ─── Interactions ───────────────────────────────────────────────────

export interface CreateInteractionInput {
  type?: InteractionType;
  title: string;
  description?: string;
  interactionDate?: string;
}

export async function createInteraction(
  workspaceId: string,
  actorUserId: string,
  contactId: string,
  input: CreateInteractionInput,
): Promise<ApiInteraction> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();

  const parent = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.workspaceId, workspaceId)))
    .limit(1);
  if (!parent[0]) throw new ServiceError(404, "contact_not_found");

  const [created] = await db
    .insert(contactInteractions)
    .values({
      contactId,
      createdBy: actorUserId,
      type: input.type ?? "note",
      title: input.title,
      description: input.description ?? "",
      interactionDate: input.interactionDate
        ? new Date(input.interactionDate)
        : new Date(),
    })
    .returning();
  if (!created) throw new ServiceError(500, "insert_failed");
  return toApiInteraction(created);
}

export interface UpdateInteractionInput {
  type?: InteractionType;
  title?: string;
  description?: string;
  interactionDate?: string;
}

export async function updateInteraction(
  workspaceId: string,
  actorUserId: string,
  contactId: string,
  interactionId: string,
  input: UpdateInteractionInput,
): Promise<ApiInteraction> {
  if (Object.keys(input).length === 0) throw new ServiceError(400, "empty_patch");
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();

  // Defend against forged URLs across workspaces — verify the interaction
  // belongs to a contact in this workspace before updating.
  const guard = await db
    .select({ id: contactInteractions.id })
    .from(contactInteractions)
    .innerJoin(contacts, eq(contacts.id, contactInteractions.contactId))
    .where(
      and(
        eq(contactInteractions.id, interactionId),
        eq(contacts.id, contactId),
        eq(contacts.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!guard[0]) throw new ServiceError(404, "interaction_not_found");

  const { interactionDate, ...rest } = input;
  const set: Partial<typeof contactInteractions.$inferInsert> = { ...rest };
  if (interactionDate !== undefined) {
    set.interactionDate = new Date(interactionDate);
  }

  const [updated] = await db
    .update(contactInteractions)
    .set(set)
    .where(eq(contactInteractions.id, interactionId))
    .returning();
  if (!updated) throw new ServiceError(404, "interaction_not_found");
  return toApiInteraction(updated);
}

export async function deleteInteraction(
  workspaceId: string,
  actorUserId: string,
  interactionId: string,
): Promise<void> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();
  const result = await db
    .delete(contactInteractions)
    .where(eq(contactInteractions.id, interactionId))
    .returning({ id: contactInteractions.id });
  if (!result[0]) throw new ServiceError(404, "interaction_not_found");
}

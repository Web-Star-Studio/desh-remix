import { and, asc, eq, gte, lte } from "drizzle-orm";
import { events } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { ServiceError } from "./errors.js";
import { assertWorkspaceMember } from "./workspace-members.js";
import { emitAutomationEvent } from "./automations.js";

// Service layer for first-party calendar events. Same dual-target shape as
// services/notes.ts: REST routes and the agent's MCP tools both call into
// here so behaviour stays single-source-of-truth.

export type EventCategory =
  | "trabalho"
  | "pessoal"
  | "saúde"
  | "educação"
  | "lazer"
  | "outro";

export type RecurrenceType = "none" | "daily" | "weekly" | "monthly";

const EVENT_CATEGORY_COLORS: Record<EventCategory, string> = {
  trabalho: "bg-blue-500",
  pessoal: "bg-emerald-500",
  saúde: "bg-rose-500",
  educação: "bg-amber-500",
  lazer: "bg-violet-500",
  outro: "bg-muted-foreground",
};

// Snake-case shape exposed to the SPA — matches `apps/web/src/types/calendar.ts`
// so existing components don't need rewiring.
export interface ApiEvent {
  id: string;
  workspace_id: string;
  created_by: string | null;
  label: string;
  day: number;
  month: number;
  year: number;
  start_at: string | null;
  end_at: string | null;
  category: EventCategory;
  recurrence: RecurrenceType;
  color: string;
  location: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

function toApi(row: typeof events.$inferSelect): ApiEvent {
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    created_by: row.createdBy,
    label: row.label,
    day: row.day,
    month: row.month,
    year: row.year,
    start_at: row.startAt ? row.startAt.toISOString() : null,
    end_at: row.endAt ? row.endAt.toISOString() : null,
    category: row.category as EventCategory,
    recurrence: row.recurrence as RecurrenceType,
    color: row.color,
    location: row.location,
    description: row.description,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function dbOrThrow() {
  const db = getDb();
  if (!db) throw new ServiceError(500, "db_unavailable");
  return db;
}

// ── List ──────────────────────────────────────────────────────────────────

export interface ListEventsOptions {
  /** Inclusive month bounds — both required if either is set. */
  fromYear?: number;
  fromMonth?: number;
  toYear?: number;
  toMonth?: number;
}

export async function listEvents(
  workspaceId: string,
  opts: ListEventsOptions = {},
): Promise<ApiEvent[]> {
  const db = dbOrThrow();
  const conds = [eq(events.workspaceId, workspaceId)];

  // Window filter: both ends optional; we encode (year*12+month) so the
  // index on (year, month) gets walked predicate-by-predicate. Simpler than
  // a stored generated column for the volume we're at.
  if (opts.fromYear != null && opts.fromMonth != null) {
    conds.push(
      gte(events.year, opts.fromYear),
    );
    // Within the same start year, also constrain month. Cross-year queries
    // are rare; fall back to year-only and let the SPA filter the rest.
    if (opts.toYear == null || opts.toYear === opts.fromYear) {
      conds.push(gte(events.month, opts.fromMonth));
    }
  }
  if (opts.toYear != null && opts.toMonth != null) {
    conds.push(lte(events.year, opts.toYear));
    if (opts.fromYear == null || opts.fromYear === opts.toYear) {
      conds.push(lte(events.month, opts.toMonth));
    }
  }

  const rows = await db
    .select()
    .from(events)
    .where(and(...conds))
    .orderBy(asc(events.year), asc(events.month), asc(events.day), asc(events.startAt));
  return rows.map(toApi);
}

export async function getEvent(workspaceId: string, eventId: string): Promise<ApiEvent | null> {
  const db = dbOrThrow();
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.workspaceId, workspaceId)))
    .limit(1);
  return rows[0] ? toApi(rows[0]) : null;
}

// ── Create ────────────────────────────────────────────────────────────────

export interface CreateEventInput {
  label: string;
  day: number;
  month: number;
  year: number;
  startAt?: string | null;
  endAt?: string | null;
  category?: EventCategory;
  recurrence?: RecurrenceType;
  color?: string;
  location?: string | null;
  description?: string | null;
}

export async function createEvent(
  workspaceId: string,
  actorUserId: string,
  input: CreateEventInput,
): Promise<ApiEvent> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();

  const category = input.category ?? "outro";
  const color = input.color ?? EVENT_CATEGORY_COLORS[category];

  const [row] = await db
    .insert(events)
    .values({
      workspaceId,
      createdBy: actorUserId,
      label: input.label,
      day: input.day,
      month: input.month,
      year: input.year,
      startAt: input.startAt ? new Date(input.startAt) : null,
      endAt: input.endAt ? new Date(input.endAt) : null,
      category,
      recurrence: input.recurrence ?? "none",
      color,
      location: input.location ?? null,
      description: input.description ?? null,
    })
    .returning();
  if (!row) throw new ServiceError(500, "insert_failed");

  emitAutomationEvent(workspaceId, "event_created", {
    eventId: row.id,
    label: row.label,
    day: row.day,
    month: row.month,
    year: row.year,
    category: row.category,
  });

  return toApi(row);
}

// ── Update ────────────────────────────────────────────────────────────────

export type UpdateEventInput = Partial<CreateEventInput>;

export async function updateEvent(
  workspaceId: string,
  actorUserId: string,
  eventId: string,
  input: UpdateEventInput,
): Promise<ApiEvent> {
  if (Object.keys(input).length === 0) throw new ServiceError(400, "empty_patch");
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();

  const set: Partial<typeof events.$inferInsert> = { updatedAt: new Date() };
  if (input.label !== undefined) set.label = input.label;
  if (input.day !== undefined) set.day = input.day;
  if (input.month !== undefined) set.month = input.month;
  if (input.year !== undefined) set.year = input.year;
  if (input.startAt !== undefined) set.startAt = input.startAt ? new Date(input.startAt) : null;
  if (input.endAt !== undefined) set.endAt = input.endAt ? new Date(input.endAt) : null;
  if (input.category !== undefined) {
    set.category = input.category;
    // Auto-refresh color on category change unless caller pinned a color too.
    if (input.color === undefined) set.color = EVENT_CATEGORY_COLORS[input.category];
  }
  if (input.color !== undefined) set.color = input.color;
  if (input.recurrence !== undefined) set.recurrence = input.recurrence;
  if (input.location !== undefined) set.location = input.location;
  if (input.description !== undefined) set.description = input.description;

  const [row] = await db
    .update(events)
    .set(set)
    .where(and(eq(events.id, eventId), eq(events.workspaceId, workspaceId)))
    .returning();
  if (!row) throw new ServiceError(404, "event_not_found");
  return toApi(row);
}

// ── Delete ────────────────────────────────────────────────────────────────

export async function deleteEvent(
  workspaceId: string,
  actorUserId: string,
  eventId: string,
): Promise<void> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();
  const result = await db
    .delete(events)
    .where(and(eq(events.id, eventId), eq(events.workspaceId, workspaceId)))
    .returning({ id: events.id });
  if (result.length === 0) throw new ServiceError(404, "event_not_found");
}


import { and, asc, eq } from "drizzle-orm";
import { emailTemplates } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { ServiceError } from "./errors.js";

// Admin-managed email templates. Slug-keyed; the notification service looks
// up by slug at send time and falls back to inline TS templates if no row
// exists. Variable substitution is {{name}}-style and resolves from the
// caller's `data` map.

export type TemplateType = "transactional" | "report" | "marketing" | "lifecycle";

export interface ApiEmailTemplate {
  id: string;
  slug: string;
  name: string;
  type: string;
  subjectTemplate: string;
  bodyHtml: string;
  bodyText: string;
  active: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

function toApi(row: typeof emailTemplates.$inferSelect): ApiEmailTemplate {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: row.type,
    subjectTemplate: row.subjectTemplate,
    bodyHtml: row.bodyHtml,
    bodyText: row.bodyText,
    active: row.active,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function dbOrThrow() {
  const db = getDb();
  if (!db) throw new ServiceError(500, "db_unavailable");
  return db;
}

export async function listTemplates(
  filter: { type?: TemplateType; activeOnly?: boolean } = {},
): Promise<ApiEmailTemplate[]> {
  const db = dbOrThrow();
  const conditions = [];
  if (filter.type) conditions.push(eq(emailTemplates.type, filter.type));
  if (filter.activeOnly) conditions.push(eq(emailTemplates.active, true));
  const rows = conditions.length
    ? await db.select().from(emailTemplates).where(and(...conditions)).orderBy(asc(emailTemplates.slug))
    : await db.select().from(emailTemplates).orderBy(asc(emailTemplates.slug));
  return rows.map(toApi);
}

export async function getTemplate(id: string): Promise<ApiEmailTemplate> {
  const db = dbOrThrow();
  const [row] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id)).limit(1);
  if (!row) throw new ServiceError(404, "template_not_found");
  return toApi(row);
}

export async function getTemplateBySlug(slug: string): Promise<ApiEmailTemplate | null> {
  const db = dbOrThrow();
  const [row] = await db
    .select()
    .from(emailTemplates)
    .where(and(eq(emailTemplates.slug, slug), eq(emailTemplates.active, true)))
    .limit(1);
  return row ? toApi(row) : null;
}

export interface CreateTemplateInput {
  slug: string;
  name: string;
  type?: TemplateType;
  subjectTemplate: string;
  bodyHtml: string;
  bodyText?: string;
  active?: boolean;
}

export async function createTemplate(
  actorUserId: string,
  input: CreateTemplateInput,
): Promise<ApiEmailTemplate> {
  const db = dbOrThrow();
  try {
    const [row] = await db
      .insert(emailTemplates)
      .values({
        slug: input.slug,
        name: input.name,
        type: input.type ?? "transactional",
        subjectTemplate: input.subjectTemplate,
        bodyHtml: input.bodyHtml,
        bodyText: input.bodyText ?? "",
        active: input.active ?? true,
        createdBy: actorUserId,
      })
      .returning();
    if (!row) throw new ServiceError(500, "insert_failed");
    return toApi(row);
  } catch (err) {
    // Postgres unique violation on slug.
    if (err instanceof Error && err.message.includes("email_templates_slug_unique")) {
      throw new ServiceError(409, "slug_taken");
    }
    throw err;
  }
}

export type UpdateTemplateInput = Partial<CreateTemplateInput>;

export async function updateTemplate(
  id: string,
  input: UpdateTemplateInput,
): Promise<ApiEmailTemplate> {
  if (Object.keys(input).length === 0) throw new ServiceError(400, "empty_patch");
  const db = dbOrThrow();
  const [row] = await db
    .update(emailTemplates)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(emailTemplates.id, id))
    .returning();
  if (!row) throw new ServiceError(404, "template_not_found");
  return toApi(row);
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = dbOrThrow();
  const result = await db.delete(emailTemplates).where(eq(emailTemplates.id, id)).returning({ id: emailTemplates.id });
  if (!result[0]) throw new ServiceError(404, "template_not_found");
}

// Curly-brace variable substitution: `{{name}}` → data.name (toString).
// Missing keys are left as empty strings (legacy behavior). HTML escape is
// the caller's responsibility; we don't escape on substitution because the
// admin author may want to inject HTML fragments into a template.
export function renderTemplate(
  template: { subjectTemplate: string; bodyHtml: string; bodyText: string },
  data: Record<string, unknown>,
): { subject: string; html: string; text: string } {
  const sub = (s: string) =>
    s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
      const value = data[key];
      return value == null ? "" : String(value);
    });
  return {
    subject: sub(template.subjectTemplate),
    html: sub(template.bodyHtml),
    text: sub(template.bodyText),
  };
}

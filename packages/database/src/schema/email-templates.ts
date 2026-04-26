import { boolean, check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

// Admin-managed email templates. Each row is a slug-keyed template the
// notification service hydrates with `data` from the call site. Variables
// follow {{name}} curly-brace syntax. Subject + body_html + body_text are
// stored separately so we can render plain-text fallback for clients that
// don't load HTML. `type` distinguishes lifecycle from marketing from
// transactional — used today only for the admin filter UI.
export const emailTemplates = pgTable(
  "email_templates",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    type: text("type").notNull().default("transactional"),
    subjectTemplate: text("subject_template").notNull(),
    bodyHtml: text("body_html").notNull(),
    bodyText: text("body_text").notNull().default(""),
    active: boolean("active").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    typeCheck: check(
      "email_templates_type_check",
      sql`${table.type} in ('transactional','report','marketing','lifecycle')`,
    ),
    activeIdx: index("email_templates_active_idx").on(table.active),
  }),
);

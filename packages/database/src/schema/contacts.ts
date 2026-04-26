import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import { users } from "./users";

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by")
      .references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    company: text("company").notNull().default(""),
    role: text("role").notNull().default(""),
    notes: text("notes").notNull().default(""),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    favorited: boolean("favorited").notNull().default(false),
    avatarUrl: text("avatar_url"),
    birthday: text("birthday"),
    // Rich fields — multi-value contact details. Stored as jsonb to
    // preserve the legacy {number, label, is_primary} shape without
    // exploding into normalized phone/email/address tables. The legacy
    // SPA already speaks this shape so the UI migration is a flat
    // copy; if/when we want SQL-side queries on, say, "all contacts
    // with a primary email" we can add expression indexes.
    contactType: text("contact_type").notNull().default("person"),
    phones: jsonb("phones").notNull().default(sql`'[]'::jsonb`),
    emails: jsonb("emails").notNull().default(sql`'[]'::jsonb`),
    addresses: jsonb("addresses").notNull().default(sql`'[]'::jsonb`),
    socialLinks: jsonb("social_links").notNull().default(sql`'{}'::jsonb`),
    website: text("website").notNull().default(""),
    companyLogoUrl: text("company_logo_url"),
    companyDescription: text("company_description").notNull().default(""),
    companyIndustry: text("company_industry").notNull().default(""),
    companySize: text("company_size").notNull().default(""),
    customFields: jsonb("custom_fields").notNull().default(sql`'{}'::jsonb`),
    googleResourceName: text("google_resource_name"),
    googleEtag: text("google_etag"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index("contacts_workspace_id_idx").on(table.workspaceId),
  }),
);

export const contactInteractions = pgTable(
  "contact_interactions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by")
      .references(() => users.id, { onDelete: "set null" }),
    type: text("type").notNull().default("note"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    interactionDate: timestamp("interaction_date", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    contactIdx: index("contact_interactions_contact_id_idx").on(table.contactId),
  }),
);

import {
  boolean,
  index,
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

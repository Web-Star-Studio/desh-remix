import { jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import { users } from "./users";

// First-party mirror of Zernio's "profile" concept (a brand/project container
// grouping social accounts). The legacy Supabase table was `social_profiles`
// with a `late_profile_id` column; on the new stack we store the same id under
// the canonical name `zernio_profile_id`. The legacy table is unaffected.
//
// `userId` is nullable so a profile created server-side via the workspace
// lifecycle hook (no user attribution) lines up with profiles a member added
// from the SPA.
export const socialProfiles = pgTable(
  "social_profiles",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    zernioProfileId: text("zernio_profile_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    meta: jsonb("meta").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceProfileUnique: unique("social_profiles_workspace_profile_unique").on(
      table.workspaceId,
      table.zernioProfileId,
    ),
  }),
);

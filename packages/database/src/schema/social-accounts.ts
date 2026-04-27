import { jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import { users } from "./users";
import { socialProfiles } from "./social-profiles";

// Connected social accounts as Zernio sees them, mirrored locally so the SPA
// can render lists and the webhook can flip status without an extra HTTP call.
// `zernio_account_id` is the upstream `_id`; the legacy column was
// `late_account_id`.
export const socialAccounts = pgTable(
  "social_accounts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    socialProfileId: uuid("social_profile_id").references(() => socialProfiles.id, {
      onDelete: "cascade",
    }),
    zernioAccountId: text("zernio_account_id").notNull(),
    platform: text("platform").notNull(),
    username: text("username"),
    avatarUrl: text("avatar_url"),
    status: text("status").notNull().default("active"),
    meta: jsonb("meta").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceAccountUnique: unique("social_accounts_workspace_account_unique").on(
      table.workspaceId,
      table.zernioAccountId,
    ),
  }),
);

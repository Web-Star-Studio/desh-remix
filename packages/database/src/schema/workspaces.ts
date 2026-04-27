import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  icon: text("icon").notNull().default("🏠"),
  color: text("color").notNull().default("hsl(220, 80%, 50%)"),
  isDefault: boolean("is_default").notNull().default(false),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  // Zernio profile id minted on workspace creation (fire-and-forget). Null
  // when ZERNIO_API_KEY is unset or the upstream call hasn't completed yet.
  // The supervisor reads this to decide whether to emit `mcp_servers.zernio`
  // and to scope the agent's SOUL.md to this workspace's profile.
  zernioProfileId: text("zernio_profile_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

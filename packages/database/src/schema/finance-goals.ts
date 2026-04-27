import { numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import { users } from "./users";

// User-defined savings goals. `target` and `current` use numeric(15,2) to
// preserve the legacy SPA's amount shape (no truncation, BRL-safe). When the
// SPA persists a `current` value, the server treats it as authoritative —
// goal progress is not derived from transactions automatically (a future
// wave can layer auto-progress from a category-tagged transaction filter).
export const financeGoals = pgTable("finance_goals", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  target: numeric("target", { precision: 15, scale: 2 }).notNull().default("0"),
  current: numeric("current", { precision: 15, scale: 2 }).notNull().default("0"),
  color: text("color").notNull().default("hsl(220, 60%, 55%)"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { citext } from "./_helpers";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: citext("email").notNull().unique(),
  cognitoSub: text("cognito_sub").unique(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  // System-wide admin flag. Gated behind manual SQL set in production; admin
  // pages (broadcasts, templates, automations) check this before allowing
  // mutations. Workspace-level roles live in `workspace_members.role`.
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

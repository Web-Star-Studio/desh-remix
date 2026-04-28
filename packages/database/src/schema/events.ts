import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import { users } from "./users";

// First-party calendar-events table. Replaces the legacy `user_data`
// `data_type='event'` JSONB-blob pattern. The SPA's calendar grid renders
// month-by-month against the (year, month, day-of-month) integer triple,
// so we keep that shape as the canonical fields rather than a single
// timestamp. The optional `startAt`/`endAt` are there for finer ordering
// (e.g. "show at 14:00 on Tuesday") and for the agent / Google Calendar
// import paths; both are nullable.
//
// `category` and `recurrence` use the same vocabulary the SPA's
// types/calendar.ts has been using since legacy: trabalho/pessoal/...
// for category, none/daily/weekly/monthly for recurrence. Check
// constraints keep the set tight.
//
// "Remote" Google Calendar events do NOT live in this table — they're
// served live via Composio's calendar action runner. This table is only
// for events the user (or Pandora / an automation) creates inside DESH.
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    label: text("label").notNull(),
    day: integer("day").notNull(),
    month: integer("month").notNull(), // 0-indexed (matches Date.getMonth())
    year: integer("year").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }),
    endAt: timestamp("end_at", { withTimezone: true }),
    category: text("category").notNull().default("outro"),
    recurrence: text("recurrence").notNull().default("none"),
    color: text("color").notNull().default("bg-muted-foreground"),
    location: text("location"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    categoryCheck: check(
      "events_category_check",
      sql`${table.category} in ('trabalho','pessoal','saúde','educação','lazer','outro')`,
    ),
    recurrenceCheck: check(
      "events_recurrence_check",
      sql`${table.recurrence} in ('none','daily','weekly','monthly')`,
    ),
    dayCheck: check("events_day_check", sql`${table.day} between 1 and 31`),
    monthCheck: check("events_month_check", sql`${table.month} between 0 and 11`),
    yearCheck: check("events_year_check", sql`${table.year} between 1900 and 2200`),
    workspaceIdx: index("events_workspace_idx").on(table.workspaceId),
    workspaceMonthIdx: index("events_workspace_month_idx").on(
      table.workspaceId,
      table.year,
      table.month,
    ),
  }),
);

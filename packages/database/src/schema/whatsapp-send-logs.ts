import { check, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import { users } from "./users";

// Audit trail for every WhatsApp message sent through the Zernio routes.
// The send route inserts the row with status = success | failed and
// zernio_message_id (when the upstream call returned one). The webhook
// handler later updates delivery_status / *_at / error_* by matching on
// zernio_message_id. Monotonic transitions are enforced in handler logic
// (sent → delivered → read), never by the DB.
export const whatsappSendLogs = pgTable(
  "whatsapp_send_logs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    accountId: text("account_id").notNull(),
    // No FK on contactId yet — contacts table belongs to a different wave.
    contactId: uuid("contact_id"),
    toPhone: text("to_phone").notNull(),
    messageType: text("message_type").notNull(),
    templateName: text("template_name"),
    templateLanguage: text("template_language"),
    messagePreview: text("message_preview"),
    status: text("status").notNull(),
    zernioMessageId: text("zernio_message_id"),
    deliveryStatus: text("delivery_status"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    latencyMs: integer("latency_ms"),
    webhookPayload: jsonb("webhook_payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    messageTypeCheck: check(
      "whatsapp_send_logs_message_type_check",
      sql`${table.messageType} in ('text','template')`,
    ),
    statusCheck: check(
      "whatsapp_send_logs_status_check",
      sql`${table.status} in ('success','failed')`,
    ),
    deliveryStatusCheck: check(
      "whatsapp_send_logs_delivery_status_check",
      sql`${table.deliveryStatus} is null or ${table.deliveryStatus} in ('sent','delivered','read','failed')`,
    ),
    workspaceCreatedIdx: index("whatsapp_send_logs_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
    zernioMessageIdx: index("whatsapp_send_logs_zernio_message_idx").on(
      table.zernioMessageId,
    ),
  }),
);

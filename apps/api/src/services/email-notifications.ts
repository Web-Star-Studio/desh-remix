import { and, desc, eq, gte } from "drizzle-orm";
import {
  emailRateLimits,
  emailSendLog,
  notificationPreferences,
  users,
} from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { env } from "../config/env.js";
import { ServiceError } from "./errors.js";
import { getTemplateBySlug, renderTemplate } from "./email-templates.js";
import { getProviderCredential, isCredentialEncryptionConfigured } from "./credentials.js";

// Notification email service. Pipeline:
//   1. Resolve recipient + preferences (create-on-read default)
//   2. Suppress if preference toggle is off → log skipped
//   3. Suppress if rate-limited within 4h → log skipped
//   4. Render template (inline TS for 4a — three types)
//   5. Send via Resend (HTTP API, no SDK dep)
//   6. Log to email_send_log + email_rate_limits
//
// All paths terminate in a `email_send_log` row. The 4-hour rate-limit
// window mirrors the legacy edge function so user inboxes don't get spammed
// during heavy task/event reminder cycles.

// Notification types accepted today. The DB-level email_type column is `text`
// (no enum constraint) — admin-driven automations may emit additional types
// like `weekly_report` or `broadcast` with no SPA-side caller, but those still
// need preference + rate-limit handling. PREF_BY_TYPE returns null for types
// we don't yet have a preference flag for; those send unconditionally (4b
// schema only carries the three core flags; later waves add the rest).
export type NotificationType =
  | "task_reminder"
  | "event_reminder"
  | "archive_notice"
  | string;

const PREF_BY_TYPE: Record<string, keyof typeof notificationPreferences.$inferSelect | null> = {
  task_reminder: "emailTaskReminders",
  event_reminder: "emailEventReminders",
  archive_notice: "emailArchiveNotice",
};

const RATE_LIMIT_WINDOW_MS = 4 * 60 * 60 * 1000;

export interface SendNotificationInput {
  userId: string;
  type: NotificationType;
  data: Record<string, unknown>;
  workspaceId?: string | null;
}

export interface SendNotificationResult {
  status: "sent" | "skipped" | "failed";
  reason?: string;
}

function dbOrThrow() {
  const db = getDb();
  if (!db) throw new ServiceError(500, "db_unavailable");
  return db;
}

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function renderInlineTemplate(type: string, data: Record<string, unknown>): RenderedEmail {
  const userName = String(data.userName ?? "");
  switch (type) {
    case "task_reminder": {
      const title = String(data.title ?? "Task reminder");
      const dueAt = data.dueAt ? new Date(String(data.dueAt)) : null;
      return {
        subject: `Reminder: ${title}`,
        text:
          `Hi${userName ? ` ${userName}` : ""},\n\n` +
          `This is a reminder for your task: ${title}` +
          (dueAt ? `\nDue at: ${dueAt.toLocaleString()}` : "") +
          `\n\n— Desh`,
        html:
          `<p>Hi${userName ? ` ${userName}` : ""},</p>` +
          `<p>This is a reminder for your task: <strong>${escapeHtml(title)}</strong></p>` +
          (dueAt
            ? `<p>Due at: <em>${escapeHtml(dueAt.toLocaleString())}</em></p>`
            : "") +
          `<p>— Desh</p>`,
      };
    }
    case "event_reminder": {
      const title = String(data.title ?? "Event reminder");
      const startAt = data.startAt ? new Date(String(data.startAt)) : null;
      return {
        subject: `Reminder: ${title}`,
        text:
          `Hi${userName ? ` ${userName}` : ""},\n\n` +
          `This is a reminder for: ${title}` +
          (startAt ? `\nStarts at: ${startAt.toLocaleString()}` : "") +
          `\n\n— Desh`,
        html:
          `<p>Hi${userName ? ` ${userName}` : ""},</p>` +
          `<p>This is a reminder for: <strong>${escapeHtml(title)}</strong></p>` +
          (startAt
            ? `<p>Starts at: <em>${escapeHtml(startAt.toLocaleString())}</em></p>`
            : "") +
          `<p>— Desh</p>`,
      };
    }
    case "archive_notice": {
      const reason = String(data.reason ?? "Inactivity");
      return {
        subject: "Your Desh account will be archived",
        text:
          `Hi${userName ? ` ${userName}` : ""},\n\n` +
          `Your account is scheduled for archival.\nReason: ${reason}\n\n` +
          `If you'd like to keep using Desh, sign in within the next 30 days.\n\n— Desh`,
        html:
          `<p>Hi${userName ? ` ${userName}` : ""},</p>` +
          `<p>Your account is scheduled for archival.</p>` +
          `<p>Reason: <em>${escapeHtml(reason)}</em></p>` +
          `<p>If you'd like to keep using Desh, sign in within the next 30 days.</p>` +
          `<p>— Desh</p>`,
      };
    }
    default: {
      // Unknown type with no DB template + no inline branch. Render a
      // minimal generic envelope so the send doesn't fail silently.
      const title = String(data.title ?? "Notification");
      return {
        subject: title,
        text: `Hi${userName ? ` ${userName}` : ""},\n\n${title}\n\n— Desh`,
        html: `<p>Hi${userName ? ` ${userName}` : ""},</p><p>${escapeHtml(title)}</p><p>— Desh</p>`,
      };
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// BYOK lookup: prefer a workspace-scoped Resend API key (encrypted via KMS)
// over the platform env-var key. Returns null if neither is available so the
// notification service can short-circuit with `provider_unconfigured`.
async function resolveResendKey(workspaceId: string | null | undefined): Promise<string | null> {
  if (workspaceId && isCredentialEncryptionConfigured()) {
    try {
      const byok = await getProviderCredential(workspaceId, "resend");
      if (byok) return byok;
    } catch {
      // KMS or DB hiccup — fall through to platform key.
    }
  }
  return env.RESEND_API_KEY ?? null;
}

async function sendViaResend(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  workspaceId: string | null | undefined;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = await resolveResendKey(opts.workspaceId);
  if (!apiKey) {
    return { ok: false, error: "provider_unconfigured" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.NOTIFICATION_FROM_EMAIL,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: `resend_${res.status}_${body.slice(0, 200)}` };
  }
  return { ok: true };
}

async function ensurePreferences(
  userId: string,
): Promise<typeof notificationPreferences.$inferSelect> {
  const db = dbOrThrow();
  const [existing] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(notificationPreferences)
    .values({ userId })
    .onConflictDoUpdate({
      target: notificationPreferences.userId,
      set: { updatedAt: new Date() },
    })
    .returning();
  if (!created) throw new ServiceError(500, "preferences_persist_failed");
  return created;
}

async function isRateLimited(userId: string, type: NotificationType): Promise<boolean> {
  const db = dbOrThrow();
  const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const [recent] = await db
    .select({ id: emailRateLimits.id })
    .from(emailRateLimits)
    .where(
      and(
        eq(emailRateLimits.userId, userId),
        eq(emailRateLimits.emailType, type),
        gte(emailRateLimits.sentAt, cutoff),
      ),
    )
    .orderBy(desc(emailRateLimits.sentAt))
    .limit(1);
  return Boolean(recent);
}

async function logSend(
  workspaceId: string | null | undefined,
  userId: string,
  type: NotificationType,
  recipient: string,
  subject: string,
  status: "sent" | "failed" | "skipped",
  errorMessage?: string,
): Promise<void> {
  const db = dbOrThrow();
  await db.insert(emailSendLog).values({
    workspaceId: workspaceId ?? null,
    userId,
    emailType: type,
    recipientEmail: recipient,
    subject,
    status,
    errorMessage: errorMessage ?? null,
  });
}

export async function sendNotification(
  input: SendNotificationInput,
): Promise<SendNotificationResult> {
  const db = dbOrThrow();

  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  if (!user) throw new ServiceError(404, "user_not_found");
  if (!user.email) {
    await logSend(input.workspaceId, input.userId, input.type, "", "", "skipped", "no_email");
    return { status: "skipped", reason: "no_email" };
  }

  const prefField = PREF_BY_TYPE[input.type] ?? null;
  if (prefField) {
    const prefs = await ensurePreferences(input.userId);
    const enabled = (prefs as Record<string, unknown>)[prefField];
    if (enabled === false) {
      await logSend(input.workspaceId, input.userId, input.type, user.email, "", "skipped", "preference_off");
      return { status: "skipped", reason: "preference_off" };
    }
  }

  if (await isRateLimited(input.userId, input.type)) {
    await logSend(
      input.workspaceId,
      input.userId,
      input.type,
      user.email,
      "",
      "skipped",
      "rate_limited",
    );
    return { status: "skipped", reason: "rate_limited" };
  }

  // Prefer DB-stored template (admin-managed) over inline TS fallback. Lets
  // the admin tweak copy without a redeploy; we keep the inline path so
  // notifications still work in dev/test where the templates table is empty.
  const dbTemplate = await getTemplateBySlug(input.type);
  const rendered = dbTemplate
    ? renderTemplate(
        {
          subjectTemplate: dbTemplate.subjectTemplate,
          bodyHtml: dbTemplate.bodyHtml,
          bodyText: dbTemplate.bodyText,
        },
        { ...input.data, userName: input.data.userName ?? "" },
      )
    : renderInlineTemplate(input.type, input.data);
  const send = await sendViaResend({
    to: user.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    workspaceId: input.workspaceId,
  });

  if (!send.ok) {
    await logSend(
      input.workspaceId,
      input.userId,
      input.type,
      user.email,
      rendered.subject,
      "failed",
      send.error,
    );
    return { status: "failed", reason: send.error };
  }

  await logSend(input.workspaceId, input.userId, input.type, user.email, rendered.subject, "sent");
  await db.insert(emailRateLimits).values({ userId: input.userId, emailType: input.type });
  return { status: "sent" };
}

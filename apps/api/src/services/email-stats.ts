import { desc } from "drizzle-orm";
import { emailSendLog } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { ServiceError } from "./errors.js";

export interface EmailStatsResponse {
  sent_today: number;
  sent_week: number;
  sent_month: number;
  failed_total: number;
  skipped_total: number;
  by_type: { email_type: string; status: string; count: number }[];
  daily_volume: { day: string; total: number; sent: number; failed: number }[];
  recent_logs: Array<{
    id: string;
    workspace_id: string | null;
    user_id: string | null;
    email_type: string;
    recipient_email: string;
    subject: string;
    status: string;
    error_message: string | null;
    created_at: string;
  }>;
}

function dbOrThrow() {
  const db = getDb();
  if (!db) throw new ServiceError(500, "db_unavailable");
  return db;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function getEmailStats(now = new Date()): Promise<EmailStatsResponse> {
  const db = dbOrThrow();
  const rows = await db.select().from(emailSendLog).orderBy(desc(emailSendLog.createdAt));

  const today = startOfDay(now);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 6);
  const monthStart = new Date(today);
  monthStart.setDate(monthStart.getDate() - 29);

  const byType = new Map<string, { email_type: string; status: string; count: number }>();
  const daily = new Map<string, { day: string; total: number; sent: number; failed: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = dayKey(d);
    daily.set(key, { day: key, total: 0, sent: 0, failed: 0 });
  }

  let sentToday = 0;
  let sentWeek = 0;
  let sentMonth = 0;
  let failedTotal = 0;
  let skippedTotal = 0;

  for (const row of rows) {
    const createdAt = row.createdAt;
    const createdMs = createdAt.getTime();
    const status = row.status;

    if (status === "failed") failedTotal++;
    if (status === "skipped") skippedTotal++;
    if (status === "sent") {
      if (createdMs >= today.getTime()) sentToday++;
      if (createdMs >= weekStart.getTime()) sentWeek++;
      if (createdMs >= monthStart.getTime()) sentMonth++;
    }

    const typeKey = `${row.emailType}:${status}`;
    const existing = byType.get(typeKey);
    if (existing) existing.count++;
    else byType.set(typeKey, { email_type: row.emailType, status, count: 1 });

    const key = dayKey(createdAt);
    const bucket = daily.get(key);
    if (bucket) {
      bucket.total++;
      if (status === "sent") bucket.sent++;
      if (status === "failed") bucket.failed++;
    }
  }

  return {
    sent_today: sentToday,
    sent_week: sentWeek,
    sent_month: sentMonth,
    failed_total: failedTotal,
    skipped_total: skippedTotal,
    by_type: Array.from(byType.values()).sort(
      (a, b) => a.email_type.localeCompare(b.email_type) || a.status.localeCompare(b.status),
    ),
    daily_volume: Array.from(daily.values()),
    recent_logs: rows.slice(0, 100).map((row) => ({
      id: row.id,
      workspace_id: row.workspaceId,
      user_id: row.userId,
      email_type: row.emailType,
      recipient_email: row.recipientEmail,
      subject: row.subject,
      status: row.status,
      error_message: row.errorMessage,
      created_at: row.createdAt.toISOString(),
    })),
  };
}

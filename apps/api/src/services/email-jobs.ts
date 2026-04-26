import type { PgBoss, Job } from "pg-boss";
import { register } from "./jobs.js";
import { findDueSnoozes, restoreSnooze } from "./email-snoozes.js";
import { findExpiringWatches, incrementalSync, registerWatch } from "./gmail-sync.js";
import { runAutomationTick } from "./email-automations.js";

// pg-boss job topology for the email feature wave.
//
// Three jobs:
//
//  - gmail.incremental-sync — event-triggered, payload {workspaceId, connectionId}.
//    Fired by /internal/gmail/webhook for each Pub/Sub push.
//  - email.snooze-restore-tick — cron, every minute. Drains rows whose
//    snoozeUntil has elapsed.
//  - gmail.watch-renewal-tick — cron, every 6h. Re-registers any watch
//    expiring within 24h (Gmail caps watch lifetime at 7 days).
//
// boss.schedule() is idempotent on (name, cron) — safe to call on every boot.

export interface IncrementalSyncPayload {
  workspaceId: string;
  connectionId: string;
}

const SNOOZE_TICK = "email.snooze-restore-tick";
const WATCH_TICK = "gmail.watch-renewal-tick";
const SYNC_NAME = "gmail.incremental-sync";
const AUTOMATION_TICK = "email.automation-tick";

const SNOOZE_BATCH = 100;
const WATCH_BATCH = 50;

export async function registerEmailJobs(boss: PgBoss): Promise<void> {
  await register<IncrementalSyncPayload>(SYNC_NAME, async (jobs: Job<IncrementalSyncPayload>[]) => {
    for (const job of jobs) {
      try {
        await incrementalSync(job.data.workspaceId, job.data.connectionId);
      } catch (err) {
        // Log + swallow — we don't want one bad workspace to wedge the queue.
        // pg-boss retries via its own retry policy if we throw; for v1 we just
        // record and move on (next webhook will retry naturally).
        // eslint-disable-next-line no-console
        console.error("[email-jobs] incrementalSync failed", { job: job.id, err });
      }
    }
  });

  await register<Record<string, never>>(SNOOZE_TICK, async () => {
    const due = await findDueSnoozes(SNOOZE_BATCH);
    for (const row of due) {
      try {
        await restoreSnooze(row.workspaceId, row.id);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[email-jobs] restoreSnooze failed", { id: row.id, err });
      }
    }
  });

  await register<Record<string, never>>(WATCH_TICK, async () => {
    const due = await findExpiringWatches(24 * 60 * 60 * 1000, WATCH_BATCH);
    for (const row of due) {
      try {
        await registerWatch(row.workspaceId, row.connectionId, { folder: row.folder });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[email-jobs] registerWatch failed", { ...row, err });
      }
    }
  });

  await register<Record<string, never>>(AUTOMATION_TICK, async () => {
    try {
      await runAutomationTick();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[email-jobs] automation tick failed", err);
    }
  });

  // Cron schedules — idempotent. Pin to UTC for determinism across hosts.
  await boss.schedule(SNOOZE_TICK, "*/1 * * * *", undefined, { tz: "UTC" });
  await boss.schedule(WATCH_TICK, "0 */6 * * *", undefined, { tz: "UTC" });
  // Hourly tick is fine — most automations land daily/weekly; the in-process
  // logic gates on time-since-last-run before sending so over-ticking is safe.
  await boss.schedule(AUTOMATION_TICK, "0 * * * *", undefined, { tz: "UTC" });
}

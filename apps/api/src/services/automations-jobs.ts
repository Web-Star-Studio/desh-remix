import type { PgBoss } from "pg-boss";
import { register } from "./jobs.js";
import { runScheduledTick } from "./automations.js";

// pg-boss topology for Wave B automations.
//
// Single cron tick — `automation.cron-tick` — fires once per minute and
// drains the two cron-driven trigger types: `scheduled` and `task_overdue`.
// (Realtime triggers like `task_created` or `finance_transaction` are
// emitted directly from their service helpers and don't need a job.)
//
// We pin to UTC so the same rule fires consistently regardless of host TZ;
// the SPA stores rule times as UTC and the cron-tick comparison is UTC.

const TICK_NAME = "automation.cron-tick";

export async function registerAutomationsJobs(boss: PgBoss): Promise<void> {
  await register<Record<string, never>>(TICK_NAME, async () => {
    try {
      const result = await runScheduledTick();
      if (result.scheduledFired > 0 || result.taskOverdueFired > 0) {
        console.log("[automations-jobs] tick fired", result);
      }
    } catch (err) {
      console.error("[automations-jobs] tick failed", err);
    }
  });

  await boss.schedule(TICK_NAME, "*/1 * * * *", undefined, { tz: "UTC" });
}

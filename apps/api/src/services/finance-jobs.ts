import type { PgBoss, Job } from "pg-boss";
import { register } from "./jobs.js";
import { runPluggySync } from "./finance-sync.js";

// pg-boss job topology for the Finance Wave B feature.
//
// One job today:
//
//  - finance.pluggy-sync — event-triggered, payload {workspaceId, connectionId,
//    fromDate?, triggeredByUserId?}. Fired by:
//      • POST /workspaces/:id/finance/connections/:cid/sync (manual)
//      • POST /finance/pluggy-webhook on `item/updated` events
//
// We keep the handler thin: every sync writes its own audit row inside
// `runPluggySync`, so the job-level error handler just needs to log and let
// the connection's status reflect the failure on the next poll.

export interface PluggySyncPayload {
  workspaceId: string;
  connectionId: string;
  fromDate?: string;
  triggeredByUserId?: string | null;
}

export const FINANCE_PLUGGY_SYNC = "finance.pluggy-sync";

export async function registerFinanceJobs(_boss: PgBoss): Promise<void> {
  await register<PluggySyncPayload>(FINANCE_PLUGGY_SYNC, async (jobs: Job<PluggySyncPayload>[]) => {
    for (const job of jobs) {
      try {
        await runPluggySync(job.data.workspaceId, job.data.connectionId, {
          fromDate: job.data.fromDate,
          triggeredByUserId: job.data.triggeredByUserId ?? null,
        });
      } catch (err) {
        // runPluggySync writes the audit row itself, so a thrown error here is
        // the unexpected case (DB outage, validation failure). Log + swallow so
        // one wedge doesn't stall the queue.
        console.error("[finance-jobs] pluggy-sync failed", { job: job.id, err });
      }
    }
  });
}

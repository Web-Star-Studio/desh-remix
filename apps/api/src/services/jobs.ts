import { PgBoss } from "pg-boss";
import type { Job, SendOptions } from "pg-boss";
import { env } from "../config/env.js";

// pg-boss is the shared background job runner across waves. It manages its
// own schema (`pgboss`) on the same DATABASE_URL, so no extra infrastructure
// is needed. First consumer is Wave 3 (Gmail watch renewal); Wave 4 uses it
// for WhatsApp session reaping; Wave 6 for Stripe webhook retries.

let boss: PgBoss | null = null;
let starting: Promise<PgBoss | null> | null = null;

export async function startJobs(): Promise<PgBoss | null> {
  if (boss) return boss;
  if (starting) return starting;
  if (!env.DATABASE_URL) return null;

  starting = (async () => {
    const instance = new PgBoss(env.DATABASE_URL!);
    instance.on("error", (err: unknown) => {
      // eslint-disable-next-line no-console
      console.error("[jobs] pg-boss error", err);
    });
    await instance.start();
    boss = instance;
    return instance;
  })();

  try {
    return await starting;
  } finally {
    starting = null;
  }
}

export async function stopJobs(): Promise<void> {
  if (!boss) return;
  await boss.stop({ graceful: true });
  boss = null;
}

export function getJobs(): PgBoss | null {
  return boss;
}

export async function enqueue<T extends object>(
  name: string,
  data: T,
  opts?: SendOptions,
): Promise<string | null> {
  const b = boss;
  if (!b) throw new Error("Job runner not started");
  return b.send(name, data, opts ?? {});
}

export async function register<T extends object>(
  name: string,
  handler: (jobs: Job<T>[]) => Promise<void>,
): Promise<void> {
  const b = boss;
  if (!b) throw new Error("Job runner not started");
  await b.createQueue(name);
  await b.work<T>(name, handler);
}

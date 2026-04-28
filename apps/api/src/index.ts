import { buildServer } from "./server.js";
import { env } from "./config/env.js";
import { init as initHermes, shutdown as shutdownHermes } from "./services/hermes/process-supervisor.js";
import { startJobs, stopJobs } from "./services/jobs.js";
import { registerEmailJobs } from "./services/email-jobs.js";
import { registerFinanceJobs } from "./services/finance-jobs.js";

const app = await buildServer();

await initHermes();

try {
  const jobs = await startJobs();
  if (jobs) {
    app.log.info("[jobs] pg-boss started");
    try {
      await registerEmailJobs(jobs);
      app.log.info("[jobs] email handlers + schedules registered");
    } catch (err) {
      app.log.error(err, "[jobs] failed to register email handlers");
    }
    try {
      await registerFinanceJobs(jobs);
      app.log.info("[jobs] finance handlers registered");
    } catch (err) {
      app.log.error(err, "[jobs] failed to register finance handlers");
    }
  } else {
    app.log.warn("[jobs] DATABASE_URL not set — job runner disabled");
  }
} catch (err) {
  app.log.error(err, "[jobs] failed to start pg-boss");
}

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, "shutting down");
  try {
    await stopJobs();
  } catch (err) {
    app.log.error(err, "error stopping job runner");
  }
  try {
    await shutdownHermes();
  } catch (err) {
    app.log.error(err, "error shutting down hermes supervisor");
  }
  try {
    await app.close();
  } finally {
    process.exit(0);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

/**
 * Dev reset — wipes all user data so the app behaves like a fresh install.
 *
 * What it deletes:
 *   - agent_events, conversations, composio_connections (no cascade from users)
 *   - workspaces (cascades to: workspace_members, agent_profiles,
 *     workspace_credentials, tasks, contacts)
 *   - users
 *   - contents of ~/.hermes/profiles/ (the dir itself is preserved; only its
 *     children are removed, since hermes expects the dir to exist)
 *
 * What it does NOT touch:
 *   - Cognito users (use AWS console or `aws cognito-idp admin-delete-user`)
 *   - pg-boss queue tables (independent of app data)
 *   - Schema migrations / drizzle metadata
 *   - Composio remote state (connections live on Composio's side; the local
 *     row is gone but the user's Google/Slack/etc grants persist until they
 *     revoke them in the provider's account settings)
 *
 * Usage:
 *   pnpm --filter @desh/api dev:reset           # interactive: prints counts then prompts "wipe"
 *   pnpm --filter @desh/api dev:reset --yes     # skip prompt
 *   pnpm --filter @desh/api dev:reset --keep-hermes   # leave ~/.hermes alone
 */

import { readdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[dev-reset] DATABASE_URL is required (set it in apps/api/.env)");
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const skipPrompt = args.has("--yes") || args.has("-y");
const keepHermes = args.has("--keep-hermes");

async function confirm(): Promise<boolean> {
  if (skipPrompt) return true;
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const answer = await rl.question('Type "wipe" to continue, anything else to abort: ');
  rl.close();
  return answer.trim().toLowerCase() === "wipe";
}

async function main() {
  const sql = postgres(DATABASE_URL!, { max: 1 });

  try {
    const [counts] = await sql<
      Array<{
        users: string;
        workspaces: string;
        conversations: string;
        events: string;
        connections: string;
      }>
    >`
      SELECT
        (SELECT count(*) FROM users) AS users,
        (SELECT count(*) FROM workspaces) AS workspaces,
        (SELECT count(*) FROM conversations) AS conversations,
        (SELECT count(*) FROM agent_events) AS events,
        (SELECT count(*) FROM composio_connections) AS connections
    `;

    console.log("[dev-reset] About to delete:");
    console.log(`  users:                ${counts.users}`);
    console.log(`  workspaces:           ${counts.workspaces}`);
    console.log(`  conversations:        ${counts.conversations}`);
    console.log(`  agent_events:         ${counts.events}`);
    console.log(`  composio_connections: ${counts.connections}`);
    if (!keepHermes) {
      console.log(`  contents of ${path.join(homedir(), ".hermes", "profiles")}/ (dir kept, children removed)`);
    }

    const totalRows =
      Number(counts.users) +
      Number(counts.workspaces) +
      Number(counts.conversations) +
      Number(counts.events) +
      Number(counts.connections);
    if (totalRows === 0 && keepHermes) {
      console.log("[dev-reset] nothing to delete, exiting");
      return;
    }

    if (!(await confirm())) {
      console.log("[dev-reset] aborted");
      return;
    }

    await sql.begin(async (tx) => {
      await tx`DELETE FROM agent_events`;
      await tx`DELETE FROM conversations`;
      await tx`DELETE FROM composio_connections`;
      await tx`DELETE FROM workspaces`;
      await tx`DELETE FROM users`;
    });

    console.log("[dev-reset] DB wiped");

    if (!keepHermes) {
      const profilesDir = path.join(homedir(), ".hermes", "profiles");
      let entries: string[] = [];
      try {
        entries = await readdir(profilesDir);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }
      await Promise.all(
        entries.map((name) =>
          rm(path.join(profilesDir, name), { recursive: true, force: true }),
        ),
      );
      console.log(`[dev-reset] cleared ${entries.length} profile(s) inside ${profilesDir}`);
    }

    console.log(
      "[dev-reset] done. Next sign-in via Cognito will create a fresh users row and run the onboarding wizard.",
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("[dev-reset] failed:", err);
  process.exit(1);
});

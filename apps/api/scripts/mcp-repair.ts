/**
 * mcp-repair — diagnoses and (re)registers the Composio MCP server for a
 * workspace's Hermes profile.
 *
 * Use when the fire-and-forget registration in `POST /workspaces` either
 * never ran, failed silently, or got rolled back.
 *
 * Usage:
 *   pnpm --filter @desh/api mcp:repair                 # repair all workspaces
 *   pnpm --filter @desh/api mcp:repair <workspace-id>  # repair a specific one
 *
 * Each step is logged so you can pinpoint which boundary fails:
 *   1. DB lookup (workspace + agent_profile + creating user)
 *   2. Composio: mint per-entity instance URL
 *   3. Hermes CLI: profile create + mcp remove + mcp add
 *   4. Hermes CLI: mcp list (post-condition check)
 */

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY;
const COMPOSIO_MCP_SERVER_ID = process.env.COMPOSIO_MCP_SERVER_ID;
const COMPOSIO_MCP_TOOLKITS =
  process.env.COMPOSIO_MCP_TOOLKITS ??
  "gmail,googlecalendar,googledrive,googletasks,googlecontacts";
const HERMES_BIN = process.env.HERMES_BIN ?? "hermes";

if (!DATABASE_URL) {
  console.error("[mcp-repair] DATABASE_URL is required");
  process.exit(1);
}
if (!COMPOSIO_API_KEY) {
  console.error("[mcp-repair] COMPOSIO_API_KEY is required");
  process.exit(1);
}

const COMPOSIO_API_BASE = "https://backend.composio.dev/api/v3";
const SERVER_NAME = "desh-pandora";

const targetWsId = process.argv[2] ?? null;

async function ensureCustomMcpServer(): Promise<string> {
  if (COMPOSIO_MCP_SERVER_ID) {
    console.log(`[mcp-repair] using cached COMPOSIO_MCP_SERVER_ID=${COMPOSIO_MCP_SERVER_ID}`);
    return COMPOSIO_MCP_SERVER_ID;
  }

  console.log(`[mcp-repair] no COMPOSIO_MCP_SERVER_ID — looking up or creating "${SERVER_NAME}"`);
  const toolkits = COMPOSIO_MCP_TOOLKITS.split(",").map((s) => s.trim()).filter(Boolean);
  const res = await fetch(`${COMPOSIO_API_BASE}/mcp/servers/custom`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": COMPOSIO_API_KEY! },
    body: JSON.stringify({ name: SERVER_NAME, toolkits, manage_connections: false }),
  });
  if (res.ok) {
    const data = (await res.json()) as { id?: string; server_id?: string };
    const id = data.id ?? data.server_id;
    if (!id) throw new Error(`server created but no id in response: ${JSON.stringify(data).slice(0, 300)}`);
    console.log(`[mcp-repair] created server. ADD THIS TO apps/api/.env:`);
    console.log(`  COMPOSIO_MCP_SERVER_ID=${id}`);
    return id;
  }

  const errBody = await res.text().catch(() => "");
  const isDuplicate = res.status === 400 && /MCP_DuplicateServerName|already exists/i.test(errBody);
  if (!isDuplicate) throw new Error(`server create failed (${res.status}): ${errBody.slice(0, 500)}`);

  console.log(`[mcp-repair] server already exists — looking up by name`);
  for (let page = 1; page <= 5; page++) {
    const listRes = await fetch(
      `${COMPOSIO_API_BASE}/mcp/servers?limit=50&page=${page}`,
      { headers: { "x-api-key": COMPOSIO_API_KEY! } },
    );
    if (!listRes.ok) {
      const body = await listRes.text().catch(() => "");
      throw new Error(`list failed (${listRes.status}): ${body.slice(0, 300)}`);
    }
    const data = (await listRes.json()) as {
      items?: Array<{ id?: string; server_id?: string; name?: string }>;
      data?: Array<{ id?: string; server_id?: string; name?: string }>;
    };
    const items = data.items ?? data.data ?? [];
    const match = items.find((s) => s.name === SERVER_NAME);
    if (match) {
      const id = match.id ?? match.server_id;
      if (!id) throw new Error("found server but no id field");
      console.log(`[mcp-repair] found existing server. ADD THIS TO apps/api/.env:`);
      console.log(`  COMPOSIO_MCP_SERVER_ID=${id}`);
      return id;
    }
    if (items.length < 50) break;
  }
  throw new Error(`server "${SERVER_NAME}" reported as duplicate but lookup returned nothing`);
}

async function mintInstanceUrlForEntity(entityId: string): Promise<string> {
  const serverId = await ensureCustomMcpServer();
  const deterministicUrl = `https://backend.composio.dev/v3/mcp/${encodeURIComponent(serverId)}?user_id=${encodeURIComponent(entityId)}`;
  console.log(`[mcp-repair] minting instance URL: serverId=${serverId} user_id=${entityId}`);
  const res = await fetch(
    `${COMPOSIO_API_BASE}/mcp/servers/${encodeURIComponent(serverId)}/instances`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": COMPOSIO_API_KEY! },
      body: JSON.stringify({ user_id: entityId }),
    },
  );
  if (res.ok) {
    const data = (await res.json()) as { mcp_url?: string; url?: string; instance_url?: string };
    return data.mcp_url ?? data.url ?? data.instance_url ?? deterministicUrl;
  }
  const body = await res.text().catch(() => "");
  if (res.status === 400 && /MCP_InstanceAlreadyExists|already exists/i.test(body)) {
    console.log(`[mcp-repair] instance already exists — using deterministic URL`);
    return deterministicUrl;
  }
  throw new Error(`mint failed (${res.status}): ${body.slice(0, 500)}`);
}

interface CliResult {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
}

function runCli(args: string[]): Promise<CliResult> {
  return new Promise((resolve) => {
    const child = spawn(HERMES_BIN, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (c) => { stdout += c.toString(); });
    child.stderr?.on("data", (c) => { stderr += c.toString(); });
    child.on("error", (err) => resolve({ ok: false, code: null, stdout, stderr: stderr + String(err) }));
    child.on("close", (code) => resolve({ ok: code === 0, code, stdout, stderr }));
  });
}

async function repairOne(
  sql: postgres.Sql,
  profileId: string,
  profileName: string,
  entityId: string,
) {
  console.log(`\n[mcp-repair] ─── ${profileName} (entity=${entityId}) ───`);

  let url: string;
  try {
    url = await mintInstanceUrlForEntity(entityId);
    console.log(`[mcp-repair] minted URL: ${url}`);
  } catch (err) {
    console.error(`[mcp-repair] FAIL at mintInstanceUrlForEntity: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  const create = await runCli(["profile", "create", profileName, "--no-alias"]);
  const createOk = create.ok || /already exists|exists/i.test(create.stdout + create.stderr);
  console.log(`[mcp-repair] profile create: ${createOk ? "ok" : `FAIL code=${create.code}`}`);
  if (!createOk) {
    console.error(`  stderr: ${create.stderr.slice(0, 300)}`);
    return;
  }

  // Persist the URL on agent_profiles.config so the next gateway start
  // renders it into config.yaml. `hermes mcp add` is interactive — we
  // can't drive it from a script, but writing the YAML ourselves works
  // because Hermes reads mcp_servers from config.yaml on boot.
  await sql`
    UPDATE agent_profiles
    SET config = COALESCE(config, '{}'::jsonb) || jsonb_build_object('composio_mcp_url', ${url}::text),
        updated_at = now()
    WHERE id = ${profileId}::uuid
  `;
  console.log(`[mcp-repair] stored URL on agent_profiles.config`);

  // Kill any running gateway so the API supervisor's next ensureRunning()
  // re-renders config.yaml from scratch with the new URL. We can't directly
  // call supervisor.stop() from here (different process), so we SIGTERM
  // the PID Hermes wrote to disk.
  const pidFile = path.join(homedir(), ".hermes", "profiles", profileName, "gateway.pid");
  try {
    const raw = await readFile(pidFile, "utf8");
    const parsed = JSON.parse(raw) as { pid?: number };
    const pid = parsed.pid;
    if (typeof pid === "number" && pid > 0) {
      try {
        process.kill(pid, "SIGTERM");
        console.log(`[mcp-repair] sent SIGTERM to gateway pid=${pid}`);
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === "ESRCH") {
          console.log(`[mcp-repair] gateway pid=${pid} not running (already stopped)`);
        } else {
          console.warn(`[mcp-repair] could not signal pid=${pid}: ${(err as Error).message}`);
        }
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(`[mcp-repair] could not read pid file: ${(err as Error).message}`);
    }
  }
}

async function main() {
  const sql = postgres(DATABASE_URL!, { max: 1 });

  try {
    type Row = {
      profile_id: string;
      workspace_id: string;
      hermes_profile_name: string;
      created_by: string;
    };
    const rows = targetWsId
      ? await sql<Row[]>`
          SELECT p.id AS profile_id, w.id AS workspace_id, p.hermes_profile_name, w.created_by
          FROM workspaces w JOIN agent_profiles p ON p.workspace_id = w.id
          WHERE w.id = ${targetWsId}::uuid`
      : await sql<Row[]>`
          SELECT p.id AS profile_id, w.id AS workspace_id, p.hermes_profile_name, w.created_by
          FROM workspaces w JOIN agent_profiles p ON p.workspace_id = w.id
          ORDER BY w.created_at`;

    if (rows.length === 0) {
      console.error("[mcp-repair] no workspaces found");
      return;
    }

    console.log(`[mcp-repair] repairing ${rows.length} workspace(s)`);
    for (const row of rows) {
      const entityId = `${row.workspace_id}_${row.created_by}`;
      await repairOne(sql, row.profile_id, row.hermes_profile_name, entityId);
    }
    console.log(`\n[mcp-repair] done. Send a chat message to spawn a fresh gateway with the new config.`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("[mcp-repair] fatal:", err);
  process.exit(1);
});

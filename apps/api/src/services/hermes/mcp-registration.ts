import { spawn } from "node:child_process";
import { env } from "../../config/env.js";

/**
 * Registers a Composio MCP server with a Hermes profile so the agent inside
 * that profile gets access to the workspace's connected toolkits as MCP tools.
 *
 * Flow (idempotent):
 *   1. `hermes profile create <profileName>` — creates the profile dir + state
 *      DB if absent. No-op if already exists.
 *   2. `hermes -p <profileName> mcp remove composio` — clears any stale entry.
 *   3. `hermes -p <profileName> mcp add composio --url <mcpUrl>` — registers.
 *
 * The supervisor's `actuallyStart()` runs `renderProfileConfig` which writes
 * config.yaml/SOUL.md to the profile dir. Both `profile create` (this helper)
 * and `renderProfileConfig` (supervisor) target the same dir, so order of
 * operations doesn't matter — they each handle "already exists" gracefully.
 */

interface RunResult {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
}

function runHermesCli(args: string[], opts: { cwd?: string } = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(env.HERMES_BIN, args, {
      cwd: opts.cwd,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      resolve({ ok: false, code: null, stdout, stderr: stderr + String(err) });
    });
    child.on("close", (code) => {
      resolve({ ok: code === 0, code, stdout, stderr });
    });
  });
}

export async function ensureHermesProfileExists(profileName: string): Promise<void> {
  // `profile create` errors if the profile already exists — that's fine, we
  // treat it as success. Detect via stderr substring or just ignore non-zero.
  const res = await runHermesCli(["profile", "create", profileName, "--no-alias"]);
  if (res.ok) return;
  const out = (res.stdout + res.stderr).toLowerCase();
  if (out.includes("already exists") || out.includes("exists")) return;
  // Anything else is unexpected — log but don't throw, the gateway start will
  // fail more loudly if the profile really isn't there.
  // eslint-disable-next-line no-console
  console.warn(
    `[mcp-registration] profile create '${profileName}' returned code=${res.code}: ${res.stderr.trim().slice(0, 300)}`,
  );
}

/**
 * Idempotently registers (or replaces) the `composio` MCP server entry in
 * the given Hermes profile, pointing at the per-entity URL.
 *
 * Returns `true` on success, `false` if any step failed (logged, non-fatal).
 */
export async function registerComposioMcp(
  profileName: string,
  mcpUrl: string,
): Promise<boolean> {
  await ensureHermesProfileExists(profileName);

  // Remove any existing registration first; ignore non-zero exit (it's normal
  // if the entry doesn't exist yet).
  await runHermesCli(["-p", profileName, "mcp", "remove", "composio"]);

  const add = await runHermesCli([
    "-p",
    profileName,
    "mcp",
    "add",
    "composio",
    "--url",
    mcpUrl,
  ]);

  if (!add.ok) {
    // eslint-disable-next-line no-console
    console.warn(
      `[mcp-registration] mcp add composio failed for ${profileName} (code=${add.code}): ${add.stderr.trim().slice(0, 400)}`,
    );
    return false;
  }
  return true;
}

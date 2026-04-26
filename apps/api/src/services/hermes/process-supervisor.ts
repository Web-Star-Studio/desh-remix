import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { eq } from "drizzle-orm";
import { agentProfiles, workspaces } from "@desh/database/schema";
import { getDb } from "../../db/client.js";
import { env } from "../../config/env.js";
import { renderProfileConfig } from "./profile-config.js";

export type StopReason = "shutdown" | "idle_timeout" | "workspace_deleted" | "manual";

interface RunningGateway {
  child: ChildProcess;
  port: number;
  startedAt: number;
  lastActivityAt: number;
}

const running = new Map<string, RunningGateway>();
let sweeperHandle: NodeJS.Timeout | null = null;
const inflightStarts = new Map<string, Promise<void>>();

interface ProfileRow {
  id: string;
  workspaceId: string;
  hermesProfileName: string;
  hermesPort: number | null;
  adapterSecret: string | null;
  callbackSecret: string | null;
  modelId: string;
  systemPrompt: string | null;
  config: Record<string, unknown> | null;
}

async function loadProfile(profileId: string): Promise<ProfileRow & { workspaceName: string }> {
  const db = getDb();
  if (!db) throw new Error("supervisor: DATABASE_URL not configured");
  const rows = await db
    .select({
      id: agentProfiles.id,
      workspaceId: agentProfiles.workspaceId,
      hermesProfileName: agentProfiles.hermesProfileName,
      hermesPort: agentProfiles.hermesPort,
      adapterSecret: agentProfiles.adapterSecret,
      callbackSecret: agentProfiles.callbackSecret,
      modelId: agentProfiles.modelId,
      systemPrompt: agentProfiles.systemPrompt,
      config: agentProfiles.config,
      workspaceName: workspaces.name,
    })
    .from(agentProfiles)
    .innerJoin(workspaces, eq(workspaces.id, agentProfiles.workspaceId))
    .where(eq(agentProfiles.id, profileId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error(`supervisor: agent_profile ${profileId} not found`);
  return row as ProfileRow & { workspaceName: string };
}

async function setStatus(profileId: string, status: string, lastStartedAt?: Date): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db
    .update(agentProfiles)
    .set({
      status,
      ...(lastStartedAt ? { lastStartedAt } : {}),
      updatedAt: new Date(),
    })
    .where(eq(agentProfiles.id, profileId));
}

async function probeHealth(port: number, secret: string, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (res.ok) return true;
    } catch {
      // Not yet listening; retry.
    }
    await delay(250);
  }
  return false;
}

async function actuallyStart(profileId: string): Promise<void> {
  const profile = await loadProfile(profileId);
  if (!profile.hermesPort || !profile.adapterSecret || !profile.callbackSecret) {
    throw new Error(`supervisor: profile ${profileId} missing port/secrets — provision first`);
  }

  const composioMcpUrl =
    typeof profile.config?.composio_mcp_url === "string"
      ? (profile.config.composio_mcp_url as string)
      : null;

  const config = await renderProfileConfig({
    hermesProfileName: profile.hermesProfileName,
    workspaceId: profile.workspaceId,
    workspaceName: profile.workspaceName,
    hermesPort: profile.hermesPort,
    adapterSecret: profile.adapterSecret,
    callbackSecret: profile.callbackSecret,
    modelId: profile.modelId,
    systemPrompt: profile.systemPrompt,
    composioMcpUrl,
  });

  await setStatus(profileId, "starting");

  const child = spawn(env.HERMES_BIN, ["-p", profile.hermesProfileName, "gateway"], {
    cwd: config.hermesHome,
    env: { ...process.env, HERMES_HOME: config.hermesHome },
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  const log = (level: "info" | "error", msg: string) => {
    const line = `[hermes-supervisor] ${msg}`;
    if (level === "error") console.error(line);
    else console.log(line);
  };

  child.stdout?.on("data", (chunk) => {
    log("info", `[ws=${profile.workspaceId}] ${chunk.toString().trimEnd()}`);
  });
  child.stderr?.on("data", (chunk) => {
    log("error", `[ws=${profile.workspaceId}] ${chunk.toString().trimEnd()}`);
  });
  child.on("exit", (code, signal) => {
    log("info", `[ws=${profile.workspaceId}] exited code=${code} signal=${signal}`);
    running.delete(profileId);
    void setStatus(profileId, code === 0 ? "stopped" : "error");
  });

  log("info", `starting profile ${profileId} on port ${profile.hermesPort} pid=${child.pid}`);

  const healthy = await probeHealth(profile.hermesPort, profile.adapterSecret, env.HERMES_HEALTH_TIMEOUT_MS);
  if (!healthy) {
    log("error", `gateway ${profileId} did not pass /health within ${env.HERMES_HEALTH_TIMEOUT_MS}ms`);
    try {
      child.kill("SIGTERM");
    } catch {
      /* noop */
    }
    await setStatus(profileId, "error");
    throw new Error("hermes gateway failed health check");
  }

  const now = Date.now();
  running.set(profileId, {
    child,
    port: profile.hermesPort,
    startedAt: now,
    lastActivityAt: now,
  });
  await setStatus(profileId, "running", new Date(now));
  log("info", `gateway ${profileId} healthy after ${Date.now() - now}ms`);
}

// Idempotent. Lazy-start entry point — call before routing a message to a workspace.
export async function ensureRunning(profileId: string): Promise<void> {
  const existing = running.get(profileId);
  if (existing) {
    existing.lastActivityAt = Date.now();
    return;
  }
  // Coalesce concurrent starts so two messages arriving together don't race.
  const inflight = inflightStarts.get(profileId);
  if (inflight) return inflight;

  const promise = actuallyStart(profileId).finally(() => {
    inflightStarts.delete(profileId);
  });
  inflightStarts.set(profileId, promise);
  return promise;
}

// Refresh activity without doing the start dance. Use from callback paths
// where we know the gateway is already running.
export function markActive(profileId: string): void {
  const gw = running.get(profileId);
  if (gw) gw.lastActivityAt = Date.now();
}

export async function stop(profileId: string, reason: StopReason): Promise<void> {
  const gw = running.get(profileId);
  if (!gw) return;
  console.log(`[hermes-supervisor] stopping profile ${profileId} reason=${reason}`);
  running.delete(profileId);
  try {
    gw.child.kill("SIGTERM");
  } catch {
    /* noop */
  }
  // Give it 5s to exit gracefully, then SIGKILL.
  const deadline = Date.now() + 5000;
  while (gw.child.exitCode === null && Date.now() < deadline) {
    await delay(100);
  }
  if (gw.child.exitCode === null) {
    try {
      gw.child.kill("SIGKILL");
    } catch {
      /* noop */
    }
  }
  await setStatus(profileId, "stopped");
}

export function isRunning(profileId: string): boolean {
  return running.has(profileId);
}

export function getRunningPort(profileId: string): number | null {
  return running.get(profileId)?.port ?? null;
}

function idleSweep(): void {
  const now = Date.now();
  for (const [profileId, gw] of running) {
    if (now - gw.lastActivityAt > env.HERMES_IDLE_TIMEOUT_MS) {
      void stop(profileId, "idle_timeout");
    }
  }
}

let initialized = false;

// Called from server bootstrap. Resets stale 'running' rows from a previous
// run (the actual processes are gone; orphans documented as a known gap)
// and starts the idle sweeper.
export async function init(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const db = getDb();
  if (db) {
    await db
      .update(agentProfiles)
      .set({ status: "stopped", updatedAt: new Date() })
      .where(eq(agentProfiles.status, "running"));
    await db
      .update(agentProfiles)
      .set({ status: "stopped", updatedAt: new Date() })
      .where(eq(agentProfiles.status, "starting"));
  }

  sweeperHandle = setInterval(idleSweep, env.HERMES_IDLE_SWEEP_MS);
  console.log(`[hermes-supervisor] init complete (idle timeout=${env.HERMES_IDLE_TIMEOUT_MS}ms)`);
}

export async function shutdown(): Promise<void> {
  if (sweeperHandle) {
    clearInterval(sweeperHandle);
    sweeperHandle = null;
  }
  const ids = Array.from(running.keys());
  await Promise.all(ids.map((id) => stop(id, "shutdown")));
  initialized = false;
}

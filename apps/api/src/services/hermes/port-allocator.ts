import net from "node:net";
import { isNotNull } from "drizzle-orm";
import { agentProfiles } from "@desh/database/schema";
import { getDb } from "../../db/client.js";
import { env } from "../../config/env.js";

async function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

// Picks a free port in [HERMES_PORT_RANGE_START, HERMES_PORT_RANGE_END] that
// is not already assigned to another agent_profile and is not currently bound
// on 127.0.0.1. Falls back to OS-assigned (bind to :0) if the pool is exhausted.
export async function allocatePort(): Promise<number> {
  const db = getDb();
  if (!db) throw new Error("port-allocator: DATABASE_URL not configured");

  const taken = new Set<number>();
  const rows = await db
    .select({ port: agentProfiles.hermesPort })
    .from(agentProfiles)
    .where(isNotNull(agentProfiles.hermesPort));
  for (const r of rows) {
    if (r.port != null) taken.add(r.port);
  }

  for (let port = env.HERMES_PORT_RANGE_START; port <= env.HERMES_PORT_RANGE_END; port++) {
    if (taken.has(port)) continue;
    if (await isPortFree(port)) return port;
  }

  // Pool exhausted — let the OS pick.
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      server.close(() => {
        if (typeof addr === "object" && addr && "port" in addr) {
          resolve(addr.port);
        } else {
          reject(new Error("port-allocator: failed to obtain OS-assigned port"));
        }
      });
    });
  });
}

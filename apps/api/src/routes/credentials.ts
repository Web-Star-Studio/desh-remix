import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { workspaceCredentials, workspaceMembers } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { requireUserDbId } from "../services/users.js";
import {
  encryptCredential,
  isCredentialEncryptionConfigured,
} from "../services/credentials.js";

const PROVIDER_RE = /^[a-z][a-z0-9_-]{0,63}$/;

const ProviderParams = z.object({
  workspaceId: z.string().uuid(),
  provider: z.string().regex(PROVIDER_RE),
});
const WorkspaceParams = z.object({ workspaceId: z.string().uuid() });

const PutBody = z.object({
  value: z.string().min(1).max(8192),
  meta: z.record(z.unknown()).optional(),
});

async function requireOwner(workspaceId: string, userDbId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const [row] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userDbId),
      ),
    )
    .limit(1);
  return row?.role === "owner";
}

export default async function credentialsRoutes(app: FastifyInstance) {
  // List provider credentials for a workspace. Never returns ciphertext —
  // only the provider name, meta (caller-supplied), and timestamps. The
  // intent is "what does this workspace have configured", not "give me the
  // tokens." Decryption is server-internal via getProviderCredential().
  app.get("/workspaces/:workspaceId/credentials", async (req, reply) => {
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });

    const dbId = await requireUserDbId(req);
    if (!(await requireOwner(params.data.workspaceId, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }

    const db = getDb();
    if (!db) return reply.code(503).send({ error: "db_unavailable" });

    const rows = await db
      .select({
        provider: workspaceCredentials.provider,
        meta: workspaceCredentials.meta,
        createdAt: workspaceCredentials.createdAt,
        updatedAt: workspaceCredentials.updatedAt,
      })
      .from(workspaceCredentials)
      .where(eq(workspaceCredentials.workspaceId, params.data.workspaceId))
      .orderBy(desc(workspaceCredentials.updatedAt));
    return rows.map((r) => ({
      provider: r.provider,
      meta: r.meta,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  });

  app.put("/workspaces/:workspaceId/credentials/:provider", async (req, reply) => {
    if (!isCredentialEncryptionConfigured()) {
      return reply.code(503).send({ error: "credentials_not_configured" });
    }
    const params = ProviderParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const body = PutBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });

    const dbId = await requireUserDbId(req);
    if (!(await requireOwner(params.data.workspaceId, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }

    const db = getDb();
    if (!db) return reply.code(503).send({ error: "db_unavailable" });

    const ciphertext = await encryptCredential(body.data.value, {
      workspaceId: params.data.workspaceId,
    });

    const now = new Date();
    const meta = body.data.meta ?? {};
    const [row] = await db
      .insert(workspaceCredentials)
      .values({
        workspaceId: params.data.workspaceId,
        provider: params.data.provider,
        ciphertext,
        meta,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [workspaceCredentials.workspaceId, workspaceCredentials.provider],
        set: { ciphertext, meta, updatedAt: now },
      })
      .returning({
        provider: workspaceCredentials.provider,
        meta: workspaceCredentials.meta,
        createdAt: workspaceCredentials.createdAt,
        updatedAt: workspaceCredentials.updatedAt,
      });

    return {
      provider: row!.provider,
      meta: row!.meta,
      createdAt: row!.createdAt.toISOString(),
      updatedAt: row!.updatedAt.toISOString(),
    };
  });

  app.delete("/workspaces/:workspaceId/credentials/:provider", async (req, reply) => {
    const params = ProviderParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });

    const dbId = await requireUserDbId(req);
    if (!(await requireOwner(params.data.workspaceId, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }

    const db = getDb();
    if (!db) return reply.code(503).send({ error: "db_unavailable" });

    await db
      .delete(workspaceCredentials)
      .where(
        and(
          eq(workspaceCredentials.workspaceId, params.data.workspaceId),
          eq(workspaceCredentials.provider, params.data.provider),
        ),
      );
    return reply.code(204).send();
  });
}

import type { FastifyInstance, FastifyRequest } from "fastify";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  socialAccounts,
  socialProfiles,
  whatsappSendLogs,
  workspaceMembers,
  workspaces,
} from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { requireUserDbId } from "../services/users.js";
import { env } from "../config/env.js";
import {
  ZernioApiError,
  connect,
  createProfile as zernioCreateProfile,
  disconnectAccount,
  updateProfile as zernioUpdateProfile,
  isZernioConfigured,
  listAccounts as zernioListAccounts,
  posts,
  probeHealth as zernioProbeHealth,
  sendWhatsAppTemplate as zernioSendTemplate,
  sendWhatsAppText as zernioSendText,
  whatsappBroadcasts,
  whatsappBusinessProfile,
  whatsappConnect,
  whatsappContacts,
  whatsappPhoneNumbers,
  whatsappTemplates,
} from "../services/zernio.js";
import { buildZernioProfileMeta } from "../services/zernio-profile-naming.js";

const WorkspaceParams = z.object({ id: z.string().uuid() });
const BroadcastParams = z.object({
  id: z.string().uuid(),
  broadcastId: z.string().min(1).max(120),
});

async function requireMembership(workspaceId: string, userDbId: string): Promise<{ role: string } | null> {
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userDbId)))
    .limit(1);
  return rows[0] ?? null;
}

async function loadWorkspace(workspaceId: string) {
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .select({ id: workspaces.id, name: workspaces.name, zernioProfileId: workspaces.zernioProfileId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Returns the workspace's `zernio_profile_id`, creating it on the fly if
 * missing. The post-create hook in `routes/workspaces.ts` covers the happy
 * path; this self-heals legacy workspaces that pre-date the hook so the SPA
 * doesn't 409 on first /social use. Idempotent at the DB level — concurrent
 * callers who race past the null check will mint a duplicate Zernio profile,
 * which is a benign cost (one orphaned upstream profile) we accept.
 */
async function ensureWorkspaceZernioProfile(
  workspaceId: string,
): Promise<{ id: string; name: string; zernioProfileId: string } | null> {
  const ws = await loadWorkspace(workspaceId);
  if (!ws) return null;
  if (ws.zernioProfileId) return { id: ws.id, name: ws.name, zernioProfileId: ws.zernioProfileId };
  if (!isZernioConfigured()) return null;
  const db = getDb();
  if (!db) return null;
  const meta = await buildZernioProfileMeta(workspaceId);
  const minted = await zernioCreateProfile({ name: meta.name, description: meta.description });
  await db
    .update(workspaces)
    .set({ zernioProfileId: minted.profileId, updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId));
  return { id: ws.id, name: ws.name, zernioProfileId: minted.profileId };
}

async function loadWorkspaceAccount(workspaceId: string, accountId: string) {
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .select({ id: socialAccounts.id })
    .from(socialAccounts)
    .where(and(eq(socialAccounts.workspaceId, workspaceId), eq(socialAccounts.zernioAccountId, accountId)))
    .limit(1);
  return rows[0] ?? null;
}

function extractBroadcastId(value: unknown): string | null {
  const obj = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const broadcast = obj.broadcast && typeof obj.broadcast === "object" ? (obj.broadcast as Record<string, unknown>) : {};
  const id = broadcast.id ?? broadcast._id ?? obj.id ?? obj._id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function toBroadcastRecipientsBody(recipients: unknown[]): {
  phones?: string[];
  contactIds?: string[];
} {
  const phones: string[] = [];
  const contactIds: string[] = [];
  for (const item of recipients) {
    if (typeof item === "string" && item.trim()) {
      phones.push(item.trim());
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (typeof record.phone === "string" && record.phone.trim()) phones.push(record.phone.trim());
    if (typeof record.contactId === "string" && record.contactId.trim()) {
      contactIds.push(record.contactId.trim());
    }
  }
  return {
    ...(phones.length > 0 ? { phones } : {}),
    ...(contactIds.length > 0 ? { contactIds } : {}),
  };
}

function asZernioErrorReply(err: unknown): { status: number; body: Record<string, unknown> } {
  if (err instanceof ZernioApiError) {
    return {
      status: 502,
      body: {
        error: "zernio_request_failed",
        code: err.code,
        message: err.message,
        retryable: err.retryable,
        upstreamStatus: err.status ?? null,
      },
    };
  }
  return {
    status: 500,
    body: { error: "zernio_internal", message: (err as Error).message ?? "internal error" },
  };
}

// ── Send-message body ───────────────────────────────────────────────────────

const SendMessageBody = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    accountId: z.string().min(1),
    to: z.string().min(1).max(40),
    text: z.string().min(1).max(4096),
    contactId: z.string().uuid().optional(),
  }),
  z.object({
    kind: z.literal("template"),
    accountId: z.string().min(1),
    to: z.string().min(1).max(40),
    templateName: z.string().min(1).max(120),
    language: z.string().min(2).max(20),
    variables: z.array(z.unknown()).optional(),
    contactId: z.string().uuid().optional(),
  }),
]);

// ── Webhook signature verification ──────────────────────────────────────────
//
// Zernio's docs only mention X-Zernio-Signature without specifying the
// algorithm. We try HMAC-SHA256 of `<ts>.<rawBody>` first (Composio-style),
// and fall back to plain shared-secret comparison when no timestamp header is
// present (the legacy late-proxy/zernio-webhook behaviour). Once we've
// confirmed the real scheme against a live test webhook, the fallback can go.
function verifyZernioSignature(req: FastifyRequest, secret: string): { ok: boolean; mode: "hmac" | "shared" | "none" } {
  const rawBody = (req as unknown as { rawBody?: string }).rawBody ?? "";
  const sigHeader = String(req.headers["x-zernio-signature"] ?? "");
  const tsHeader = String(req.headers["x-zernio-signature-timestamp"] ?? "");
  const queryToken = String((req.query as { token?: string } | undefined)?.token ?? "");

  if (!sigHeader && !queryToken) return { ok: false, mode: "none" };

  if (tsHeader && sigHeader) {
    const tsNum = Number(tsHeader);
    if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 5 * 60) {
      return { ok: false, mode: "hmac" };
    }
    const expected = createHmac("sha256", secret).update(`${tsHeader}.${rawBody}`).digest("hex");
    try {
      const a = Buffer.from(expected, "hex");
      const b = Buffer.from(sigHeader.replace(/^sha256=/, ""), "hex");
      if (a.length === b.length && timingSafeEqual(a, b)) return { ok: true, mode: "hmac" };
    } catch {
      // fall through
    }
    return { ok: false, mode: "hmac" };
  }

  // Legacy fallback — string match. Remove once HMAC is confirmed live.
  const candidate = sigHeader || queryToken;
  if (candidate.length === secret.length) {
    const a = Buffer.from(candidate, "utf8");
    const b = Buffer.from(secret, "utf8");
    if (timingSafeEqual(a, b)) return { ok: true, mode: "shared" };
  }
  return { ok: false, mode: "shared" };
}

export default async function zernioRoutes(app: FastifyInstance) {
  // ── Workspace gating + sync ───────────────────────────────────────────────

  app.get("/workspaces/:id/zernio", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }
    const ws = await loadWorkspace(params.data.id);
    if (!ws) return reply.code(404).send({ error: "not_found" });

    if (!isZernioConfigured()) {
      return { configured: false, profileId: null, accountsCount: 0 };
    }

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });
    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(socialAccounts)
      .where(eq(socialAccounts.workspaceId, params.data.id));
    const accountsCount = countRows[0]?.count ?? 0;

    return { configured: true, profileId: ws.zernioProfileId, accountsCount };
  });

  // Rename the Zernio profile to match the canonical Desh naming format —
  // `<user_email> · <workspace_name> · #<short_workspace_id>`. Useful when:
  //   - the workspace was renamed in DESH and we want Zernio to follow
  //   - profiles minted before the naming helper landed (e.g. just "Principal")
  //     should be backfilled to include the user discriminator
  // Idempotent: if the upstream name already matches the computed format,
  // Zernio's PATCH is a no-op.
  app.post("/workspaces/:id/zernio/rename-profile", async (req, reply) => {
    if (!isZernioConfigured()) return reply.code(503).send({ error: "zernio_not_configured" });
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }
    const ws = await loadWorkspace(params.data.id);
    if (!ws?.zernioProfileId) {
      return reply.code(409).send({ error: "no_zernio_profile" });
    }
    try {
      const meta = await buildZernioProfileMeta(params.data.id);
      const updated = await zernioUpdateProfile(ws.zernioProfileId, {
        name: meta.name,
        description: meta.description,
      });
      return { profileId: updated.profileId, name: updated.name, description: updated.description };
    } catch (err) {
      const { status, body } = asZernioErrorReply(err);
      return reply.code(status).send(body);
    }
  });

  app.post("/workspaces/:id/zernio/sync-accounts", async (req, reply) => {
    if (!isZernioConfigured()) return reply.code(503).send({ error: "zernio_not_configured" });
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }
    const ws = await loadWorkspace(params.data.id);
    if (!ws) return reply.code(404).send({ error: "not_found" });
    if (!ws.zernioProfileId) {
      return reply.code(409).send({ error: "no_zernio_profile", message: "Workspace has no Zernio profile yet" });
    }

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    let accounts: Awaited<ReturnType<typeof zernioListAccounts>>;
    try {
      accounts = await zernioListAccounts({ profileId: ws.zernioProfileId });
    } catch (err) {
      const { status, body } = asZernioErrorReply(err);
      return reply.code(status).send(body);
    }

    // Ensure a local social_profiles row exists (idempotent) so future
    // social_accounts rows can FK to it.
    const profileRows = await db
      .select({ id: socialProfiles.id })
      .from(socialProfiles)
      .where(
        and(
          eq(socialProfiles.workspaceId, params.data.id),
          eq(socialProfiles.zernioProfileId, ws.zernioProfileId),
        ),
      )
      .limit(1);
    let socialProfileId = profileRows[0]?.id;
    if (!socialProfileId) {
      const inserted = await db
        .insert(socialProfiles)
        .values({
          workspaceId: params.data.id,
          userId: dbId,
          zernioProfileId: ws.zernioProfileId,
          name: ws.name,
        })
        .returning({ id: socialProfiles.id });
      socialProfileId = inserted[0]?.id;
    }

    let synced = 0;
    for (const a of accounts) {
      await db
        .insert(socialAccounts)
        .values({
          workspaceId: params.data.id,
          userId: dbId,
          socialProfileId: socialProfileId ?? null,
          zernioAccountId: a.zernioAccountId,
          platform: a.platform,
          username: a.username,
          avatarUrl: a.avatarUrl,
          status: a.status,
          meta: a.meta,
        })
        .onConflictDoUpdate({
          target: [socialAccounts.workspaceId, socialAccounts.zernioAccountId],
          set: {
            platform: a.platform,
            username: a.username,
            avatarUrl: a.avatarUrl,
            status: a.status,
            meta: a.meta,
            updatedAt: new Date(),
          },
        });
      synced++;
    }

    return { synced, profileId: ws.zernioProfileId, accounts };
  });

  app.get("/workspaces/:id/zernio/accounts", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }
    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });
    const rows = await db
      .select()
      .from(socialAccounts)
      .where(eq(socialAccounts.workspaceId, params.data.id))
      .orderBy(desc(socialAccounts.updatedAt));
    return { accounts: rows };
  });

  // ── WhatsApp messages ─────────────────────────────────────────────────────

  app.post("/workspaces/:id/zernio/whatsapp/messages", async (req, reply) => {
    if (!isZernioConfigured()) return reply.code(503).send({ error: "zernio_not_configured" });
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }
    const parsed = SendMessageBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    const body = parsed.data;
    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    // Strip non-digit chars upfront — Zernio expects E.164 digits only.
    const toDigits = body.to.replace(/\D+/g, "");
    if (!toDigits) return reply.code(400).send({ error: "invalid_to" });
    if (!(await loadWorkspaceAccount(params.data.id, body.accountId))) {
      return reply.code(403).send({ error: "account_not_in_workspace" });
    }

    const startedAt = Date.now();
    let messageId: string | null = null;
    let errorCode: string | null = null;
    let errorMessage: string | null = null;
    let upstreamStatus: number | undefined;

    try {
      if (body.kind === "text") {
        const res = await zernioSendText({ accountId: body.accountId, to: toDigits, text: body.text });
        messageId = res.messageId;
      } else {
        const res = await zernioSendTemplate({
          accountId: body.accountId,
          to: toDigits,
          templateName: body.templateName,
          language: body.language,
          variables: body.variables,
        });
        messageId = res.messageId;
      }
    } catch (err) {
      if (err instanceof ZernioApiError) {
        errorCode = err.code;
        errorMessage = err.message;
        upstreamStatus = err.status;
      } else {
        errorCode = "internal";
        errorMessage = (err as Error).message ?? "internal error";
      }
    }

    const latencyMs = Date.now() - startedAt;
    const status = errorCode ? "failed" : "success";
    const messagePreview = body.kind === "text" ? body.text.slice(0, 280) : null;

    await db.insert(whatsappSendLogs).values({
      workspaceId: params.data.id,
      userId: dbId,
      accountId: body.accountId,
      contactId: body.contactId ?? null,
      toPhone: toDigits,
      messageType: body.kind,
      templateName: body.kind === "template" ? body.templateName : null,
      templateLanguage: body.kind === "template" ? body.language : null,
      messagePreview,
      status,
      zernioMessageId: messageId,
      latencyMs,
      errorCode,
      errorMessage,
    });

    if (errorCode) {
      return reply.code(upstreamStatus && upstreamStatus < 500 ? 502 : 502).send({
        error: "zernio_request_failed",
        code: errorCode,
        message: errorMessage,
        upstreamStatus: upstreamStatus ?? null,
      });
    }
    return { ok: true, messageId, latencyMs };
  });

  app.get("/workspaces/:id/zernio/whatsapp/send-logs", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }
    const Q = z.object({
      status: z.enum(["queued", "sent", "delivered", "read", "failed", "all"]).optional(),
      phone: z.string().max(40).optional(),
      content: z.string().max(200).optional(),
      since: z.string().datetime().optional(),
      limit: z.coerce.number().int().positive().max(500).default(200),
    });
    const q = Q.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid_query", details: q.error.flatten() });
    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const conditions = [eq(whatsappSendLogs.workspaceId, params.data.id)];
    const status = q.data.status;
    if (status && status !== "all") {
      if (status === "failed") {
        conditions.push(eq(whatsappSendLogs.status, "failed"));
      } else {
        conditions.push(eq(whatsappSendLogs.deliveryStatus, status));
      }
    }
    if (q.data.phone) {
      conditions.push(ilike(whatsappSendLogs.toPhone, `%${q.data.phone.replace(/\D+/g, "")}%`));
    }
    if (q.data.content) {
      const pattern = `%${q.data.content}%`;
      const contentClause = or(
        ilike(whatsappSendLogs.messagePreview, pattern),
        ilike(whatsappSendLogs.templateName, pattern),
      );
      if (contentClause) conditions.push(contentClause);
    }
    if (q.data.since) {
      conditions.push(sql`${whatsappSendLogs.createdAt} >= ${q.data.since}`);
    }

    const rows = await db
      .select()
      .from(whatsappSendLogs)
      .where(and(...conditions))
      .orderBy(desc(whatsappSendLogs.createdAt))
      .limit(q.data.limit);
    return { logs: rows };
  });

  // ── WhatsApp passthrough routes ───────────────────────────────────────────
  //
  // Thin forwarders to services/zernio.ts. SPA's apps/web/src/services/zernio
  // /client.ts adapts response shapes; component code is unchanged.

  async function memberOr404<T>(
    req: FastifyRequest,
    workspaceId: string,
    dbId: string,
    accountId: string | null,
    fn: () => Promise<T>,
  ): Promise<{ status: number; body: unknown }> {
    if (!isZernioConfigured()) return { status: 503, body: { error: "zernio_not_configured" } };
    if (!(await requireMembership(workspaceId, dbId))) return { status: 404, body: { error: "not_found" } };
    if (accountId && !(await loadWorkspaceAccount(workspaceId, accountId))) {
      return { status: 403, body: { error: "account_not_in_workspace" } };
    }
    try {
      const data = await fn();
      return { status: 200, body: data };
    } catch (err) {
      const { status, body } = asZernioErrorReply(err);
      req.log.warn({ err }, "[zernio] forward failed");
      return { status, body };
    }
  }

  // Templates
  app.get("/workspaces/:id/zernio/whatsapp/templates", async (req, reply) => {
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    const Q = z.object({ accountId: z.string().min(1) }).safeParse(req.query);
    if (!Q.success) return reply.code(400).send({ error: "invalid_query" });
    const dbId = await requireUserDbId(req);
    const r = await memberOr404(req, params.data.id, dbId, Q.data.accountId, () =>
      whatsappTemplates.list(Q.data.accountId),
    );
    return reply.code(r.status).send(r.body);
  });
  app.post("/workspaces/:id/zernio/whatsapp/templates", async (req, reply) => {
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    const B = z.object({
      accountId: z.string().min(1),
      name: z.string().min(1),
      category: z.string().min(1),
      language: z.string().min(2),
      components: z.array(z.unknown()),
    }).safeParse(req.body);
    if (!B.success) return reply.code(400).send({ error: "invalid_body" });
    const dbId = await requireUserDbId(req);
    const r = await memberOr404(req, params.data.id, dbId, B.data.accountId, () =>
      whatsappTemplates.create(B.data),
    );
    return reply.code(r.status).send(r.body);
  });
  app.delete("/workspaces/:id/zernio/whatsapp/templates", async (req, reply) => {
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    const Q = z.object({ accountId: z.string().min(1), name: z.string().min(1) }).safeParse(req.query);
    if (!Q.success) return reply.code(400).send({ error: "invalid_query" });
    const dbId = await requireUserDbId(req);
    const r = await memberOr404(req, params.data.id, dbId, Q.data.accountId, () =>
      whatsappTemplates.remove(Q.data.accountId, Q.data.name),
    );
    return reply.code(r.status).send(r.body);
  });

  // Broadcasts
  app.get("/workspaces/:id/zernio/whatsapp/broadcasts", async (req, reply) => {
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    const Q = z.object({ accountId: z.string().min(1) }).safeParse(req.query);
    if (!Q.success) return reply.code(400).send({ error: "invalid_query" });
    const dbId = await requireUserDbId(req);
    const ws = await loadWorkspace(params.data.id);
    if (!ws?.zernioProfileId) return reply.code(409).send({ error: "no_zernio_profile" });
    const r = await memberOr404(req, params.data.id, dbId, Q.data.accountId, () =>
      whatsappBroadcasts.list({ profileId: ws.zernioProfileId!, accountId: Q.data.accountId }),
    );
    return reply.code(r.status).send(r.body);
  });
  app.post("/workspaces/:id/zernio/whatsapp/broadcasts", async (req, reply) => {
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    const B = z.object({
      accountId: z.string().min(1),
      name: z.string().min(1),
      template: z.unknown(),
      recipients: z.array(z.unknown()),
    }).safeParse(req.body);
    if (!B.success) return reply.code(400).send({ error: "invalid_body" });
    const dbId = await requireUserDbId(req);
    const ws = await loadWorkspace(params.data.id);
    if (!ws?.zernioProfileId) return reply.code(409).send({ error: "no_zernio_profile" });
    const r = await memberOr404(req, params.data.id, dbId, B.data.accountId, async () => {
      const created = await whatsappBroadcasts.create({
        profileId: ws.zernioProfileId!,
        accountId: B.data.accountId,
        name: B.data.name,
        template: B.data.template,
      });
      const broadcastId = extractBroadcastId(created);
      if (broadcastId && B.data.recipients.length > 0) {
        await whatsappBroadcasts.addRecipients(broadcastId, toBroadcastRecipientsBody(B.data.recipients));
      }
      return created;
    });
    return reply.code(r.status).send(r.body);
  });
  app.post("/workspaces/:id/zernio/whatsapp/broadcasts/:broadcastId/send", async (req, reply) => {
    const params = BroadcastParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const dbId = await requireUserDbId(req);
    const r = await memberOr404(req, params.data.id, dbId, null, () =>
      whatsappBroadcasts.send(params.data.broadcastId),
    );
    return reply.code(r.status).send(r.body);
  });
  app.post("/workspaces/:id/zernio/whatsapp/broadcasts/:broadcastId/schedule", async (req, reply) => {
    const params = BroadcastParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const B = z.object({ scheduledAt: z.string().datetime() }).safeParse(req.body);
    if (!B.success) return reply.code(400).send({ error: "invalid_body" });
    const dbId = await requireUserDbId(req);
    const r = await memberOr404(req, params.data.id, dbId, null, () =>
      whatsappBroadcasts.schedule(params.data.broadcastId, B.data.scheduledAt),
    );
    return reply.code(r.status).send(r.body);
  });
  app.patch("/workspaces/:id/zernio/whatsapp/broadcasts/:broadcastId/recipients", async (req, reply) => {
    const params = BroadcastParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const B = z.object({ recipients: z.array(z.unknown()) }).safeParse(req.body);
    if (!B.success) return reply.code(400).send({ error: "invalid_body" });
    const dbId = await requireUserDbId(req);
    const r = await memberOr404(req, params.data.id, dbId, null, () =>
      whatsappBroadcasts.addRecipients(params.data.broadcastId, toBroadcastRecipientsBody(B.data.recipients)),
    );
    return reply.code(r.status).send(r.body);
  });

  // Contacts
  app.get("/workspaces/:id/zernio/whatsapp/contacts", async (req, reply) => {
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    const Q = z.object({
      accountId: z.string().min(1),
      page: z.coerce.number().int().positive().default(1),
    }).safeParse(req.query);
    if (!Q.success) return reply.code(400).send({ error: "invalid_query" });
    const dbId = await requireUserDbId(req);
    const ws = await loadWorkspace(params.data.id);
    if (!ws?.zernioProfileId) return reply.code(409).send({ error: "no_zernio_profile" });
    const r = await memberOr404(req, params.data.id, dbId, Q.data.accountId, () =>
      whatsappContacts.list({
        profileId: ws.zernioProfileId!,
        accountId: Q.data.accountId,
        page: Q.data.page,
      }),
    );
    return reply.code(r.status).send(r.body);
  });
  app.post("/workspaces/:id/zernio/whatsapp/contacts", async (req, reply) => {
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    const B = z.object({ accountId: z.string().min(1), phone: z.string().min(1) }).passthrough().safeParse(req.body);
    if (!B.success) return reply.code(400).send({ error: "invalid_body" });
    const dbId = await requireUserDbId(req);
    const ws = await loadWorkspace(params.data.id);
    if (!ws?.zernioProfileId) return reply.code(409).send({ error: "no_zernio_profile" });
    const r = await memberOr404(req, params.data.id, dbId, B.data.accountId, () =>
      whatsappContacts.create({
        ...B.data,
        profileId: ws.zernioProfileId!,
      }),
    );
    return reply.code(r.status).send(r.body);
  });
  app.post("/workspaces/:id/zernio/whatsapp/contacts/import", async (req, reply) => {
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    const B = z.object({
      accountId: z.string().min(1),
      contacts: z.array(z.unknown()),
      defaultTags: z.array(z.string()).optional(),
    }).safeParse(req.body);
    if (!B.success) return reply.code(400).send({ error: "invalid_body" });
    const dbId = await requireUserDbId(req);
    const ws = await loadWorkspace(params.data.id);
    if (!ws?.zernioProfileId) return reply.code(409).send({ error: "no_zernio_profile" });
    const r = await memberOr404(req, params.data.id, dbId, B.data.accountId, () =>
      whatsappContacts.import({ ...B.data, profileId: ws.zernioProfileId! }),
    );
    return reply.code(r.status).send(r.body);
  });
  app.post("/workspaces/:id/zernio/whatsapp/contacts/bulk", async (req, reply) => {
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    const B = z.object({
      action: z.string().min(1),
      contactIds: z.array(z.string().min(1)),
      tags: z.array(z.string()).optional(),
      groups: z.array(z.string()).optional(),
    }).safeParse(req.body);
    if (!B.success) return reply.code(400).send({ error: "invalid_body" });
    const dbId = await requireUserDbId(req);
    const r = await memberOr404(req, params.data.id, dbId, null, () => whatsappContacts.bulkUpdate(B.data));
    return reply.code(r.status).send(r.body);
  });

  // Business profile
  app.get("/workspaces/:id/zernio/whatsapp/business-profile", async (req, reply) => {
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    const Q = z.object({ accountId: z.string().min(1) }).safeParse(req.query);
    if (!Q.success) return reply.code(400).send({ error: "invalid_query" });
    const dbId = await requireUserDbId(req);
    const r = await memberOr404(req, params.data.id, dbId, Q.data.accountId, () =>
      whatsappBusinessProfile.get(Q.data.accountId),
    );
    return reply.code(r.status).send(r.body);
  });
  app.post("/workspaces/:id/zernio/whatsapp/business-profile", async (req, reply) => {
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    const B = z.object({ accountId: z.string().min(1) }).passthrough().safeParse(req.body);
    if (!B.success) return reply.code(400).send({ error: "invalid_body" });
    const { accountId, ...rest } = B.data;
    const dbId = await requireUserDbId(req);
    const r = await memberOr404(req, params.data.id, dbId, accountId, () =>
      whatsappBusinessProfile.update(accountId, rest as Record<string, unknown>),
    );
    return reply.code(r.status).send(r.body);
  });

  // Phone numbers
  app.get("/workspaces/:id/zernio/whatsapp/phone-numbers", async (req, reply) => {
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    const dbId = await requireUserDbId(req);
    const r = await memberOr404(req, params.data.id, dbId, null, () => whatsappPhoneNumbers.list());
    return reply.code(r.status).send(r.body);
  });
  app.post("/workspaces/:id/zernio/whatsapp/phone-numbers/purchase", async (req, reply) => {
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    const B = z.object({ profileId: z.string().min(1).optional() }).safeParse(req.body);
    if (!B.success) return reply.code(400).send({ error: "invalid_body" });
    const dbId = await requireUserDbId(req);
    const ws = await loadWorkspace(params.data.id);
    const profileId = B.data.profileId ?? ws?.zernioProfileId;
    if (!profileId) return reply.code(409).send({ error: "no_zernio_profile" });
    const r = await memberOr404(req, params.data.id, dbId, null, () =>
      whatsappPhoneNumbers.purchase(profileId),
    );
    return reply.code(r.status).send(r.body);
  });

  // Connect (Embedded Signup)
  app.get("/workspaces/:id/zernio/whatsapp/connect/sdk-config", async (req, reply) => {
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    const dbId = await requireUserDbId(req);
    const r = await memberOr404(req, params.data.id, dbId, null, () => whatsappConnect.getSdkConfig());
    return reply.code(r.status).send(r.body);
  });
  app.get("/workspaces/:id/zernio/whatsapp/connect/auth-url", async (req, reply) => {
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    const Q = z.object({ redirectUrl: z.string().url() }).safeParse(req.query);
    if (!Q.success) return reply.code(400).send({ error: "invalid_query" });
    const ws = await loadWorkspace(params.data.id);
    if (!ws?.zernioProfileId) return reply.code(409).send({ error: "no_zernio_profile" });
    const dbId = await requireUserDbId(req);
    const r = await memberOr404(req, params.data.id, dbId, null, () =>
      whatsappConnect.getAuthUrl({ profileId: ws.zernioProfileId!, redirectUrl: Q.data.redirectUrl }),
    );
    return reply.code(r.status).send(r.body);
  });
  app.post("/workspaces/:id/zernio/whatsapp/connect/embedded-signup", async (req, reply) => {
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    const B = z.object({ code: z.string().min(1), profileId: z.string().min(1) }).safeParse(req.body);
    if (!B.success) return reply.code(400).send({ error: "invalid_body" });
    const dbId = await requireUserDbId(req);
    const r = await memberOr404(req, params.data.id, dbId, null, () =>
      whatsappConnect.exchangeEmbeddedSignup(B.data.code, B.data.profileId),
    );
    return reply.code(r.status).send(r.body);
  });
  app.post("/workspaces/:id/zernio/whatsapp/connect/credentials", async (req, reply) => {
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    const B = z.object({
      profileId: z.string().min(1),
      accessToken: z.string().min(1),
      wabaId: z.string().min(1),
      phoneNumberId: z.string().min(1),
    }).safeParse(req.body);
    if (!B.success) return reply.code(400).send({ error: "invalid_body" });
    const dbId = await requireUserDbId(req);
    const r = await memberOr404(req, params.data.id, dbId, null, () => whatsappConnect.connectCredentials(B.data));
    return reply.code(r.status).send(r.body);
  });

  // ── Health probe (workspace-scoped) ───────────────────────────────────────

  app.get("/workspaces/:id/zernio/health", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }
    if (!isZernioConfigured()) return { ok: false, code: "not_configured", message: "ZERNIO_API_KEY unset" };
    return zernioProbeHealth();
  });

  // ── Social platform OAuth + per-platform actions ─────────────────────────
  //
  // The SPA's /social page calls these to (a) initiate OAuth for a platform,
  // (b) read per-platform data after a successful connect. profileId is
  // injected from `workspaces.zernio_profile_id` server-side — the SPA never
  // passes it. accountId, where required, is verified to belong to this
  // workspace via `social_accounts`.

  app.get("/workspaces/:id/zernio/social/connect/:platform", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = z
      .object({ id: z.string().uuid(), platform: z.string().min(1).max(64) })
      .safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const Q = z.object({ redirectUrl: z.string().url().optional() }).safeParse(req.query);
    if (!Q.success) return reply.code(400).send({ error: "invalid_query" });
    if (!isZernioConfigured()) return reply.code(503).send({ error: "zernio_not_configured" });
    if (!(await requireMembership(params.data.id, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }
    let ws;
    try {
      ws = await ensureWorkspaceZernioProfile(params.data.id);
    } catch (err) {
      req.log.error(
        { err, platform: params.data.platform, workspaceId: params.data.id },
        "[zernio-connect] ensureWorkspaceZernioProfile failed",
      );
      const { status, body } = asZernioErrorReply(err);
      return reply.code(status).send(body);
    }
    if (!ws) return reply.code(404).send({ error: "not_found" });
    try {
      const res = (await connect.getAuthUrl({
        platform: params.data.platform.toLowerCase(),
        profileId: ws.zernioProfileId,
        redirectUrl: Q.data.redirectUrl,
      })) as { authUrl?: string; url?: string };
      const authUrl = res.authUrl ?? res.url ?? null;
      if (!authUrl) {
        req.log.warn(
          { platform: params.data.platform, response: res },
          "[zernio-connect] Zernio returned 200 with no authUrl/url field",
        );
        return reply
          .code(502)
          .send({
            error: "zernio_request_failed",
            code: "no_auth_url",
            message: `Zernio respondeu sem URL de OAuth para ${params.data.platform}. Verifique se essa plataforma é suportada pelo seu plano.`,
          });
      }
      return { authUrl };
    } catch (err) {
      // Log the full upstream error so we can diagnose 502s without crawling
      // through Fastify's default formatting. ZernioApiError has `code`,
      // `status`, `details` (the parsed JSON body Zernio returned).
      const detail =
        err instanceof ZernioApiError
          ? { code: err.code, upstreamStatus: err.status, details: err.details, message: err.message }
          : { err };
      req.log.warn(
        { ...detail, platform: params.data.platform, profileId: ws.zernioProfileId },
        "[zernio-connect] upstream rejected /connect/:platform",
      );
      const { status, body } = asZernioErrorReply(err);
      return reply.code(status).send(body);
    }
  });

  // Disconnect a single connected account. Tells Zernio to revoke the OAuth
  // and deletes the local `social_accounts` row. Verifies the account
  // belongs to this workspace before doing either.
  app.delete("/workspaces/:id/zernio/social/accounts/:accountId", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = z
      .object({ id: z.string().uuid(), accountId: z.string().min(1).max(200) })
      .safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    if (!isZernioConfigured()) return reply.code(503).send({ error: "zernio_not_configured" });
    if (!(await requireMembership(params.data.id, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }
    if (!(await loadWorkspaceAccount(params.data.id, params.data.accountId))) {
      return reply.code(403).send({ error: "account_not_in_workspace" });
    }
    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });
    try {
      await disconnectAccount(params.data.accountId);
    } catch (err) {
      // Don't block local cleanup on upstream failure — log and proceed so the
      // SPA's optimistic remove doesn't get stuck.
      req.log.warn({ err }, "[zernio] upstream disconnect failed, removing locally anyway");
    }
    await db
      .delete(socialAccounts)
      .where(
        and(
          eq(socialAccounts.workspaceId, params.data.id),
          eq(socialAccounts.zernioAccountId, params.data.accountId),
        ),
      );
    return reply.code(204).send();
  });

  // Posts feed for a specific connected account. Used by the SPA's
  // PlatformDetailInline to render the recent-posts panel. Profile/follower
  // metadata for the card comes from `social_accounts.meta` (stored on the
  // last sync), so we don't need a per-platform "profile" endpoint here.
  app.get("/workspaces/:id/zernio/social/posts", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    const Q = z
      .object({
        accountId: z.string().min(1),
        limit: z.coerce.number().int().min(1).max(50).default(20),
        page: z.coerce.number().int().min(1).max(50).default(1),
      })
      .safeParse(req.query);
    if (!Q.success) return reply.code(400).send({ error: "invalid_query" });
    if (!isZernioConfigured()) return reply.code(503).send({ error: "zernio_not_configured" });
    if (!(await requireMembership(params.data.id, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }
    if (!(await loadWorkspaceAccount(params.data.id, Q.data.accountId))) {
      return reply.code(403).send({ error: "account_not_in_workspace" });
    }
    const ws = await loadWorkspace(params.data.id);
    if (!ws?.zernioProfileId) return reply.code(409).send({ error: "no_zernio_profile" });
    try {
      const data = await posts.list({
        profileId: ws.zernioProfileId,
        limit: Q.data.limit,
        page: Q.data.page,
      });
      return { data };
    } catch (err) {
      const { status, body } = asZernioErrorReply(err);
      return reply.code(status).send(body);
    }
  });

  // ── Webhook ───────────────────────────────────────────────────────────────

  app.post("/zernio/webhook", async (req, reply) => {
    const secret = env.ZERNIO_WEBHOOK_SECRET;
    if (!secret) {
      req.log.warn("[zernio-webhook] ZERNIO_WEBHOOK_SECRET unset — refusing");
      return reply.code(503).send({ error: "webhook_secret_unset" });
    }

    const verification = verifyZernioSignature(req, secret);
    if (!verification.ok) {
      return reply.code(401).send({ error: "bad_signature", mode: verification.mode });
    }
    if (verification.mode === "shared") {
      // TODO(zernio-webhook): remove the shared-secret fallback once HMAC is
      // confirmed against a real Zernio test webhook (see plan).
      req.log.warn("[zernio-webhook] used legacy shared-secret fallback — confirm scheme and remove");
    }

    const body = req.body as { event?: string; type?: string; data?: Record<string, unknown> } | undefined;
    const eventType = (body?.event ?? body?.type ?? "").toString();
    const data = (body?.data ?? {}) as Record<string, unknown>;

    const db = getDb();
    if (!db) {
      req.log.warn("[zernio-webhook] DB unavailable — ack without persistence");
      return reply.code(200).send({ ok: true, persisted: false });
    }

    try {
      switch (eventType) {
        case "message.delivered":
        case "message.read":
        case "message.failed": {
          const messageId = String(data.messageId ?? data.id ?? "");
          if (!messageId) break;
          const tag = eventType.replace(/^message\./, "") as "delivered" | "read" | "failed";
          const stamp =
            tag === "delivered" ? "deliveredAt" : tag === "read" ? "readAt" : "failedAt";
          // Only set the timestamp if it's not already populated (first-seen
          // wins — Zernio can replay events). Delivery_status moves
          // monotonically: existing 'read' isn't pulled back to 'delivered'.
          const updates: Record<string, unknown> = {
            deliveryStatus: sql`CASE
              WHEN ${whatsappSendLogs.deliveryStatus} = 'read' THEN ${whatsappSendLogs.deliveryStatus}
              WHEN ${whatsappSendLogs.deliveryStatus} = 'delivered' AND ${tag} = 'delivered' THEN ${whatsappSendLogs.deliveryStatus}
              ELSE ${tag}
            END`,
            webhookPayload: data,
          };
          updates[stamp] = sql`COALESCE(${whatsappSendLogs[stamp as keyof typeof whatsappSendLogs] as never}, NOW())`;
          if (tag === "failed") {
            const errInfo = (data.error ?? {}) as { code?: unknown; message?: unknown };
            if (typeof errInfo.code === "string") updates.errorCode = errInfo.code;
            if (typeof errInfo.message === "string") updates.errorMessage = errInfo.message;
          }
          await db
            .update(whatsappSendLogs)
            .set(updates)
            .where(eq(whatsappSendLogs.zernioMessageId, messageId));
          break;
        }
        case "account.connected":
        case "account.disconnected": {
          const accountId = String(data.accountId ?? data.id ?? "");
          if (!accountId) break;
          const newStatus = eventType === "account.connected" ? "active" : "disconnected";
          await db
            .update(socialAccounts)
            .set({ status: newStatus, updatedAt: new Date() })
            .where(eq(socialAccounts.zernioAccountId, accountId));
          break;
        }
        case "webhook.test":
          req.log.info("[zernio-webhook] test event acked");
          break;
        default:
          req.log.info({ eventType }, "[zernio-webhook] unhandled event — log only");
      }
    } catch (err) {
      req.log.error(
        { err: err instanceof Error ? err.message : String(err), eventType },
        "[zernio-webhook] handler failed",
      );
      return reply.code(200).send({ ok: true, persisted: false });
    }

    return reply.code(200).send({ ok: true });
  });
}

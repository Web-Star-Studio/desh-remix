import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { users } from "@desh/database/schema";
import { buildServer } from "../src/server.js";
import { authHeader, signTestToken } from "./_helpers/auth.js";
import { getTestDb, resetData } from "./_helpers/db.js";

// Templates are admin-gated. Tests cover both: the gate itself (non-admin
// → 403) and the CRUD round-trip when admin.

describe("email-templates routes", () => {
  let app: FastifyInstance;
  let userId: string;
  let token: string;

  beforeAll(async () => {
    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetData();
    const db = getTestDb();
    const subjectId = crypto.randomUUID();
    const email = `t-${Date.now()}@desh.test`;
    const [user] = await db.insert(users).values({ cognitoSub: subjectId, email }).returning();
    userId = user!.id;
    token = await signTestToken({ sub: subjectId, email });
  });

  it("rejects unauthenticated requests", async () => {
    const res = await app.inject({ method: "GET", url: "/admin/email-templates" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects non-admin users with 403", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/email-templates",
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("admin_required");
  });

  it("admin can list, create, patch, delete a template", async () => {
    const db = getTestDb();
    await db.update(users).set({ isAdmin: true }).where(eq(users.id, userId));

    const list0 = await app.inject({
      method: "GET",
      url: "/admin/email-templates",
      headers: authHeader(token),
    });
    expect(list0.statusCode).toBe(200);
    expect(list0.json()).toEqual([]);

    const create = await app.inject({
      method: "POST",
      url: "/admin/email-templates",
      headers: authHeader(token),
      payload: {
        slug: "welcome",
        name: "Welcome email",
        subjectTemplate: "Welcome, {{userName}}",
        bodyHtml: "<p>Hi {{userName}}, welcome.</p>",
      },
    });
    expect(create.statusCode).toBe(201);
    const created = create.json();
    expect(created.slug).toBe("welcome");

    const dupe = await app.inject({
      method: "POST",
      url: "/admin/email-templates",
      headers: authHeader(token),
      payload: {
        slug: "welcome",
        name: "Welcome again",
        subjectTemplate: "Hi",
        bodyHtml: "x",
      },
    });
    expect(dupe.statusCode).toBe(409);

    const patch = await app.inject({
      method: "PATCH",
      url: `/admin/email-templates/${created.id}`,
      headers: authHeader(token),
      payload: { active: false },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().active).toBe(false);

    const del = await app.inject({
      method: "DELETE",
      url: `/admin/email-templates/${created.id}`,
      headers: authHeader(token),
    });
    expect(del.statusCode).toBe(204);
  });

  it("rejects invalid slug formats", async () => {
    const db = getTestDb();
    await db.update(users).set({ isAdmin: true }).where(eq(users.id, userId));

    const res = await app.inject({
      method: "POST",
      url: "/admin/email-templates",
      headers: authHeader(token),
      payload: {
        slug: "Has Spaces!",
        name: "Bad",
        subjectTemplate: "x",
        bodyHtml: "x",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_body");
  });
});

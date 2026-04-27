import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { users } from "@desh/database/schema";
import { buildServer } from "../src/server.js";
import { authHeader, signTestToken } from "./_helpers/auth.js";
import { getTestDb, resetData } from "./_helpers/db.js";

describe("me routes", () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetData();
    const subjectId = crypto.randomUUID();
    const email = `me-${Date.now()}@desh.test`;

    await getTestDb().insert(users).values({ cognitoSub: subjectId, email, displayName: "Me" });
    token = await signTestToken({ sub: subjectId, email });
  });

  it("patches avatarUrl along with the rest of the profile", async () => {
    const avatarUrl = "data:image/webp;base64,abc";

    const res = await app.inject({
      method: "PATCH",
      url: "/me",
      headers: authHeader(token),
      payload: { avatarUrl },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().avatarUrl).toBe(avatarUrl);
  });
});

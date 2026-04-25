import type { FastifyInstance } from "fastify";
import { pingDb } from "../db/client.js";

export default async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    const db = await pingDb();
    return { ok: true, db };
  });
}

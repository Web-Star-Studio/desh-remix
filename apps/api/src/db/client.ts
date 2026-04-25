import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env.js";

let cachedSql: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (!env.DATABASE_URL) return null;
  cachedSql ??= postgres(env.DATABASE_URL, { max: 5 });
  return drizzle(cachedSql);
}

export async function pingDb(): Promise<"up" | "down"> {
  const db = getDb();
  if (!db) return "down";
  try {
    await db.execute("select 1");
    return "up";
  } catch {
    return "down";
  }
}

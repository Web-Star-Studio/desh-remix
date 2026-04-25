/**
 * @module whatsapp-evolution
 * @description Evolution API client and shared context type
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.95.3";

export const EVOLUTION_API_URL = "https://evolution-api-4pkj.onrender.com";

export interface WaContext {
  adminClient: SupabaseClient;
  userId: string;
  instance: string;
  workspaceId?: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  serviceRoleKey: string;
  apiKey: string;
}

export interface EvolutionResult {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
}

/** Call Evolution API with retry */
export async function callEvolution(
  apiKey: string,
  path: string,
  method = "GET",
  payload?: unknown,
  retries = 1,
): Promise<EvolutionResult> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${EVOLUTION_API_URL}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "apikey": apiKey,
        },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok || attempt >= retries) {
        return { ok: res.ok, status: res.status, data };
      }
      if (res.status >= 500 && attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      if (attempt >= retries) {
        return { ok: false, status: 0, data: { error: err instanceof Error ? err.message : String(err) } };
      }
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return { ok: false, status: 0, data: {} };
}

/** Helper: upsert session record in DB */
export async function upsertSession(
  ctx: WaContext,
  sessionId: string,
  status: string,
  extra: Record<string, unknown> = {},
) {
  const upsertData: Record<string, unknown> = {
    user_id: ctx.userId,
    session_id: sessionId,
    status,
    updated_at: new Date().toISOString(),
    ...extra,
  };
  if (ctx.workspaceId) {
    upsertData.workspace_id = ctx.workspaceId;
  }
  await ctx.adminClient
    .from("whatsapp_web_sessions")
    .upsert(upsertData, { onConflict: "session_id" });
}

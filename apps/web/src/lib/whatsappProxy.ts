/**
 * Shared helper to call the whatsapp-web-proxy edge function.
 * Centralizes auth-header construction so callers don't repeat boilerplate.
 */
import { supabase } from "@/integrations/supabase/client";

/** Default timeout for proxy calls (seconds) */
const DEFAULT_TIMEOUT_MS = 25_000;

export async function callWhatsappProxy(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  /** Optional workspace_id to scope the request */
  workspaceId?: string | null,
  /** Optional timeout in ms (default 25s) */
  timeoutMs?: number,
): Promise<Record<string, unknown>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sessão expirada");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const baseUrl = `${supabaseUrl}/functions/v1/whatsapp-web-proxy`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
  };
  if (workspaceId) {
    headers["x-workspace-id"] = workspaceId;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new Error(
        (data as { error?: string }).error ?? `HTTP ${res.status}`,
      );
    return data as Record<string, unknown>;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("Gateway timeout — o servidor WhatsApp não respondeu a tempo");
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

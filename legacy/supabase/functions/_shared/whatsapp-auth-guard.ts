/**
 * @module whatsapp-auth-guard
 * @description Centralized fail-closed authorization for Pandora WhatsApp.
 * Called by BOTH whatsapp-webhook-handler and pandora-whatsapp (defense in depth).
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.95.3";

/** Normalize phone to digits-only with Brazilian country code */
export function normalizePhone(phone: string): string {
  let digits = String(phone ?? "").replace(/\D/g, "");

  // Remove leading 0 (local Brazilian format)
  if (digits.startsWith("0")) digits = digits.slice(1);

  // Add Brazilian country code if missing (≤ 11 digits)
  if (digits.length <= 11 && digits.length >= 10) digits = "55" + digits;

  // Handle missing 9th digit for Brazilian mobiles: 55 + 2-digit DDD + 8-digit number = 12
  if (digits.length === 12 && digits.startsWith("55")) {
    const ddd = parseInt(digits.slice(2, 4), 10);
    if (ddd >= 11 && ddd <= 99) {
      digits = digits.slice(0, 4) + "9" + digits.slice(4);
    }
  }

  return digits;
}

export interface AuthGuardResult {
  allowed: boolean;
  reason: string;
}

/**
 * Fail-closed authorization gate for Pandora WhatsApp messages.
 * Returns { allowed: true } ONLY if ALL checks pass.
 * Any error or missing data → blocked.
 */
export async function shouldProcessMessage(
  supabase: SupabaseClient,
  userId: string,
  senderPhone: string,
  isGroup: boolean,
  options?: { messagePreview?: string; skipAuditLog?: boolean; workspaceId?: string },
): Promise<AuthGuardResult> {
  // RULE 1: Groups are ALWAYS ignored
  if (isGroup) {
    await logAudit(supabase, userId, senderPhone, "blocked", "group_message", options?.skipAuditLog);
    return { allowed: false, reason: "group_message" };
  }

  // RULE 2: Fetch AI settings per workspace (fail-closed)
  let settings: any;
  try {
    let query = supabase
      .from("whatsapp_ai_settings")
      .select("enabled, allowed_numbers, verified_numbers, active_hours_start, active_hours_end")
      .eq("user_id", userId);

    if (options?.workspaceId) {
      query = query.eq("workspace_id", options.workspaceId);
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
      console.error(`[auth-guard] BLOCKED: Could not fetch settings for user ${userId}`, error);
      return { allowed: false, reason: "settings_error" };
    }
    settings = data;
  } catch (e) {
    console.error(`[auth-guard] BLOCKED: Exception fetching settings for user ${userId}`, e);
    return { allowed: false, reason: "settings_error" };
  }

  // RULE 3: Kill switch — if disabled, zero processing, zero logging
  if (!settings.enabled) {
    return { allowed: false, reason: "inactive" };
  }

  // RULE 4: Empty allowed list = block everyone
  const allowedNumbers: string[] = Array.isArray(settings.allowed_numbers)
    ? settings.allowed_numbers
    : [];
  if (allowedNumbers.length === 0) {
    console.log(`[auth-guard] BLOCKED: No authorized numbers for user ${userId}`);
    await logAudit(supabase, userId, senderPhone, "blocked", "no_allowed_numbers", options?.skipAuditLog);
    return { allowed: false, reason: "no_allowed_numbers" };
  }

  // RULE 5: Normalize and exact-match
  const senderNormalized = normalizePhone(senderPhone);
  const allowedNormalized = new Set(allowedNumbers.map(normalizePhone).filter((n) => n.length > 0));

  if (!allowedNormalized.has(senderNormalized)) {
    console.log(`[auth-guard] BLOCKED: ${senderNormalized} NOT in allowed list [${[...allowedNormalized].join(", ")}]`);

    // Rate limiting: if > 10 blocked attempts in last hour, skip logging too (anti-spam)
    try {
      const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
      const { count } = await supabase
        .from("pandora_wa_audit_log")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("sender_phone", senderNormalized)
        .eq("action", "blocked")
        .gte("created_at", oneHourAgo);

      if ((count ?? 0) > 10) {
        console.log(`[auth-guard] Rate-limited logging for ${senderNormalized} (${count} blocks in 1h)`);
        return { allowed: false, reason: "not_authorized" };
      }
    } catch {}

    await logAudit(supabase, userId, senderNormalized, "blocked", "not_authorized", options?.skipAuditLog);

    // Check for security alert: > 5 distinct blocked numbers in 1 hour
    checkSecurityAlert(supabase, userId).catch(() => {});

    return { allowed: false, reason: "not_authorized" };
  }

  // RULE 5b: Check verified_numbers (revalidation)
  const verifiedNumbers: string[] = Array.isArray(settings.verified_numbers)
    ? settings.verified_numbers
    : [];
  const verifiedNormalized = new Set(verifiedNumbers.map(normalizePhone).filter((n) => n.length > 0));

  if (!verifiedNormalized.has(senderNormalized)) {
    console.log(`[auth-guard] BLOCKED: ${senderNormalized} is allowed but NOT verified`);
    await logAudit(supabase, userId, senderNormalized, "blocked", "not_verified", options?.skipAuditLog);
    return { allowed: false, reason: "not_verified" };
  }

  // RULE 6: Active hours check (São Paulo timezone)
  const start = settings.active_hours_start ?? 6;
  const end = settings.active_hours_end ?? 23;
  try {
    const nowSP = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const currentHour = nowSP.getHours();

    let inActiveHours: boolean;
    if (start <= end) {
      inActiveHours = currentHour >= start && currentHour <= end;
    } else {
      // Crosses midnight
      inActiveHours = currentHour >= start || currentHour <= end;
    }

    if (!inActiveHours) {
      console.log(`[auth-guard] Outside active hours (${start}-${end}, current: ${currentHour})`);
      await logAudit(supabase, userId, senderNormalized, "blocked", "outside_hours", options?.skipAuditLog);
      return { allowed: false, reason: "outside_hours" };
    }
  } catch {}

  // ALL checks passed
  console.log(`[auth-guard] AUTHORIZED: ${senderNormalized} for user ${userId}`);
  if (!options?.skipAuditLog) {
    logAudit(
      supabase,
      userId,
      senderNormalized,
      "processed",
      "authorized",
      false,
      options?.messagePreview?.slice(0, 100),
    ).catch(() => {});
  }

  return { allowed: true, reason: "authorized" };
}

/** Fire-and-forget audit log insert */
async function logAudit(
  supabase: SupabaseClient,
  userId: string,
  senderPhone: string,
  action: string,
  reason: string,
  skip?: boolean,
  messagePreview?: string,
  creditsUsed = 0,
) {
  if (skip) return;
  try {
    await supabase.from("pandora_wa_audit_log").insert({
      user_id: userId,
      sender_phone: senderPhone,
      action,
      reason,
      message_preview: action === "processed" ? (messagePreview || null) : null,
      credits_used: creditsUsed,
    });
  } catch (e) {
    console.error("[auth-guard] Audit log insert error:", e);
  }
}

/** Check if > 5 distinct blocked numbers in 1 hour → security alert email */
async function checkSecurityAlert(supabase: SupabaseClient, userId: string) {
  try {
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { data: recentBlocked } = await supabase
      .from("pandora_wa_audit_log")
      .select("sender_phone")
      .eq("user_id", userId)
      .eq("action", "blocked")
      .eq("reason", "not_authorized")
      .gte("created_at", oneHourAgo);

    if (!recentBlocked) return;
    const distinctPhones = new Set(recentBlocked.map((r: any) => r.sender_phone));
    if (distinctPhones.size >= 5) {
      console.warn(`[auth-guard] SECURITY ALERT: ${distinctPhones.size} distinct blocked numbers in 1h for user ${userId}`);
      // Fire-and-forget email alert
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      if (supabaseUrl && serviceKey) {
        fetch(`${supabaseUrl}/functions/v1/email-system`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            action: "send-notification",
            type: "security_alert",
            userId,
            data: {
              title: "Atividade incomum no WhatsApp",
              message: `${distinctPhones.size} números desconhecidos tentaram interagir com a Pandora na última hora.`,
            },
          }),
        }).catch(() => {});
      }
    }
  } catch {}
}

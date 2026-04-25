/**
 * @function auth-phone-otp
 * @description OTP verification for authorizing WhatsApp phone numbers
 * @status active
 */
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { corsHeaders } from "../_shared/utils.ts";
import { normalizePhone } from "../_shared/whatsapp-auth-guard.ts";

async function sha256Hex(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateOTP(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 1000000).padStart(6, "0");
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "***@***";
  const visible = user.slice(0, 1);
  return `${visible}${"*".repeat(Math.max(user.length - 1, 3))}@${domain}`;
}

async function validateWorkspaceOwnership(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  workspaceId: string,
) {
  const { data: workspaceRow, error } = await adminClient
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[auth-phone-otp] Workspace validation error:", error);
    return null;
  }

  return workspaceRow;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claims.claims.sub as string;
    const userEmail = (claims.claims.email as string) ?? "";

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json();
    const { action, phone_number, otp_code, workspace_id } = body;

    if (!workspace_id) {
      return new Response(
        JSON.stringify({ error: "workspace_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const workspaceRow = await validateWorkspaceOwnership(adminClient, userId, workspace_id);
    if (!workspaceRow) {
      return new Response(
        JSON.stringify({ error: "workspace_forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "request") {
      if (!phone_number) {
        return new Response(JSON.stringify({ error: "phone_number is required" }), { status: 400, headers: corsHeaders });
      }

      const normalizedPhone = normalizePhone(phone_number);

      // Rate limit: max 5 OTPs/hour/user
      const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
      const { count } = await adminClient
        .from("phone_authorization_otps")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", oneHourAgo);

      if ((count ?? 0) >= 5) {
        return new Response(
          JSON.stringify({ error: "rate_limited", message: "Muitas solicitações. Tente novamente em 1 hora." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Generate OTP
      const otpCode = generateOTP();
      const otpHash = await sha256Hex(otpCode);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

      // Store hash (NEVER store plaintext)
      const { data: insertedOtp, error: insertOtpError } = await adminClient
        .from("phone_authorization_otps")
        .insert({
          user_id: userId,
          phone_number: normalizedPhone,
          otp_hash: otpHash,
          expires_at: expiresAt,
        })
        .select("id")
        .single();

      if (insertOtpError || !insertedOtp?.id) {
        console.error("[auth-phone-otp] OTP insert error:", insertOtpError);
        return new Response(
          JSON.stringify({ error: "otp_store_failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Send email via email-system
      const formattedPhone = normalizedPhone.replace(/^(\d{2})(\d{2})(\d{5})(\d{4})$/, "+$1 $2 $3-$4");
      try {
        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/email-system`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            action: "send-notification",
            type: "security_otp",
            user_id: userId,
            data: {
              title: "Código de verificação WhatsApp",
              otpCode,
              phoneNumber: formattedPhone,
              expiresInMinutes: 10,
            },
          }),
        });

        const emailResponseText = await emailResponse.text();
        let emailResult: any = null;
        try {
          emailResult = emailResponseText ? JSON.parse(emailResponseText) : null;
        } catch {
          emailResult = { raw: emailResponseText };
        }

        const emailWasSent = emailResponse.ok && (emailResult?.sent === true || emailResult?.sent === 1);
        if (!emailWasSent) {
          await adminClient.from("phone_authorization_otps").delete().eq("id", insertedOtp.id);
          console.error("[auth-phone-otp] Email send rejected:", {
            status: emailResponse.status,
            result: emailResult,
          });
          return new Response(
            JSON.stringify({ error: "email_send_failed", message: "Não foi possível enviar o código agora. Tente novamente." }),
            { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } catch (emailErr) {
        await adminClient.from("phone_authorization_otps").delete().eq("id", insertedOtp.id);
        console.error("[auth-phone-otp] Email send error:", emailErr);
        return new Response(
          JSON.stringify({ error: "email_send_failed", message: "Não foi possível enviar o código agora. Tente novamente." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ sent: true, masked_email: maskEmail(userEmail) }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "verify") {
      if (!phone_number || !otp_code) {
        return new Response(
          JSON.stringify({ error: "phone_number and otp_code are required" }),
          { status: 400, headers: corsHeaders },
        );
      }

      const normalizedPhone = normalizePhone(phone_number);
      const inputHash = await sha256Hex(otp_code);

      // Find pending OTP (not expired, not verified, attempts < 3)
      const { data: otpRow } = await adminClient
        .from("phone_authorization_otps")
        .select("id, otp_hash, attempts")
        .eq("user_id", userId)
        .eq("phone_number", normalizedPhone)
        .eq("verified", false)
        .gte("expires_at", new Date().toISOString())
        .lt("attempts", 3)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!otpRow) {
        return new Response(
          JSON.stringify({ verified: false, error: "expired_or_invalid" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (otpRow.otp_hash !== inputHash) {
        // Increment attempts
        const newAttempts = (otpRow.attempts ?? 0) + 1;
        if (newAttempts >= 3) {
          await adminClient.from("phone_authorization_otps").delete().eq("id", otpRow.id);
        } else {
          await adminClient.from("phone_authorization_otps").update({ attempts: newAttempts }).eq("id", otpRow.id);
        }
        return new Response(
          JSON.stringify({ verified: false, attempts_remaining: Math.max(0, 3 - newAttempts) }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // OTP correct — delete it and add to verified_numbers
      await adminClient.from("phone_authorization_otps").delete().eq("id", otpRow.id);

      // Add to verified_numbers in whatsapp_ai_settings for THIS workspace only
      const { data: currentSettings } = await adminClient
        .from("whatsapp_ai_settings")
        .select("id, verified_numbers, allowed_numbers")
        .eq("user_id", userId)
        .eq("workspace_id", workspace_id)
        .maybeSingle();

      const verifiedNumbers: string[] = Array.isArray(currentSettings?.verified_numbers)
        ? currentSettings.verified_numbers
        : [];
      const allowedNumbers: string[] = Array.isArray(currentSettings?.allowed_numbers)
        ? currentSettings.allowed_numbers
        : [];

      if (!verifiedNumbers.includes(normalizedPhone)) {
        verifiedNumbers.push(normalizedPhone);
      }
      if (!allowedNumbers.includes(normalizedPhone)) {
        allowedNumbers.push(normalizedPhone);
      }

      if (currentSettings?.id) {
        const { error: updateError } = await adminClient
          .from("whatsapp_ai_settings")
          .update({ verified_numbers: verifiedNumbers, allowed_numbers: allowedNumbers })
          .eq("id", currentSettings.id);

        if (updateError) {
          console.error("[auth-phone-otp] Settings update error:", updateError);
          return new Response(
            JSON.stringify({ error: "settings_update_failed" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } else {
        const { error: insertError } = await adminClient
          .from("whatsapp_ai_settings")
          .insert({
            user_id: userId,
            workspace_id,
            enabled: false,
            allowed_numbers: allowedNumbers,
            verified_numbers: verifiedNumbers,
            greeting_message: "",
            active_hours_start: 6,
            active_hours_end: 23,
            use_mcp: false,
          });

        if (insertError) {
          console.error("[auth-phone-otp] Settings insert error:", insertError);
          return new Response(
            JSON.stringify({ error: "settings_insert_failed" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      return new Response(
        JSON.stringify({ verified: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders });
  } catch (e) {
    console.error("[auth-phone-otp] Error:", e);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

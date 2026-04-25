/**
 * @function email-automation-runner
 * @description Executa automações de e-mail (cron/triggers)
 * @status active
 * @calledBy Cron jobs, DB triggers
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { corsHeaders } from "../_shared/utils.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all active automations
    const { data: automations, error } = await supabase
      .from("email_automations")
      .select("*")
      .eq("active", true);

    if (error) throw error;
    if (!automations || automations.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let processed = 0;
    const now = new Date();

    for (const automation of automations) {
      const config = automation.trigger_config || {};
      let shouldRun = false;

      // ── Cron-based triggers ──
      if (automation.trigger_type === "cron") {
        const cronExpr = config.cron || "";
        if (!automation.last_run_at) {
          shouldRun = true;
        } else {
          const lastRun = new Date(automation.last_run_at);
          const hoursSince = (now.getTime() - lastRun.getTime()) / 3600000;

          // Simple cron matching: check if enough time has passed
          if (cronExpr.includes("* * * * *")) {
            shouldRun = hoursSince >= 0.016; // ~1 min
          } else if (cronExpr.includes("0 8 * * 1")) {
            // Weekly on Monday 8am
            shouldRun = now.getDay() === 1 && now.getHours() >= 8 && hoursSince >= 24;
          } else if (cronExpr.includes("0 7 * * *") || cronExpr.includes("0 8 * * *")) {
            // Daily at 7am or 8am
            shouldRun = hoursSince >= 20; // at least ~20h since last
          } else {
            // Default: run if > 1 hour since last
            shouldRun = hoursSince >= 1;
          }
        }
      }

      // ── Threshold triggers ──
      if (automation.trigger_type === "threshold") {
        const event = config.event;
        const threshold = config.threshold || 5;

        if (event === "credit_low") {
          // Find users with low credits who haven't been notified recently
          const { data: lowCreditUsers } = await supabase
            .from("user_credits")
            .select("user_id, balance")
            .lt("balance", threshold);

          if (lowCreditUsers && lowCreditUsers.length > 0) {
            for (const u of lowCreditUsers) {
              try {
                const fnUrl = `${supabaseUrl}/functions/v1/send-notification-email`;
                await fetch(fnUrl, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${serviceKey}`,
                  },
                  body: JSON.stringify({
                    type: "credit_low",
                    user_id: u.user_id,
                    data: { credits_balance: u.balance },
                  }),
                });
              } catch (e) {
                console.error("Threshold notification error:", e);
              }
            }
            shouldRun = false; // Already processed inline
            processed++;
            await supabase.from("email_automations").update({ last_run_at: now.toISOString() }).eq("id", automation.id);
          }
          continue;
        }
      }

      if (!shouldRun) continue;

      // ── Get target users ──
      let targetUserIds: string[] = [];
      const audience = automation.target_audience || "all";

      if (audience === "all" || audience === "active") {
        const { data: allUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        if (allUsers?.users) {
          if (audience === "active") {
            const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
            targetUserIds = allUsers.users
              .filter((u: any) => u.last_sign_in_at && u.last_sign_in_at > sevenDaysAgo)
              .map((u: any) => u.id);
          } else {
            targetUserIds = allUsers.users.map((u: any) => u.id);
          }
        }
      } else if (audience === "inactive") {
        const { data: allUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        if (allUsers?.users) {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
          targetUserIds = allUsers.users
            .filter((u: any) => !u.last_sign_in_at || u.last_sign_in_at < sevenDaysAgo)
            .map((u: any) => u.id);
        }
      } else if (audience === "admins") {
        const { data: adminRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        if (adminRoles) targetUserIds = adminRoles.map((r: any) => r.user_id);
      }

      // ── Send to each target ──
      const emailType = automation.template_slug || "broadcast";
      const fnUrl = `${supabaseUrl}/functions/v1/send-notification-email`;

      for (const uid of targetUserIds) {
        try {
          await fetch(fnUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              type: emailType,
              user_id: uid,
              data: config.data || {},
            }),
          });
        } catch (e) {
          console.error(`Automation ${automation.id} send error:`, e);
        }
      }

      // Update last_run_at
      await supabase.from("email_automations").update({ last_run_at: now.toISOString() }).eq("id", automation.id);
      processed++;
    }

    return new Response(JSON.stringify({ processed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("email-automation-runner error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

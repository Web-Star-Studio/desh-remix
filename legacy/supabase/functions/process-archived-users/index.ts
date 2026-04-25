/**
 * @function process-archived-users
 * @description Processa exclusão de contas arquivadas expiradas
 * @status active
 * @calledBy Cron job
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

    const now = new Date();
    const results = { warnings_7d: 0, warnings_3d: 0, deleted: 0, errors: [] as string[] };

    // Get all archived users with pending deletion
    const { data: pending } = await supabase.rpc("admin_get_pending_deletions");
    if (!pending || !Array.isArray(pending) || pending.length === 0) {
      return new Response(JSON.stringify({ message: "No pending deletions", ...results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all admin emails for notifications
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminEmails: string[] = [];
    if (adminRoles) {
      for (const ar of adminRoles) {
        const { data: adminAuth } = await supabase.auth.admin.getUserById(ar.user_id);
        if (adminAuth?.user?.email) adminEmails.push(adminAuth.user.email);
      }
    }

    for (const user of pending) {
      const daysRemaining = user.days_remaining;
      const userId = user.user_id;
      const userEmail = user.email;

      try {
        // 7-day warning (between 6 and 7 days remaining)
        if (daysRemaining >= 6 && daysRemaining < 7) {
          await sendArchiveEmail(supabase, "account_deletion_warning", userId, {
            days_remaining: 7,
            email: userEmail,
            display_name: user.display_name,
            archived_reason: user.archived_reason,
            admin_emails: adminEmails,
          });
          results.warnings_7d++;
        }

        // 3-day warning (between 2 and 3 days remaining)
        if (daysRemaining >= 2 && daysRemaining < 3) {
          await sendArchiveEmail(supabase, "account_deletion_warning", userId, {
            days_remaining: 3,
            email: userEmail,
            display_name: user.display_name,
            archived_reason: user.archived_reason,
            admin_emails: adminEmails,
          });
          results.warnings_3d++;
        }

        // Expired: permanently delete user data
        if (daysRemaining <= 0) {
          await permanentlyDeleteUser(supabase, userId, userEmail, adminEmails);
          results.deleted++;
        }
      } catch (e: any) {
        console.error(`Error processing user ${userId}:`, e);
        results.errors.push(`${userId}: ${e.message}`);
      }
    }

    // Log summary
    await supabase.from("admin_logs").insert({
      user_id: null,
      user_email: "system@cron",
      action: "process_archived_users",
      details: results,
    });

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("process-archived-users error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sendArchiveEmail(
  supabase: any,
  type: string,
  userId: string,
  data: Record<string, any>,
) {
  const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notification-email`;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Send to user
  await fetch(fnUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ type, user_id: userId, data }),
  });

  // Send warning to all admins
  if (data.admin_emails?.length) {
    for (const adminEmail of data.admin_emails) {
      // Find admin user_id by email
      const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const adminUser = users?.users?.find((u: any) => u.email === adminEmail);
      if (adminUser) {
        await fetch(fnUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            type,
            user_id: adminUser.id,
            data: { ...data, is_admin_copy: true, target_email: data.email, target_name: data.display_name },
          }),
        });
      }
    }
  }
}

async function permanentlyDeleteUser(
  supabase: any,
  userId: string,
  userEmail: string,
  adminEmails: string[],
) {

  // Delete user data from all tables
  const tables = [
    "user_data", "contacts", "contact_interactions", "finance_transactions",
    "finance_budgets", "finance_goals", "finance_recurring", "financial_accounts",
    "financial_connections", "financial_investments", "financial_transactions_unified",
    "financial_sync_logs", "ai_conversations", "ai_agents", "ai_projects",
    "ai_knowledge_base", "ai_memories", "ai_insights", "tasks",
    "automation_rules", "automation_logs",
    "gmail_messages_cache", "gmail_sync_state", "email_snoozes",
    "connections",
    "credit_transactions", "notification_preferences", "billing_preferences",
    "email_rate_limits", "email_cleanup_sessions",
    "pandora_interaction_logs", "gateway_api_key_logs", "user_gateway_api_keys",
    "widget_shares", "friendships", "friend_requests",
    "broadcast_dismissals", "coupon_redemptions", "user_credits",
    "user_subscriptions", "whatsapp_web_sessions", "whatsapp_web_session_logs",
    "profile_documents",
  ];

  for (const table of tables) {
    try {
      await supabase.from(table).delete().eq("user_id", userId);
    } catch (e) {
      console.warn(`Failed to delete from ${table}:`, e);
    }
  }

  // Clear profile archive fields and mark as deleted
  await supabase
    .from("profiles")
    .update({
      archived_at: null,
      archived_reason: null,
      archive_expires_at: null,
      display_name: "[Conta excluída]",
      avatar_url: null,
    })
    .eq("user_id", userId);

  // Delete the auth user (disables login)
  await supabase.auth.admin.deleteUser(userId);

  // Log permanent deletion
  await supabase.from("admin_logs").insert({
    user_id: null,
    user_email: "system@cron",
    action: "permanent_delete_user",
    details: { target_user_id: userId, target_email: userEmail },
  });

}

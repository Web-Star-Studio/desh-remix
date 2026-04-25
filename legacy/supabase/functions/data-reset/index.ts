/**
 * @function data-reset
 * @description Reset/wipe user data by module with audit logging
 * @status active
 * @calledBy DataResetPage
 */
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { corsHeaders } from "../_shared/utils.ts";

const VALID_MODULES = [
  "whatsapp",
  "email_cache",
  "notes",
  "tasks",
  "contacts",
  "finances",
  "files",
  "ai",
  "social",
] as const;

type Module = typeof VALID_MODULES[number];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  let userId: string;
  try {
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) throw new Error("Invalid token");
    userId = claimsData.claims.sub as string;
  } catch {
    // Fallback
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    userId = user.id;
  }

  let body: { module: string; confirmation: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { module, confirmation } = body;

  if (!module || !VALID_MODULES.includes(module as Module)) {
    return new Response(JSON.stringify({ error: "Invalid module", valid: VALID_MODULES }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Double confirmation: user must type the module name in uppercase
  if (confirmation !== module.toUpperCase()) {
    return new Response(JSON.stringify({ error: "Confirmation mismatch. Type the module name in UPPERCASE to confirm." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  let totalDeleted = 0;
  const details: Record<string, number> = {};

  try {
    switch (module as Module) {
      case "whatsapp": {
        // Delete messages first (FK to conversations)
        const { data: convos } = await admin
          .from("whatsapp_conversations")
          .select("id")
          .eq("user_id", userId);
        const convIds = (convos || []).map((c: { id: string }) => c.id);

        if (convIds.length > 0) {
          const { count: msgCount } = await admin
            .from("whatsapp_messages")
            .delete({ count: "exact" })
            .in("conversation_id", convIds);
          details.messages = msgCount || 0;
          totalDeleted += details.messages;
        }

        const { count: convCount } = await admin
          .from("whatsapp_conversations")
          .delete({ count: "exact" })
          .eq("user_id", userId);
        details.conversations = convCount || 0;
        totalDeleted += details.conversations;

        // Disconnect sessions
        const { count: sessCount } = await admin
          .from("whatsapp_web_sessions")
          .delete({ count: "exact" })
          .eq("user_id", userId);
        details.sessions = sessCount || 0;
        totalDeleted += details.sessions;

        // WhatsApp AI settings
        await admin
          .from("whatsapp_ai_settings")
          .delete()
          .eq("user_id", userId);
        break;
      }

      case "email_cache": {
        const { count } = await admin
          .from("emails_cache")
          .delete({ count: "exact" })
          .eq("user_id", userId);
        details.emails_cache = count || 0;
        totalDeleted += details.emails_cache;

        const { count: snoozeCount } = await admin
          .from("email_snoozes")
          .delete({ count: "exact" })
          .eq("user_id", userId);
        details.snoozes = snoozeCount || 0;
        totalDeleted += details.snoozes;

        const { count: cleanupCount } = await admin
          .from("email_cleanup_sessions")
          .delete({ count: "exact" })
          .eq("user_id", userId);
        details.cleanup_sessions = cleanupCount || 0;
        totalDeleted += details.cleanup_sessions;
        break;
      }

      case "notes": {
        const { count } = await admin
          .from("user_data")
          .delete({ count: "exact" })
          .eq("user_id", userId)
          .eq("data_type", "notes");
        details.notes = count || 0;
        totalDeleted += details.notes;
        break;
      }

      case "tasks": {
        const { count } = await admin
          .from("tasks")
          .delete({ count: "exact" })
          .eq("user_id", userId);
        details.tasks = count || 0;
        totalDeleted += details.tasks;
        break;
      }

      case "contacts": {
        // Delete interactions first
        const { data: contactRows } = await admin
          .from("contacts")
          .select("id")
          .eq("user_id", userId);
        const contactIds = (contactRows || []).map((c: { id: string }) => c.id);

        if (contactIds.length > 0) {
          const { count: intCount } = await admin
            .from("contact_interactions")
            .delete({ count: "exact" })
            .in("contact_id", contactIds);
          details.interactions = intCount || 0;
          totalDeleted += details.interactions;
        }

        const { count } = await admin
          .from("contacts")
          .delete({ count: "exact" })
          .eq("user_id", userId);
        details.contacts = count || 0;
        totalDeleted += details.contacts;
        break;
      }

      case "finances": {
        const tables = [
          { table: "finance_transactions", key: "transactions" },
          { table: "finance_goals", key: "goals" },
          { table: "finance_budgets", key: "budgets" },
          { table: "finance_recurring", key: "recurring" },
        ];
        for (const { table, key } of tables) {
          const { count } = await admin
            .from(table)
            .delete({ count: "exact" })
            .eq("user_id", userId);
          details[key] = count || 0;
          totalDeleted += details[key];
        }
        break;
      }

      case "files": {
        // Delete links, share links first
        const { data: fileRows } = await admin
          .from("files")
          .select("id")
          .eq("user_id", userId);
        const fileIds = (fileRows || []).map((f: { id: string }) => f.id);

        if (fileIds.length > 0) {
          await admin.from("file_links").delete().in("file_id", fileIds);
          await admin.from("file_share_links").delete().in("file_id", fileIds);
        }

        const { count: fileCount } = await admin
          .from("files")
          .delete({ count: "exact" })
          .eq("user_id", userId);
        details.files = fileCount || 0;
        totalDeleted += details.files;

        const { count: folderCount } = await admin
          .from("file_folders")
          .delete({ count: "exact" })
          .eq("user_id", userId);
        details.folders = folderCount || 0;
        totalDeleted += details.folders;

        const { count: inboxCount } = await admin
          .from("file_inbox")
          .delete({ count: "exact" })
          .eq("user_id", userId);
        details.inbox = inboxCount || 0;
        totalDeleted += details.inbox;
        break;
      }

      case "ai": {
        // Pandora operational tables (primary)
        const { count: toolCount } = await admin
          .from("pandora_tool_calls")
          .delete({ count: "exact" })
          .eq("user_id", userId);
        details.tool_calls = toolCount || 0;
        totalDeleted += details.tool_calls;

        const { count: interCount } = await admin
          .from("pandora_interaction_logs")
          .delete({ count: "exact" })
          .eq("user_id", userId);
        details.interaction_logs = interCount || 0;
        totalDeleted += details.interaction_logs;

        const { count: sessCount2 } = await admin
          .from("pandora_sessions")
          .delete({ count: "exact" })
          .eq("user_id", userId);
        details.sessions = sessCount2 || 0;
        totalDeleted += details.sessions;

        // Legacy AI tables
        const { count: convCount } = await admin
          .from("ai_conversations")
          .delete({ count: "exact" })
          .eq("user_id", userId);
        details.conversations = convCount || 0;
        totalDeleted += details.conversations;

        const { count: memCount } = await admin
          .from("ai_memories")
          .delete({ count: "exact" })
          .eq("user_id", userId);
        details.memories = memCount || 0;
        totalDeleted += details.memories;

        const { count: kbCount } = await admin
          .from("ai_knowledge_base")
          .delete({ count: "exact" })
          .eq("user_id", userId);
        details.knowledge_base = kbCount || 0;
        totalDeleted += details.knowledge_base;
        break;
      }

      case "social": {
        const { count } = await admin
          .from("social_accounts")
          .delete({ count: "exact" })
          .eq("user_id", userId);
        details.accounts = count || 0;
        totalDeleted += details.accounts;
        break;
      }
    }

    // Log the reset
    await admin.from("data_reset_log").insert({
      user_id: userId,
      module,
      records_deleted: totalDeleted,
      metadata: details,
    });

    return new Response(JSON.stringify({
      success: true,
      module,
      records_deleted: totalDeleted,
      details,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(`[data-reset] Error resetting ${module} for ${userId}:`, err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

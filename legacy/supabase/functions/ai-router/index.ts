/**
 * @function ai-router
 * @description Unified AI router — replaces productivity-ai, comms-ai, data-ai and all per-module redirects
 * @status active
 * @calledBy All frontend AI hooks and components via invokeAI()
 */
import { corsHeaders, handleCors, errorResponse } from "../_shared/utils.ts";
import { verifyAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  try {
    const authResult = await verifyAuth(req);
    if (authResult instanceof Response) {
      return new Response(authResult.body, {
        status: authResult.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { module, ...params } = body;

    if (!module) return errorResponse(400, "Missing 'module' parameter");

    const userId = authResult.userId;

    switch (module) {
      // === Productivity ===
      case "calendar": {
        const { handleCalendarAI } = await import("../_shared/ai-calendar.ts");
        return await handleCalendarAI(params, userId);
      }
      case "tasks": {
        const { handleTasksAI } = await import("../_shared/ai-tasks.ts");
        return await handleTasksAI(params, userId);
      }
      case "notes": {
        const { handleNotesAI } = await import("../_shared/ai-notes.ts");
        return await handleNotesAI(params, userId);
      }
      case "week-planner": {
        const { handleWeekPlannerAI } = await import("../_shared/ai-week-planner.ts");
        return await handleWeekPlannerAI(params, userId);
      }
      case "automation": {
        const { handleAutomationAI } = await import("../_shared/ai-automation.ts");
        return await handleAutomationAI(params, userId);
      }

      // === Communications ===
      case "email": {
        const { handleEmailAI } = await import("../_shared/ai-email.ts");
        return await handleEmailAI(req, params, userId);
      }
      case "messages": {
        const { handleMessagesAI } = await import("../_shared/ai-messages.ts");
        return await handleMessagesAI(params, userId);
      }
      case "inbox": {
        const { handleInboxAI } = await import("../_shared/ai-inbox.ts");
        return await handleInboxAI(params, userId);
      }
      case "contacts": {
        const { handleContactsAI } = await import("../_shared/ai-contacts.ts");
        return await handleContactsAI(params, userId);
      }
      case "social": {
        const { handleSocialAI } = await import("../_shared/ai-social.ts");
        return await handleSocialAI(params, userId);
      }

      // === Data ===
      case "finance": {
        const { handleFinanceAI } = await import("../_shared/ai-finance.ts");
        return await handleFinanceAI(req, params, userId);
      }
      case "files": {
        const { handleFilesAI } = await import("../_shared/ai-files.ts");
        return await handleFilesAI(params, userId);
      }

      default:
        return errorResponse(400, `Unknown AI module: ${module}`);
    }
  } catch (e: any) {
    console.error("[ai-router] error:", e);
    return errorResponse(500, e.message || "Internal error");
  }
});

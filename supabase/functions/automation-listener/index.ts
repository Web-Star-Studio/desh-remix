/**
 * @function automation-listener
 * @description Processes automation events from the event bus.
 * Called via Database Webhook on INSERT into automation_events.
 * @status active
 * @calledBy Database Webhook (automation_events INSERT)
 */
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/utils.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Support both database webhook format and direct invocation
    const event = body.record || body;

    if (!event?.id || !event?.user_id || !event?.event_type) {
      return jsonResponse({ error: "Invalid event payload" }, 400);
    }

    // Skip already processed events
    if (event.processed) {
      return jsonResponse({ skipped: "already_processed" });
    }

    // Fetch active automation rules matching this event type
    const { data: rules, error: rulesErr } = await supabaseAdmin
      .from("automation_rules")
      .select("*")
      .eq("user_id", event.user_id)
      .eq("enabled", true)
      .eq("trigger_event", event.event_type);

    if (rulesErr) {
      console.error("[automation-listener] Rules query error:", rulesErr);
      return errorResponse(500, "Failed to fetch rules");
    }

    if (!rules || rules.length === 0) {
      // Mark as processed with no matches
      await supabaseAdmin
        .from("automation_events")
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq("id", event.id);

      return jsonResponse({ matched: 0 });
    }

    const matchedRuleIds: string[] = [];

    for (const rule of rules) {
      try {
        // Evaluate condition from trigger_config
        const condition = rule.trigger_config?.condition;
        if (!evaluateCondition(condition, event.event_data)) {
          continue;
        }

        matchedRuleIds.push(rule.id);

        // Execute action
        await executeAction(supabaseAdmin, rule, event);

        // Log execution
        await supabaseAdmin.from("automation_logs").insert({
          rule_id: rule.id,
          user_id: event.user_id,
          event_id: event.id,
          status: "executed",
          trigger_data: event.event_data,
          action_result: { action_type: rule.action_type, timestamp: new Date().toISOString() },
        });

        // Update rule execution count
        await supabaseAdmin
          .from("automation_rules")
          .update({
            execution_count: (rule.execution_count || 0) + 1,
            last_executed_at: new Date().toISOString(),
          })
          .eq("id", rule.id);
      } catch (ruleErr) {
        console.error(`[automation-listener] Rule ${rule.id} execution error:`, ruleErr);

        // Log failure
        await supabaseAdmin.from("automation_logs").insert({
          rule_id: rule.id,
          user_id: event.user_id,
          event_id: event.id,
          status: "failed",
          trigger_data: event.event_data,
          action_result: { error: String(ruleErr) },
        });
      }
    }

    // Mark event as processed
    await supabaseAdmin
      .from("automation_events")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        matched_rules: matchedRuleIds,
      })
      .eq("id", event.id);

    return jsonResponse({ matched: matchedRuleIds.length, rules: matchedRuleIds });
  } catch (error: any) {
    console.error("[automation-listener] Error:", error);
    return errorResponse(500, error.message || "Internal error");
  }
});

/**
 * Evaluate a condition object against event data.
 * Supports: equals, contains, starts_with, greater_than, less_than, exists, not_exists
 */
function evaluateCondition(
  condition: { field: string; operator: string; value: any } | null | undefined,
  eventData: Record<string, any>,
): boolean {
  // No condition = always matches
  if (!condition || !condition.field || !condition.operator) return true;

  const { field, operator, value } = condition;

  // Support nested fields with dot notation: "amount" or "data.category"
  const actualValue = field.split(".").reduce((obj: any, key: string) => obj?.[key], eventData);

  switch (operator) {
    case "equals":
      return String(actualValue) === String(value);
    case "not_equals":
      return String(actualValue) !== String(value);
    case "contains":
      return String(actualValue || "").toLowerCase().includes(String(value).toLowerCase());
    case "not_contains":
      return !String(actualValue || "").toLowerCase().includes(String(value).toLowerCase());
    case "starts_with":
      return String(actualValue || "").toLowerCase().startsWith(String(value).toLowerCase());
    case "greater_than":
      return Number(actualValue) > Number(value);
    case "less_than":
      return Number(actualValue) < Number(value);
    case "exists":
      return actualValue !== null && actualValue !== undefined && actualValue !== "";
    case "not_exists":
      return actualValue === null || actualValue === undefined || actualValue === "";
    default:
      console.warn(`[automation-listener] Unknown operator: ${operator}`);
      return false;
  }
}

/**
 * Execute an automation action based on rule configuration.
 */
async function executeAction(
  supabase: any,
  rule: any,
  event: any,
): Promise<void> {
  const { action_type, action_config } = rule;

  if (!action_type || !action_config) {
    console.warn(`[automation-listener] Rule ${rule.id} missing action_type or action_config`);
    return;
  }

  switch (action_type) {
    case "create_task": {
      await supabase.from("tasks").insert({
        user_id: event.user_id,
        workspace_id: event.workspace_id || null,
        title: interpolate(action_config.title || "Nova tarefa", event.event_data),
        description: interpolate(action_config.description || "", event.event_data),
        status: action_config.status || "pending",
        priority: action_config.priority || "medium",
      });
      break;
    }

    case "create_transaction": {
      await supabase.from("finance_transactions").insert({
        user_id: event.user_id,
        workspace_id: event.workspace_id || null,
        description: interpolate(action_config.description || "", event.event_data),
        amount: action_config.amount || 0,
        type: action_config.type || "outflow",
        category: action_config.category || "outros",
        date: new Date().toISOString().split("T")[0],
        source: "automation",
      });
      break;
    }

    case "create_note": {
      await supabase.from("user_data").insert({
        user_id: event.user_id,
        workspace_id: event.workspace_id || null,
        data_type: "notes",
        data: {
          title: interpolate(action_config.title || "Nota automática", event.event_data),
          content: interpolate(action_config.content || "", event.event_data),
          source: "automation",
        },
      });
      break;
    }

    case "send_notification": {
      await supabase.from("notifications").insert({
        user_id: event.user_id,
        title: interpolate(action_config.title || "Automação", event.event_data),
        body: interpolate(action_config.body || "", event.event_data),
        type: "automation",
      });
      break;
    }

    case "send_whatsapp": {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      try {
        await fetch(`${supabaseUrl}/functions/v1/whatsapp-web-proxy`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            action: "send",
            userId: event.user_id,
            ...action_config,
            message: interpolate(action_config.message || "", event.event_data),
          }),
        });
      } catch (e) {
        console.error("[automation-listener] WhatsApp send error:", e);
      }
      break;
    }

    default:
      console.warn(`[automation-listener] Unknown action_type: ${action_type}`);
  }
}

/**
 * Interpolate {{field}} placeholders with event data values.
 */
function interpolate(template: string, data: Record<string, any>): string {
  if (!template) return "";
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path: string) => {
    const value = path.split(".").reduce((obj: any, key: string) => obj?.[key], data);
    return value !== null && value !== undefined ? String(value) : "";
  });
}

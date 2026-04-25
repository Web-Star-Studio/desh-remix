/**
 * @function automation-cron
 * @description Executes scheduled/habit/overdue automation rules server-side (every 5 min via pg_cron)
 * @status active
 * @calledBy pg_cron (every 5 minutes)
 */
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/utils.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  try {
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    const currentDay = now.getUTCDay();
    const todayISO = now.toISOString().split("T")[0];

    // Fetch all enabled rules of types we handle server-side
    const { data: rules, error: rulesErr } = await supabaseAdmin
      .from("automation_rules")
      .select("*")
      .eq("enabled", true)
      .in("trigger_type", ["scheduled", "habit_incomplete", "task_overdue"]);

    if (rulesErr) {
      console.error("[automation-cron] Failed to fetch rules:", rulesErr.message);
      return errorResponse(500, rulesErr.message);
    }

    if (!rules || rules.length === 0) {
      return jsonResponse({ success: true, processed: 0, message: "No active rules" });
    }

    let processed = 0;
    const results: Array<{ rule_id: string; action: string; status: string }> = [];

    for (const rule of rules) {
      try {
        const config = rule.trigger_config || {};
        let shouldFire = false;
        let triggerData: Record<string, unknown> = {};

        if (rule.trigger_type === "scheduled") {
          const mode = config.schedule_mode || (config.interval_hours ? "interval" : "daily");
          const lastExec = rule.last_executed_at ? new Date(rule.last_executed_at).getTime() : 0;

          if (mode === "interval") {
            const intervalMs = (config.interval_hours ?? 24) * 3600000;
            shouldFire = Date.now() - lastExec >= intervalMs;
          } else {
            const targetHour = config.hour ?? 8;
            const targetMinute = config.minute ?? 0;
            const atOrPastTime = currentHour > targetHour || (currentHour === targetHour && currentMinute >= targetMinute);
            const lastRunDate = lastExec ? new Date(lastExec).toISOString().split("T")[0] : "";
            const alreadyRanToday = lastRunDate === todayISO;

            if (atOrPastTime && !alreadyRanToday) {
              if (mode === "weekly" || mode === "custom") {
                const allowedDays: number[] = config.days_of_week ?? [1, 2, 3, 4, 5];
                shouldFire = allowedDays.includes(currentDay);
              } else {
                shouldFire = true;
              }
            }
          }

          if (shouldFire) {
            triggerData = { scheduled: true, schedule_mode: mode, date: todayISO, source: "cron" };
          }
        } else if (rule.trigger_type === "task_overdue") {
          const lastExec = rule.last_executed_at ? new Date(rule.last_executed_at).getTime() : 0;
          const lastRunDate = lastExec ? new Date(lastExec).toISOString().split("T")[0] : "";
          if (lastRunDate === todayISO) continue; // Already ran today

          const minDays = config.days_overdue ?? 1;
          const { data: overdueTasks } = await supabaseAdmin
            .from("tasks")
            .select("id, title, due_date, priority")
            .eq("user_id", rule.user_id)
            .neq("status", "done")
            .lt("due_date", todayISO)
            .order("due_date", { ascending: true })
            .limit(10);

          if (overdueTasks && overdueTasks.length > 0) {
            const task = overdueTasks.find(t => {
              const daysOverdue = Math.floor((Date.now() - new Date(t.due_date!).getTime()) / 86400000);
              return daysOverdue >= minDays;
            });
            if (task) {
              const daysOverdue = Math.floor((Date.now() - new Date(task.due_date!).getTime()) / 86400000);
              shouldFire = true;
              triggerData = { title: task.title, days_overdue: String(daysOverdue), priority: task.priority, source: "cron" };
            }
          }
        } else if (rule.trigger_type === "habit_incomplete") {
          const checkHour = config.check_hour ?? 20;
          if (currentHour < checkHour) continue;

          const lastExec = rule.last_executed_at ? new Date(rule.last_executed_at).getTime() : 0;
          const lastRunDate = lastExec ? new Date(lastExec).toISOString().split("T")[0] : "";
          if (lastRunDate === todayISO) continue;

          const { data: habitsData } = await supabaseAdmin
            .from("user_data")
            .select("data")
            .eq("user_id", rule.user_id)
            .eq("data_type", "habits")
            .order("updated_at", { ascending: false })
            .limit(1)
            .single();

          if (habitsData?.data) {
            const habits = Array.isArray(habitsData.data) ? habitsData.data : (habitsData.data as any).items || [];
            const targetName = (config.habit_name || "").toLowerCase();

            for (const habit of habits) {
              const habitName = (habit.name || habit.title || "").toLowerCase();
              if (targetName && !habitName.includes(targetName)) continue;

              const completedToday = (habit.history || []).includes(todayISO) ||
                (habit.completedDates || []).includes(todayISO) ||
                (habit.progress?.[todayISO] >= (habit.target || 1));

              if (!completedToday) {
                shouldFire = true;
                triggerData = { habit_name: habit.name || habit.title, check_hour: checkHour, source: "cron" };
                break;
              }
            }
          }
        }

        if (shouldFire) {
          // Execute via automation-execute edge function
          const baseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

          const execRes = await fetch(`${baseUrl}/functions/v1/automation-execute`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              rule_id: rule.id,
              user_id: rule.user_id,
              action_type: rule.action_type,
              action_config: rule.action_config,
              trigger_data: triggerData,
              workspace_id: rule.workspace_id,
              source: "cron",
            }),
          });

          const execText = await execRes.text();
          const status = execRes.ok ? "success" : "error";

          // Update execution count
          await supabaseAdmin
            .from("automation_rules")
            .update({
              execution_count: (rule.execution_count || 0) + 1,
              last_executed_at: now.toISOString(),
            })
            .eq("id", rule.id);

          // Log
          await supabaseAdmin.from("automation_logs").insert({
            rule_id: rule.id,
            user_id: rule.user_id,
            trigger_data: triggerData,
            action_result: { source: "cron", status, detail: execText.substring(0, 500) },
            status,
          });

          processed++;
          results.push({ rule_id: rule.id, action: rule.action_type, status });
        }
      } catch (ruleErr) {
        console.error(`[automation-cron] Error processing rule ${rule.id}:`, ruleErr);
        results.push({ rule_id: rule.id, action: rule.action_type, status: "error" });
      }
    }

    console.log(`[automation-cron] Processed ${processed}/${rules.length} rules`);
    return jsonResponse({ success: true, processed, total_rules: rules.length, results, ran_at: now.toISOString() });
  } catch (e: any) {
    console.error("[automation-cron] Error:", e);
    return errorResponse(500, e.message || "Internal error");
  }
});

// TODO: Migrar para edge function — acesso direto ao Supabase
import { useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { useComposioWorkspaceId } from "@/hooks/integrations/useComposioWorkspaceId";
import { useComposioConnection } from "@/hooks/integrations/useComposioConnection";
import type { AutomationRule } from "./useAutomations";

const LOW_SCORE_FIRED_KEY = "desh-automation-low-score-fired";
const SCHEDULED_LAST_RUN_KEY = "desh-automation-scheduled-last";
const COOLDOWN_KEY = "desh-automation-cooldown";
const HABIT_CHECK_KEY = "desh-automation-habit-check";
const OVERDUE_CHECK_KEY = "desh-automation-overdue-check";

/* ── Cooldown / rate-limit helpers ── */
const DEFAULT_MAX_PER_HOUR = 10;

function getCooldownMap(): Record<string, number[]> {
  try { return JSON.parse(localStorage.getItem(COOLDOWN_KEY) || "{}"); } catch { return {}; }
}

function isRateLimited(ruleId: string, maxPerHour = DEFAULT_MAX_PER_HOUR): boolean {
  const map = getCooldownMap();
  const timestamps = (map[ruleId] || []).filter(t => t > Date.now() - 3600000);
  return timestamps.length >= maxPerHour;
}

function recordExecution(ruleId: string) {
  const map = getCooldownMap();
  const timestamps = (map[ruleId] || []).filter(t => t > Date.now() - 3600000);
  timestamps.push(Date.now());
  map[ruleId] = timestamps;
  try { localStorage.setItem(COOLDOWN_KEY, JSON.stringify(map)); } catch {}
}

/* ── Low-score dedup helpers ── */
function getFiredMap(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(LOW_SCORE_FIRED_KEY) || "{}"); } catch { return {}; }
}
function markFired(contactId: string) {
  const map = getFiredMap();
  map[contactId] = Date.now();
  const cutoff = Date.now() - 86400000;
  for (const k of Object.keys(map)) if (map[k] < cutoff) delete map[k];
  try { localStorage.setItem(LOW_SCORE_FIRED_KEY, JSON.stringify(map)); } catch {}
}
function alreadyFired(contactId: string): boolean {
  return !!getFiredMap()[contactId];
}

/* ── Scheduled helpers ── */
function getScheduledLastRun(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(SCHEDULED_LAST_RUN_KEY) || "{}"); } catch { return {}; }
}
function markScheduledRun(ruleId: string) {
  const map = getScheduledLastRun();
  map[ruleId] = Date.now();
  try { localStorage.setItem(SCHEDULED_LAST_RUN_KEY, JSON.stringify(map)); } catch {}
}

export function useAutomationEngine() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { invoke } = useEdgeFn();
  const composioWsId = useComposioWorkspaceId();
  const { isConnected: isComposioConnected } = useComposioConnection();
  const rulesRef = useRef<AutomationRule[]>([]);
  const seenEmailIdsRef = useRef<Set<string>>(new Set());
  const emailPollInitRef = useRef(false);
  const invokeRef = useRef(invoke);
  invokeRef.current = invoke;
  // Workspace-aware invoke ref for composio-proxy calls
  const wsInvokeRef = useRef(<T,>(opts: { fn: string; body: Record<string, any> }) => {
    const body = { ...opts.body, workspace_id: composioWsId, default_workspace_id: composioWsId };
    return invoke<T>({ ...opts, body });
  });
  wsInvokeRef.current = (opts) => {
    const body = { ...opts.body, workspace_id: composioWsId, default_workspace_id: composioWsId };
    return invoke({ ...opts, body });
  };
  const isComposioConnectedRef = useRef(isComposioConnected);
  isComposioConnectedRef.current = isComposioConnected;
  const hasGmail = isComposioConnected("gmail");

  // ── Page Visibility guard: pause intervals when tab is hidden ──
  const isVisibleRef = useRef(!document.hidden);
  useEffect(() => {
    const handler = () => { isVisibleRef.current = !document.hidden; };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  // Keep rules in sync (reduced to every 5min, with visibility guard)
  useEffect(() => {
    if (!user) return;
    const fetchRules = async () => {
      if (!isVisibleRef.current) return; // Skip when tab is hidden
      const { data } = await supabase
        .from("automation_rules")
        .select("*")
        .eq("user_id", user.id)
        .eq("enabled", true);
      rulesRef.current = (data as AutomationRule[]) || [];
    };
    fetchRules();
    const interval = setInterval(fetchRules, 300_000); // 5min (was 1min) — cron handles server-side
    return () => clearInterval(interval);
  }, [user]);

  const executeAction = useCallback(async (rule: AutomationRule, triggerData: Record<string, any>, dryRun = false) => {
    if (!user) return { success: false, message: "Não autenticado" };

    // Rate-limit check (skip for dry-runs)
    if (!dryRun && isRateLimited(rule.id, rule.trigger_config?.max_per_hour ?? DEFAULT_MAX_PER_HOUR)) {
      console.warn(`[AutomationEngine] Rule ${rule.id} rate-limited`);
      return { success: false, message: "Limite de execuções por hora atingido" };
    }

    try {
      const config = rule.action_config;
      const replaceVars = (str: string) =>
        str.replace(/\{\{(\w+)\}\}/g, (_, key) => {
          if (key === "date") return new Date().toLocaleDateString("pt-BR");
          return String(triggerData[key] || "");
        });

      let resultDetail = "";
      let actionSuccess = true;

      if (rule.action_type === "create_task") {
        const dueDate = config.days_until_due
          ? new Date(Date.now() + config.days_until_due * 86400000).toISOString().split("T")[0]
          : undefined;
        const title = replaceVars(config.title || "Tarefa automática");
        if (dryRun) {
          resultDetail = `Criaria tarefa: "${title}" (prioridade: ${config.priority || "medium"})`;
        } else {
          const { data: inserted, error } = await supabase.from("tasks").insert({
            title,
            description: replaceVars(config.description || ""),
            priority: config.priority || "medium",
            status: "todo",
            user_id: user.id,
            ...(dueDate ? { due_date: dueDate } : {}),
          }).select("id").single();
          if (error || !inserted) {
            actionSuccess = false;
            resultDetail = `ERRO ao criar tarefa "${title}": ${error?.message || "sem retorno do banco"}`;
          } else {
            resultDetail = `Tarefa criada e verificada: "${title}" (ID: ${inserted.id})`;
          }
        }
      } else if (rule.action_type === "send_notification") {
        const title = replaceVars(config.title || "Automação");
        const body = replaceVars(config.body || "");
        if (dryRun) {
          resultDetail = `Enviaria notificação: "${title}" — ${body}`;
        } else {
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(title, { body, icon: "/desh-icon.png" });
            resultDetail = `Notificação enviada: "${title}"`;
          } else {
            actionSuccess = false;
            resultDetail = `Notificação não enviada: permissão não concedida pelo navegador`;
          }
        }
      } else if (rule.action_type === "log_xp") {
        resultDetail = "Ação de XP desativada (gamificação removida)";
      } else if (rule.action_type === "add_tag" && triggerData.contact_id) {
        if (dryRun) {
          resultDetail = `Adicionaria tag "${config.tag}" ao contato`;
        } else {
          const { data: contact, error: fetchErr } = await supabase
            .from("contacts")
            .select("tags")
            .eq("id", triggerData.contact_id)
            .single();
          if (fetchErr || !contact) {
            actionSuccess = false;
            resultDetail = `ERRO ao buscar contato: ${fetchErr?.message || "não encontrado"}`;
          } else {
            const tags = [...(contact.tags || []), config.tag].filter(Boolean);
            const { error: updateErr } = await supabase.from("contacts").update({ tags }).eq("id", triggerData.contact_id);
            if (updateErr) {
              actionSuccess = false;
              resultDetail = `ERRO ao adicionar tag: ${updateErr.message}`;
            } else {
              resultDetail = `Tag "${config.tag}" adicionada com sucesso`;
            }
          }
        }
      } else if (rule.action_type === "create_note") {
        const title = replaceVars(config.title || "Nota automática");
        if (dryRun) {
          resultDetail = `Criaria nota: "${title}"`;
        } else {
          const { data: inserted, error } = await supabase.from("user_data").insert({
            user_id: user.id,
            data_type: "notes",
            data: {
              title,
              content: replaceVars(config.content || ""),
              created_by: "automation",
            },
          }).select("id").single();
          if (error || !inserted) {
            actionSuccess = false;
            resultDetail = `ERRO ao criar nota "${title}": ${error?.message || "sem retorno"}`;
          } else {
            resultDetail = `Nota criada e verificada: "${title}" (ID: ${inserted.id})`;
          }
        }
      } else if (rule.action_type === "create_event") {
        const eventDate = new Date(Date.now() + (config.days_offset || 1) * 86400000);
        const title = replaceVars(config.title || "Evento automático");
        if (dryRun) {
          resultDetail = `Criaria evento: "${title}" em ${eventDate.toLocaleDateString("pt-BR")}`;
        } else {
          const { data: inserted, error } = await supabase.from("user_data").insert({
            user_id: user.id,
            data_type: "calendar",
            data: {
              title,
              date: eventDate.toISOString().split("T")[0],
              allDay: true,
              created_by: "automation",
            },
          }).select("id").single();
          if (error || !inserted) {
            actionSuccess = false;
            resultDetail = `ERRO ao criar evento "${title}": ${error?.message || "sem retorno"}`;
          } else {
            resultDetail = `Evento criado e verificado: "${title}" (ID: ${inserted.id})`;
          }
        }
      } else if (rule.action_type === "send_whatsapp") {
        const message = replaceVars(config.message || "Mensagem automática");
        const phone = config.to || config.phone_number || "";
        if (dryRun) {
          resultDetail = `Enviaria WhatsApp para ${phone}: "${message.substring(0, 50)}"`;
        } else {
          if (!phone) {
            actionSuccess = false;
            resultDetail = "ERRO: número de telefone não configurado na ação";
          } else {
            try {
              // Use edge function for dynamic data resolution (tasks, events, etc.)
              const { data: result, error: execError } = await invokeRef.current<any>({
                fn: "automation-execute",
                body: {
                  action_type: "send_whatsapp",
                  action_config: { message: config.message || "Mensagem automática", to: phone },
                  rule_id: rule.id,
                  trigger_data: triggerData,
                },
              });
              if (execError) {
                actionSuccess = false;
                resultDetail = `ERRO ao enviar WhatsApp: ${execError}`;
              } else if (result?.success === false) {
                actionSuccess = false;
                resultDetail = result.message || "ERRO ao enviar WhatsApp";
              } else {
                resultDetail = result?.message || `WhatsApp enviado para ${phone}`;
              }
            } catch (e) { actionSuccess = false; resultDetail = `ERRO ao enviar WhatsApp: ${e}`; }
          }
        }
      } else if (rule.action_type === "pandora_whatsapp") {
        const phone = config.to || config.phone_number || "";
        const prompt = config.prompt || "";
        if (dryRun) {
          resultDetail = `Pandora processaria prompt e enviaria para ${phone}: "${prompt.substring(0, 60)}..."`;
        } else {
          if (!phone) {
            actionSuccess = false;
            resultDetail = "ERRO: número de telefone não configurado na ação";
          } else if (!prompt) {
            actionSuccess = false;
            resultDetail = "ERRO: prompt não configurado na ação";
          } else {
            try {
              const { data: result, error: execError } = await invokeRef.current<any>({
                fn: "automation-execute",
                body: {
                  action_type: "pandora_whatsapp",
                  action_config: { prompt, to: phone },
                  rule_id: rule.id,
                  trigger_data: triggerData,
                },
              });
              if (execError) {
                actionSuccess = false;
                resultDetail = `ERRO Pandora WhatsApp: ${execError}`;
              } else if (result?.success === false) {
                actionSuccess = false;
                resultDetail = result.message || "ERRO ao executar Pandora WhatsApp";
              } else {
                resultDetail = result?.message || `Pandora enviou mensagem para ${phone}`;
              }
            } catch (e) { actionSuccess = false; resultDetail = `ERRO Pandora WhatsApp: ${e}`; }
          }
        }
      } else if (rule.action_type === "send_email") {
        const to = config.to_email || "";
        const subject = replaceVars(config.subject || "Automação DESH");
        const body = replaceVars(config.body || "");
        if (dryRun) {
          resultDetail = `Enviaria e-mail para ${to}: "${subject}"`;
        } else {
          if (!to) { actionSuccess = false; resultDetail = "ERRO: e-mail do destinatário não configurado"; }
          else {
            try {
              if (!isComposioConnectedRef.current("gmail")) { actionSuccess = false; resultDetail = "ERRO: sem conexão Gmail (Composio)"; }
              else {
                const rawMessage = [`To: ${to}`, `Subject: ${subject}`, `Content-Type: text/plain; charset=utf-8`, ``, body].join("\r\n");
                const encodedMessage = btoa(unescape(encodeURIComponent(rawMessage))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
                const { data: result, error: sendErr } = await wsInvokeRef.current<any>({ fn: "composio-proxy", body: { service: "gmail", path: "/gmail/v1/users/me/messages/send", method: "POST", body: { raw: encodedMessage } } });
                if (sendErr || result?.error) { actionSuccess = false; resultDetail = `ERRO ao enviar e-mail: ${sendErr || JSON.stringify(result?.error)}`; }
                else resultDetail = `E-mail enviado para ${to}: "${subject}"`;
              }
            } catch (e) { actionSuccess = false; resultDetail = `ERRO ao enviar e-mail: ${e}`; }
          }
        }
      }

      if (!dryRun) {
        recordExecution(rule.id);

        // Log execution with real status
        const logStatus = actionSuccess ? "success" : "error";
        await supabase.from("automation_logs").insert({
          rule_id: rule.id,
          user_id: user.id,
          trigger_data: triggerData,
          action_result: { action: rule.action_type, status: actionSuccess ? "executed" : "failed", detail: resultDetail },
          status: logStatus,
        } as any);

        // Only update execution count on success
        if (actionSuccess) {
          await supabase
            .from("automation_rules")
            .update({
              execution_count: (rule.execution_count || 0) + 1,
              last_executed_at: new Date().toISOString(),
            } as any)
            .eq("id", rule.id);
        }

        qc.invalidateQueries({ queryKey: ["automation_rules"] });
        qc.invalidateQueries({ queryKey: ["automation_logs"] });
      }

      return { success: actionSuccess, message: resultDetail };
    } catch (err) {
      console.error("Automation execution error:", err);
      if (!dryRun) {
        await supabase.from("automation_logs").insert({
          rule_id: rule.id,
          user_id: user.id,
          trigger_data: triggerData,
          action_result: { error: String(err) },
          status: "error",
        } as any);
      }
      return { success: false, message: String(err) };
    }
  }, [user, qc]);

  // Realtime listeners for triggers
  useEffect(() => {
    if (!user) return;

    const matchRules = (triggerType: string, triggerData: Record<string, any>) => {
      const matching = rulesRef.current.filter(r => r.enabled && r.trigger_type === triggerType);
      for (const rule of matching) {
        const config = rule.trigger_config || {};

        if (triggerType === "email_received" && config.from_contains) {
          if (!triggerData.sender?.toLowerCase().includes(config.from_contains.toLowerCase())) continue;
        }
        if (triggerType === "email_received" && config.subject_contains) {
          if (!triggerData.subject?.toLowerCase().includes(config.subject_contains.toLowerCase())) continue;
        }
        if (triggerType === "email_keyword") {
          const keywords = (config.keywords || "").split(",").map((k: string) => k.trim().toLowerCase()).filter(Boolean);
          if (keywords.length === 0) continue;
          const matchIn = config.match_in || "subject";
          const textToSearch = matchIn === "from" ? (triggerData.sender || "").toLowerCase() : (triggerData.subject || "").toLowerCase();
          if (!keywords.some((kw: string) => textToSearch.includes(kw))) continue;
        }
        if (triggerType === "finance_transaction" && config.min_amount) {
          if ((triggerData.amount || 0) < config.min_amount) continue;
        }
        if (triggerType === "task_created" && config.project_filter) {
          if (!triggerData.project?.toLowerCase().includes(config.project_filter.toLowerCase())) continue;
        }

        executeAction(rule, triggerData);
      }
    };

    const channel = supabase
      .channel("automation-engine")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tasks", filter: `user_id=eq.${user.id}` }, (payload) => {
        const task = payload.new as any;
        matchRules("task_created", { title: task.title, priority: task.priority, project: task.project });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tasks", filter: `user_id=eq.${user.id}` }, (payload) => {
        const task = payload.new as any;
        const old = payload.old as any;
        if (task.status === "done" && old.status !== "done") {
          matchRules("task_completed", { title: task.title, priority: task.priority, project: task.project });
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "contacts", filter: `user_id=eq.${user.id}` }, (payload) => {
        const contact = payload.new as any;
        matchRules("contact_added", { name: contact.name, email: contact.email, contact_id: contact.id });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "finance_transactions", filter: `user_id=eq.${user.id}` }, (payload) => {
        const tx = payload.new as any;
        matchRules("finance_transaction", { amount: tx.amount, description: tx.description, category: tx.category, type: tx.type });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "user_data", filter: `user_id=eq.${user.id}` }, (payload) => {
        const data = payload.new as any;
        if (data.data_type === "notes" && data.data?.created_by !== "automation") {
          matchRules("note_created", { title: data.data?.title || "Nota", content: data.data?.content || "" });
        }
        if (data.data_type === "calendar" && data.data?.created_by !== "automation") {
          matchRules("event_created", { title: data.data?.title || "Evento", date: data.data?.date || "" });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc, executeAction]);

  // Scheduled trigger — now handled by automation-cron server-side.
  // Client-side check kept as fallback only for immediate feedback, reduced to every 5min.
  useEffect(() => {
    if (!user) return;

    const checkScheduled = () => {
      if (!isVisibleRef.current) return; // Skip when tab hidden
      const scheduledRules = rulesRef.current.filter(r => r.enabled && r.trigger_type === "scheduled");
      if (scheduledRules.length === 0) return;

      const lastRuns = getScheduledLastRun();
      const now = Date.now();
      const currentDate = new Date();
      const currentHour = currentDate.getHours();
      const currentMinute = currentDate.getMinutes();
      const currentDay = currentDate.getDay(); // 0=Sun, 6=Sat

      for (const rule of scheduledRules) {
        const config = rule.trigger_config || {};
        const mode = config.schedule_mode || (config.interval_hours ? "interval" : "daily");
        const lastRun = lastRuns[rule.id] || 0;

        if (mode === "interval") {
          const intervalHours = config.interval_hours ?? 24;
          const intervalMs = intervalHours * 3600000;
          if (now - lastRun >= intervalMs) {
            markScheduledRun(rule.id);
            executeAction(rule, { scheduled: true, interval_hours: intervalHours, date: currentDate.toLocaleDateString("pt-BR") });
          }
          continue;
        }

        const targetHour = config.hour ?? 8;
        const targetMinute = config.minute ?? 0;
        const atOrPastTime = currentHour > targetHour || (currentHour === targetHour && currentMinute >= targetMinute);
        if (!atOrPastTime) continue;

        const todayKey = currentDate.toISOString().split("T")[0];
        const lastRunDate = lastRun ? new Date(lastRun).toISOString().split("T")[0] : "";
        if (lastRunDate === todayKey) continue;

        if (mode === "weekly" || mode === "custom") {
          const allowedDays: number[] = config.days_of_week ?? [1, 2, 3, 4, 5];
          if (!allowedDays.includes(currentDay)) continue;
        }

        markScheduledRun(rule.id);
        executeAction(rule, { scheduled: true, schedule_mode: mode, date: currentDate.toLocaleDateString("pt-BR") });
      }
    };

    const timer = setTimeout(checkScheduled, 10000);
    const interval = setInterval(checkScheduled, 5 * 60 * 1000); // 5min (was 1min) — cron is primary
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [user, executeAction]);

  // Habit incomplete — now handled by automation-cron. Client fallback every 30min with visibility guard.
  useEffect(() => {
    if (!user) return;

    const checkHabits = async () => {
      if (!isVisibleRef.current) return;
      const habitRules = rulesRef.current.filter(r => r.enabled && r.trigger_type === "habit_incomplete");
      if (habitRules.length === 0) return;

      const currentHour = new Date().getHours();
      const today = new Date().toISOString().split("T")[0];

      const { data: habitsData } = await supabase
        .from("user_data")
        .select("data")
        .eq("user_id", user.id)
        .eq("data_type", "habits")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (!habitsData?.data) return;

      const habits = Array.isArray(habitsData.data) ? habitsData.data : (habitsData.data as any).items || [];
      const firedToday: Record<string, string> = (() => {
        try { return JSON.parse(localStorage.getItem(HABIT_CHECK_KEY) || "{}"); } catch { return {}; }
      })();

      for (const rule of habitRules) {
        const checkHour = rule.trigger_config?.check_hour ?? 20;
        if (currentHour < checkHour) continue;

        const targetName = (rule.trigger_config?.habit_name || "").toLowerCase();

        for (const habit of habits) {
          const habitName = (habit.name || habit.title || "").toLowerCase();
          if (targetName && !habitName.includes(targetName)) continue;

          const habitId = `${rule.id}_${habit.id || habitName}`;
          if (firedToday[habitId] === today) continue;

          const completedToday = (habit.history || []).includes(today) || 
            (habit.completedDates || []).includes(today) ||
            (habit.progress?.[today] >= (habit.target || 1));

          if (!completedToday) {
            firedToday[habitId] = today;
            try { localStorage.setItem(HABIT_CHECK_KEY, JSON.stringify(firedToday)); } catch {}
            executeAction(rule, { habit_name: habit.name || habit.title, check_hour: checkHour });
          }
        }
      }
    };

    const timer = setTimeout(checkHabits, 15000);
    const interval = setInterval(checkHabits, 30 * 60 * 1000); // 30min (was 10min) — cron is primary
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [user, executeAction]);

  // Task overdue — now handled by automation-cron. Client fallback every 30min with visibility guard.
  useEffect(() => {
    if (!user) return;

    const checkOverdue = async () => {
      if (!isVisibleRef.current) return;
      const overdueRules = rulesRef.current.filter(r => r.enabled && r.trigger_type === "task_overdue");
      if (overdueRules.length === 0) return;

      const today = new Date().toISOString().split("T")[0];
      const firedToday: Record<string, string> = (() => {
        try { return JSON.parse(localStorage.getItem(OVERDUE_CHECK_KEY) || "{}"); } catch { return {}; }
      })();

      const { data: overdueTasks } = await supabase
        .from("tasks")
        .select("id, title, due_date, priority")
        .eq("user_id", user.id)
        .neq("status", "done")
        .lt("due_date", today)
        .order("due_date", { ascending: true })
        .limit(20);

      if (!overdueTasks || overdueTasks.length === 0) return;

      for (const task of overdueTasks) {
        const daysOverdue = Math.floor((Date.now() - new Date(task.due_date!).getTime()) / 86400000);

        for (const rule of overdueRules) {
          const minDays = rule.trigger_config?.days_overdue ?? 1;
          if (daysOverdue < minDays) continue;

          const firedKey = `${rule.id}_${task.id}`;
          if (firedToday[firedKey] === today) continue;

          firedToday[firedKey] = today;
          try { localStorage.setItem(OVERDUE_CHECK_KEY, JSON.stringify(firedToday)); } catch {}
          executeAction(rule, { title: task.title, days_overdue: String(daysOverdue), priority: task.priority });
        }
      }
    };

    const timer = setTimeout(checkOverdue, 20000);
    const interval = setInterval(checkOverdue, 30 * 60 * 1000); // 30min (was 15min)
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [user, executeAction]);

  // Contact low-score trigger
  const fireLowScoreAlert = useCallback(async (contactId: string, contactName: string, score: number, daysSince: number) => {
    if (!user) return;
    if (alreadyFired(contactId)) return;

    const matchingRules = rulesRef.current.filter(r => {
      if (!r.enabled || r.trigger_type !== "contact_low_score") return false;
      const threshold = r.trigger_config?.score_threshold ?? 30;
      return score < threshold;
    });

    if (matchingRules.length === 0) return;

    markFired(contactId);
    const triggerData = {
      contact_id: contactId,
      contact_name: contactName,
      score: String(score),
      days_since: String(daysSince),
    };
    for (const rule of matchingRules) {
      await executeAction(rule, triggerData);
    }
  }, [user, executeAction]);

  // Gmail polling for email_received trigger (with visibility guard)
  useEffect(() => {
    if (!user) return;

    if (!isComposioConnectedRef.current("gmail")) return;

    if (!emailPollInitRef.current) {
      try {
        const stored = localStorage.getItem(`automation_seen_emails_${user.id}`);
        if (stored) seenEmailIdsRef.current = new Set(JSON.parse(stored));
      } catch {}
      emailPollInitRef.current = true;
    }

    const persistSeen = () => {
      try {
        const arr = [...seenEmailIdsRef.current].slice(-200);
        localStorage.setItem(`automation_seen_emails_${user.id}`, JSON.stringify(arr));
      } catch {}
    };

    const pollEmails = async () => {
      if (!isVisibleRef.current) return; // Skip when tab hidden
      const emailRules = rulesRef.current.filter(r => r.enabled && (r.trigger_type === "email_received" || r.trigger_type === "email_keyword"));
      if (emailRules.length === 0) return; // Guard: no email rules → skip

      try {
        const { data, error } = await wsInvokeRef.current<any>({
          fn: "composio-proxy",
          body: {
            service: "gmail",
            path: "/gmail/v1/users/me/messages",
            method: "GET",
            params: { maxResults: "10", q: "is:inbox is:unread" },
          },
        });

        if (error || !data?.messages) return;

        const messages: any[] = data.messages;
        const isFirstPoll = seenEmailIdsRef.current.size === 0;

        if (isFirstPoll) {
          for (const msg of messages) seenEmailIdsRef.current.add(msg.id);
          persistSeen();
          return;
        }

        const newMessages = messages.filter(m => !seenEmailIdsRef.current.has(m.id));
        if (newMessages.length === 0) return;

        for (const msg of newMessages) {
          seenEmailIdsRef.current.add(msg.id);
          const headers = msg.payload?.headers || [];
          const getHeader = (name: string) => headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
          const sender = getHeader("From");
          const subject = getHeader("Subject");

          const matchingRules = emailRules.filter(rule => {
            const config = rule.trigger_config || {};
            if (rule.trigger_type === "email_keyword") {
              const keywords = (config.keywords || "").split(",").map((k: string) => k.trim().toLowerCase()).filter(Boolean);
              if (keywords.length === 0) return false;
              const matchIn = config.match_in || "subject";
              const textToSearch = matchIn === "from" ? sender.toLowerCase() : subject.toLowerCase();
              return keywords.some((kw: string) => textToSearch.includes(kw));
            }
            if (config.from_contains && !sender.toLowerCase().includes(config.from_contains.toLowerCase())) return false;
            if (config.subject_contains && !subject.toLowerCase().includes(config.subject_contains.toLowerCase())) return false;
            return true;
          });

          for (const rule of matchingRules) {
            executeAction(rule, { sender, subject, email_id: msg.id });
          }
        }

        persistSeen();
      } catch (err) {
        console.error("[AutomationEngine] Gmail poll error:", err);
      }
    };

    pollEmails();
    const timer = setInterval(pollEmails, 3 * 60 * 1000); // 3min (was 2min)
    return () => clearInterval(timer);
  }, [user, hasGmail, executeAction]);

  return { fireLowScoreAlert, executeAction };
}

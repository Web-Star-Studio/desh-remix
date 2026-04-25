/**
 * @function automation-execute
 * @description Executes automation actions server-side with dynamic data resolution
 * @status active
 * @calledBy useAutomationEngine (scheduled automations)
 */
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { verifyAuth } from "../_shared/auth.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/utils.ts";

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const EVOLUTION_API_URL = "https://evolution-api-4pkj.onrender.com";

function userInstanceName(userId: string, workspaceId?: string): string {
  const userPart = userId.replace(/-/g, "").slice(0, 8);
  if (workspaceId) {
    const wsPart = workspaceId.replace(/-/g, "").slice(0, 6);
    return `desh_${userPart}_${wsPart}`;
  }
  return `desh_${userPart}`;
}

function normalizeBrazilianNumber(num: string): string {
  const clean = num.replace(/\D/g, "");
  if (clean.length === 12 && clean.startsWith("55")) {
    const ddd = parseInt(clean.slice(2, 4), 10);
    if (ddd >= 11 && ddd <= 99) return clean.slice(0, 4) + "9" + clean.slice(4);
  }
  return clean;
}

function getNumberVariants(num: string): string[] {
  const clean = num.replace(/\D/g, "");
  const variants = new Set<string>();
  variants.add(clean);
  if (clean.length === 13 && clean.startsWith("55")) {
    const ddd = clean.slice(2, 4);
    variants.add("55" + ddd + clean.slice(5));
  }
  if (clean.length === 12 && clean.startsWith("55")) {
    const ddd = parseInt(clean.slice(2, 4), 10);
    if (ddd >= 11 && ddd <= 99) {
      variants.add(clean.slice(0, 4) + "9" + clean.slice(4));
    }
  }
  return Array.from(variants);
}

function getGreeting(): string {
  const hour = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false });
  const h = parseInt(hour, 10);
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const PRIORITY_EMOJI: Record<string, string> = {
  urgent: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
};

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

interface DynamicData {
  tasks: any[];
  events: any[];
  habits: any[];
  financeSummary: { income: number; expense: number };
  userName: string;
}

async function fetchDynamicData(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<DynamicData> {
  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.slice(0, 7) + "-01";

  const [tasksRes, eventsRes, habitsRes, financeRes, profileRes] = await Promise.all([
    // Pending tasks ordered by priority
    supabase
      .from("tasks")
      .select("id,title,priority,due_date,status")
      .eq("user_id", userId)
      .in("status", ["todo", "in_progress"])
      .order("priority", { ascending: true })
      .limit(15),
    // Today's calendar events
    supabase
      .from("user_data")
      .select("id,data")
      .eq("user_id", userId)
      .eq("data_type", "calendar")
      .limit(50),
    // Habits
    supabase
      .from("user_data")
      .select("data")
      .eq("user_id", userId)
      .eq("data_type", "habits")
      .order("updated_at", { ascending: false })
      .limit(1),
    // Finance this month
    supabase
      .from("finance_transactions")
      .select("type,amount")
      .eq("user_id", userId)
      .gte("date", monthStart),
    // Profile
    supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  // Filter events for today
  const allEvents = (eventsRes.data || []).map((e: any) => e.data).filter(Boolean);
  const todayEvents = allEvents.filter((e: any) => {
    const eventDate = e.date || e.start_date || "";
    return eventDate.startsWith(today);
  });

  // Sort events by time
  todayEvents.sort((a: any, b: any) => {
    const timeA = a.start_time || a.time || "99:99";
    const timeB = b.start_time || b.time || "99:99";
    return timeA.localeCompare(timeB);
  });

  // Habits pending today
  const habitsData = habitsRes.data?.[0]?.data;
  const allHabits = Array.isArray(habitsData) ? habitsData : (habitsData as any)?.items || [];
  const pendingHabits = allHabits.filter((h: any) => {
    const completedToday =
      (h.history || []).includes(today) ||
      (h.completedDates || []).includes(today) ||
      (h.progress?.[today] >= (h.target || 1));
    return !completedToday && h.active !== false;
  });

  // Finance summary
  const txs = financeRes.data || [];
  const income = txs.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + (t.amount || 0), 0);
  const expense = txs.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Math.abs(t.amount || 0), 0);

  return {
    tasks: tasksRes.data || [],
    events: todayEvents,
    habits: pendingHabits,
    financeSummary: { income, expense },
    userName: profileRes.data?.display_name || "Usuário",
  };
}

function formatTasks(tasks: any[]): string {
  if (tasks.length === 0) return "✅ Nenhuma tarefa pendente!";
  const lines = tasks.map((t) => {
    const emoji = PRIORITY_EMOJI[t.priority] || "⚪";
    const label = PRIORITY_LABEL[t.priority] || t.priority;
    const due = t.due_date ? ` (${new Date(t.due_date).toLocaleDateString("pt-BR")})` : "";
    return `• ${t.title} — ${emoji} ${label}${due}`;
  });
  return `📝 *Tarefas:*\n${lines.join("\n")}`;
}

function formatEvents(events: any[]): string {
  if (events.length === 0) return "📅 Nenhum evento hoje.";
  const lines = events.map((e) => {
    const time = e.start_time || e.time || (e.allDay ? "Dia todo" : "—");
    const title = e.title || e.label || "Evento";
    return `• ${time} — ${title}`;
  });
  return `📅 *Eventos:*\n${lines.join("\n")}`;
}

function formatHabits(habits: any[]): string {
  if (habits.length === 0) return "💪 Todos os hábitos concluídos!";
  const lines = habits.slice(0, 8).map((h: any) => `• ${h.name || h.title}`);
  return `🎯 *Hábitos pendentes:*\n${lines.join("\n")}`;
}

function formatFinance(summary: { income: number; expense: number }): string {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const balance = summary.income - summary.expense;
  return `💰 *Finanças do mês:*\nReceitas: ${fmt(summary.income)}\nDespesas: ${fmt(summary.expense)}\nSaldo: ${fmt(balance)}`;
}

function resolveDynamicVars(template: string, data: DynamicData, extraVars: Record<string, string> = {}): string {
  let result = template;

  // Dynamic data variables
  result = result.replace(/\{\{tasks_today\}\}/g, formatTasks(data.tasks));
  result = result.replace(/\{\{events_today\}\}/g, formatEvents(data.events));
  result = result.replace(/\{\{habits_pending\}\}/g, formatHabits(data.habits));
  result = result.replace(/\{\{finance_summary\}\}/g, formatFinance(data.financeSummary));
  result = result.replace(/\{\{greeting\}\}/g, getGreeting());
  result = result.replace(/\{\{user_name\}\}/g, data.userName);
  result = result.replace(/\{\{date\}\}/g, new Date().toLocaleDateString("pt-BR"));
  result = result.replace(/\{\{task_count\}\}/g, String(data.tasks.length));
  result = result.replace(/\{\{event_count\}\}/g, String(data.events.length));

  // Extra trigger vars
  for (const [key, value] of Object.entries(extraVars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authResult = await verifyAuth(req);
    if (authResult instanceof Response) {
      return new Response(authResult.body, {
        status: authResult.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, rule_id, action_type, action_config, trigger_data = {}, user_id: bodyUserId, workspace_id: bodyWorkspaceId } = body;

    if (!action_type || !action_config) {
      return errorResponse(400, "action_type e action_config são obrigatórios");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const userId = authResult.userId;

    // Fetch dynamic data
    const dynamicData = await fetchDynamicData(supabase, userId);

    // Build extra vars from trigger_data
    const extraVars: Record<string, string> = {};
    for (const [k, v] of Object.entries(trigger_data)) {
      extraVars[k] = String(v);
    }

    let resultDetail = "";
    let actionSuccess = true;

    if (action_type === "send_whatsapp") {
      const rawMessage = action_config.message || "Mensagem automática";
      const message = resolveDynamicVars(rawMessage, dynamicData, extraVars);
      const phone = normalizeBrazilianNumber((action_config.to || action_config.phone_number || "").replace(/\D/g, ""));

      if (!phone || phone.length < 10) {
        return jsonResponse({ success: false, message: "Número de telefone inválido" });
      }

      // Resolve WhatsApp instance — use bodyWorkspaceId from rule, then CONNECTED, then any session
      let wsId = bodyWorkspaceId;
      if (!wsId) {
        const { data: waSession } = await supabase
          .from("whatsapp_web_sessions")
          .select("workspace_id")
          .eq("user_id", userId)
          .eq("status", "CONNECTED")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        wsId = waSession?.workspace_id;
      }
      if (!wsId) {
        const { data: anySession } = await supabase
          .from("whatsapp_web_sessions")
          .select("workspace_id")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        wsId = anySession?.workspace_id;
      }
      const instanceName = userInstanceName(userId, wsId || undefined);
      const apiKey = Deno.env.get("WHATSAPP_WEB_GATEWAY_SECRET") ?? "";

      // Try sending with number variants
      const variants = getNumberVariants(phone);
      let lastError = "";
      let sent = false;

      for (const variant of variants) {
        const jid = `${variant}@s.whatsapp.net`;
        const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: apiKey },
          body: JSON.stringify({ number: jid, text: message }),
        });
        if (res.ok) {
          sent = true;
          resultDetail = `WhatsApp enviado para ${phone}: "${message.substring(0, 80)}..."`;
          break;
        }
        lastError = await res.text();
        const lower = lastError.toLowerCase();
        if (lower.includes("not registered") || lower.includes("invalid") || lower.includes("not on whatsapp")) {
          continue;
        }
        actionSuccess = false;
        resultDetail = `ERRO ao enviar WhatsApp: ${lastError.substring(0, 150)}`;
        break;
      }

      if (!sent && actionSuccess) {
        actionSuccess = false;
        resultDetail = `Número não registrado no WhatsApp: ${variants.join(", ")}`;
      }
    } else if (action_type === "pandora_whatsapp") {
      // ── Pandora AI → WhatsApp ──
      const prompt = action_config.prompt || "";
      const phone = normalizeBrazilianNumber((action_config.to || "").replace(/\D/g, ""));

      if (!prompt) {
        return jsonResponse({ success: false, message: "Prompt não configurado" });
      }
      if (!phone || phone.length < 10) {
        return jsonResponse({ success: false, message: "Número de telefone inválido" });
      }

      // Build structured context from dynamic data
      const contextLines = [
        `Data: ${new Date().toLocaleDateString("pt-BR")}`,
        `Usuário: ${dynamicData.userName}`,
        ``,
        formatTasks(dynamicData.tasks),
        ``,
        formatEvents(dynamicData.events),
        ``,
        formatHabits(dynamicData.habits),
        ``,
        formatFinance(dynamicData.financeSummary),
      ].join("\n");

      const systemPrompt = `Você é a Pandora, assistente pessoal inteligente do DESH. Responda ao pedido do usuário usando os dados reais dele abaixo.

REGRAS:
- Formate para WhatsApp: use *bold* para destaques, • para listas
- Seja pessoal, calorosa e objetiva
- Use os dados reais — não invente informações
- Máximo 400 palavras
- Comece com uma saudação usando o nome do usuário

DADOS DO USUÁRIO:
${contextLines}`;

      // Call AI Gateway
      const apiKey = Deno.env.get("LOVABLE_API_KEY");
      if (!apiKey) {
        return jsonResponse({ success: false, message: "LOVABLE_API_KEY não configurada" });
      }

      const aiResp = await fetch(AI_GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 1500,
        }),
      });

      if (!aiResp.ok) {
        const errText = await aiResp.text();
        console.error("[automation-execute] AI error:", aiResp.status, errText);
        actionSuccess = false;
        resultDetail = `ERRO na IA: ${aiResp.status}`;
      } else {
        const aiData = await aiResp.json();
        const aiMessage = aiData.choices?.[0]?.message?.content || "Não consegui gerar a mensagem.";

        // Resolve WhatsApp instance — use bodyWorkspaceId from rule, then CONNECTED, then any session
        let wsId2 = bodyWorkspaceId;
        if (!wsId2) {
          const { data: waSession } = await supabase
            .from("whatsapp_web_sessions")
            .select("workspace_id")
            .eq("user_id", userId)
            .eq("status", "CONNECTED")
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          wsId2 = waSession?.workspace_id;
        }
        if (!wsId2) {
          const { data: anySession } = await supabase
            .from("whatsapp_web_sessions")
            .select("workspace_id")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          wsId2 = anySession?.workspace_id;
        }
        const instanceName = userInstanceName(userId, wsId2 || undefined);
        const waApiKey = Deno.env.get("WHATSAPP_WEB_GATEWAY_SECRET") ?? "";

        // Send via WhatsApp with variants
        const variants = getNumberVariants(phone);
        let lastError = "";
        let sent = false;

        for (const variant of variants) {
          const jid = `${variant}@s.whatsapp.net`;
          const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: waApiKey },
            body: JSON.stringify({ number: jid, text: aiMessage }),
          });
          if (res.ok) {
            sent = true;
            resultDetail = `Pandora enviou via WhatsApp para ${phone}`;
            break;
          }
          lastError = await res.text();
          const lower = lastError.toLowerCase();
          if (lower.includes("not registered") || lower.includes("invalid") || lower.includes("not on whatsapp")) {
            continue;
          }
          actionSuccess = false;
          resultDetail = `ERRO ao enviar WhatsApp: ${lastError.substring(0, 150)}`;
          break;
        }

        if (!sent && actionSuccess) {
          actionSuccess = false;
          resultDetail = `Número não registrado no WhatsApp: ${variants.join(", ")}`;
        }
      }
    } else {
      return jsonResponse({ success: false, message: `Ação '${action_type}' não suportada nesta edge function` });
    }

    // Log execution
    if (rule_id) {
      await supabase.from("automation_logs").insert({
        rule_id,
        user_id: userId,
        trigger_data: trigger_data,
        action_result: { action: action_type, status: actionSuccess ? "executed" : "failed", detail: resultDetail },
        status: actionSuccess ? "success" : "error",
      }).then(() => {});

      if (actionSuccess) {
        await supabase
          .from("automation_rules")
          .update({ execution_count: supabase.rpc ? undefined : 0, last_executed_at: new Date().toISOString() })
          .eq("id", rule_id)
          .then(() => {});

        // Increment execution_count via raw update
        const { data: rule } = await supabase.from("automation_rules").select("execution_count").eq("id", rule_id).maybeSingle();
        if (rule) {
          await supabase.from("automation_rules").update({ execution_count: (rule.execution_count || 0) + 1 }).eq("id", rule_id);
        }
      }
    }

    return jsonResponse({ success: actionSuccess, message: resultDetail });
  } catch (error: any) {
    console.error("[automation-execute] Error:", error);
    return errorResponse(500, error.message || "Erro interno");
  }
});

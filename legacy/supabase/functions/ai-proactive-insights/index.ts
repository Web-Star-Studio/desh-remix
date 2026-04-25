/**
 * @function ai-proactive-insights
 * @description Gera insights proativos de IA baseados nos dados do usuário
 * @status active
 * @calledBy Dashboard widgets
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { deductCredits, insufficientCreditsResponse } from "../_shared/credits.ts";
import { corsHeaders } from "../_shared/utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // User client for auth
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await userClient.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      console.error("Auth error:", authError?.message ?? "No claims");
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const user = { id: claimsData.claims.sub };

    // Service client for inserts
    const serviceClient = createClient(supabaseUrl, supabaseKey);
    const userId = user.id;
    const now = new Date();
    const todayISO = now.toISOString().split("T")[0];
    const monthStart = `${todayISO.slice(0, 7)}-01`;

    // Gather user data in parallel
    const [
      { data: overdueTasks },
      { data: dueSoonTasks },
      { data: budgets },
      { data: monthExpenses },
      { data: goals },
      { data: staleContacts },
    ] = await Promise.all([
      // Overdue tasks
      userClient.from("tasks").select("id, title, due_date").neq("status", "done").lt("due_date", todayISO).order("due_date", { ascending: true }).limit(10),
      // Due soon (today + tomorrow)
      userClient.from("tasks").select("id, title, due_date").neq("status", "done").gte("due_date", todayISO).lte("due_date", new Date(now.getTime() + 86400000 * 2).toISOString().split("T")[0]).limit(10),
      // Budgets
      userClient.from("finance_budgets").select("category, monthly_limit"),
      // Month expenses by category
      userClient.from("finance_transactions").select("category, amount").eq("type", "expense").gte("date", monthStart).lte("date", todayISO),
      // Financial goals
      userClient.from("finance_goals").select("name, target, current, color"),
      // Contacts without recent interaction (last interaction > 14 days ago)
      userClient.from("contacts").select("id, name").limit(5),
    ]);

    // Aggregate expenses by category
    const expensesByCategory: Record<string, number> = {};
    (monthExpenses || []).forEach((t: any) => {
      expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + Number(t.amount);
    });

    // Budget analysis
    const budgetAlerts: string[] = [];
    (budgets || []).forEach((b: any) => {
      const spent = expensesByCategory[b.category] || 0;
      const pct = b.monthly_limit > 0 ? Math.round((spent / b.monthly_limit) * 100) : 0;
      if (pct >= 85) budgetAlerts.push(`${b.category}: ${pct}% do orçamento (R$${spent.toFixed(0)} de R$${b.monthly_limit})`);
    });

    // Goal proximity
    const goalAlerts: string[] = [];
    (goals || []).forEach((g: any) => {
      const remaining = Number(g.target) - Number(g.current);
      const pct = g.target > 0 ? Math.round((Number(g.current) / Number(g.target)) * 100) : 0;
      if (pct >= 70 && pct < 100) goalAlerts.push(`Meta "${g.name}": ${pct}% completa, faltam R$${remaining.toFixed(0)}`);
    });

    // Build context for AI
    const contextParts: string[] = [];
    contextParts.push(`Data atual: ${todayISO}, hora: ${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`);

    if ((overdueTasks || []).length > 0) {
      contextParts.push(`Tarefas atrasadas (${overdueTasks!.length}): ${overdueTasks!.map((t: any) => `"${t.title}" (venceu ${t.due_date})`).join(", ")}`);
    }
    if ((dueSoonTasks || []).length > 0) {
      contextParts.push(`Tarefas vencendo em breve (${dueSoonTasks!.length}): ${dueSoonTasks!.map((t: any) => `"${t.title}" (vence ${t.due_date})`).join(", ")}`);
    }
    if (budgetAlerts.length > 0) {
      contextParts.push(`Alertas de orçamento: ${budgetAlerts.join("; ")}`);
    }
    if (goalAlerts.length > 0) {
      contextParts.push(`Metas financeiras próximas: ${goalAlerts.join("; ")}`);
    }

    // If nothing to analyze, return empty (no credit charge)
    if (contextParts.length <= 1) {
      return new Response(JSON.stringify({ insights: [], message: "No actionable data found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduct credits before AI call
    const creditResult = await deductCredits(userId, "ai_proactive");
    if (!creditResult.success) {
      return insufficientCreditsResponse(corsHeaders, creditResult.error || "insufficient_credits");
    }

    // Call AI with tool calling for structured output
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é a DESH AI, assistente pessoal inteligente. Analise os dados do usuário e gere insights proativos e acionáveis. 
Regras:
- Gere no MÁXIMO 5 insights
- Priorize alertas urgentes (tarefas atrasadas, orçamento estourado)
- Seja conciso e direto nas mensagens (max 80 caracteres)
- Use tom motivador e amigável em português brasileiro
- Cada insight deve ter uma ação clara
- Não repita insights óbvios ou triviais`,
          },
          {
            role: "user",
            content: `Analise estes dados do usuário e gere insights proativos:\n\n${contextParts.join("\n")}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_insights",
              description: "Generate proactive insights based on user data analysis",
              parameters: {
                type: "object",
                properties: {
                  insights: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: {
                          type: "string",
                          enum: ["overdue_tasks", "due_soon", "budget_exceeded", "spending_spike", "contact_followup", "habit_streak_risk", "event_prep", "financial_goal", "general"],
                        },
                        severity: { type: "string", enum: ["info", "warning", "success"] },
                        title: { type: "string", description: "Short title, max 40 chars" },
                        message: { type: "string", description: "Descriptive message, max 100 chars" },
                        action_url: { type: "string", description: "App route to navigate (e.g. /tasks, /finances, /contacts)" },
                        icon: { type: "string", enum: ["alert-triangle", "clock", "wallet", "trending-up", "users", "target", "calendar", "piggy-bank", "lightbulb"] },
                      },
                      required: ["type", "severity", "title", "message", "action_url", "icon"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["insights"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_insights" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", status, errText);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ insights: [], message: "No insights generated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let insights: any[] = [];
    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      insights = parsed.insights || [];
    } catch {
      console.error("Failed to parse AI response");
      return new Response(JSON.stringify({ insights: [], message: "Parse error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduplicate: check existing non-dismissed, non-expired insights of same type
    const { data: existing } = await serviceClient
      .from("ai_insights")
      .select("type")
      .eq("user_id", userId)
      .eq("dismissed", false)
      .gt("expires_at", now.toISOString());

    const existingTypes = new Set((existing || []).map((e: any) => e.type));
    const newInsights = insights.filter((i: any) => !existingTypes.has(i.type));

    // Insert new insights
    if (newInsights.length > 0) {
      const rows = newInsights.map((i: any) => ({
        user_id: userId,
        type: i.type,
        severity: i.severity,
        title: i.title,
        message: i.message,
        action_url: i.action_url || null,
        icon: i.icon || "lightbulb",
        dismissed: false,
      }));

      await serviceClient.from("ai_insights").insert(rows);
    }

    return new Response(JSON.stringify({ insights: newInsights, total: insights.length, deduplicated: insights.length - newInsights.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Proactive insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { jsonResponse, errorResponse } from "./utils.ts";
import { deductCredits, insufficientCreditsResponse } from "./credits.ts";
import { corsHeaders } from "./utils.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.3";

export async function handleMorningBriefing(params: any, userId: string) {
  const creditResult = await deductCredits(userId, "morning_briefing", 2);
  if (!creditResult.success) {
    return insufficientCreditsResponse(corsHeaders, creditResult.error || "insufficient_credits");
  }

  const { context } = params;
  const todayISO = new Date().toISOString().split("T")[0];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

  const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const [tasksRes, financeRes, goalsRes] = await Promise.all([
    serviceClient.from("tasks").select("title, status, priority, due_date").eq("user_id", userId).neq("status", "done").order("due_date", { ascending: true, nullsFirst: false }).limit(10),
    serviceClient.from("finance_transactions").select("amount, type, category, description").eq("user_id", userId).gte("date", monthStart).order("date", { ascending: false }).limit(20),
    serviceClient.from("finance_goals").select("name, current, target").eq("user_id", userId).limit(5),
  ]);

  const tasks = tasksRes.data || [];
  const transactions = financeRes.data || [];
  const goals = goalsRes.data || [];

  const overdue = tasks.filter(t => t.due_date && t.due_date < todayISO);
  const dueToday = tasks.filter(t => t.due_date === todayISO);
  const highPri = tasks.filter(t => t.priority === "high");
  const income = transactions.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

  const briefingContext = {
    date: now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    time: now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    overdueTasks: overdue.map(t => t.title),
    todayTasks: dueToday.map(t => t.title),
    highPriorityTasks: highPri.map(t => t.title),
    pendingTasksCount: tasks.length,
    monthBalance: income - expense,
    monthIncome: income,
    monthExpense: expense,
    financialGoals: goals.map(g => ({ name: g.name, progress: Math.round((g.current / g.target) * 100) })),
    ...(context || {}),
  };

  const systemPrompt = `Você é a assistente DESH. Gere um briefing matinal em áudio CURTO e NATURAL para ser lido em voz alta via TTS.

REGRAS CRÍTICAS:
- Máximo 4-5 frases curtas e diretas
- Tom conversacional e encorajador, como uma assistente pessoal falando
- NÃO use markdown, bullets, emojis ou formatação — é para áudio TTS
- NÃO diga "Bom dia" (já é mostrado no header)
- Comece direto com o conteúdo mais importante
- Use linguagem natural: "você tem 3 tarefas hoje" em vez de listas
- Mencione apenas o que é relevante (omita categorias sem dados)
- Termine com uma frase motivacional curta
- Responda APENAS em português brasileiro`;

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return errorResponse(500, "AI not configured");

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Contexto do dia do usuário:\n${JSON.stringify(briefingContext, null, 2)}` },
      ],
    }),
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    console.error("AI gateway error:", aiResponse.status, errText);
    if (aiResponse.status === 429) return errorResponse(429, "Rate limit exceeded");
    return errorResponse(502, "AI generation failed");
  }

  const aiData = await aiResponse.json();
  const briefingText = aiData.choices?.[0]?.message?.content?.trim() || "";

  return jsonResponse({ briefing: briefingText });
}

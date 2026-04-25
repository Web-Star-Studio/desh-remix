import { checkCredits, getApiKey, callAI, aiErrorResponse, jsonRes, parseJsonFromAI } from "./ai-utils.ts";

export async function handleCalendarAI(body: any, userId: string): Promise<Response> {
  const creditCheck = await checkCredits(userId, "ai_calendar");
  if (creditCheck) return creditCheck;

  const apiKey = getApiKey();
  const { action, events, date } = body;

  let systemPrompt = "";
  let userPrompt = "";

  if (action === "daily_summary") {
    systemPrompt = `Você é um assistente de produtividade. Analise os eventos do dia e gere um resumo inteligente em português. Inclua:
- Resumo geral do dia (ocupado/leve/livre)
- Dicas de otimização de agenda (ex: intervalos, conflitos)
- Sugestão de priorização se houver muitos eventos

Responda APENAS em JSON válido: {"summary": "...", "tips": ["dica1", "dica2"], "busy_level": "light|moderate|busy|free"}`;
    userPrompt = `Data: ${date}\nEventos do dia:\n${events.map((e: any) => `- ${e.label} (${e.category || "geral"})`).join("\n") || "Nenhum evento"}`;
  } else if (action === "weekly_summary") {
    systemPrompt = `Você é um assistente de produtividade. Analise os eventos da semana e gere um resumo inteligente em português. Inclua:
- Panorama da semana (dias mais ocupados, dias livres)
- Distribuição por categoria
- Sugestões de balanceamento

Responda APENAS em JSON válido: {"summary": "...", "busiest_day": "...", "tips": ["dica1", "dica2"], "category_distribution": {"categoria": count}}`;
    userPrompt = `Eventos da semana:\n${events.map((e: any) => `- Dia ${e.day}: ${e.label} (${e.category || "geral"})`).join("\n") || "Nenhum evento"}`;
  } else {
    return jsonRes({ error: "Ação inválida" }, 400);
  }

  const response = await callAI(apiKey, [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  if (!response.ok) return aiErrorResponse(response.status);

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || "{}";
  let result;
  try { result = parseJsonFromAI(raw); } catch { result = { error: "Resposta inválida da IA", raw }; }

  return jsonRes({ result });
}

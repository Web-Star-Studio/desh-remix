import { checkCredits, getApiKey, callAI, jsonRes } from "./ai-utils.ts";

export async function handleInboxAI(params: any, userId: string): Promise<Response> {
  const { items, action } = params;

  if (!items || items.length === 0) return jsonRes({ error: "No items provided" }, 400);

  const creditErr = await checkCredits(userId, "ai_inbox");
  if (creditErr) return creditErr;

  const apiKey = getApiKey();

  const itemsSummary = items.slice(0, 40).map((item: any, i: number) =>
    `${i + 1}. id="${item.id}" [${item.type}] "${item.title}" | ${item.subtitle || ""} | prioridade:${item.priority} | ${item.overdue ? "ATRASADO" : ""} | ${item.timestamp}`
  ).join("\n");

  let systemPrompt = "";
  let userPrompt = "";

  if (action === "analyze") {
    systemPrompt = `Você é um assistente de produtividade inteligente. Analise os itens do inbox do usuário e retorne um JSON com:
1. "summary": resumo executivo em 2-3 frases (pt-BR)
2. "urgentAlert": se há algo REALMENTE urgente, uma frase curta de alerta (ou null)
3. "smartGroups": array de grupos contextuais
4. "priorityOverrides": array para itens que deveriam ter prioridade diferente
5. "suggestedActions": array de ações sugeridas
6. "autoTriageLabels": array de labels

Regras:
- Use EXATAMENTE os IDs fornecidos nos campos itemId/itemIds
- Agrupe por projeto, contato, tema ou contexto similar
- Priorize itens atrasados e com deadlines próximos
- Responda APENAS com JSON válido, sem markdown`;

    userPrompt = `Data/hora atual: ${new Date().toISOString()}\n\nAnalise estes ${items.length} itens do meu inbox:\n\n${itemsSummary}`;
  } else if (action === "quickReply") {
    systemPrompt = `Você é um assistente que gera respostas rápidas e profissionais em pt-BR. Retorne um JSON com:
"replies": array de 3 opções de resposta curtas (max 100 chars cada).
Cada reply: { "text": string, "tone": "formal"|"casual"|"assertive" }
Responda APENAS com JSON válido.`;
    userPrompt = `Gere respostas rápidas para: "${items[0]?.title}" - ${items[0]?.subtitle || ""}`;
  } else {
    return jsonRes({ error: "Invalid action" }, 400);
  }

  const response = await callAI(apiKey, [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ], { model: "google/gemini-2.5-flash", temperature: 0.3, maxTokens: 3000 });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI API error:", errorText);
    return jsonRes({ error: "AI analysis failed" }, 500);
  }

  const aiResult = await response.json();
  const content = aiResult.choices?.[0]?.message?.content || "";

  let parsed: any = {};
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch {
    parsed = { summary: "Não foi possível analisar o inbox.", smartGroups: [], suggestedActions: [], priorityOverrides: [], autoTriageLabels: [] };
  }

  return jsonRes(parsed);
}

import { checkCredits, getApiKey, callAI, aiErrorResponse, jsonRes, parseJsonFromAI } from "./ai-utils.ts";

export async function handleWeekPlannerAI(body: any, userId: string): Promise<Response> {
  const creditCheck = await checkCredits(userId, "ai_week_planner");
  if (creditCheck) return creditCheck;

  const apiKey = getApiKey();
  const { pendingTasks, weekEvents, weekDays } = body;

  const systemPrompt = `Você é um assistente especialista em produtividade e gestão do tempo. 
Sua tarefa é analisar as tarefas pendentes e os eventos da semana para sugerir a melhor distribuição das tarefas nos slots de tempo livre.

Regras:
- Respeite os eventos já existentes (não sobreponha)
- Priorize tarefas de prioridade "high" > "medium" > "low"
- Use duração estimada: alta prioridade = 90min, média = 60min, baixa = 30min (exceto se tiver estimativa)
- Trabalhe dentro do horário 08:00–19:00
- Prefira manhãs para tarefas de alta prioridade
- Deixe pelo menos 15min de intervalo entre blocos
- Distribua bem ao longo da semana, não concentre tudo em um dia
- Se não couber tudo, priorize as mais importantes

Responda APENAS em JSON válido com este formato exato:
{
  "suggestions": [{ "taskId": "...", "taskTitle": "...", "day": 0, "dayLabel": "Segunda", "date": "2024-01-15", "startTime": "09:00", "endTime": "10:30", "priority": "high", "reason": "..." }],
  "unscheduled": [{ "taskId": "...", "taskTitle": "...", "reason": "..." }],
  "weekInsight": "..."
}`;

  const userPrompt = `Semana: ${weekDays.map((d: string, i: number) => `Dia ${i} (${d})`).join(", ")}

TAREFAS PENDENTES (${pendingTasks.length}):
${pendingTasks.map((t: any) => `- ID:${t.id} | "${t.title}" | Prioridade:${t.priority} | Vence:${t.due_date || "sem prazo"} | Projeto:${t.project || "geral"}`).join("\n")}

EVENTOS JÁ AGENDADOS NA SEMANA:
${weekEvents.length === 0 ? "Nenhum evento" : weekEvents.map((e: any) => `- Dia ${e.dayIndex} (${e.dayLabel}): ${e.title} | ${e.startTime || "dia todo"}${e.endTime ? `–${e.endTime}` : ""}`).join("\n")}

Distribua as tarefas pendentes nos slots livres da semana.`;

  const response = await callAI(apiKey, [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ], { temperature: 0.3 });

  if (!response.ok) return aiErrorResponse(response.status);

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || "{}";
  let result;
  try { result = parseJsonFromAI(raw); } catch { result = { error: "Resposta inválida da IA", raw }; }

  return jsonRes({ result });
}

import { checkCredits, getApiKey, callAI, aiErrorResponse, jsonRes, parseJsonFromAI } from "./ai-utils.ts";

export async function handleTasksAI(body: any, userId: string): Promise<Response> {
  const creditCheck = await checkCredits(userId, "ai_tasks");
  if (creditCheck) return creditCheck;

  const apiKey = getApiKey();
  const { action, task, tasks: allTasks } = body;

  let systemPrompt = "";
  let userPrompt = "";

  if (action === "suggest_priority") {
    systemPrompt = `Você é um assistente de produtividade. Analise a tarefa e sugira:
- **Prioridade**: low, medium ou high
- **Projeto sugerido**: uma categoria curta (1-2 palavras) ou null
- **Estimativa de tempo**: quanto tempo levaria (ex: "30min", "2h", "1 dia")
- **Data sugerida**: se faz sentido, sugira uma data no formato YYYY-MM-DD baseado na urgência. Use a data de hoje como referência: ${new Date().toISOString().split("T")[0]}. Se não fizer sentido, retorne null.

Responda APENAS em JSON válido: {"priority": "medium", "project": "Trabalho", "estimate": "1h", "suggested_due": "2026-02-21"}`;
    userPrompt = `Tarefa: "${task.title}"`;
  } else if (action === "break_into_subtasks") {
    systemPrompt = `Você é um assistente de produtividade. Quebre a tarefa abaixo em subtarefas menores e acionáveis.

Diretrizes:
- Gere entre 3 e 7 subtarefas
- Cada subtarefa deve ser específica e acionável
- Ordene de forma lógica (o que fazer primeiro)
- Seja conciso (máximo 10 palavras por subtarefa)

Responda APENAS em JSON válido: {"subtasks": ["Subtarefa 1", "Subtarefa 2", ...]}`;
    userPrompt = `Tarefa: "${task.title}"${task.description ? `\nDescrição: ${task.description}` : ""}`;
  } else if (action === "plan_day") {
    systemPrompt = `Você é um planejador de produtividade expert. Analise as tarefas pendentes e crie um plano otimizado para o dia.

Diretrizes:
- Priorize tarefas urgentes/atrasadas
- Agrupe por contexto/projeto quando possível  
- Sugira ordem de execução com blocos de tempo
- Identifique quick wins (tarefas rápidas para fazer primeiro)
- Máximo 8-10 tarefas no plano diário

Responda APENAS em JSON válido:
{"plan": [{"id": "task-id", "title": "nome", "suggested_time": "09:00", "duration": "30min", "reason": "motivo curto"}], "tips": "dica de produtividade do dia"}`;
    userPrompt = `Tarefas pendentes:\n${JSON.stringify(allTasks || [], null, 2)}`;
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

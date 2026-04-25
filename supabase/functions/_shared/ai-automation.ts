import { checkCredits, getApiKey, callAI, aiErrorResponse, jsonRes } from "./ai-utils.ts";

const TRIGGER_TYPES = ["email_received","email_keyword","task_created","task_completed","task_overdue","event_created","contact_added","contact_low_score","finance_transaction","habit_incomplete","note_created","scheduled","whatsapp_received"];
const ACTION_TYPES = ["create_task","send_notification","add_tag","create_note","create_event","send_whatsapp"];

export async function handleAutomationAI(body: any, userId: string): Promise<Response> {
  const creditCheck = await checkCredits(userId, "ai_automation", 1);
  if (creditCheck) return creditCheck;

  const { prompt } = body;
  if (!prompt || typeof prompt !== "string") {
    return jsonRes({ error: "Prompt is required" }, 400);
  }

  const apiKey = getApiKey();

  const systemPrompt = `Você é a Pandora, assistente de IA do DESH — um dashboard pessoal completo com módulos de email, tarefas, contatos (CRM), finanças, hábitos, notas, calendário, WhatsApp e mais.

Sua tarefa é converter uma descrição em linguagem natural em uma configuração de automação IFTTT válida.

GATILHOS DISPONÍVEIS:
- email_received: Quando email chega. Config: { from_contains?, subject_contains? }
- email_keyword: Email com palavra-chave. Config: { keywords: "word1,word2", match_in: "subject"|"from" }
- task_created: Tarefa criada. Config: { project_filter? }
- task_completed: Tarefa concluída. Config: {}
- task_overdue: Tarefa atrasada. Config: { days_overdue: number }
- event_created: Evento criado. Config: {}
- contact_added: Contato adicionado. Config: {}
- contact_low_score: Contato com score baixo (CRM). Config: { score_threshold: number }
- finance_transaction: Transação financeira. Config: { min_amount?: number }
- habit_incomplete: Hábito não completado. Config: { habit_name?, check_hour?: number (8-22) }
- note_created: Nota criada. Config: {}
- scheduled: Agendamento. Config: { interval_hours: 1|6|12|24|168 }
- whatsapp_received: Mensagem WhatsApp recebida. Config: { from_contains? }

AÇÕES DISPONÍVEIS:
- create_task: Config: { title, description?, priority: "low"|"medium"|"high"|"urgent", days_until_due? }
- send_notification: Config: { title, body }
- add_tag: Config: { tag }
- create_note: Config: { title, content? }
- create_event: Config: { title, days_offset? }
- send_whatsapp: Config: { to?, message }

VARIÁVEIS DINÂMICAS: {{contact_name}}, {{score}}, {{days_since}}, {{sender}}, {{subject}}, {{title}}, {{amount}}, {{description}}, {{date}}, {{habit_name}}, {{days_overdue}}, {{message}}

REGRAS:
1. Retorne APENAS JSON válido, sem markdown nem explicação
2. JSON: { name, trigger_type, trigger_config, action_type, action_config }
3. Use nomes descritivos em português com emojis relevantes
Responda APENAS com o JSON.`;

  const response = await callAI(apiKey, [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt },
  ], { model: "google/gemini-2.5-flash", temperature: 0.3 });

  if (!response.ok) return aiErrorResponse(response.status);

  const aiResult = await response.json();
  const content = aiResult.choices?.[0]?.message?.content;
  if (!content) return jsonRes({ error: "Empty AI response" }, 500);

  let automation;
  try {
    automation = JSON.parse(content);
  } catch {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) automation = JSON.parse(jsonMatch[0]);
    else throw new Error("Invalid JSON from AI");
  }

  if (!TRIGGER_TYPES.includes(automation.trigger_type)) {
    automation.trigger_type = "scheduled";
    automation.trigger_config = { interval_hours: 24 };
  }
  if (!ACTION_TYPES.includes(automation.action_type)) {
    automation.action_type = "send_notification";
    automation.action_config = { title: automation.name || "Automação", body: "Ação configurada via IA" };
  }

  return jsonRes(automation);
}

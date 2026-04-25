import { checkCredits, getApiKey, callAI, aiErrorResponse, jsonRes } from "./ai-utils.ts";

export async function handleMessagesAI(params: any, userId: string): Promise<Response> {
  const creditErr = await checkCredits(userId, "ai_messages");
  if (creditErr) return creditErr;

  const apiKey = getApiKey();
  const { action, conversation } = params;

  let systemPrompt = "";
  let userPrompt = "";

  if (action === "summarize") {
    systemPrompt = `Você é um assistente inteligente de mensagens. Gere um resumo conciso da conversa abaixo em português brasileiro.
Destaque:
- **Tema principal**: sobre o que estão falando
- **Decisões tomadas**: o que foi combinado (se houver)
- **Pendências**: o que ficou em aberto

Seja direto, máximo 4-5 linhas. Use markdown leve.`;
    userPrompt = `Conversa "${conversation.name}" (${conversation.platform}):\n\n${conversation.messages.map((m: any) => `${m.sender}: ${m.text}`).join("\n")}`;
  } else if (action === "suggest_reply") {
    systemPrompt = `Você é um assistente inteligente de mensagens. Gere uma sugestão de resposta natural e contextual em português brasileiro.

Diretrizes:
- Tom casual e amigável (conversa de mensagem, não e-mail)
- Responda ao contexto mais recente
- Seja conciso (1-3 linhas)
- NÃO use saudação ou despedida formal
- Retorne apenas o texto da mensagem, sem markdown`;
    userPrompt = `Conversa "${conversation.name}" (${conversation.platform}):\n\n${conversation.messages.map((m: any) => `${m.sender}: ${m.text}`).join("\n")}`;
  } else if (action === "translate") {
    const targetLang = conversation.targetLang || "inglês";
    systemPrompt = `Você é um tradutor profissional. Traduza a mensagem abaixo para ${targetLang}.
- Mantenha o tom e estilo original
- Retorne APENAS a tradução, sem explicações`;
    userPrompt = conversation.messageText || "";
  } else if (action === "improve") {
    systemPrompt = `Você é um assistente de escrita. Melhore a mensagem abaixo mantendo o significado original.
- Corrija erros gramaticais e de pontuação
- Melhore a clareza e fluidez
- Mantenha o tom original
- Retorne APENAS a mensagem melhorada, sem explicações`;
    userPrompt = conversation.messageText || "";
  } else {
    return jsonRes({ error: "Ação inválida" }, 400);
  }

  const response = await callAI(apiKey, [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  if (!response.ok) return aiErrorResponse(response.status);

  const data = await response.json();
  const result = data.choices?.[0]?.message?.content || "Não foi possível processar.";
  return jsonRes({ result });
}

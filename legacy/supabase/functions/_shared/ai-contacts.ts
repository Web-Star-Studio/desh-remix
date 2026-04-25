import { checkCredits, getApiKey, callAI, aiErrorResponse, jsonRes, parseJsonFromAI } from "./ai-utils.ts";

export async function handleContactsAI(params: any, userId: string): Promise<Response> {
  const creditErr = await checkCredits(userId, "ai_contacts");
  if (creditErr) return creditErr;

  const apiKey = getApiKey();
  const { action, contact, contacts } = params;

  let systemPrompt = "";
  let userPrompt = "";

  if (action === "enrich") {
    systemPrompt = `Você é um assistente de CRM inteligente. Dado um contato, enriqueça os dados:
- Sugira um cargo provável baseado no nome/empresa
- Sugira 3-5 tags relevantes (1-2 palavras cada)
- Sugira uma nota inicial sobre o contato

Responda APENAS em JSON válido: {"role": "Gerente de Projetos", "tags": ["cliente", "tech"], "note": "Contato principal na empresa X"}`;
    userPrompt = `Nome: "${contact.name}"${contact.company ? `\nEmpresa: ${contact.company}` : ""}${contact.email ? `\nE-mail: ${contact.email}` : ""}`;
  } else if (action === "suggest_tags") {
    systemPrompt = `Analise o contato e sugira 3-5 tags relevantes e curtas.
Responda APENAS em JSON válido: {"tags": ["tag1", "tag2"]}`;
    userPrompt = `Nome: "${contact.name}"${contact.company ? ` | Empresa: ${contact.company}` : ""}${contact.role ? ` | Cargo: ${contact.role}` : ""}`;
  } else if (action === "find_duplicates") {
    systemPrompt = `Analise a lista de contatos e identifique possíveis duplicatas baseado em nomes similares, mesmos e-mails ou telefones.
Responda APENAS em JSON válido: {"duplicates": [{"ids": ["id1", "id2"], "reason": "Nomes similares"}]}
Se não houver duplicatas, retorne: {"duplicates": []}`;
    userPrompt = `Contatos:\n${JSON.stringify(contacts?.slice(0, 50) || [], null, 2)}`;
  } else if (action === "summarize_interactions") {
    systemPrompt = `Resuma o histórico de interações com este contato em 2-3 frases. Destaque pontos importantes e sugira próximos passos.
Responda APENAS em JSON válido: {"summary": "resumo aqui", "next_steps": "sugestão de próximo passo"}`;
    userPrompt = `Contato: ${contact.name}\nInterações:\n${JSON.stringify(contact.interactions || [], null, 2)}`;
  } else if (action === "suggest_next_action") {
    systemPrompt = `Você é um assistente de relacionamento. Com base nos dados do contato e seu histórico, sugira a próxima ação concreta.
Responda APENAS em JSON válido: {"suggestion": "sua sugestão aqui", "urgency": "low|medium|high", "type": "email|call|meeting|message"}`;
    userPrompt = `Contato: ${contact.name}${contact.company ? ` | Empresa: ${contact.company}` : ""}${contact.role ? ` | Cargo: ${contact.role}` : ""}${contact.tags?.length ? ` | Tags: ${contact.tags.join(", ")}` : ""}
Última interação: ${contact.last_interaction || "nunca"}
Histórico recente:\n${JSON.stringify(contact.interactions || [], null, 2)}`;
  } else if (action === "suggest_followup") {
    systemPrompt = `Você é um assistente de CRM especializado em relacionamentos profissionais.
Um contato não foi contactado há mais de 30 dias. Sugira uma mensagem personalizada e calorosa para retomar o contato.
Responda APENAS em JSON válido: {
  "subject": "assunto sugerido",
  "message": "texto da mensagem sugerida (2-4 frases)",
  "channel": "email|whatsapp|linkedin|phone",
  "urgency": "low|medium|high",
  "reason": "por que agora é um bom momento"
}`;
    const daysSince = contact.days_since_last_interaction || "desconhecido";
    userPrompt = `Contato: ${contact.name}${contact.company ? ` | Empresa: ${contact.company}` : ""}${contact.role ? ` | Cargo: ${contact.role}` : ""}${contact.email ? ` | E-mail: ${contact.email}` : ""}
Dias sem contato: ${daysSince}
Última interação: ${contact.last_interaction || "nunca registrada"}
Histórico recente:\n${JSON.stringify(contact.interactions?.slice(0, 5) || [], null, 2)}`;
  } else {
    return jsonRes({ error: "Ação inválida" }, 400);
  }

  // Retry with model fallback
  const models = ["openai/gpt-5-nano", "google/gemini-2.5-flash-lite", "google/gemini-2.5-flash"];
  let response: Response | null = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 1500));

      response = await callAI(apiKey, [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ], { model });

      if (response.ok) break;

      const status = response.status;
      const t = await response.text();
      console.error(`AI gateway error (${model}, attempt ${attempt + 1}):`, status, t);

      if (status === 429 || status === 402) return aiErrorResponse(status);
    }
    if (response?.ok) break;
  }

  if (!response || !response.ok) return jsonRes({ error: "Erro no serviço de IA. Tente novamente." }, 500);

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || "{}";
  let result;
  try {
    result = parseJsonFromAI(raw);
  } catch {
    result = { error: "Resposta inválida da IA", raw };
  }

  return jsonRes({ result });
}

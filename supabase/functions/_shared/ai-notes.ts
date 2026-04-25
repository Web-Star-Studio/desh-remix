import { checkCredits, getApiKey, callAI, aiErrorResponse, jsonRes, parseJsonFromAI } from "./ai-utils.ts";

export async function handleNotesAI(body: any, userId: string): Promise<Response> {
  const { action, text, title, tone, prompt, selectedText } = body;
  const inputText = selectedText || text;

  // Transcription summary action
  if (action === "transcription_summary") {
    const creditCheck = await checkCredits(userId, "ai_notes");
    if (creditCheck) return creditCheck;
    const apiKey = getApiKey();

    const sysPrompt = `Você é um assistente especializado em atas de reunião. Analise a transcrição abaixo e gere um resumo estruturado em HTML.

A transcrição pode conter marcadores de falantes no formato "[Participante N]: texto". Use essas marcações para:
- Atribuir falas a cada participante no resumo
- Identificar quem disse o quê nos pontos-chave
- Identificar quem ficou responsável por cada próximo passo

Retorne APENAS um JSON válido com esta estrutura:
{
  "title": "título curto da reunião (máx 60 chars)",
  "summary": "<h3>Resumo Executivo</h3><p>...</p><h3>Participantes</h3><ul><li>Participante 1</li></ul><h3>Pontos-Chave</h3><ul><li>...</li></ul><h3>Decisões</h3><ul><li>...</li></ul><h3>Próximos Passos</h3><ul data-type=\\"taskList\\"><li data-type=\\"taskItem\\" data-checked=\\"false\\"><label><input type=\\"checkbox\\"><span>...</span></label></li></ul>"
}

Regras:
- O título deve ser descritivo e curto
- O resumo executivo deve ter 2-3 frases
- Se houver múltiplos participantes, liste-os
- Nos próximos passos, indique o responsável
- Use HTML válido compatível com TipTap
- Responda em português brasileiro`;

    const resp = await callAI(apiKey, [
      { role: "system", content: sysPrompt },
      { role: "user", content: text },
    ]);

    if (!resp.ok) return aiErrorResponse(resp.status);
    const aiData = await resp.json();
    const raw = aiData.choices?.[0]?.message?.content || "";
    try {
      const parsed = parseJsonFromAI(raw);
      return jsonRes({ result: parsed });
    } catch {
      return jsonRes({ result: { title: "Transcrição", summary: raw } });
    }
  }

  const creditCheck = await checkCredits(userId, "ai_notes");
  if (creditCheck) return creditCheck;
  const apiKey = getApiKey();

  let systemPrompt = "";
  let userPrompt = "";

  const actionPrompts: Record<string, [string, string]> = {
    summarize: [`Você é um assistente de notas. Resuma o texto abaixo de forma concisa e clara em português, mantendo os pontos principais. Use HTML para formatar. Responda APENAS com o resumo.`, inputText],
    expand: [`Você é um assistente de escrita. Expanda o texto abaixo, adicionando mais detalhes, exemplos e explicações. Mantenha o tom original. Use HTML. Responda APENAS com o texto expandido.`, inputText],
    correct: [`Você é um revisor de texto profissional. Corrija erros de gramática, ortografia e pontuação no texto abaixo. Mantenha o significado e estilo originais. Use HTML. Responda APENAS com o texto corrigido.`, inputText],
    proofread: [`Você é um revisor de texto profissional. Revise o texto abaixo, corrigindo erros. Coloque em <strong> as palavras/frases que você alterou. Use HTML. Responda APENAS com o texto revisado.`, inputText],
    rewrite: [`Você é um assistente de escrita. Reescreva completamente o texto abaixo, melhorando clareza, fluidez e estrutura, mantendo informações. Use HTML. Responda APENAS com o texto reescrito.`, inputText],
    translate: [`Você é um tradutor profissional. Traduza o texto para inglês se estiver em português, ou para português se estiver em inglês. Use HTML. Responda APENAS com a tradução.`, inputText],
    generate_from_title: [`Você é um assistente de escrita criativa. Dado o título de uma nota, gere um conteúdo inicial relevante e útil em HTML. Inclua subtítulos, listas ou outras formatações. Responda APENAS com o conteúdo gerado.`, `Título: "${title}"`],
    generate_outline: [`Você é um assistente de organização. Analise o texto e gere um outline/esboço estruturado com tópicos e subtópicos. Use HTML. Responda APENAS com o outline.`, inputText || `Título: "${title}"`],
    continue_writing: [`Você é um assistente de escrita. Continue escrevendo o texto abaixo de forma natural e coerente, mantendo estilo e tom. Adicione 2-3 parágrafos. Use HTML. Responda APENAS com a continuação (não repita o original).`, inputText],
    key_points: [`Você é um assistente analítico. Extraia os 5-10 pontos principais do texto. Retorne como HTML com lista (<ul><li>). Cada ponto deve ser curto e objetivo. Responda APENAS com a lista.`, inputText],
    to_list: [`Você é um assistente de organização. Converta o texto corrido em lista estruturada com marcadores. Use HTML. Agrupe itens relacionados sob subtítulos se fizer sentido. Responda APENAS com a lista.`, inputText],
    to_table: [`Você é um assistente de dados. Converta as informações do texto em tabela HTML. Use <table>, <thead>, <tbody>, <tr>, <th>, <td>. Responda APENAS com a tabela.`, inputText],
  };

  if (action === "suggest_tags") {
    systemPrompt = `Analise o título e conteúdo da nota e sugira 3-5 tags relevantes e curtas (1-2 palavras cada). Responda APENAS em JSON válido: {"tags": ["tag1", "tag2", "tag3"]}`;
    userPrompt = `Título: "${title}"\nConteúdo: ${inputText?.slice(0, 500) || "(vazio)"}`;
  } else if (action === "change_tone") {
    const toneMap: Record<string, string> = {
      formal: "formal e profissional", casual: "casual e descontraído", academic: "acadêmico e técnico",
      creative: "criativo e literário", concise: "conciso e direto ao ponto",
    };
    systemPrompt = `Você é um assistente de escrita. Reescreva o texto em tom ${toneMap[tone] || toneMap["formal"]}. Mantenha o conteúdo. Use HTML. Responda APENAS com o texto reescrito.`;
    userPrompt = inputText;
  } else if (action === "compose") {
    systemPrompt = `Você é um assistente de escrita criativo e versátil. Siga a instrução do usuário para gerar novo conteúdo. Use HTML. Responda APENAS com o conteúdo gerado.`;
    const context = inputText ? `\n\nContexto da nota:\n${inputText}` : "";
    userPrompt = `Instrução: ${prompt}${context}`;
  } else if (actionPrompts[action]) {
    [systemPrompt, userPrompt] = actionPrompts[action];
  } else {
    return jsonRes({ error: "Ação inválida" }, 400);
  }

  const response = await callAI(apiKey, [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  if (!response.ok) return aiErrorResponse(response.status);

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || "";

  if (action === "suggest_tags") {
    try {
      const result = parseJsonFromAI(raw);
      return jsonRes({ result });
    } catch {
      return jsonRes({ result: { tags: [] } });
    }
  }

  return jsonRes({ result: { text: raw } });
}

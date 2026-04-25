import { checkCredits, getApiKey, callAI, aiErrorResponse, jsonRes, parseToolCallResult } from "./ai-utils.ts";

export async function handleSocialAI(params: any, userId: string): Promise<Response> {
  const { action, data } = params;

  const creditAction = action === "weekly_report" ? "social_analytics" : "ai_chat";
  const creditErr = await checkCredits(userId, creditAction);
  if (creditErr) return creditErr;

  const apiKey = getApiKey();

  let systemPrompt = "";
  let userPrompt = "";
  let useToolCalling = false;
  let tools: any[] = [];
  let toolChoice: any = undefined;

  if (action === "weekly_report") {
    systemPrompt = `Você é um analista de redes sociais. Analise os dados fornecidos e gere um relatório semanal executivo em português (pt-BR). Inclua: Resumo Geral, Melhor Post, Pior Post, Melhores Horários, Recomendações, Tendências. Formate com Markdown.`;
    userPrompt = `Dados da semana:\n\n${JSON.stringify(data, null, 2)}`;
  } else if (action === "content_generation") {
    systemPrompt = data.system || "Você é um especialista em marketing digital e copywriting para redes sociais. Gere textos envolventes, autênticos e otimizados para engajamento. Sempre em português brasileiro.";
    userPrompt = data.prompt || "";
  } else if (action === "smart_reply") {
    systemPrompt = `Você é um community manager profissional. Gere 3 opções de resposta para o comentário abaixo. Cada resposta máx 280 chars, em português. Retorne APENAS um JSON array: [{"label": "tipo", "text": "resposta"}]`;
    userPrompt = `Comentário de @${data.author}: "${data.comment}"\nContexto do post: "${data.postContext ?? ""}"\nPlataforma: ${data.platform}`;
  } else if (action === "smart_schedule") {
    useToolCalling = true;
    systemPrompt = `Você é um especialista em social media analytics. Analise o histórico de posts e métricas para determinar os melhores horários de postagem por plataforma.`;
    userPrompt = `Dados dos posts e métricas:\n\n${JSON.stringify(data, null, 2)}\n\nAnalise e sugira os melhores horários.`;
    tools = [{
      type: "function",
      function: {
        name: "suggest_schedule",
        description: "Sugere os melhores horários de postagem por plataforma",
        parameters: {
          type: "object",
          properties: {
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  platform: { type: "string" },
                  best_times: { type: "array", items: { type: "object", properties: { day: { type: "number" }, hour: { type: "number" }, score: { type: "number" }, reason: { type: "string" } }, required: ["day", "hour", "score", "reason"], additionalProperties: false } },
                  frequency: { type: "string" },
                  insight: { type: "string" },
                },
                required: ["platform", "best_times", "frequency", "insight"],
                additionalProperties: false,
              },
            },
            general_tips: { type: "array", items: { type: "string" } },
          },
          required: ["recommendations", "general_tips"],
          additionalProperties: false,
        },
      },
    }];
    toolChoice = { type: "function", function: { name: "suggest_schedule" } };
  } else if (action === "predict_performance") {
    useToolCalling = true;
    systemPrompt = `Você é um analista de dados de redes sociais. Preveja o desempenho esperado do conteúdo proposto.`;
    userPrompt = `Conteúdo proposto:\n${data.content}\n\nPlataformas: ${(data.platforms || []).join(", ")}\nHorário: ${data.scheduledFor || "agora"}\nMídia: ${data.mediaCount || 0} itens\n\nHistórico:\n${JSON.stringify(data.history || [], null, 2)}`;
    tools = [{
      type: "function",
      function: {
        name: "predict_performance",
        description: "Prevê métricas de performance do post",
        parameters: {
          type: "object",
          properties: {
            overall_score: { type: "number" },
            confidence: { type: "number" },
            predicted_metrics: {
              type: "object",
              properties: {
                reach_estimate: { type: "string" },
                engagement_rate: { type: "string" },
                likes_estimate: { type: "string" },
                comments_estimate: { type: "string" },
                shares_estimate: { type: "string" },
              },
              required: ["reach_estimate", "engagement_rate", "likes_estimate", "comments_estimate", "shares_estimate"],
              additionalProperties: false,
            },
            strengths: { type: "array", items: { type: "string" } },
            weaknesses: { type: "array", items: { type: "string" } },
            suggestions: { type: "array", items: { type: "string" } },
            best_platform: { type: "string" },
            viral_potential: { type: "string", enum: ["baixo", "médio", "alto", "viral"] },
          },
          required: ["overall_score", "confidence", "predicted_metrics", "strengths", "weaknesses", "suggestions", "best_platform", "viral_potential"],
          additionalProperties: false,
        },
      },
    }];
    toolChoice = { type: "function", function: { name: "predict_performance" } };
  } else if (action === "auto_reply_comments") {
    useToolCalling = true;
    systemPrompt = `Você é um community manager profissional e empático. Gere respostas automáticas para os comentários recebidos nas redes sociais. Seja natural, humana e engajadora.${data.brandVoice ? `\nTom da marca: ${data.brandVoice}` : ""}`;
    userPrompt = `Gere respostas para os seguintes comentários:\n\n${JSON.stringify(data.comments || [], null, 2)}`;
    tools = [{
      type: "function",
      function: {
        name: "generate_replies",
        description: "Gera respostas automáticas para comentários",
        parameters: {
          type: "object",
          properties: {
            replies: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  comment_id: { type: "string" },
                  reply: { type: "string" },
                  sentiment: { type: "string", enum: ["positive", "neutral", "negative", "question", "spam"] },
                  priority: { type: "string", enum: ["low", "medium", "high", "escalate"] },
                  auto_safe: { type: "boolean" },
                  reason: { type: "string" },
                },
                required: ["comment_id", "reply", "sentiment", "priority", "auto_safe", "reason"],
                additionalProperties: false,
              },
            },
            summary: {
              type: "object",
              properties: { total: { type: "number" }, auto_safe_count: { type: "number" }, needs_review_count: { type: "number" }, escalate_count: { type: "number" } },
              required: ["total", "auto_safe_count", "needs_review_count", "escalate_count"],
              additionalProperties: false,
            },
          },
          required: ["replies", "summary"],
          additionalProperties: false,
        },
      },
    }];
    toolChoice = { type: "function", function: { name: "generate_replies" } };
  } else if (action === "recycle_content") {
    useToolCalling = true;
    systemPrompt = `Você é um estrategista de conteúdo. Analise o histórico de posts e identifique conteúdo "evergreen" com alta performance que pode ser reciclado. Para cada post, crie uma versão renovada.`;
    userPrompt = `Posts publicados com métricas:\n\n${JSON.stringify(data.posts || [], null, 2)}\n\nIdentifique os melhores candidatos e crie variações.`;
    tools = [{
      type: "function",
      function: {
        name: "recycle_analysis",
        description: "Analisa e recicla conteúdo de alta performance",
        parameters: {
          type: "object",
          properties: {
            candidates: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  original_id: { type: "string" },
                  evergreen_score: { type: "number" },
                  original_snippet: { type: "string" },
                  recycled_version: { type: "string" },
                  suggested_platforms: { type: "array", items: { type: "string" } },
                  best_time_to_repost: { type: "string" },
                  reason: { type: "string" },
                },
                required: ["original_id", "evergreen_score", "original_snippet", "recycled_version", "suggested_platforms", "best_time_to_repost", "reason"],
                additionalProperties: false,
              },
            },
            strategy_tips: { type: "array", items: { type: "string" } },
          },
          required: ["candidates", "strategy_tips"],
          additionalProperties: false,
        },
      },
    }];
    toolChoice = { type: "function", function: { name: "recycle_analysis" } };
  } else if (action === "platform_adapt") {
    useToolCalling = true;
    const platformList = (data.platforms || []).join(", ");
    const brandInfo = data.brandContext
      ? `\nMarca: ${data.brandContext.business_name || ""}. Voz: ${data.brandContext.brand_voice || ""}. Nicho: ${data.brandContext.niche || ""}.`
      : "";
    systemPrompt = `Você é um especialista em marketing digital multicanal. Adapte o conteúdo fornecido para cada plataforma listada, respeitando os limites de caracteres, tom ideal e formato de cada rede social.${brandInfo}

Regras por plataforma:
- Twitter/X: máx 280 chars (URLs=23, emojis=2), tom direto e impactante
- Instagram: máx 2200 chars, hashtags no final (5-15), tom visual e envolvente, primeiros 125 chars cruciais
- Facebook: máx 63000 chars, tom conversacional, primeiros 480 chars visíveis
- LinkedIn: máx 3000 chars, tom profissional, primeiros 210 chars visíveis, evitar links no corpo
- TikTok: máx 2200 chars, tom jovem e dinâmico, hashtags virais
- YouTube: descrição máx 5000 chars, incluir timestamps se aplicável
- Bluesky: máx 300 chars RÍGIDO, tom conciso
- Threads: máx 500 chars, tom casual
- Pinterest: máx 500 chars, foco em SEO e palavras-chave
- Reddit: tom autêntico/comunitário, sem marketing agressivo
- Telegram: máx 4096 chars, formatação HTML
- Google Business: máx 1500 chars, foco local/SEO`;
    userPrompt = `Conteúdo original:\n\n${data.content}\n\nAdapte para estas plataformas: ${platformList}`;
    
    const platformProperties: Record<string, any> = {};
    for (const p of (data.platforms || [])) {
      platformProperties[p] = { type: "string", description: `Versão otimizada para ${p}` };
    }
    
    tools = [{
      type: "function",
      function: {
        name: "platform_adaptations",
        description: "Retorna versões adaptadas do conteúdo para cada plataforma",
        parameters: {
          type: "object",
          properties: platformProperties,
          required: data.platforms || [],
          additionalProperties: false,
        },
      },
    }];
    toolChoice = { type: "function", function: { name: "platform_adaptations" } };
  } else if (action === "strategist") {
    // AI Strategist — uses brand profile context injected from frontend
    systemPrompt = data.system || "Você é um estrategista de marketing digital.";
    // Build conversation from messages array
    const msgs = data.messages || [];
    if (msgs.length > 0) {
      const aiMessages = [
        { role: "system", content: systemPrompt },
        ...msgs,
      ];
      try {
        const response = await callAI(apiKey, aiMessages, { model: "google/gemini-2.5-flash", maxTokens: 4096 });
        if (!response.ok) {
          console.error(`[strategist] AI call failed: ${response.status}`);
          return aiErrorResponse(response.status);
        }
        const aiData = await response.json();
        const content = aiData.choices?.[0]?.message?.content ?? "";
        return jsonRes({ result: content });
      } catch (err: any) {
        console.error(`[strategist] Exception: ${err.message}`);
        return jsonRes({ error: err.message }, 500);
      }
    }
    userPrompt = data.prompt || "";
  } else {
    return jsonRes({ error: `Unknown action: ${action}` }, 400);
  }

  const aiBody: any = {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };

  const response = await callAI(apiKey, aiBody.messages, {
    model: aiBody.model,
    tools: useToolCalling ? tools : undefined,
    toolChoice: useToolCalling ? toolChoice : undefined,
  });

  if (!response.ok) return aiErrorResponse(response.status);

  const aiData = await response.json();

  if (useToolCalling) {
    const parsed = parseToolCallResult(aiData);
    if (parsed) return jsonRes({ result: parsed });
  }

  const content = aiData.choices?.[0]?.message?.content ?? "";
  return jsonRes({ result: content });
}

import { corsHeaders } from "./utils.ts";
import { checkCredits, getApiKey, callAI, aiErrorResponse, jsonRes, parseToolCallResult } from "./ai-utils.ts";

export async function handleEmailAI(req: Request, params: any, userId: string): Promise<Response> {
  const creditErr = await checkCredits(userId, "ai_email");
  if (creditErr) return creditErr;

  const apiKey = getApiKey();
  const { action, email, emails: emailList, query, context, today_date } = params;

  let systemPrompt = "";
  let userPrompt = "";
  let useToolCalling = false;
  let tools: any[] = [];
  let toolChoice: any = undefined;

  if (action === "summarize") {
    systemPrompt = `Você é um assistente de e-mail inteligente. Gere um resumo conciso do e-mail abaixo em português brasileiro. 
Destaque:
- **Ponto principal**: o que o remetente quer
- **Ação necessária**: o que o usuário precisa fazer (se houver)
- **Urgência**: baixa/média/alta
- **Sentimento**: positivo/neutro/negativo

Seja direto, máximo 4-5 linhas. Use markdown leve.`;
    userPrompt = `De: ${email.from} <${email.email}>
Assunto: ${email.subject}
Data: ${email.date}

${email.body}`;

  } else if (action === "suggest_reply") {
    systemPrompt = `Você é um assistente de e-mail inteligente. Gere UMA sugestão de resposta profissional e amigável em português brasileiro.

Diretrizes:
- Tom profissional mas caloroso
- Responda diretamente ao ponto principal
- Seja conciso (3-5 linhas)
- NÃO inclua saudação inicial ou assinatura
- Retorne apenas o texto da resposta, sem markdown`;
    userPrompt = `De: ${email.from} <${email.email}>
Assunto: ${email.subject}

${email.body}`;

  } else if (action === "suggest_replies_multiple") {
    systemPrompt = `Você é um assistente de e-mail. Gere 3 opções de resposta em português para o e-mail abaixo, com tons diferentes.`;
    userPrompt = `De: ${email.from} <${email.email}>
Assunto: ${email.subject}

${email.body}`;
    useToolCalling = true;
    tools = [{
      type: "function",
      function: {
        name: "provide_reply_options",
        description: "Fornecer 3 opções de resposta com tons diferentes",
        parameters: {
          type: "object",
          properties: {
            options: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  tone: { type: "string", enum: ["formal", "amigável", "curto"] },
                  label: { type: "string" },
                  body: { type: "string" },
                },
                required: ["tone", "label", "body"],
              },
              minItems: 3, maxItems: 3,
            },
          },
          required: ["options"],
        },
      },
    }];
    toolChoice = { type: "function", function: { name: "provide_reply_options" } };

  } else if (action === "categorize") {
    systemPrompt = `Você é um sistema de categorização de e-mails. Analise o e-mail e classifique-o.`;
    userPrompt = `De: ${email.from} <${email.email}>
Assunto: ${email.subject}
Corpo (trecho): ${(email.body || "").slice(0, 300)}`;
    useToolCalling = true;
    tools = [{
      type: "function",
      function: {
        name: "categorize_email",
        description: "Categorizar um e-mail com base no conteúdo",
        parameters: {
          type: "object",
          properties: {
            category: { type: "string", enum: ["trabalho", "pessoal", "financeiro", "promoções", "notificações", "urgente", "newsletter", "reunião", "projeto", "outro"] },
            priority: { type: "string", enum: ["alta", "média", "baixa"] },
            sentiment: { type: "string", enum: ["positivo", "neutro", "negativo"] },
            requires_action: { type: "boolean" },
            suggested_label: { type: "string" },
            action_description: { type: "string" },
            estimated_read_time: { type: "string" },
          },
          required: ["category", "priority", "sentiment", "requires_action", "suggested_label"],
          additionalProperties: false,
        },
      },
    }];
    toolChoice = { type: "function", function: { name: "categorize_email" } };

  } else if (action === "batch_analyze") {
    if (!emailList || emailList.length === 0) return jsonRes({ error: "Lista de e-mails vazia" }, 400);
    systemPrompt = `Você é um analista de produtividade de e-mail de alto nível. Analise a caixa de entrada profundamente e forneça insights ricos, categorizações e recomendações acionáveis.

Regras:
- Identifique padrões de comunicação (remetentes frequentes, tópicos recorrentes)
- Classifique e-mails por categoria (trabalho, pessoal, newsletter, transacional, social, urgente)
- Identifique e-mails que precisam de resposta urgente
- Dê um score de saúde da inbox (0-100) baseado em: volume de não lidos, urgência pendente, organização
- Sugira ações concretas e priorizadas
- Identifique os 3 e-mails mais importantes que precisam de atenção imediata
- Analise tendências: está recebendo muitos newsletters? Muitos e-mails sem resposta?`;
    const batch = emailList.slice(0, 40);
    const emailSummaries = batch.map((e: any, i: number) =>
      `[${i + 1}] De: ${e.from} | Assunto: ${e.subject} | Não lido: ${e.unread ? "sim" : "não"} | Com estrela: ${e.starred ? "sim" : "não"} | Anexo: ${e.hasAttachment ? "sim" : "não"} | Data: ${e.date || "?"} | Prévia: ${(e.body || "").substring(0, 150)}`
    ).join("\n");
    userPrompt = `Caixa de entrada (${emailList.length} e-mails, analisando ${batch.length}):\n${emailSummaries}`;
    useToolCalling = true;
    tools = [{
      type: "function",
      function: {
        name: "inbox_intelligence",
        description: "Análise inteligente profunda da caixa de entrada",
        parameters: {
          type: "object",
          properties: {
            total_unread: { type: "number" },
            urgent_count: { type: "number" },
            main_senders: { type: "array", items: { type: "string" }, maxItems: 5 },
            categories: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  count: { type: "number" },
                  icon: { type: "string" },
                },
                required: ["name", "count", "icon"],
              },
              maxItems: 6,
            },
            priority_emails: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  index: { type: "number" },
                  from: { type: "string" },
                  subject: { type: "string" },
                  urgency: { type: "string", enum: ["critical", "high", "medium"] },
                  reason: { type: "string" },
                },
                required: ["index", "from", "subject", "urgency", "reason"],
              },
              maxItems: 3,
            },
            suggested_actions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  action: { type: "string" },
                  description: { type: "string" },
                  email_count: { type: "number" },
                  impact: { type: "string", enum: ["high", "medium", "low"] },
                },
                required: ["action", "description", "email_count", "impact"],
              },
              maxItems: 5,
            },
            inbox_score: { type: "number" },
            insight: { type: "string" },
            trends: {
              type: "object",
              properties: {
                newsletter_percentage: { type: "number" },
                needs_response: { type: "number" },
                pattern: { type: "string" },
              },
              required: ["newsletter_percentage", "needs_response", "pattern"],
            },
            focus_email_index: { type: "number" },
          },
          required: ["total_unread", "urgent_count", "main_senders", "categories", "priority_emails", "suggested_actions", "inbox_score", "insight", "trends"],
          additionalProperties: false,
        },
      },
    }];
    toolChoice = { type: "function", function: { name: "inbox_intelligence" } };

  } else if (action === "compose_ai") {
    const { prompt: composePrompt, recipient, tone, existingBody } = context || {};
    systemPrompt = `Você é um assistente de escrita de e-mails profissional em português brasileiro.
Tom desejado: ${tone || "profissional"}
Redigir ou melhorar um e-mail com base na instrução do usuário.
- Não inclua campos de cabeçalho (Para:, Assunto:)
- Inclua saudação e despedida adequadas
- Seja claro e objetivo`;
    userPrompt = existingBody
      ? `Melhore este e-mail para ${recipient || "o destinatário"}:\n${existingBody}\n\nInstrução adicional: ${composePrompt || "Torne mais profissional"}`
      : `Escreva um e-mail para ${recipient || "o destinatário"} sobre: ${composePrompt}`;

  } else if (action === "smart_search") {
    if (!query) return jsonRes({ error: "Query inválida" }, 400);
    systemPrompt = `Você é um sistema de busca inteligente de e-mails. Converta a busca em linguagem natural para uma query do Gmail.`;
    userPrompt = `Busca do usuário: "${query}"
      
Retorne uma query Gmail válida (operadores: from:, to:, subject:, has:attachment, is:unread, is:starred, before:, after:, label:, etc.)
Apenas a query, sem explicação.`;

  } else if (action === "batch_categorize") {
    if (!emailList || emailList.length === 0) return jsonRes({ error: "Lista de e-mails vazia" }, 400);
    const batch = emailList.slice(0, 15);
    systemPrompt = `Você é um sistema especializado em categorização de e-mails em português. 
Para cada e-mail fornecido, retorne: categoria, prioridade e se requer ação.
Seja preciso e rápido.`;
    const emailLines = batch.map((e: any, i: number) =>
      `[${i}] De: ${e.from} | Assunto: ${e.subject} | Trecho: ${String(e.body || "").slice(0, 150)}`
    ).join("\n");
    userPrompt = `Categorize estes ${batch.length} e-mails:\n${emailLines}`;
    useToolCalling = true;
    tools = [{
      type: "function",
      function: {
        name: "categorize_batch",
        description: "Categorizar múltiplos e-mails de uma vez",
        parameters: {
          type: "object",
          properties: {
            results: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  index: { type: "number" },
                  category: { type: "string", enum: ["trabalho", "pessoal", "financeiro", "promoções", "notificações", "urgente", "newsletter", "reunião", "projeto", "outro"] },
                  priority: { type: "string", enum: ["alta", "média", "baixa"] },
                  requires_action: { type: "boolean" },
                },
                required: ["index", "category", "priority", "requires_action"],
                additionalProperties: false,
              },
            },
          },
          required: ["results"],
          additionalProperties: false,
        },
      },
    }];
    toolChoice = { type: "function", function: { name: "categorize_batch" } };

  } else if (action === "detect_threads") {
    if (!emailList || emailList.length === 0) return jsonRes({ error: "Lista vazia" }, 400);
    systemPrompt = `Agrupe e-mails relacionados em threads com base no assunto e remetentes.`;
    const emailSummaries = emailList.map((e: any, i: number) =>
      `[${i}] De: ${e.from} | Assunto: ${e.subject} | Data: ${e.date}`
    ).join("\n");
    userPrompt = emailSummaries;
    useToolCalling = true;
    tools = [{
      type: "function",
      function: {
        name: "group_threads",
        description: "Agrupar e-mails em threads relacionados",
        parameters: {
          type: "object",
          properties: {
            threads: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  thread_subject: { type: "string" },
                  email_indices: { type: "array", items: { type: "number" } },
                },
                required: ["thread_subject", "email_indices"],
              },
            },
          },
          required: ["threads"],
        },
      },
    }];
    toolChoice = { type: "function", function: { name: "group_threads" } };

  } else if (action === "daily_summary") {
    if (!emailList || emailList.length === 0) return jsonRes({ error: "Lista de e-mails vazia" }, 400);
    const todayStr = today_date || new Date().toLocaleDateString("pt-BR");
    systemPrompt = `Você é um assistente de produtividade de e-mail altamente inteligente. Analise os e-mails de hoje (${todayStr}) e produza um resumo diário completo em português.

Regras:
- Categorize em: urgente, trabalho, financeiro, reunião, projeto, pessoal, promoções, newsletter, sistema, outro.
- Para cada categoria com e-mails, identifique: contagem, não lidos, remetentes principais e 1-2 ações práticas concretas.
- Atribua um nível de urgência (critical, high, medium, low) para cada categoria baseado no conteúdo.
- Identifique o e-mail mais importante que precisa de atenção imediata (spotlight).
- Identifique e-mails que aguardam resposta do usuário (response_needed).
- Calcule um score de produtividade de 0-100.
- Gere 1-3 alertas importantes se houver.
- Dê um veredicto geral motivador sobre o dia.`;

    const emailLines = emailList.slice(0, 60).map((e: any, i: number) =>
      `[${i}] De: ${e.from} | Assunto: ${e.subject} | Não lido: ${e.unread ? "sim" : "não"} | Favorito: ${e.starred ? "sim" : "não"} | Anexo: ${e.hasAttachment ? "sim" : "não"} | Data: ${e.date || ""} | Trecho: ${String(e.body || "").slice(0, 200)}`
    ).join("\n");
    userPrompt = `E-mails de hoje (${emailList.length} total, mostrando ${Math.min(emailList.length, 60)}):\n${emailLines}`;

    useToolCalling = true;
    tools = [{
      type: "function",
      function: {
        name: "daily_summary",
        description: "Resumo diário completo da caixa de entrada",
        parameters: {
          type: "object",
          properties: {
            overall_insight: { type: "string" },
            total_today: { type: "number" },
            unread_today: { type: "number" },
            productivity_score: { type: "number" },
            verdict: { type: "string" },
            spotlight: {
              type: "object",
              properties: {
                email_index: { type: "number" },
                from: { type: "string" },
                subject: { type: "string" },
                why: { type: "string" },
                urgency: { type: "string", enum: ["critical", "high", "medium"] },
              },
              required: ["email_index", "from", "subject", "why", "urgency"],
              additionalProperties: false,
            },
            alerts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  icon: { type: "string" },
                  message: { type: "string" },
                  severity: { type: "string", enum: ["critical", "warning", "info"] },
                },
                required: ["icon", "message", "severity"],
                additionalProperties: false,
              },
              maxItems: 3,
            },
            categories: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", enum: ["urgente", "trabalho", "financeiro", "reunião", "projeto", "pessoal", "promoções", "newsletter", "sistema", "outro"] },
                  icon: { type: "string" },
                  count: { type: "number" },
                  unread: { type: "number" },
                  urgency: { type: "string", enum: ["critical", "high", "medium", "low"] },
                  top_senders: { type: "array", items: { type: "string" }, maxItems: 3 },
                  response_needed: { type: "number" },
                  suggested_actions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string" },
                        description: { type: "string" },
                      },
                      required: ["label", "description"],
                      additionalProperties: false,
                    },
                    maxItems: 2,
                  },
                },
                required: ["name", "icon", "count", "unread", "urgency", "suggested_actions"],
                additionalProperties: false,
              },
              maxItems: 10,
            },
          },
          required: ["overall_insight", "total_today", "unread_today", "productivity_score", "verdict", "categories"],
          additionalProperties: false,
        },
      },
    }];
    toolChoice = { type: "function", function: { name: "daily_summary" } };

  } else if (action === "cleanup_analysis") {
    if (!emailList || !Array.isArray(emailList) || emailList.length === 0) return jsonRes({ error: "Lista de e-mails vazia" }, 400);
    const batch = emailList.slice(0, 200).map((e: any) => ({
      from: String(e.from || "").slice(0, 120),
      email: String(e.email || "").slice(0, 120),
      subject: String(e.subject || "").slice(0, 200),
      body: String(e.body || "").slice(0, 300),
      date: String(e.date || "").slice(0, 30),
      unread: !!e.unread,
      id: String(e.id || "").slice(0, 80),
    }));

    systemPrompt = `Você é um especialista em organização de e-mails. Analise a lista de e-mails fornecida e agrupe os que são seguros para arquivar ou excluir em categorias inteligentes.

Regras:
- Agrupe apenas e-mails que são claramente dispensáveis
- E-mails de trabalho com ação pendente, e-mails pessoais importantes, conversas ativas: liste em "safe_to_keep"
- Para cada grupo, forneça: nome do grupo, ícone emoji, motivo, ação recomendada (archive ou trash), índices dos e-mails
- Seja conservador: em caso de dúvida, coloque em safe_to_keep
- email_indices devem conter APENAS índices válidos de 0 a ${batch.length - 1}`;

    const emailLines = batch.map((e: any, i: number) =>
      `[${i}] De: ${e.from} | Assunto: ${e.subject} | Não lido: ${e.unread ? "sim" : "não"} | Trecho: ${String(e.body || "").slice(0, 80)}`
    ).join("\n");
    userPrompt = `Analise estes ${batch.length} e-mails e identifique os que podem ser limpos com segurança:\n\n${emailLines}`;

    useToolCalling = true;
    tools = [{
      type: "function",
      function: {
        name: "cleanup_analysis",
        description: "Agrupar e-mails dispensáveis em categorias de limpeza",
        parameters: {
          type: "object",
          properties: {
            cleanup_groups: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  group_name: { type: "string" },
                  icon: { type: "string" },
                  reason: { type: "string" },
                  recommended_action: { type: "string", enum: ["archive", "trash"] },
                  is_newsletter: { type: "boolean" },
                  estimated_space_saved: { type: "string" },
                  email_indices: { type: "array", items: { type: "number" } },
                },
                required: ["group_name", "icon", "reason", "recommended_action", "is_newsletter", "estimated_space_saved", "email_indices"],
                additionalProperties: false,
              },
            },
            safe_to_keep: { type: "array", items: { type: "number" } },
          },
          required: ["cleanup_groups", "safe_to_keep"],
          additionalProperties: false,
        },
      },
    }];
    toolChoice = { type: "function", function: { name: "cleanup_analysis" } };

  } else if (action === "auto_organize") {
    if (!emailList || !Array.isArray(emailList) || emailList.length === 0) return jsonRes({ error: "Lista de e-mails vazia" }, 400);
    const { available_labels } = context || {};
    const batch = emailList.slice(0, 150).map((e: any) => ({
      from: String(e.from || "").slice(0, 120),
      subject: String(e.subject || "").slice(0, 200),
      body: String(e.body || "").slice(0, 250),
      labels: (Array.isArray(e.labels) ? e.labels : []).slice(0, 10).map((l: any) => String(l).slice(0, 60)),
    }));
    const safeLabels = (Array.isArray(available_labels) ? available_labels : []).slice(0, 100);
    const labelList = safeLabels.map((l: any) => `${String(l.id || "").slice(0, 60)}: ${String(l.name || "").slice(0, 60)}`).join("\n");

    systemPrompt = `Você é um especialista em organização de e-mails com alto nível de inteligência contextual. Analise os e-mails fornecidos e sugira labels do Gmail para cada um.

Regras:
- PRIORIZE os labels existentes listados abaixo. Use-os sempre que possível.
- Cada e-mail pode receber 1-3 labels.
- Indique um nível de confiança (high, medium, low).
- Identifique se o e-mail é newsletter, promoção, notificação, pessoal/profissional.
- Se nenhum label existente se encaixa, sugira novos labels usando "new_labels".
- IMPORTANTE: O campo "index" deve conter APENAS índices válidos de 0 a ${batch.length - 1}.

Labels disponíveis:
${labelList || "IMPORTANT, CATEGORY_PERSONAL, CATEGORY_SOCIAL, CATEGORY_PROMOTIONS, CATEGORY_UPDATES, CATEGORY_FORUMS"}`;

    const emailLines = batch.map((e: any, i: number) =>
      `[${i}] De: ${e.from} | Assunto: ${e.subject} | Labels atuais: ${(e.labels || []).join(", ") || "nenhum"} | Trecho: ${String(e.body || "").slice(0, 250)}`
    ).join("\n");
    userPrompt = `Organize estes ${batch.length} e-mails atribuindo labels apropriados:\n${emailLines}`;

    useToolCalling = true;
    tools = [{
      type: "function",
      function: {
        name: "auto_organize",
        description: "Atribuir labels do Gmail a e-mails para organização automática",
        parameters: {
          type: "object",
          properties: {
            assignments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  index: { type: "number" },
                  add_labels: { type: "array", items: { type: "string" } },
                  new_labels: { type: "array", items: { type: "string" } },
                  remove_labels: { type: "array", items: { type: "string" } },
                  reason: { type: "string" },
                  confidence: { type: "string", enum: ["high", "medium", "low"] },
                  email_type: { type: "string", enum: ["newsletter", "promotion", "notification", "personal", "work", "transactional", "social"] },
                },
                required: ["index", "add_labels", "reason", "confidence", "email_type"],
                additionalProperties: false,
              },
            },
            summary: { type: "string" },
            stats: {
              type: "object",
              properties: {
                total_to_organize: { type: "number" },
                already_organized: { type: "number" },
                newsletters_found: { type: "number" },
                high_priority: { type: "number" },
              },
              required: ["total_to_organize", "already_organized", "newsletters_found", "high_priority"],
              additionalProperties: false,
            },
          },
          required: ["assignments", "summary", "stats"],
          additionalProperties: false,
        },
      },
    }];
    toolChoice = { type: "function", function: { name: "auto_organize" } };

  } else if (action === "unsubscribe_scan") {
    if (!emailList || emailList.length === 0) return jsonRes({ error: "Lista de e-mails vazia" }, 400);
    const batch = emailList.slice(0, 300);
    systemPrompt = `Você é um especialista em segurança de e-mail e descadastramento inteligente. Analise os e-mails e identifique remetentes de marketing, newsletters, notificações automáticas e promoções que o usuário pode querer se descadastrar com segurança.

Regras RIGOROSAS:
- NUNCA sugira descadastrar de: e-mails de trabalho/colegas, bancos/instituições financeiras, governo, saúde, seguros, escola/universidade, serviços essenciais
- Agrupe por remetente (sender_email) e conte quantos e-mails cada um enviou
- Atribua um safety_score de 0-100
- Classifique cada sender: newsletter, marketing, social, notification, promotional, transactional`;

    const emailLines = batch.map((e: any, i: number) =>
      `[${i}] De: ${e.from} <${e.email}> | Assunto: ${e.subject} | Trecho: ${String(e.body || "").slice(0, 200)}`
    ).join("\n");
    userPrompt = `Analise estes ${batch.length} e-mails e identifique remetentes para descadastro seguro:\n${emailLines}`;

    useToolCalling = true;
    tools = [{
      type: "function",
      function: {
        name: "unsubscribe_scan",
        description: "Identificar remetentes de marketing/newsletter para descadastro seguro",
        parameters: {
          type: "object",
          properties: {
            senders: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  sender_name: { type: "string" },
                  sender_email: { type: "string" },
                  email_count: { type: "number" },
                  email_indices: { type: "array", items: { type: "number" } },
                  category: { type: "string", enum: ["newsletter", "marketing", "social", "notification", "promotional", "transactional", "outro"] },
                  safety_score: { type: "number" },
                  reason: { type: "string" },
                },
                required: ["sender_name", "sender_email", "email_count", "email_indices", "category", "safety_score", "reason"],
                additionalProperties: false,
              },
            },
          },
          required: ["senders"],
          additionalProperties: false,
        },
      },
    }];
    toolChoice = { type: "function", function: { name: "unsubscribe_scan" } };

  } else {
    return jsonRes({ error: "Ação inválida" }, 400);
  }

  const requestBody: any = {
    model: "google/gemini-3-flash-preview",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };
  if (useToolCalling && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = toolChoice;
  }

  const response = await callAI(apiKey, requestBody.messages, {
    tools: requestBody.tools,
    toolChoice: requestBody.tool_choice,
  });

  if (!response.ok) return aiErrorResponse(response.status);

  const data = await response.json();

  if (useToolCalling) {
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        return jsonRes({ result: parsed });
      } catch {
        const result = data.choices?.[0]?.message?.content || "";
        return jsonRes({ result });
      }
    }
  }

  const result = data.choices?.[0]?.message?.content || "Não foi possível processar.";
  return jsonRes({ result });
}

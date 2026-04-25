/**
 * @function search-web
 * @description Busca web para IA (Perplexity + Google + locais)
 * @status active
 * @calledBy PandoraChat tools
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { deductCredits, insufficientCreditsResponse } from "../_shared/credits.ts";
import { corsHeaders } from "../_shared/utils.ts";

const locationKeywords = [
  "onde fica", "endereço", "endereco", "localização", "localizacao",
  "como chegar", "mapa", "restaurante", "hotel", "aeroporto",
  "hospital", "shopping", "cidade", "bairro", "rua", "avenida",
  "praça", "praca", "parque", "museu", "praia", "estação", "estacao",
  "where is", "location", "address", "directions to", "near me",
  "café", "cafe", "bar", "loja", "mercado", "farmácia", "farmacia",
  "igreja", "escola", "universidade", "estádio", "estadio",
];

function looksLikeLocationQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return locationKeywords.some((kw) => lower.includes(kw));
}

function extractMetadata(rawAnswer: string) {
  const related_queries: string[] = [];
  let answer = rawAnswer;

  // Extract TLDR block
  let tldr = "";
  const tldrMatch = answer.match(/\[TLDR\]([\s\S]*?)\[\/TLDR\]/);
  if (tldrMatch) {
    tldr = tldrMatch[1].trim();
    answer = answer.replace(tldrMatch[0], "").trim();
  }

  // Extract key facts block
  const key_facts: string[] = [];
  const factsMatch = answer.match(/\[KEY_FACTS\]([\s\S]*?)\[\/KEY_FACTS\]/);
  if (factsMatch) {
    const lines = factsMatch[1].trim().split("\n").map((l: string) => l.trim()).filter((l: string) => l.startsWith("- "));
    lines.forEach((l: string) => key_facts.push(l.replace(/^-\s*/, "").trim()));
    answer = answer.replace(factsMatch[0], "").trim();
  }

  // Extract related queries
  const separatorIdx = answer.lastIndexOf("---");
  if (separatorIdx !== -1) {
    const beforeSep = answer.substring(0, separatorIdx).trim();
    const afterSep = answer.substring(separatorIdx + 3).trim();
    const lines = afterSep.split("\n").map((l: string) => l.trim()).filter((l: string) => l.startsWith("- "));
    if (lines.length > 0) {
      answer = beforeSep;
      lines.forEach((l: string) => related_queries.push(l.replace(/^-\s*/, "").trim()));
    }
  }

  // Extract images
  const imageRegex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
  const images: string[] = [];
  let match;
  while ((match = imageRegex.exec(answer)) !== null) {
    images.push(match[1]);
  }

  return { answer, images, related_queries, tldr, key_facts };
}

async function extractLocation(apiKey: string, query: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const locResponse = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: 'You are a geocoding assistant. Return ONLY a JSON object with keys "name" (string), "lat" (number), "lng" (number) for the main location mentioned. If no specific location, return null. No explanation, just JSON or null.',
          },
          { role: "user", content: query.trim() },
        ],
        temperature: 0,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const locData = await locResponse.json();
    if (locResponse.ok) {
      const locContent = locData.choices?.[0]?.message?.content?.trim() || "";
      if (locContent && locContent !== "null") {
        const jsonMatch = locContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.lat && parsed.lng && parsed.name) {
            return { name: parsed.name, lat: Number(parsed.lat), lng: Number(parsed.lng) };
          }
        }
      }
    }
  } catch (locErr) {
    clearTimeout(timeoutId);
    console.error("Location extraction failed:", locErr);
  }
  return null;
}

// Smart intent detection for better prompt routing
function detectSearchIntent(query: string): string {
  const q = query.toLowerCase();
  if (/\b(vs|versus|comparar?|diferença|melhor|pior)\b/i.test(q)) return "comparison";
  if (/\b(como|tutorial|passo a passo|guia|how to)\b/i.test(q)) return "howto";
  if (/\b(o que é|what is|definição|significado|quem é|who is)\b/i.test(q)) return "definition";
  if (/\b(preço|custo|quanto custa|valor|price|pricing)\b/i.test(q)) return "pricing";
  if (/\b(review|avaliação|análise|opinião|vale a pena)\b/i.test(q)) return "review";
  return "general";
}

function getStructuredSuffix(lang: string, intent: string): string {
  const intentHints: Record<string, string> = {
    comparison: lang === "pt"
      ? "\n\n⚡ COMPARAÇÃO DETECTADA: USE OBRIGATORIAMENTE uma tabela markdown comparativa com todas as características relevantes. Inclua uma conclusão clara de qual opção é melhor para cada caso de uso."
      : "\n\n⚡ COMPARISON DETECTED: You MUST use a markdown comparison table with all relevant features. Include a clear conclusion about which option is better for each use case.",
    howto: lang === "pt"
      ? "\n\n⚡ TUTORIAL DETECTADO: Estruture a resposta em passos numerados claros (1., 2., 3...). Inclua pré-requisitos, comandos exatos ou ações, e dicas de troubleshooting."
      : "\n\n⚡ HOW-TO DETECTED: Structure the answer in clear numbered steps (1., 2., 3...). Include prerequisites, exact commands or actions, and troubleshooting tips.",
    pricing: lang === "pt"
      ? "\n\n⚡ PREÇO DETECTADO: Inclua tabela com planos/preços disponíveis. SEMPRE em R$ para o mercado brasileiro. Inclua custo-benefício e alternativas mais baratas."
      : "\n\n⚡ PRICING DETECTED: Include a table with available plans/prices. Include value-for-money analysis and cheaper alternatives.",
    review: lang === "pt"
      ? "\n\n⚡ AVALIAÇÃO DETECTADA: Estruture com Prós, Contras e Veredicto Final. Use nota de 1-10 quando aplicável. Cite fontes reais de reviews."
      : "\n\n⚡ REVIEW DETECTED: Structure with Pros, Cons, and Final Verdict. Use 1-10 rating when applicable. Cite real review sources.",
  };

  const intentSuffix = intentHints[intent] || "";

  if (lang === "pt") {
    return `

REGRAS DE FORMATAÇÃO OBRIGATÓRIAS:
1. Comece com um bloco [TLDR] com resumo de 1-2 frases:
   [TLDR]Seu resumo conciso aqui[/TLDR]

2. Adicione um bloco [KEY_FACTS] com 3-5 fatos principais:
   [KEY_FACTS]
   - Fato um
   - Fato dois
   - Fato três
   [/KEY_FACTS]

3. Forneça a resposta detalhada com headings markdown (##), **negrito** para termos-chave e listas com bullets.

4. USE TABELAS MARKDOWN (com | e ---) sempre que comparar itens, recursos, preços ou opções. Tabelas são obrigatórias para comparações.

5. LOCALIZAÇÃO OBRIGATÓRIA PARA O BRASIL:
   - SEMPRE use Real brasileiro (R$) para valores monetários, NUNCA use USD/US$ a menos que explicitamente sobre mercado americano
   - Use sistema métrico (kg, cm, km, °C)
   - Use formato de data dd/mm/aaaa
   - Contextualize para o mercado e realidade brasileiros (lojas BR, disponibilidade BR, regulamentações BR)
   - Preços devem refletir o mercado brasileiro quando possível

6. Ao final, adicione "---" seguido de exatamente 5 buscas relacionadas (mais específicas e exploratórias), uma por linha, com "- ".${intentSuffix}`;
  }
  return `

IMPORTANT FORMATTING RULES:
1. Start your response with a [TLDR] block containing a 1-2 sentence summary:
   [TLDR]Your concise summary here[/TLDR]

2. Then add a [KEY_FACTS] block with 3-5 bullet points of the most important facts:
   [KEY_FACTS]
   - Fact one
   - Fact two
   - Fact three
   [/KEY_FACTS]

3. Then provide your detailed answer with proper markdown headings (##), bold for key terms, and bullet points for lists.

4. USE MARKDOWN TABLES (with | and ---) whenever comparing items, features, prices or options. Tables are mandatory for comparisons.

5. At the end, add "---" followed by exactly 5 related searches (more specific and exploratory), one per line, prefixed with "- ".${intentSuffix}`;
}

function buildSystemPrompt(filter: string, lang: string, intent: string): string {
  const suffix = getStructuredSuffix(lang, intent);

  if (filter === "code") {
    return lang === "pt"
      ? `Você é um assistente técnico expert em programação. Responda com:
- Exemplos de código completos e funcionais em blocos markdown com a linguagem especificada
- Explicação passo a passo do que cada parte do código faz
- Menção a documentação oficial e repositórios GitHub relevantes
- Alternativas e trade-offs quando aplicável
- Notas sobre performance, segurança ou boas práticas
- Use tabelas markdown para comparar bibliotecas, frameworks ou opções
Seja preciso, detalhado e prático.${suffix}`
      : `You are an expert technical programming assistant. Answer with:
- Complete, functional code examples in markdown code blocks with language specified
- Step-by-step explanation of what each part does
- Official documentation and relevant GitHub repositories
- Alternatives and trade-offs when applicable
- Notes on performance, security or best practices
- Use markdown tables to compare libraries, frameworks or options
Be precise, detailed and practical.${suffix}`;
  }

  if (filter === "news") {
    return lang === "pt"
      ? `Você é um assistente jornalístico inteligente focado no Brasil. Responda com:
- Informações recentes e verificadas, priorizando as últimas 48 horas
- Contexto histórico relevante para entender a notícia
- Múltiplas perspectivas quando houver debate
- Datas exatas (formato dd/mm/aaaa) e nomes de fontes
- Impacto e consequências previstas para o Brasil
- Valores monetários em Real (R$)
Organize cronologicamente quando fizer sentido.${suffix}`
      : `You are an intelligent journalistic assistant. Answer with:
- Recent verified information, prioritizing the last 48 hours
- Relevant historical context
- Multiple perspectives when there's debate
- Exact dates and source names
- Expected impact and consequences
Organize chronologically when it makes sense.${suffix}`;
  }

  if (filter === "academic") {
    return lang === "pt"
      ? `Você é um assistente acadêmico rigoroso. Responda com:
- Citações de artigos, papers e fontes acadêmicas com autores e ano
- Metodologias e frameworks teóricos relevantes
- Dados estatísticos e evidências empíricas quando disponíveis
- Distinção clara entre consenso científico e hipóteses em debate
- Sugestões de leituras complementares
- Use tabelas markdown para comparar estudos, metodologias ou resultados
Use linguagem técnica apropriada e referências no formato autor (ano). Valores monetários em R$ quando aplicável.${suffix}`
      : `You are a rigorous academic assistant. Answer with:
- Citations from papers and academic sources with authors and year
- Relevant methodologies and theoretical frameworks
- Statistical data and empirical evidence when available
- Clear distinction between scientific consensus and debated hypotheses
- Complementary reading suggestions
Use appropriate technical language and author (year) references.${suffix}`;
  }

  // Default web search
  return lang === "pt"
    ? `Você é um assistente de pesquisa inteligente e detalhista. Responda de forma completa e bem estruturada em português brasileiro.
- Use headings (##) para organizar seções longas
- Destaque termos-chave em **negrito**
- Use listas com bullets (- ) para enumerar itens
- USE TABELAS MARKDOWN (com | e ---) OBRIGATORIAMENTE para qualquer comparação de produtos, especificações, preços ou opções
- Inclua dados numéricos, datas (dd/mm/aaaa) e fatos específicos sempre que possível
- Quando relevante, inclua imagens no markdown usando ![descrição](url)
- Forneça contexto suficiente para que a resposta seja autocontida
- Se houver prós e contras, apresente ambos os lados
- SEMPRE use Real brasileiro (R$) para valores monetários e sistema métrico
- Contextualize para o mercado e realidade brasileiros${suffix}`
    : `You are an intelligent and thorough research assistant. Provide complete, well-structured answers.
- Use headings (##) to organize long sections
- Highlight key terms in **bold**
- Use bullet lists (- ) to enumerate items
- USE MARKDOWN TABLES (with | and ---) whenever comparing products, specs, prices or options
- Include numerical data, dates and specific facts whenever possible
- When relevant, include images using markdown ![description](url) syntax
- Provide enough context for the answer to be self-contained
- If there are pros and cons, present both sides${suffix}`;
}

// Simple in-memory rate limiter per user (resets on cold start)
const rateLimiter = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimiter.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimiter.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await verifyAuth(req);
    if (authResult instanceof Response) {
      return new Response(authResult.body, {
        status: authResult.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit check
    if (!checkRateLimit(authResult.userId)) {
      return new Response(
        JSON.stringify({ error: "Limite de requisições atingido. Aguarde 1 minuto." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const creditResult = await deductCredits(authResult.userId, "web_search");
    if (!creditResult.success) {
      return insufficientCreditsResponse(corsHeaders, creditResult.error || "insufficient_credits");
    }

    const apiKey = Deno.env.get("PERPLEXITY_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "PERPLEXITY_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { query: rawQuery, filter = "web", lang = "pt", stream = false, conversation_history = [], recency = "" } = await req.json();

    if (!rawQuery || typeof rawQuery !== "string" || !rawQuery.trim()) {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize and validate query
    const query = rawQuery.trim().slice(0, 500);

    const validFilters = new Set(["web", "news", "code", "images", "academic", "shopping"]);
    const safeFilter = validFilters.has(filter) ? filter : "web";

    const isLocationQuery = looksLikeLocationQuery(query);
    const intent = detectSearchIntent(query);
    const systemPrompt = buildSystemPrompt(safeFilter, lang, intent);

    const messages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    // Limit conversation history to prevent token abuse
    const historySlice = Array.isArray(conversation_history) ? conversation_history.slice(-6) : [];
    for (const msg of historySlice) {
      if (msg.role && msg.content && typeof msg.content === "string") {
        messages.push({ role: msg.role, content: msg.content.slice(0, 2000) });
      }
    }

    messages.push({ role: "user", content: query });

    const body: Record<string, unknown> = {
      model: "sonar-pro",
      messages,
      temperature: 0.2,
      stream,
    };

    if (safeFilter === "news") {
      body.search_recency_filter = recency || "week";
    } else if (recency && ["hour", "day", "week", "month"].includes(recency)) {
      body.search_recency_filter = recency;
    }

    if (safeFilter === "academic") {
      body.search_mode = "academic";
    } else if (safeFilter === "code") {
      body.search_domain_filter = ["github.com", "stackoverflow.com", "dev.to", "docs.microsoft.com", "developer.mozilla.org", "npmjs.com", "medium.com"];
    } else if (safeFilter === "images") {
      const imgSuffix = getStructuredSuffix(lang, "general");
      body.messages = [
        { role: "system", content: lang === "pt"
          ? `Forneça uma resposta visual rica. Inclua o máximo de imagens relevantes possível usando a sintaxe markdown ![descrição detalhada](url). Organize as imagens por categoria quando possível.${imgSuffix}`
          : `Provide a rich visual answer. Include as many relevant images as possible using markdown ![detailed description](url) syntax. Organize images by category when possible.${imgSuffix}` },
        { role: "user", content: query + " images" },
      ];
    }

    // Add timeout controller for Perplexity API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    let response: Response;
    try {
      response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr.name === "AbortError") {
        return new Response(
          JSON.stringify({ error: "A busca demorou demais. Tente novamente com termos mais específicos." }),
          { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw fetchErr;
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error("Perplexity API error:", JSON.stringify(errData));
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Perplexity API error [${response.status}]: ${errData.error?.message || "Unknown error"}`);
    }

    // --- STREAMING MODE ---
    if (stream) {
      const encoder = new TextEncoder();

      const readable = new ReadableStream({
        async start(controller) {
          const reader = response.body!.getReader();
          const decoder = new TextDecoder();
          let fullAnswer = "";
          let citations: string[] = [];
          let buffer = "";

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const payload = line.slice(6).trim();
                if (payload === "[DONE]") continue;

                try {
                  const chunk = JSON.parse(payload);
                  const delta = chunk.choices?.[0]?.delta?.content || "";
                  if (delta) {
                    fullAnswer += delta;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", content: delta })}\n\n`));
                  }
                  if (chunk.citations) {
                    citations = chunk.citations;
                  }
                } catch {
                  // skip malformed chunks
                }
              }
            }

            const { answer, images, related_queries, tldr, key_facts } = extractMetadata(fullAnswer);

            let location: { name: string; lat: number; lng: number } | null = null;
            if (isLocationQuery) {
              location = await extractLocation(apiKey, query);
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: "done",
              answer,
              citations,
              images,
              location,
              related_queries,
              tldr,
              key_facts,
              intent,
            })}\n\n`));

          } catch (err) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // --- NON-STREAMING MODE ---
    const data = await response.json();
    const rawAnswer = data.choices?.[0]?.message?.content || "";
    const citations: string[] = data.citations || [];
    const { answer, images, related_queries, tldr, key_facts } = extractMetadata(rawAnswer);

    let location: { name: string; lat: number; lng: number } | null = null;
    if (isLocationQuery) {
      location = await extractLocation(apiKey, query);
    }

    return new Response(
      JSON.stringify({ answer, citations, images, location, related_queries, tldr, key_facts, intent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Search error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

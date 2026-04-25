/**
 * @function deep-research
 * @description Pesquisa profunda com IA (Perplexity + multi-step reasoning)
 * @status active
 * @calledBy PandoraChat (deep research mode)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { deductCredits, insufficientCreditsResponse } from "../_shared/credits.ts";
import { corsHeaders } from "../_shared/utils.ts";

interface ResearchStep {
  query: string;
  purpose: string;
  answer: string;
  citations: string[];
}

async function perplexitySearch(
  apiKey: string,
  query: string,
  systemPrompt: string,
  recency?: string,
  searchMode?: string,
): Promise<{ answer: string; citations: string[] }> {
  const body: Record<string, unknown> = {
    model: "sonar-pro",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: query },
    ],
    temperature: 0.2,
  };

  if (recency && ["hour", "day", "week", "month"].includes(recency)) {
    body.search_recency_filter = recency;
  }
  if (searchMode) {
    body.search_mode = searchMode;
  }

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Perplexity error [${response.status}]: ${err.error?.message || "Unknown"}`);
  }

  const data = await response.json();
  return {
    answer: data.choices?.[0]?.message?.content || "",
    citations: data.citations || [],
  };
}

async function generateSubQueries(apiKey: string, topic: string, lang: string): Promise<{ query: string; purpose: string }[]> {
  const prompt = lang === "pt"
    ? `Dado o tema de pesquisa abaixo, gere exatamente 5 sub-perguntas de pesquisa que, juntas, cobrirão o tema de forma abrangente e profunda.

Cada sub-pergunta deve explorar um ângulo diferente:
1. Definição e contexto fundamental
2. Estado atual e dados recentes
3. Perspectivas múltiplas e debates
4. Impactos práticos e aplicações
5. Tendências futuras e projeções

Responda APENAS com um JSON array, sem markdown, sem explicação:
[{"query": "pergunta aqui", "purpose": "propósito da busca"}]

Tema: ${topic}`
    : `Given the research topic below, generate exactly 5 sub-questions that together will cover the topic comprehensively.

Each sub-question should explore a different angle:
1. Definition and fundamental context
2. Current state and recent data
3. Multiple perspectives and debates
4. Practical impacts and applications
5. Future trends and projections

Reply ONLY with a JSON array, no markdown, no explanation:
[{"query": "question here", "purpose": "search purpose"}]

Topic: ${topic}`;

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    }),
  });

  if (!response.ok) throw new Error("Failed to generate sub-queries");
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "[]";

  // Extract JSON array from response
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Failed to parse sub-queries");

  const parsed = JSON.parse(jsonMatch[0]);
  return parsed.slice(0, 5);
}

async function compileReport(
  apiKey: string,
  topic: string,
  steps: ResearchStep[],
  lang: string,
): Promise<string> {
  const stepsContext = steps
    .map((s, i) => `## Pesquisa ${i + 1}: ${s.purpose}\n**Pergunta:** ${s.query}\n\n${s.answer}`)
    .join("\n\n---\n\n");

  const allCitations = [...new Set(steps.flatMap((s) => s.citations))];
  const citationsList = allCitations.map((c, i) => `[${i + 1}] ${c}`).join("\n");

  const prompt = lang === "pt"
    ? `Você é um pesquisador expert. Com base nas pesquisas realizadas abaixo, compile um relatório completo, bem estruturado e profundo sobre o tema "${topic}".

REGRAS:
- Use headings (## e ###) para organizar seções
- Comece com um resumo executivo (3-4 parágrafos)
- Sintetize e cruze informações das diferentes pesquisas
- Destaque consensos e divergências encontradas
- Inclua dados numéricos, datas e fatos específicos
- Use tabelas para comparações quando relevante
- Termine com conclusões e perspectivas futuras
- Referencie as fontes usando [número] quando citar dados específicos
- O relatório deve ter no mínimo 2000 palavras
- Escreva em português brasileiro

PESQUISAS REALIZADAS:
${stepsContext}

FONTES DISPONÍVEIS:
${citationsList}

Compile o relatório final agora:`
    : `You are an expert researcher. Based on the research below, compile a complete, well-structured, and deep report on "${topic}".

RULES:
- Use headings (## and ###) to organize sections
- Start with an executive summary (3-4 paragraphs)
- Synthesize and cross-reference information from different searches
- Highlight consensus and divergences found
- Include numerical data, dates, and specific facts
- Use tables for comparisons when relevant
- End with conclusions and future perspectives
- Reference sources using [number] when citing specific data
- The report should be at least 2000 words

RESEARCH CONDUCTED:
${stepsContext}

AVAILABLE SOURCES:
${citationsList}

Compile the final report now:`;

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    // Fallback to flash
    const fallback = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });
    if (!fallback.ok) throw new Error("Failed to compile report");
    const d = await fallback.json();
    return d.choices?.[0]?.message?.content || "";
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
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

    // Deep research costs 22 credits (multiple searches + compilation)
    const creditResult = await deductCredits(authResult.userId, "deep_research", 22);
    if (!creditResult.success) {
      return insufficientCreditsResponse(corsHeaders, creditResult.error || "insufficient_credits");
    }

    const apiKey = Deno.env.get("PERPLEXITY_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "PERPLEXITY_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { topic, lang = "pt" } = await req.json();
    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return new Response(
        JSON.stringify({ error: "Topic is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Stream progress events
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const send = (event: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        try {
          // Step 1: Generate sub-queries
          send({ type: "status", step: 0, total: 7, message: lang === "pt" ? "Planejando pesquisa..." : "Planning research..." });

          const subQueries = await generateSubQueries(apiKey, topic.trim(), lang);

          send({
            type: "plan",
            queries: subQueries,
            message: lang === "pt" ? `${subQueries.length} sub-pesquisas planejadas` : `${subQueries.length} sub-queries planned`,
          });

          // Step 2-6: Execute each search
          const steps: ResearchStep[] = [];
          const systemPrompt = lang === "pt"
            ? "Você é um pesquisador detalhista. Responda de forma completa, com dados específicos, números, datas e citações quando possível. Seja factual e abrangente."
            : "You are a thorough researcher. Answer completely, with specific data, numbers, dates, and citations when possible. Be factual and comprehensive.";

          for (let i = 0; i < subQueries.length; i++) {
            const sq = subQueries[i];
            send({
              type: "status",
              step: i + 1,
              total: subQueries.length + 2,
              message: lang === "pt" ? `Pesquisando: ${sq.purpose}` : `Researching: ${sq.purpose}`,
              query: sq.query,
            });

            const result = await perplexitySearch(apiKey, sq.query, systemPrompt);
            steps.push({
              query: sq.query,
              purpose: sq.purpose,
              answer: result.answer,
              citations: result.citations,
            });

            send({
              type: "step_done",
              step: i + 1,
              total: subQueries.length + 2,
              purpose: sq.purpose,
              citationsCount: result.citations.length,
              answerPreview: result.answer.slice(0, 200) + "...",
            });
          }

          // Step 7: Compile final report
          send({
            type: "status",
            step: subQueries.length + 1,
            total: subQueries.length + 2,
            message: lang === "pt" ? "Compilando relatório final..." : "Compiling final report...",
          });

          const report = await compileReport(apiKey, topic.trim(), steps, lang);
          const allCitations = [...new Set(steps.flatMap((s) => s.citations))];

          send({
            type: "done",
            report,
            citations: allCitations,
            steps: steps.map((s) => ({
              query: s.query,
              purpose: s.purpose,
              citationsCount: s.citations.length,
            })),
            totalSearches: steps.length,
            totalCitations: allCitations.length,
          });
        } catch (err) {
          send({ type: "error", error: (err as Error).message });
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
  } catch (error) {
    console.error("Deep research error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

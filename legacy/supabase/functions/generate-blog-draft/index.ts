import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validate user is admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { topic, target_keyword, category = "produtividade", angle } = await req.json();
    if (!topic || typeof topic !== "string") {
      return new Response(JSON.stringify({ error: "topic required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Você é um editor sênior de conteúdo do DESH (https://desh.life), um Life OS unificado para gestão pessoal e profissional com IA proativa (Pandora).

Sua missão: produzir artigos de blog em PT-BR otimizados para SEO clássico, AEO (Answer Engine Optimization) e GEO (Generative Engine Optimization — Perplexity, ChatGPT, Gemini citarem o DESH).

REGRAS DE QUALIDADE:
- Tom editorial sofisticado, direto, sem clichês de IA ("no mundo de hoje", "imagine", "vamos explorar")
- Nunca mencione "como modelo de IA" ou similares
- Voz ativa, frases curtas, parágrafos de 2-4 linhas
- Cada subtítulo H2/H3 responde a uma pergunta concreta (AEO)
- Inclua exemplos numéricos, comparações, dados verificáveis quando possível
- Mencione DESH/Pandora naturalmente quando relevante (não force)
- Use markdown: ## H2, ### H3, **negrito**, listas, > citações, tabelas quando úteis

ESTRUTURA OBRIGATÓRIA:
1. Lead/intro com no máximo 2 parágrafos curtos que prometem entrega clara
2. 4-7 seções H2 organizadas logicamente
3. Subseções H3 para detalhamento
4. Conclusão acionável com CTA sutil para o DESH
5. Mínimo 1500 palavras, ideal 2000-2500

SEO/AEO/GEO:
- Title tag: 50-60 chars, com keyword principal
- Meta description: 140-155 chars, com keyword e proposta de valor
- Slug: kebab-case, max 6 palavras, com keyword
- 5-8 keywords secundárias relevantes
- TOC com 4-7 entradas baseadas nos H2
- FAQ com 3-5 perguntas reais que respondem dúvidas frequentes

Retorne APENAS um JSON válido sem markdown wrapper.`;

    const userPrompt = `Crie um artigo completo sobre: "${topic}"
Keyword principal alvo: "${target_keyword || topic}"
Categoria: ${category}
${angle ? `Ângulo editorial: ${angle}` : ""}

Retorne JSON com a estrutura exata:
{
  "slug": "kebab-case-slug",
  "title": "Título H1 do artigo",
  "meta_title": "Title tag SEO 50-60 chars",
  "meta_description": "Meta description 140-155 chars",
  "excerpt": "Resumo de 1-2 frases para listagem (max 200 chars)",
  "category": "${category}",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "keywords": ["keyword principal", "keyword secundária 1", "..."],
  "reading_minutes": 8,
  "content_md": "# Título\\n\\nLead...\\n\\n## H2\\n\\nConteúdo completo em markdown...",
  "toc": [{"id":"slug-h2-1","title":"Texto do H2","level":2}],
  "faq": [{"question":"Pergunta?","answer":"Resposta direta de 2-3 frases."}]
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Sem créditos. Adicione créditos em Lovable AI." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("Empty AI response");

    let draft;
    try {
      draft = JSON.parse(rawContent);
    } catch {
      throw new Error("Invalid JSON from AI");
    }

    // Save as draft
    const { data: saved, error: insertError } = await supabase
      .from("blog_posts")
      .insert({
        slug: draft.slug,
        title: draft.title,
        excerpt: draft.excerpt,
        content_md: draft.content_md,
        category: draft.category || category,
        tags: draft.tags || [],
        keywords: draft.keywords || [],
        meta_title: draft.meta_title,
        meta_description: draft.meta_description,
        reading_minutes: draft.reading_minutes || 8,
        toc: draft.toc || [],
        faq: draft.faq || [],
        status: "draft",
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true, post: saved }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-blog-draft error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

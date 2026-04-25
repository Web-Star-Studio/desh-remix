import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { corsHeaders } from "./utils.ts";
import { deductCredits } from "./credits.ts";

const SERPAPI_BASE = "https://serpapi.com/search.json";

function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

function computeDiff(oldData: any, newData: any): string {
  const oldCitations = new Set((oldData?.citations || []) as string[]);
  const newCitations = (newData?.citations || []) as string[];
  const newEntries = newCitations.filter((c: string) => !oldCitations.has(c));

  const oldKeyFacts = new Set((oldData?.key_facts || []) as string[]);
  const newKeyFacts = (newData?.key_facts || []) as string[];
  const newFacts = newKeyFacts.filter((f: string) => !oldKeyFacts.has(f));

  const oldTitles = new Set((oldData?.organic_results || []).map((r: any) => r.title));
  const newOrganic = (newData?.organic_results || []) as any[];
  const newOrganicEntries = newOrganic.filter((r: any) => !oldTitles.has(r.title));

  const parts: string[] = [];
  if (newEntries.length > 0) parts.push(`${newEntries.length} nova(s) fonte(s) encontrada(s)`);
  if (newFacts.length > 0) parts.push(`${newFacts.length} novo(s) ponto(s)-chave:\n${newFacts.map(f => `• ${f}`).join("\n")}`);
  if (newOrganicEntries.length > 0) parts.push(`${newOrganicEntries.length} novo(s) resultado(s) Google:\n${newOrganicEntries.slice(0, 3).map((r: any) => `• "${r.title}"`).join("\n")}`);

  if (parts.length === 0) return "Sem mudanças significativas nos resultados.";
  return parts.join("\n\n");
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (i === maxRetries - 1) return res;
    } catch (err) {
      if (i === maxRetries - 1) throw err;
    }
    await new Promise(r => setTimeout(r, 800 * (i + 1)));
  }
  throw new Error("Max retries exceeded");
}

async function fetchPerplexity(query: string, frequency: string, apiKey: string): Promise<any> {
  const searchRecency = frequency === "hourly" ? "day" : frequency === "daily" ? "week" : "month";
  const response = await fetchWithRetry("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        { role: "system", content: "Você é um assistente de monitoramento de buscas. Retorne informações atualizadas e factuais. Inclua os pontos mais importantes. Seja conciso." },
        { role: "user", content: query }
      ],
      search_recency_filter: searchRecency,
      return_citations: true,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "monitor_result",
          schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              key_facts: { type: "array", items: { type: "string" } }
            },
            required: ["summary", "key_facts"]
          }
        }
      }
    }),
  });

  if (!response.ok) throw new Error(`Perplexity error: ${response.status}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  const citations = data.citations || [];

  let parsed: any = {};
  try { parsed = JSON.parse(content); } catch { parsed = { summary: content, key_facts: [] }; }

  return { summary: parsed.summary || "", key_facts: parsed.key_facts || [], citations, provider: "perplexity" };
}

async function fetchSerpAPI(query: string, engine: string, apiKey: string): Promise<any> {
  const params = new URLSearchParams({
    api_key: apiKey, q: query, engine: engine || "google", hl: "pt", gl: "br", num: "10",
  });
  const response = await fetch(`${SERPAPI_BASE}?${params.toString()}`);
  if (!response.ok) throw new Error(`SerpAPI error: ${response.status}`);
  const data = await response.json();

  return {
    organic_results: (data.organic_results || []).slice(0, 10).map((r: any) => ({ title: r.title || "", link: r.link || "", snippet: r.snippet || "" })),
    knowledge_graph: data.knowledge_graph ? { title: data.knowledge_graph.title, description: data.knowledge_graph.description } : null,
    answer_box: data.answer_box ? { answer: data.answer_box.answer || data.answer_box.result, snippet: data.answer_box.snippet } : null,
    news_results: (data.news_results || []).slice(0, 5).map((n: any) => ({ title: n.title, link: n.link, source: n.source?.name || n.source, date: n.date })),
    provider: "serpapi",
  };
}

export async function handleMonitorCheck(_req: Request, body: Record<string, any>): Promise<Response> {
  try {
    const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
    const serpApiKey = Deno.env.get("SERPAPI_KEY");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const forceMonitorId: string | null = body?.monitor_id || null;
    const now = new Date();

    let monitors: any[];
    if (forceMonitorId) {
      const { data, error: fetchErr } = await supabase.from("serp_monitors").select("*").eq("id", forceMonitorId);
      if (fetchErr) throw new Error(`Failed to fetch monitor: ${fetchErr.message}`);
      monitors = data || [];
    } else {
      const { data, error: fetchErr } = await supabase.from("serp_monitors").select("*").eq("enabled", true);
      if (fetchErr) throw new Error(`Failed to fetch monitors: ${fetchErr.message}`);
      monitors = data || [];
    }

    if (!monitors || monitors.length === 0) {
      return new Response(JSON.stringify({ checked: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const dueMonitors = forceMonitorId ? monitors : monitors.filter((m: any) => {
      if (!m.last_checked_at) return true;
      const lastChecked = new Date(m.last_checked_at);
      const diffHours = (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60);
      switch (m.frequency) {
        case "hourly": return diffHours >= 1;
        case "daily": return diffHours >= 24;
        case "weekly": return diffHours >= 168;
        default: return diffHours >= 24;
      }
    });

    let checked = 0;
    let notified = 0;

    for (const monitor of dueMonitors) {
      try {
        const provider = (monitor.params as any)?.provider || "perplexity";
        const creditAmount = provider === "both" ? 4 : 2;

        const creditResult = await deductCredits(monitor.user_id, "serp_monitor_check", creditAmount);
        if (!creditResult.success) { console.warn(`Skipping monitor ${monitor.id}: insufficient credits`); continue; }

        let resultData: any = {};
        const fetchPromises: Promise<any>[] = [];

        const usePerplexity = (provider === "perplexity" || provider === "both") && perplexityKey;
        const useSerpApi = (provider === "serpapi" || provider === "both") && serpApiKey;

        if (usePerplexity) fetchPromises.push(fetchPerplexity(monitor.query, monitor.frequency, perplexityKey!).catch(err => { console.error(`Perplexity error for ${monitor.id}:`, err); return null; }));
        if (useSerpApi) fetchPromises.push(fetchSerpAPI(monitor.query, monitor.engine || "google", serpApiKey!).catch(err => { console.error(`SerpAPI error for ${monitor.id}:`, err); return null; }));

        if (fetchPromises.length === 0) { console.warn(`No API keys available for monitor ${monitor.id}`); continue; }

        const results = await Promise.all(fetchPromises);

        for (const res of results) {
          if (!res) continue;
          if (res.provider === "perplexity") {
            resultData.summary = res.summary; resultData.key_facts = res.key_facts; resultData.citations = res.citations;
          } else if (res.provider === "serpapi") {
            resultData.organic_results = res.organic_results; resultData.knowledge_graph = res.knowledge_graph;
            resultData.answer_box = res.answer_box; resultData.news_results = res.news_results;
          }
        }

        resultData.providers_used = results.filter(Boolean).map((r: any) => r.provider);

        const hashInput = JSON.stringify({
          kf: resultData.key_facts || [], cit: (resultData.citations || []).slice(0, 5),
          org: (resultData.organic_results || []).slice(0, 5).map((r: any) => r.title),
        });
        const newHash = hashText(hashInput);

        let diffSummary = "Primeira verificação — resultados iniciais armazenados.";
        let hasChanged = true;

        if (monitor.last_results_hash) {
          hasChanged = newHash !== monitor.last_results_hash;
          if (hasChanged) {
            const { data: lastResult } = await supabase.from("serp_monitor_results").select("results_data").eq("monitor_id", monitor.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
            diffSummary = computeDiff(lastResult?.results_data, resultData);
          } else {
            diffSummary = "Sem mudanças nos resultados.";
          }
        }

        await supabase.from("serp_monitor_results").insert({ monitor_id: monitor.id, results_data: resultData, diff_summary: diffSummary });
        await supabase.from("serp_monitors").update({ last_checked_at: now.toISOString(), last_results_hash: newHash }).eq("id", monitor.id);
        checked++;

        if (hasChanged && monitor.notify_on_change && monitor.last_results_hash) {
          const providerLabel = resultData.providers_used?.join(" + ") || provider;
          await supabase.from("ai_insights").insert({
            user_id: monitor.user_id, title: `Monitor: ${monitor.name}`,
            message: `[${providerLabel}]\n${diffSummary}`, type: "serp_monitor", severity: "info", icon: "🔍",
            expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          });
          notified++;
        }
      } catch (monitorErr) {
        console.error(`Error processing monitor ${monitor.id}:`, monitorErr);
      }
    }

    return new Response(
      JSON.stringify({ checked, notified, total_due: dueMonitors.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("serp-monitor-check error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

import { corsHeaders } from "./utils.ts";
import { verifyAuth } from "./auth.ts";
import { deductCredits, insufficientCreditsResponse } from "./credits.ts";

const SERPAPI_BASE = "https://serpapi.com/search.json";

const ENGINE_CREDIT_MAP: Record<string, string> = {
  google: "serp_search",
  google_news: "serp_news",
  google_images: "serp_images",
  google_shopping: "serp_shopping",
  google_trends: "serp_trends",
  google_jobs: "serp_jobs",
  google_finance: "serp_finance",
  google_maps: "serp_maps",
  google_flights: "serp_flights",
  google_hotels: "serp_hotels",
  google_events: "serp_events",
  google_scholar: "serp_scholar",
  youtube: "serp_youtube",
  google_patents: "serp_patents",
};

const ENGINES_REQUIRING_AI: Record<string, { schema: string }> = {
  google_flights: {
    schema: `{
  "q": "refined search query",
  "departure_id": "IATA airport code of origin (e.g. GRU, JFK)",
  "arrival_id": "IATA airport code of destination (e.g. GIG, LHR)",
  "outbound_date": "YYYY-MM-DD",
  "return_date": "YYYY-MM-DD or omit if one-way",
  "type": "1=round-trip, 2=one-way (default 1)",
  "travel_class": "1=economy, 2=premium_economy, 3=business, 4=first (default 1)",
  "adults": "number (default 1)",
  "children": "number (default 0)",
  "stops": "0=any, 1=nonstop, 2=1stop (default 0)",
  "currency": "default BRL"
}`,
  },
  google_hotels: {
    schema: `{
  "q": "refined search query (e.g. 'hotels in Paris')",
  "check_in_date": "YYYY-MM-DD",
  "check_out_date": "YYYY-MM-DD",
  "adults": "number (default 2)",
  "children": "number (default 0)",
  "sort_by": "3=lowest_price, 8=highest_rating (default 3)",
  "currency": "default BRL"
}`,
  },
  google_finance: {
    schema: `{
  "q": "ticker:EXCHANGE (e.g. PETR4:BVMF, AAPL:NASDAQ, BTC-USD). Convert company names to tickers.",
  "window": "1D, 5D, 1M, 6M, YTD, 1Y, 5Y, MAX (default 1M)"
}`,
  },
  google_jobs: {
    schema: `{
  "q": "job search query optimized for Google Jobs",
  "ltype": "1=full-time or omit for any"
}`,
  },
  google_events: {
    schema: `{
  "q": "event search query",
  "htichips": "date:today, date:tomorrow, date:week, date:month or omit"
}`,
  },
  google_scholar: {
    schema: `{
  "q": "academic search query (English preferred for better results)",
  "as_ylo": "min year or omit",
  "as_yhi": "max year or omit",
  "scisbd": "1=sort by date, 0=relevance (default 0)"
}`,
  },
  google_maps: {
    schema: `{
  "q": "search query for places/businesses (e.g. 'restaurantes italianos em Pinheiros SP')",
  "ll": "@lat,lng,zoom (optional, e.g. @-23.5505,-46.6333,15z)",
  "type": "search (default)"
}`,
  },
  google_trends: {
    schema: `{
  "q": "search term(s), comma-separated for comparison (e.g. 'React,Vue,Angular')",
  "date": "time range: today 1-m, today 3-m, today 12-m, today 5-y, all (default today 12-m)",
  "geo": "country code (default BR)",
  "cat": "category id or omit"
}`,
  },
};

async function aiExtractParams(query: string, engine: string, today: string): Promise<Record<string, any> | null> {
  const config = ENGINES_REQUIRING_AI[engine];
  if (!config) return null;

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.warn("LOVABLE_API_KEY not set, skipping AI param extraction");
    return null;
  }

  const systemPrompt = `You extract structured search parameters from natural language. Today is ${today}.

RULES:
- Return ONLY valid JSON. No markdown fences, no explanation.
- If the query is unrelated to the engine or you cannot extract params, return: {"q": "<original query>"}
- NEVER return prose or explanations. ALWAYS return JSON.
- Dates: YYYY-MM-DD. Relative dates (amanhã, next week) → resolve using today.
- Flights: city→IATA (São Paulo→GRU, Rio→GIG, Brasília→BSB, New York→JFK, London→LHR, Paris→CDG, Miami→MIA, Lisboa→LIS, Madrid→MAD, Buenos Aires→EZE, Recife→REC, Salvador→SSA, Curitiba→CWB, BH→CNF, Fortaleza→FOR, POA→POA, Floripa→FLN, Manaus→MAO, Campinas→VCP).
- Hotels: no dates → check_in=today, check_out=today+2.
- Finance: company→ticker (Apple→AAPL:NASDAQ, Petrobras→PETR4:BVMF, Tesla→TSLA:NASDAQ, Google→GOOGL:NASDAQ, Bitcoin→BTC-USD, Vale→VALE3:BVMF, Itaú→ITUB4:BVMF, Bradesco→BBDC4:BVMF, Magalu→MGLU3:BVMF).
- One-way flights: type=2, round-trip: type=1. No return date → one-way.
- Omit fields you can't determine (except q which is always required).

Schema for ${engine}:
${config.schema}`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
        temperature: 0,
      }),
    });

    if (!resp.ok) {
      console.error("AI param extraction failed:", resp.status, await resp.text());
      return null;
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    let jsonStr = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    if (!jsonStr.startsWith("{")) {
      const match = jsonStr.match(/\{[\s\S]*\}/);
      if (match) {
        jsonStr = match[0];
      } else {
        console.warn("[AI-params] No JSON found in response:", content);
        return null;
      }
    }
    const parsed = JSON.parse(jsonStr);
    return parsed;
  } catch (err) {
    console.error("AI param extraction error:", err);
    return null;
  }
}

interface ValidationResult {
  valid: boolean;
  missing: string[];
  message: string;
}

function validateEngineParams(engine: string, params: Record<string, any>, query: string): ValidationResult {
  switch (engine) {
    case "google_flights": {
      const missing: string[] = [];
      if (!params.departure_id) missing.push("aeroporto de origem");
      if (!params.arrival_id) missing.push("aeroporto de destino");
      if (missing.length > 0) {
        return {
          valid: false,
          missing,
          message: `Para buscar voos, preciso de: ${missing.join(" e ")}. Tente algo como "voos de São Paulo para Lisboa amanhã".`,
        };
      }
      return { valid: true, missing: [], message: "" };
    }
    default:
      return { valid: true, missing: [], message: "" };
  }
}

async function aiSuggestCorrection(query: string, engine: string, missing: string[]): Promise<any | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;

  const engineLabels: Record<string, string> = {
    google_flights: "voos",
    google_hotels: "hotéis",
    google_finance: "finanças",
    google_jobs: "vagas",
    google_events: "eventos",
  };

  const prompt = `O usuário buscou "${query}" no módulo de ${engineLabels[engine] || engine}, mas faltam informações: ${missing.join(", ")}.

Gere EXATAMENTE 3 sugestões de busca corrigida em português do Brasil, que sejam variações plausíveis do que o usuário quis dizer.
Inclua uma breve explicação de por que a busca original não funcionou.

Responda SOMENTE em JSON válido:
{
  "corrected_queries": ["sugestão 1", "sugestão 2", "sugestão 3"],
  "explanation": "explicação curta e amigável"
}`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    const jsonStr = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error("AI suggestion error:", err);
    return null;
  }
}

// ──── Response normalization helpers ────

function safeArray(val: any): any[] {
  if (Array.isArray(val)) return val;
  return [];
}

function normalizeResponse(data: any, engine: string): any {
  const base = {
    search_metadata: {
      total_time_taken: data.search_metadata?.total_time_taken,
      engine,
      query: data.search_parameters?.q || data.search_parameters?.search_query || "",
    },
  };

  switch (engine) {
    case "google_finance": return { ...base, ...normalizeFinance(data) };
    case "google_flights": return { ...base, ...normalizeFlights(data) };
    case "google_hotels": return { ...base, ...normalizeHotels(data) };
    case "google_jobs": return { ...base, ...normalizeJobs(data) };
    case "google_events": return { ...base, ...normalizeEvents(data) };
    case "google_scholar": return { ...base, ...normalizeScholar(data) };
    case "youtube": return { ...base, ...normalizeYouTube(data) };
    case "google_maps": return { ...base, ...normalizeMaps(data) };
    case "google_patents": return { ...base, ...normalizePatents(data) };
    case "google_trends": return { ...base, ...normalizeTrends(data) };
    default: return { ...base, ...normalizeGeneral(data) };
  }
}

function normalizeGeneral(data: any) {
  const result: any = { organic_results: [] };

  if (data.organic_results) {
    result.organic_results = safeArray(data.organic_results).map((r: any, i: number) => ({
      position: r.position || i + 1, title: r.title || "", link: r.link || "",
      snippet: r.snippet || "", displayed_link: r.displayed_link, favicon: r.favicon, date: r.date,
    }));
  }

  if (data.knowledge_graph) {
    const kg = data.knowledge_graph;
    result.knowledge_graph = {
      title: kg.title || "", type: kg.type, description: kg.description,
      image: kg.header_images?.[0]?.image || kg.thumbnail, attributes: {},
      source: kg.source ? { name: kg.source.name, link: kg.source.link } : undefined,
    };
    for (const [key, value] of Object.entries(kg)) {
      if (typeof value === "string" && !["title", "type", "description", "thumbnail", "kgmid", "entity_type"].includes(key)) {
        result.knowledge_graph.attributes[key] = value;
      }
    }
  }

  if (data.answer_box) {
    result.answer_box = {
      type: data.answer_box.type || "unknown", answer: data.answer_box.answer || data.answer_box.result,
      snippet: data.answer_box.snippet, title: data.answer_box.title, link: data.answer_box.link,
    };
  }

  if (data.answer_box?.snippet) {
    result.featured_snippet = { title: data.answer_box.title || "", content: data.answer_box.snippet, link: data.answer_box.link || "" };
  }

  if (data.related_questions) {
    result.people_also_ask = safeArray(data.related_questions).map((q: any) => ({ question: q.question, snippet: q.snippet, link: q.link }));
  }

  if (data.related_searches) {
    result.related_searches = safeArray(data.related_searches).map((s: any) => s.query);
  }

  if (data.shopping_results) {
    result.shopping_results = safeArray(data.shopping_results).map((s: any) => ({
      title: s.title || "", price: s.extracted_price ? `R$ ${s.extracted_price}` : s.price || "",
      link: s.link || "", source: s.source || "", thumbnail: s.thumbnail, rating: s.rating, reviews: s.reviews,
    }));
  }

  if (data.news_results) {
    result.news_results = safeArray(data.news_results).map((n: any) => ({
      title: n.title || "", link: n.link || "", source: n.source?.name || n.source || "",
      date: n.date || "", snippet: n.snippet, thumbnail: n.thumbnail,
    }));
  }

  if (data.images_results) {
    result.image_results = safeArray(data.images_results).slice(0, 20).map((img: any) => ({
      title: img.title || "", link: img.link || "", thumbnail: img.thumbnail || "",
      original: img.original || img.link || "", source: img.source || "",
    }));
  }

  return result;
}

function normalizeFinance(data: any) {
  return {
    summary: data.summary ? {
      title: data.summary.title || data.search_parameters?.q || "", stock: data.summary.stock || "",
      exchange: data.summary.exchange || "", price: data.summary.price, currency: data.summary.currency || "USD",
      price_change: data.summary.price_movement?.percentage, price_movement: data.summary.price_movement?.movement || "",
      previous_close: data.summary.previous_close, extensions: safeArray(data.summary.extensions),
    } : null,
    graph: safeArray(data.graph).map((p: any) => ({ price: p.price, date: p.date, volume: p.volume })),
    financials: data.financials || null,
    news_results: safeArray(data.news_results).slice(0, 5).map((n: any) => ({
      title: n.title || "", link: n.link || "", source: n.source || "", date: n.date || "",
      snippet: n.snippet || "", thumbnail: n.thumbnail,
    })),
    markets: data.markets || null,
    knowledge_graph: data.knowledge_graph ? { title: data.knowledge_graph.title, description: data.knowledge_graph.description } : null,
  };
}

function normalizeFlights(data: any) {
  const mapFlight = (f: any) => ({
    flights: safeArray(f.flights).map((leg: any) => ({
      airline: leg.airline || "", airline_logo: leg.airline_logo || "", flight_number: leg.flight_number || "",
      departure_airport: leg.departure_airport?.name || "", departure_id: leg.departure_airport?.id || "",
      departure_time: leg.departure_airport?.time || "", arrival_airport: leg.arrival_airport?.name || "",
      arrival_id: leg.arrival_airport?.id || "", arrival_time: leg.arrival_airport?.time || "",
      duration: leg.duration || 0, airplane: leg.airplane || "", travel_class: leg.travel_class || "",
      legroom: leg.legroom || "",
    })),
    total_duration: f.total_duration || 0, price: f.price || 0, type: f.type || "",
    airline_logos: safeArray(f.flights).map((l: any) => l.airline_logo).filter(Boolean),
    stops: safeArray(f.layovers).length,
    layovers: safeArray(f.layovers).map((l: any) => ({ name: l.name || "", duration: l.duration || 0, id: l.id || "" })),
    carbon_emissions: f.carbon_emissions ? {
      this_flight: f.carbon_emissions.this_flight, typical: f.carbon_emissions.typical_for_this_route,
      difference: f.carbon_emissions.difference_percent,
    } : null,
  });

  return {
    best_flights: safeArray(data.best_flights).map(mapFlight),
    other_flights: safeArray(data.other_flights).slice(0, 10).map(mapFlight),
    price_insights: data.price_insights ? {
      lowest_price: data.price_insights.lowest_price, typical_price_range: data.price_insights.typical_price_range,
      price_level: data.price_insights.price_level,
    } : null,
    airports: safeArray(data.airports),
  };
}

function normalizeHotels(data: any) {
  return {
    properties: safeArray(data.properties).slice(0, 20).map((p: any) => ({
      name: p.name || "", type: p.type || "Hotel", description: p.description || "", link: p.link || "",
      rate_per_night: p.rate_per_night?.lowest || p.rate_per_night?.extracted_lowest || "",
      extracted_rate: p.rate_per_night?.extracted_lowest || null, total_rate: p.total_rate?.lowest || "",
      overall_rating: p.overall_rating || null, reviews: p.reviews || 0,
      stars: p.hotel_class ? parseInt(p.hotel_class) : null,
      check_in_time: p.check_in_time || "", check_out_time: p.check_out_time || "",
      amenities: safeArray(p.amenities).slice(0, 8),
      images: safeArray(p.images).slice(0, 4).map((img: any) => ({ thumbnail: img.thumbnail || "", original: img.original_image || img.thumbnail || "" })),
      gps_coordinates: p.gps_coordinates || null,
      nearby_places: safeArray(p.nearby_places).slice(0, 5).map((np: any) => ({
        name: np.name || "",
        transportations: safeArray(np.transportations).map((t: any) => ({ type: t.type || "", duration: t.duration || "" })),
      })),
    })),
    brands: safeArray(data.brands).map((b: any) => ({ name: b.name || "", children: safeArray(b.children) })),
  };
}

function normalizeJobs(data: any) {
  return {
    jobs_results: safeArray(data.jobs_results).map((j: any) => ({
      title: j.title || "", company_name: j.company_name || "", location: j.location || "",
      description: j.description || "", thumbnail: j.thumbnail || "", extensions: safeArray(j.extensions),
      detected_extensions: j.detected_extensions || {},
      apply_options: safeArray(j.apply_options).map((ao: any) => ({ title: ao.title || "", link: ao.link || "" })),
      via: j.via || "",
    })),
    chips: safeArray(data.chips).map((c: any) => ({
      type: c.type || "",
      options: safeArray(c.options).map((o: any) => ({ text: o.text || "", value: o.value || "" })),
    })),
  };
}

function normalizeEvents(data: any) {
  return {
    events_results: safeArray(data.events_results).map((e: any) => ({
      title: e.title || "",
      date: e.date ? { start_date: e.date.start_date || "", when: e.date.when || "" } : null,
      address: Array.isArray(e.address) ? e.address.join(", ") : (e.address || ""),
      link: e.link || "", description: e.description || "", thumbnail: e.thumbnail || "",
      venue: e.venue ? { name: e.venue.name || "", rating: e.venue.rating, reviews: e.venue.reviews, link: e.venue.link || "" } : null,
      ticket_info: safeArray(e.ticket_info).map((t: any) => ({ source: t.source || "", link: t.link || "", link_type: t.link_type || "" })),
      event_location_map: e.event_location_map ? { image: e.event_location_map.image || "", link: e.event_location_map.link || "" } : null,
    })),
  };
}

function normalizeScholar(data: any) {
  return {
    scholar_results: safeArray(data.organic_results).map((r: any) => ({
      title: r.title || "", link: r.link || "", snippet: r.snippet || "",
      publication_info: r.publication_info?.summary || "",
      authors: safeArray(r.publication_info?.authors).map((a: any) => ({ name: a.name || "", link: a.link || "" })),
      cited_by: r.inline_links?.cited_by?.total || 0, cited_by_link: r.inline_links?.cited_by?.link || "",
      related_link: r.inline_links?.related_pages_link || "",
      versions_link: r.inline_links?.versions?.link || "", versions_total: r.inline_links?.versions?.total || 0,
      resources: safeArray(r.resources).map((res: any) => ({ title: res.title || "", file_format: res.file_format || "", link: res.link || "" })),
      year: r.publication_info?.summary?.match(/(\d{4})/)?.[1] || "",
    })),
    total_results: data.search_information?.total_results || 0,
    profiles: safeArray(data.profiles).map((p: any) => ({
      name: p.name || "", link: p.link || "", author_id: p.author_id || "",
      affiliations: p.affiliations || "", thumbnail: p.thumbnail || "",
    })),
  };
}

function normalizeYouTube(data: any) {
  return {
    video_results: safeArray(data.video_results).slice(0, 20).map((v: any) => ({
      title: v.title || "", link: v.link || "", thumbnail: v.thumbnail?.static || v.thumbnail || "",
      channel: v.channel?.name || "", channel_link: v.channel?.link || "",
      views: v.views || 0, published_date: v.published_date || "", length: v.length || "",
      description: v.description || "",
    })),
  };
}

function normalizeMaps(data: any) {
  return {
    local_results: safeArray(data.local_results).slice(0, 20).map((p: any) => ({
      title: p.title || "", place_id: p.place_id || "", address: p.address || "",
      rating: p.rating || null, reviews: p.reviews || 0, price: p.price || "",
      type: p.type || "", phone: p.phone || "", website: p.website || "",
      hours: p.hours || p.operating_hours?.hours || "", thumbnail: p.thumbnail || "",
      gps_coordinates: p.gps_coordinates || null, service_options: p.service_options || {},
    })),
  };
}

function normalizePatents(data: any) {
  return {
    patent_results: safeArray(data.organic_results).slice(0, 20).map((p: any) => ({
      title: p.title || "", patent_id: p.patent_id || p.publication_number || "",
      snippet: p.snippet || "", filing_date: p.filing_date || "", grant_date: p.grant_date || "",
      inventor: p.inventor || "", assignee: p.assignee || "", link: p.link || "",
      thumbnail: p.thumbnail || "", pdf: p.pdf || "",
      priority_date: p.priority_date || "", publication_date: p.publication_date || "",
    })),
  };
}

function flattenRelatedQueries(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const result: any[] = [];
    for (const [type, items] of Object.entries(raw)) {
      if (Array.isArray(items)) {
        result.push({ keyword: "", type, items });
      }
    }
    return result;
  }
  return [];
}

function normalizeTrends(data: any) {
  return {
    interest_over_time: safeArray(data.interest_over_time?.timeline_data).map((t: any) => ({
      date: t.date || "", timestamp: t.timestamp,
      values: safeArray(t.values).map((v: any) => ({
        query: v.query || "", value: parseInt(v.value) || 0, extracted_value: v.extracted_value || 0,
      })),
    })),
    related_queries: flattenRelatedQueries(data.related_queries).map((rq: any) => ({
      keyword: rq.keyword || rq.query || "", type: rq.type || "",
      items: safeArray(rq.items).map((i: any) => ({ query: i.query || "", value: i.value || "", link: i.link || "", serpapi_link: i.serpapi_link || "" })),
    })),
    compared_breakdown_by_region: safeArray(data.compared_breakdown_by_region).map((r: any) => ({
      geo: r.geo || "", location: r.location || "", max_value_index: r.max_value_index || 0,
      values: safeArray(r.values).map((v: any) => ({ query: v.query || "", value: parseInt(v.value) || 0, extracted_value: v.extracted_value || 0 })),
    })),
  };
}

// ──── Main search handler ────

export async function handleSerpSearch(req: Request, body: Record<string, any>): Promise<Response> {
  const authResult = await verifyAuth(req);
  if (authResult instanceof Response) {
    return new Response(authResult.body, {
      status: authResult.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const serpApiKey = Deno.env.get("SERPAPI_KEY");
  if (!serpApiKey) {
    return new Response(
      JSON.stringify({ error: "SERPAPI_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let { query, engine = "google", location, lang = "pt-br", num = 10, ...extraParams } = body;

  if (!query || typeof query !== "string" || !query.trim()) {
    return new Response(
      JSON.stringify({ error: "Query is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // AI Parameter Extraction for specialized engines
  const needsAI = ENGINES_REQUIRING_AI[engine] && !body._ai_resolved;
  let aiParams: Record<string, any> | null = null;

  if (needsAI) {
    const today = new Date().toISOString().split("T")[0];
    aiParams = await aiExtractParams(query.trim(), engine, today);
    if (aiParams) {
      if (aiParams.q) { query = aiParams.q; delete aiParams.q; }
      extraParams = { ...aiParams, ...extraParams };
    }
  }

  const validation = validateEngineParams(engine, extraParams, query.trim());
  if (!validation.valid) {
    const suggestions = await aiSuggestCorrection(query.trim(), engine, validation.missing);
    return new Response(
      JSON.stringify({ error: validation.message, suggestion: suggestions, search_metadata: { engine, query: query.trim(), ai_params: aiParams } }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const creditAction = ENGINE_CREDIT_MAP[engine] || "serp_search";
  const creditResult = await deductCredits(authResult.userId, creditAction);
  if (!creditResult.success) {
    return insufficientCreditsResponse(corsHeaders, creditResult.error || "insufficient_credits");
  }

  // Build SerpAPI query params
  const params = new URLSearchParams({ api_key: serpApiKey, q: query.trim(), engine });

  const langParts = lang.split("-");
  if (!["google_flights", "google_hotels"].includes(engine)) {
    params.set("hl", langParts[0] || "pt");
    params.set("gl", langParts[1] || "br");
  }
  if (!["google_finance", "google_flights", "google_hotels", "google_events", "google_scholar"].includes(engine)) {
    params.set("num", String(num));
  }

  if (location) params.set("location", location);

  const tbsParts: string[] = [];
  const addTbs = (val: string) => { if (val) tbsParts.push(val); };

  switch (engine) {
    case "google_images":
      params.set("tbm", "isch");
      if (extraParams.tbs_size) addTbs(extraParams.tbs_size);
      if (extraParams.tbs_color) addTbs(extraParams.tbs_color);
      if (extraParams.tbs_type) addTbs(extraParams.tbs_type);
      break;
    case "google_shopping":
      params.set("tbm", "shop");
      if (extraParams.tbs_price) addTbs(extraParams.tbs_price);
      if (extraParams.tbs_condition) addTbs(extraParams.tbs_condition);
      if (extraParams.tbs_free_shipping) addTbs(extraParams.tbs_free_shipping);
      break;
    case "google_news":
      if (extraParams.tbs) addTbs(extraParams.tbs);
      break;
    case "google_finance":
      if (extraParams.window) params.set("window", extraParams.window);
      params.set("hl", langParts[0] || "pt");
      break;
    case "google_flights":
      params.set("departure_id", extraParams.departure_id);
      params.set("arrival_id", extraParams.arrival_id);
      {
        const flightToday = new Date();
        const defaultOutbound = flightToday.toISOString().split("T")[0];
        params.set("outbound_date", extraParams.outbound_date || defaultOutbound);
        const flightType = extraParams.type ? String(extraParams.type) : "1";
        if (flightType === "1" && !extraParams.return_date) {
          const outDate = new Date(extraParams.outbound_date || defaultOutbound);
          outDate.setDate(outDate.getDate() + 7);
          params.set("return_date", outDate.toISOString().split("T")[0]);
          params.set("type", "1");
        } else {
          if (extraParams.return_date) params.set("return_date", extraParams.return_date);
          params.set("type", flightType);
        }
      }
      if (extraParams.travel_class) params.set("travel_class", String(extraParams.travel_class));
      if (extraParams.adults) params.set("adults", String(extraParams.adults));
      if (extraParams.children) params.set("children", String(extraParams.children));
      if (extraParams.stops) params.set("stops", String(extraParams.stops));
      if (extraParams.sort_by) params.set("sort_by", String(extraParams.sort_by));
      params.set("currency", extraParams.currency || "BRL");
      params.set("hl", langParts[0] || "pt");
      break;
    case "google_hotels": {
      const today = new Date();
      const defaultCheckIn = today.toISOString().split("T")[0];
      const checkout = new Date(today);
      checkout.setDate(checkout.getDate() + 2);
      const defaultCheckOut = checkout.toISOString().split("T")[0];
      params.set("check_in_date", extraParams.check_in_date || defaultCheckIn);
      params.set("check_out_date", extraParams.check_out_date || defaultCheckOut);
      if (extraParams.adults) params.set("adults", String(extraParams.adults));
      if (extraParams.children) params.set("children", String(extraParams.children));
      if (extraParams.sort_by) params.set("sort_by", String(extraParams.sort_by));
      if (extraParams.rating) params.set("rating", String(extraParams.rating));
      if (extraParams.property_type) params.set("property_type", String(extraParams.property_type));
      params.set("currency", extraParams.currency || "BRL");
      params.set("hl", langParts[0] || "pt");
      params.set("gl", langParts[1] || "br");
      break;
    }
    case "google_events": {
      const htichipsParts: string[] = [];
      if (extraParams.htichips) htichipsParts.push(extraParams.htichips);
      if (extraParams.htichips_type) htichipsParts.push(extraParams.htichips_type);
      if (htichipsParts.length) params.set("htichips", htichipsParts.join(","));
      params.set("hl", langParts[0] || "pt");
      break;
    }
    case "google_scholar":
      if (extraParams.as_ylo) params.set("as_ylo", String(extraParams.as_ylo));
      if (extraParams.as_yhi) params.set("as_yhi", String(extraParams.as_yhi));
      if (extraParams.scisbd) params.set("scisbd", String(extraParams.scisbd));
      if (extraParams.as_sdt) params.set("as_sdt", String(extraParams.as_sdt));
      params.set("hl", langParts[0] || "pt");
      break;
    case "google_jobs": {
      if (extraParams.ltype) params.set("ltype", String(extraParams.ltype));
      const chipsParts: string[] = [];
      if (extraParams.chips) chipsParts.push(extraParams.chips);
      if (extraParams.chips_remote) chipsParts.push(extraParams.chips_remote);
      if (chipsParts.length) params.set("chips", chipsParts.join(","));
      params.set("hl", langParts[0] || "pt");
      break;
    }
    case "youtube":
      params.set("search_query", query.trim());
      params.delete("q");
      if (extraParams.sp) params.set("sp", extraParams.sp);
      break;
    case "google_maps":
      if (extraParams.ll) params.set("ll", extraParams.ll);
      if (extraParams.type) params.set("type", extraParams.type);
      params.set("hl", langParts[0] || "pt");
      break;
    case "google_patents":
      if (extraParams.before) params.set("before", extraParams.before);
      if (extraParams.after) params.set("after", extraParams.after);
      if (extraParams.status) params.set("status", extraParams.status);
      break;
    case "google_trends":
      if (extraParams.date) params.set("date", extraParams.date);
      params.set("geo", extraParams.geo || "BR");
      if (extraParams.cat) params.set("cat", String(extraParams.cat));
      if (extraParams.gprop) params.set("gprop", extraParams.gprop);
      params.set("hl", langParts[0] || "pt");
      break;
  }

  if (tbsParts.length > 0) params.set("tbs", tbsParts.join(","));

  // Fetch with retry
  const MAX_RETRIES = 3;
  const INITIAL_DELAY = 800;
  let response: Response | null = null;
  let lastError = "";
  const fetchStart = Date.now();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      response = await fetch(`${SERPAPI_BASE}?${params.toString()}`);
      if (response.ok || response.status === 400 || response.status === 401) break;
      lastError = `HTTP ${response.status}`;
    } catch (fetchErr: any) {
      lastError = fetchErr.message || "Network error";
    }
    if (attempt < MAX_RETRIES - 1) {
      await new Promise(r => setTimeout(r, INITIAL_DELAY * Math.pow(2, attempt)));
    }
  }

  const fetchDuration = Date.now() - fetchStart;

  if (!response || !response.ok) {
    const errText = response ? await response.text() : lastError;
    let errMsg = `SerpAPI error [${response?.status || "network"}]`;
    try {
      const errJson = JSON.parse(typeof errText === "string" ? errText : "{}");
      if (errJson.error) errMsg = errJson.error;
    } catch {}
    const engineHints: Record<string, string> = {
      google_flights: "Verifique se os aeroportos e datas estão corretos.",
      google_hotels: "Verifique a cidade e as datas de check-in/check-out.",
      google_finance: "Verifique se o ticker está correto (ex: PETR4:BVMF).",
    };
    const hint = engineHints[engine];
    if (hint) errMsg += ` — ${hint}`;
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const data = await response.json();
  const normalized = normalizeResponse(data, engine);
  normalized.search_metadata.request_duration_ms = fetchDuration;
  if (aiParams) normalized.search_metadata.ai_params = aiParams;

  return new Response(
    JSON.stringify(normalized),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

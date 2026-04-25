/**
 * @function chat
 * @description Pandora Chat principal — Maestro architecture with workspace/agent routing
 * @status active
 * @calledBy PandoraChat component, AIChatWidget
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { verifyAuth } from "../_shared/auth.ts";
import { deductCredits, insufficientCreditsResponse } from "../_shared/credits.ts";
import { buildMaestroPrompt, buildSystemPrompt, getTemporalContext as getSharedTemporalContext, parseWorkspaceMention, detectsAction, type MaestroContext } from "../_shared/pandora-prompt.ts";
import { processPandoraResponse } from "../_shared/pandora-response-cleaner.ts";
import { corsHeaders } from "../_shared/utils.ts";
import { ALL_TOOL_DEFINITIONS } from "../_shared/pandora-tools/index.ts";
import { getOrCreateSession, getRecentToolCalls, updateSessionContext } from "../_shared/pandora-session.ts";
import { resolveTools } from "../_shared/tool-registry.ts";

// SECURITY: Sanitize user messages to prevent prompt injection via tool arguments
function sanitizeMessages(messages: any[]): any[] {
  if (!Array.isArray(messages)) return [];
  return messages.map(m => {
    if (!m || typeof m !== "object") return null;
    const role = ["user", "assistant", "system", "tool"].includes(m.role) ? m.role : "user";
    let content = m.content;
    if (role === "user" && typeof content === "string") {
      content = content
        .replace(/\[system\]/gi, "[user]")
        .replace(/\bsystem:\s*/gi, "")
        .substring(0, 32000);
    }
    return { ...m, role, content };
  }).filter(Boolean);
}

function estimateTokens(messages: any[]): number {
  return messages.reduce((sum, m) => {
    const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content || "");
    return sum + Math.ceil(content.length / 4);
  }, 0);
}

async function compressHistory(messages: any[], aiHeaders: Record<string, string>): Promise<any[]> {
  const MAX_RECENT = 20;
  const THRESHOLD = 30;
  const MAX_CONTEXT_TOKENS = 80000;

  if (messages.length <= THRESHOLD && estimateTokens(messages) < MAX_CONTEXT_TOKENS) return messages;

  let recentCount = Math.min(MAX_RECENT, messages.length);
  while (recentCount > 6 && estimateTokens(messages.slice(-recentCount)) > MAX_CONTEXT_TOKENS * 0.7) {
    recentCount -= 2;
  }

  const oldMessages = messages.slice(0, messages.length - recentCount);
  const recentMessages = messages.slice(-recentCount);

  if (oldMessages.length === 0) return recentMessages;

  const historyText = oldMessages
    .map((m: any) => `[${m.role}]: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`)
    .join("\n")
    .substring(0, 12000);

  try {
    const summaryResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Resuma a conversa abaixo em no máximo 300 palavras em português, preservando: decisões, ações, dados importantes. Seja factual e conciso." },
          { role: "user", content: historyText },
        ],
      }),
    });

    if (summaryResp.ok) {
      const summaryData = await summaryResp.json();
      const summaryText = summaryData.choices?.[0]?.message?.content;
      if (summaryText) {
        return [
          { role: "system", content: `[Resumo do histórico anterior (${oldMessages.length} mensagens comprimidas)]: ${summaryText}` },
          ...recentMessages,
        ];
      }
    }
  } catch (e) {
    console.error("History compression error:", e);
  }

  return recentMessages;
}

function getTemporalContext(clientTimezone?: string): string {
  return getSharedTemporalContext(clientTimezone);
}

/** Read-only tools for all-mode (Rule 5) */
const READ_ONLY_TOOLS = new Set([
  "list_tasks", "list_events", "list_emails", "search_emails", "search_contacts",
  "list_transactions", "finance_summary", "list_files", "search_notes", "memory_recall",
  "web_search", "get_credits", "get_tasks", "get_events", "get_finance_summary",
  "get_habits", "get_contact_details", "smart_find_contact", "get_email_stats",
  "suggest_replies", "get_bank_accounts", "get_investments",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body;

    // Welcome-chat is PUBLIC
    if (action === "welcome-chat") {
      const { handleWelcomeChat } = await import("../_shared/chat-welcome.ts");
      return await handleWelcomeChat(req, body);
    }

    const authResult = await verifyAuth(req);
    if (authResult instanceof Response) return new Response(authResult.body, { status: authResult.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (action === "proactive-insights") {
      const { handleProactiveInsights } = await import("../_shared/chat-proactive.ts");
      return await handleProactiveInsights(req, authResult, body);
    }
    if (action === "deep-research") {
      const { handleDeepResearch } = await import("../_shared/chat-deep-research.ts");
      return await handleDeepResearch(req, authResult, body);
    }

    const {
      messages, context, mode, agent_id, model: requestModel,
      temperature: requestTemp, system_prompt: requestSystemPrompt,
      workspace_id, is_all_mode,
    } = body;

    // Deduct credits
    const isLightweightTitleGen = messages?.length === 2 
      && messages[0]?.role === "system"
      && typeof messages[0]?.content === "string"
      && messages[0].content.startsWith("Gere um título curto")
      && messages[0].content.length < 200
      && typeof messages[1]?.content === "string"
      && messages[1].content.length < 500;
    if (!isLightweightTitleGen) {
      const creditAction = mode === "summary" ? "ai_summary" : "ai_chat";
      const creditResult = await deductCredits(authResult.userId, creditAction);
      if (!creditResult.success) {
        return insufficientCreditsResponse(corsHeaders, creditResult.error || "insufficient_credits");
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const aiHeaders = {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    };

    const clientTimezone = context?.timezone || undefined;
    const temporalContext = getTemporalContext(clientTimezone);

    // Summary mode: direct JSON response
    if (mode === "summary") {
      let summarySystemPrompt = `Você é a Pandora, assistente pessoal do dashboard DESH. ${temporalContext}
Gere um resumo conciso do dia em português brasileiro com markdown. Inclua tarefas, hábitos, eventos, finanças. Máximo 6-8 linhas.`;
      if (context) {
        summarySystemPrompt += `\n\n--- CONTEXTO ---\n`;
        if (context.tasksDone !== undefined) summarySystemPrompt += `Tarefas concluídas: ${context.tasksDone}\n`;
        if (context.tasksPending !== undefined) summarySystemPrompt += `Tarefas pendentes: ${context.tasksPending}\n`;
        if (context.habitsCompleted !== undefined) summarySystemPrompt += `Hábitos: ${context.habitsCompleted}/${context.habitsTotal}\n`;
        if (context.tasks) summarySystemPrompt += `Tarefas: ${JSON.stringify(context.tasks)}\n`;
        if (context.events) summarySystemPrompt += `Eventos: ${JSON.stringify(context.events)}\n`;
        if (context.finance_summary) summarySystemPrompt += `Finanças: ${JSON.stringify(context.finance_summary)}\n`;
      }

      const summaryModels = ["openai/gpt-5-nano", "google/gemini-2.5-flash-lite", "google/gemini-2.5-flash"];
      let summaryRes: Response | null = null;
      for (const sm of summaryModels) {
        summaryRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST", headers: aiHeaders,
          body: JSON.stringify({ model: sm, messages: [{ role: "system", content: summarySystemPrompt }, { role: "user", content: "Gere o resumo do meu dia de hoje." }] }),
        });
        if (summaryRes.ok) break;
        const t = await summaryRes.text(); console.error(`Summary error (${sm}):`, summaryRes.status, t);
      }
      if (!summaryRes || !summaryRes.ok) {
        return new Response(JSON.stringify({ error: "Erro ao gerar resumo" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const summaryData = await summaryRes.json();
      return new Response(JSON.stringify({ summary: summaryData.choices?.[0]?.message?.content || "Não foi possível gerar o resumo." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ══════════════════════════════════════════════
    // MAESTRO ROUTING
    // ══════════════════════════════════════════════

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sbAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Resolve workspace
    let targetWorkspaceId = workspace_id || context?.workspace_id || null;
    const lastUserMsg = messages?.filter((m: any) => m.role === "user").pop()?.content || "";
    const userMsgText = typeof lastUserMsg === "string" ? lastUserMsg : "";
    let parsedMessage = userMsgText;

    // Fetch all user workspaces (needed for @mention, all-mode, and multi-workspace intelligence)
    let userWorkspaces: Array<{ id: string; name: string; icon: string; is_default?: boolean; context_summary?: string }> = [];
    const { data: wsData } = await sbAdmin
      .from("workspaces")
      .select("id, name, icon, is_default, context_summary")
      .eq("user_id", authResult.userId)
      .order("sort_order");
    userWorkspaces = wsData || [];

    // Resolve default workspace for multi-workspace intelligence
    let defaultWorkspace: { id: string; name: string; icon: string } | null = null;
    if (userWorkspaces.length > 0) {
      const defaultWs = userWorkspaces.find((w: any) => w.is_default) || userWorkspaces[0];
      if (defaultWs) defaultWorkspace = { id: defaultWs.id, name: defaultWs.name, icon: defaultWs.icon };
    }

    // All-mode: resolve to Perfil Principal instead of blocking
    if (is_all_mode) {
      const { cleanMessage, targetWorkspaceId: mentionedWs } = parseWorkspaceMention(userMsgText, userWorkspaces);

      if (mentionedWs) {
        targetWorkspaceId = mentionedWs;
        parsedMessage = cleanMessage;
      } else {
        // Always resolve to default workspace (Perfil Principal)
        targetWorkspaceId = defaultWorkspace?.id || (userWorkspaces[0]?.id ?? null);
      }
    }

    // Fallback: resolve default workspace
    if (!targetWorkspaceId) {
      const { data: ws } = await sbAdmin
        .from("workspaces")
        .select("id")
        .eq("user_id", authResult.userId)
        .eq("is_default", true)
        .single();
      targetWorkspaceId = ws?.id || "default";
    }

    // Fetch workspace + agent + documents + profile + skills in parallel
    const [wsRow, agentRow, docsRow, profileRow, memoriesRow, skillsRow] = await Promise.all([
      sbAdmin.from("workspaces").select("id, name, icon, industry, context_summary, system_prompt_override, is_default").eq("id", targetWorkspaceId).maybeSingle(),
      agent_id ? sbAdmin.from("ai_agents").select("id, name, icon, system_prompt, model, tools_enabled, temperature").eq("id", agent_id).eq("is_template", false).maybeSingle() : Promise.resolve({ data: null }),
      sbAdmin.from("workspace_documents").select("title, content, doc_type, is_active").eq("workspace_id", targetWorkspaceId).eq("is_active", true).limit(10),
      sbAdmin.from("profiles").select("personal_context").eq("user_id", authResult.userId).maybeSingle(),
      sbAdmin.from("ai_memories").select("content, category, importance").eq("user_id", authResult.userId).order("created_at", { ascending: false }).limit(25),
      sbAdmin.from("ai_skills").select("name, trigger_description, instructions, is_system").or(`workspace_id.eq.${targetWorkspaceId},is_system.eq.true`).eq("is_active", true).limit(20),
    ]);

    // Session
    const session = await getOrCreateSession(sbAdmin, authResult.userId, targetWorkspaceId === "default" ? null : targetWorkspaceId, "chat");
    const sessionToolCalls = await getRecentToolCalls(sbAdmin, session.id, 10);

    // Update session context with active page
    const activePage = context?.active_page || body.active_page || null;
    if (activePage && session.id !== "fallback") {
      updateSessionContext(sbAdmin, session.id, { active_page: activePage }).catch(() => {});
    }

    // Anti-repetition
    let recentActions = "";
    if (messages?.length) {
      const actionLines: string[] = [];
      const seen = new Set<string>();
      for (let i = Math.max(0, messages.length - 10); i < messages.length; i++) {
        const m = messages[i];
        if (m.role === "assistant" && m.tool_calls) {
          for (const tc of m.tool_calls) {
            const name = tc.function?.name || tc.name;
            const args = tc.function?.arguments || tc.arguments;
            const argsStr = typeof args === "string" ? args : JSON.stringify(args);
            const key = `${name}:${argsStr}`;
            if (!seen.has(key)) { seen.add(key); actionLines.push(`- ${name}(${argsStr})`); }
          }
        }
      }
      if (actionLines.length) {
        recentActions = `\n--- AÇÕES JÁ REALIZADAS (referência anti-repetição) ---\n${actionLines.join("\n")}\n`;
      }
    }

    // Build Maestro prompt (Rules 3-6)
    const maestroCtx: MaestroContext = {
      workspace: wsRow.data || null,
      agent: agentRow.data || null,
      documents: (docsRow.data as any[]) || [],
      memories: memoriesRow.data || [],
      skills: ((skillsRow.data || []) as any[]).map((s: any) => ({ name: s.name, trigger_description: s.trigger_description, instructions: s.instructions })),
      allWorkspaces: userWorkspaces,
      isAllMode: !!is_all_mode,
      defaultWorkspace: defaultWorkspace || null,
      personalContext: profileRow?.data?.personal_context || null,
      userMessage: parsedMessage,
      userName: context?.user_name || "Usuário",
      temporalContext,
      recentActions: recentActions || undefined,
      sessionContext: {
        sessionId: session.id,
        activeChannel: session.active_channel,
        contextSnapshot: session.context_snapshot,
        recentToolCalls: sessionToolCalls,
      },
      dashboardContext: context || {},
      channel: "chat",
    };

    // Use custom system prompt if provided directly (agent form override)
    const customSystemPrompt = requestSystemPrompt || null;
    let systemContent: string;
    if (customSystemPrompt) {
      systemContent = `${customSystemPrompt}\n\nVocê é integrada ao DESH. Responda em português brasileiro. ${temporalContext}`;
    } else {
      systemContent = buildMaestroPrompt(maestroCtx);
    }

    // Resolve tools (Rule 5 — filter to read-only in all-mode without @mention)
    let tools = resolveTools(activePage, session.context_snapshot?.recent_modules || []);

    // If agent has specific tools_enabled, filter
    if (agentRow.data?.tools_enabled?.length > 0) {
      const enabledSet = new Set(agentRow.data.tools_enabled);
      const agentTools = ALL_TOOL_DEFINITIONS.filter((t: any) => {
        const name = t.function?.name || t.name;
        return enabledSet.has(name);
      });
      if (agentTools.length >= 3) tools = agentTools;
    }

    // All-mode no longer restricts tools — Pandora operates on Perfil Principal
    // The AI prompt handles confirmation for cross-workspace actions

    // Model routing
    const isAnalytical = /analis|compar|padr[ãõ]|tendên|projeç|revis[ãa]o|planej|otimiz|estrat[ée]g/i.test(userMsgText);
    const isSimple = userMsgText.length < 60 && !isAnalytical;
    const agentModel = agentRow.data?.model || null;
    const defaultModel = isAnalytical ? "google/gemini-2.5-pro" : isSimple ? "google/gemini-3-flash-preview" : "google/gemini-2.5-pro";

    // User preferred model cache
    let userPreferredModel: string | null = null;
    if (!requestModel && !agentModel) {
      const cacheKey = `model_pref_${authResult.userId}`;
      const cached = (globalThis as any).__modelPrefCache?.[cacheKey];
      if (cached && Date.now() - cached.ts < 300_000) {
        userPreferredModel = cached.model;
      } else {
        try {
          const { data: aiSettings } = await sbAdmin.from("whatsapp_ai_settings").select("preferred_model").eq("user_id", authResult.userId).maybeSingle();
          userPreferredModel = aiSettings?.preferred_model || null;
          if (!(globalThis as any).__modelPrefCache) (globalThis as any).__modelPrefCache = {};
          (globalThis as any).__modelPrefCache[cacheKey] = { model: userPreferredModel, ts: Date.now() };
        } catch { /* fallback */ }
      }
    }

    const selectedModel = requestModel || agentModel || userPreferredModel || defaultModel;
    const selectedTemperature = requestTemp ?? (agentRow.data as any)?.temperature ?? undefined;
    const useReasoning = isAnalytical && !requestModel;

    // Sanitize and compress history
    const sanitized = sanitizeMessages(messages);
    const trimmedMessages = await compressHistory(sanitized, aiHeaders);

    // Model fallback chain
    const chatModels = [selectedModel, "google/gemini-2.5-pro", "google/gemini-3-flash-preview", "google/gemini-2.5-flash"];
    const uniqueModels = [...new Set(chatModels)];
    let response: Response | null = null;
    const REQUEST_TIMEOUT = 55_000;

    for (const cm of uniqueModels) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      try {
        response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: aiHeaders,
          body: JSON.stringify({
            model: cm,
            messages: [{ role: "system", content: systemContent }, ...trimmedMessages],
            tools,
            tool_choice: "auto",
            ...(selectedTemperature !== undefined ? { temperature: selectedTemperature } : {}),
            ...(useReasoning && cm.includes("gemini-2.5-pro") ? { reasoning: { effort: "medium" } } : {}),
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr.name === "AbortError") { console.error(`AI timeout (${cm})`); continue; }
        console.error(`AI fetch error (${cm}):`, fetchErr.message); continue;
      }

      if (response.ok) break;
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await response.text(); console.error(`AI error (${cm}):`, response.status, t);
    }

    if (!response || !response.ok) {
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    // Rule 3 — Log system prompt used (fire-and-forget)
    sbAdmin.from("pandora_interaction_logs").insert({
      user_id: authResult.userId,
      contact_phone: "",
      message_type: "chat",
      input_text: userMsgText.substring(0, 500),
      output_text: (choice?.message?.content || "").substring(0, 2000),
      credits_consumed: 3,
      tools_used: choice?.message?.tool_calls?.map((tc: any) => tc.function?.name) || [],
      response_time_ms: 0,
      system_prompt_used: systemContent.substring(0, 4000),
      workspace_id: targetWorkspaceId === "default" ? null : targetWorkspaceId,
      agent_id: agent_id || null,
    }).then(({ error }) => { if (error) console.error("[chat] Log error:", error); });

    // Quality validation
    const validateResponse = (content: string | null | undefined): string => {
      if (!content || content.trim().length === 0) return "";
      const cleaned = content
        .replace(/^(IDENTIDADE|REGRAS|CAPACIDADES|CONTEXTO ATUAL):.*/gm, "")
        .replace(/--- CONTEXTO.*---/g, "")
        .trim();
      return cleaned || content;
    };

    if (choice?.finish_reason === "tool_calls" || choice?.message?.tool_calls?.length > 0) {
      return new Response(JSON.stringify({
        type: "tool_calls",
        tool_calls: choice.message.tool_calls.map((tc: any) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: (() => { try { return JSON.parse(tc.function.arguments || "{}"); } catch { return {}; } })(),
        })),
        content: validateResponse(choice.message.content) || null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const rawContent = validateResponse(choice?.message?.content) || "Desculpe, não consegui gerar uma resposta. Tente novamente.";
    const { text: content, suggestedReplies } = processPandoraResponse(rawContent, "chat");
    return new Response(JSON.stringify({ type: "text", content, suggested_replies: suggestedReplies }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

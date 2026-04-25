/**
 * @function pandora-mcp
 * @description Pandora Chat com Composio MCP — Claude executa ações via MCP nativo (Maestro)
 * @status active
 * @calledBy ChatPanel (MCP mode)
 */
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { verifyAuth } from "../_shared/auth.ts";
import { deductCredits, insufficientCreditsResponse } from "../_shared/credits.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/utils.ts";
import { buildMaestroPrompt, getTemporalContext, type MaestroContext } from "../_shared/pandora-prompt.ts";
import { getOrCreateMcpServer, getMcpUrl } from "../_shared/mcp-composio.ts";
import { getOrCreateSession, getRecentToolCalls, registerToolCall, deriveToolCategory } from "../_shared/pandora-session.ts";
import { processPandoraResponse } from "../_shared/pandora-response-cleaner.ts";

const COMPOSIO_API_KEY = () => Deno.env.get("COMPOSIO_API_KEY")!;
const ANTHROPIC_API_KEY = () => Deno.env.get("ANTHROPIC_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authResult = await verifyAuth(req);
    if (authResult instanceof Response) {
      return new Response(authResult.body, {
        status: authResult.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicKey = ANTHROPIC_API_KEY();
    if (!anthropicKey) return errorResponse(500, "ANTHROPIC_API_KEY não configurada");

    const body = await req.json();
    const { message, workspace_id, conversation_history = [], workspace_name = "Pessoal", user_name = "Usuário", timezone, agent_id } = body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return errorResponse(400, "message é obrigatório");
    }

    const creditResult = await deductCredits(authResult.userId, "ai_chat_mcp");
    if (!creditResult.success) return insufficientCreditsResponse(corsHeaders, creditResult.error || "insufficient_credits");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Resolve workspace
    let wsId = workspace_id;
    if (!wsId || wsId === "all") {
      const { data: ws } = await supabase.from("workspaces").select("id").eq("user_id", authResult.userId).eq("is_default", true).single();
      wsId = ws?.id || "default";
    }
    const entityId = `${authResult.userId}_${wsId}`;

    // Fetch workspace + agent + memories + profile + docs + skills + all workspaces in parallel
    const [wsRow, agentRow, memoriesRes, profileRes, docsRow, skillsRow, allWsRow] = await Promise.all([
      supabase.from("workspaces").select("id, name, icon, industry, context_summary, system_prompt_override, is_default").eq("id", wsId).maybeSingle(),
      agent_id ? supabase.from("ai_agents").select("id, name, icon, system_prompt, model, tools_enabled").eq("id", agent_id).eq("is_template", false).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("ai_memories").select("content,category,importance").eq("user_id", authResult.userId).order("created_at", { ascending: false }).limit(15),
      supabase.from("profiles").select("personal_context").eq("user_id", authResult.userId).maybeSingle(),
      supabase.from("workspace_documents").select("title, content, doc_type, is_active").eq("workspace_id", wsId).eq("is_active", true).limit(10),
      supabase.from("ai_skills").select("name, trigger_description, instructions, is_system").or(`workspace_id.eq.${wsId},is_system.eq.true`).eq("is_active", true).limit(20),
      supabase.from("workspaces").select("id, name, icon, context_summary, is_default").eq("user_id", authResult.userId).order("sort_order"),
    ]);

    // MCP server
    const composioKey = COMPOSIO_API_KEY();
    const serverId = await getOrCreateMcpServer(composioKey);
    const mcpUrl = await getMcpUrl(entityId, serverId, composioKey);

    // Session
    const session = await getOrCreateSession(supabase, authResult.userId, wsId === "default" ? null : wsId, "mcp");
    const sessionToolCalls = await getRecentToolCalls(supabase, session.id, 10);

    // Build Maestro prompt
    const temporalContext = getTemporalContext(timezone);
    const maestroCtx: MaestroContext = {
      workspace: wsRow.data || null,
      agent: agentRow.data || null,
      documents: (docsRow.data as any[]) || [],
      memories: memoriesRes.data || [],
      skills: ((skillsRow.data || []) as any[]).map((s: any) => ({ name: s.name, trigger_description: s.trigger_description, instructions: s.instructions })),
      allWorkspaces: (allWsRow.data as any[]) || [],
      isAllMode: false,
      defaultWorkspace: ((allWsRow.data as any[]) || []).find((w: any) => w.is_default) || null,
      personalContext: profileRes?.data?.personal_context || null,
      userMessage: message,
      userName: user_name,
      temporalContext,
      sessionContext: { sessionId: session.id, activeChannel: session.active_channel, contextSnapshot: session.context_snapshot, recentToolCalls: sessionToolCalls },
      channel: "mcp",
    };
    const systemPrompt = buildMaestroPrompt(maestroCtx);

    const claudeMessages = [...conversation_history.slice(-20), { role: "user", content: message }];

    const startTime = Date.now();
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "mcp-client-2025-04-04",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        system: systemPrompt,
        messages: claudeMessages,
        mcp_servers: [{ type: "url", url: mcpUrl, name: "composio", authorization_token: composioKey }],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error("[pandora-mcp] Claude error:", claudeResponse.status, errText);
      try {
        const errJson = JSON.parse(errText);
        const errMsg = errJson.error?.message || "";
        if (errMsg.includes("Resource not found on MCP server") || errMsg.includes("Connection error")) {
          return errorResponse(400, "Nenhum app conectado via Composio para este workspace. Conecte Gmail/Calendar em Configurações → Integrações.");
        }
        if (claudeResponse.status === 529) return errorResponse(503, "Claude sobrecarregado. Tente novamente.");
        if (claudeResponse.status === 401) return errorResponse(500, "Chave Anthropic inválida.");
        return errorResponse(claudeResponse.status, errMsg || `Erro Claude: ${claudeResponse.status}`);
      } catch { return errorResponse(500, `Erro API Claude: ${claudeResponse.status}`); }
    }

    const claudeData = await claudeResponse.json();
    const rawResponseText = claudeData.content?.filter((b: any) => b.type === "text")?.map((b: any) => b.text)?.join("\n") || "Não consegui processar sua solicitação.";
    const { text: responseText } = processPandoraResponse(rawResponseText, "mcp");
    const toolsUsed = claudeData.content?.filter((b: any) => b.type === "mcp_tool_use" || b.type === "tool_use")?.map((b: any) => b.name) || [];

    for (const toolName of toolsUsed) {
      registerToolCall(supabase, session.id, authResult.userId, toolName, deriveToolCategory(toolName), "mcp").catch(() => {});
    }

    const responseTimeMs = Date.now() - startTime;
    supabase.from("pandora_interaction_logs").insert({
      user_id: authResult.userId, contact_phone: "", message_type: "mcp",
      input_text: message, output_text: responseText.substring(0, 2000),
      credits_consumed: creditResult.cost ?? 5, tools_used: toolsUsed, response_time_ms: responseTimeMs,
      system_prompt_used: systemPrompt.substring(0, 4000),
      workspace_id: wsId === "default" ? null : wsId,
      agent_id: agent_id || null,
    }).then(({ error }) => { if (error) console.error("[pandora-mcp] Log error:", error); });

    return jsonResponse({ type: "text", content: responseText, tools_used: toolsUsed, model: claudeData.model, usage: claudeData.usage, mcp: true });
  } catch (error: any) {
    console.error("[pandora-mcp] Error:", error);
    return errorResponse(500, error.message || "Erro interno");
  }
});

/**
 * Pandora Unified Session Manager
 * Shared state across Chat, MCP, and WhatsApp channels.
 * Uses pandora_sessions + pandora_tool_calls tables.
 */

export interface PandoraSession {
  id: string;
  user_id: string;
  workspace_id: string | null;
  active_channel: string;
  context_snapshot: Record<string, any>;
  last_activity_at: string;
}

export interface PandoraToolCall {
  id: string;
  session_id: string;
  tool_name: string;
  status: string;
  created_at: string;
  output_result: any;
}

/** Get or create an active session (reuses if activity < 30 min ago) */
export async function getOrCreateSession(
  supabase: any,
  userId: string,
  workspaceId: string | null,
  channel: "chat" | "mcp" | "whatsapp",
): Promise<PandoraSession> {
  const { data, error } = await supabase.rpc("get_or_create_pandora_session", {
    p_user_id: userId,
    p_workspace_id: workspaceId,
    p_channel: channel,
  });
  if (error) {
    console.error("[pandora-session] getOrCreateSession error:", error);
    // Return a fallback session object so callers don't break
    return {
      id: "fallback",
      user_id: userId,
      workspace_id: workspaceId,
      active_channel: channel,
      context_snapshot: {},
      last_activity_at: new Date().toISOString(),
    };
  }
  return data;
}

/** Register a tool call (before execution) */
export async function registerToolCall(
  supabase: any,
  sessionId: string,
  userId: string,
  toolName: string,
  toolCategory: string,
  channel: string,
  inputParams: Record<string, any> = {},
): Promise<string> {
  if (sessionId === "fallback") return "fallback";
  try {
    const { data, error } = await supabase.rpc("register_tool_call", {
      p_session_id: sessionId,
      p_user_id: userId,
      p_tool_name: toolName,
      p_tool_category: toolCategory,
      p_channel: channel,
      p_input_params: inputParams,
    });
    if (error) {
      console.error("[pandora-session] registerToolCall error:", error);
      return "error";
    }
    return data?.id || "unknown";
  } catch (e) {
    console.error("[pandora-session] registerToolCall exception:", e);
    return "error";
  }
}

/** Update tool call status after execution */
export async function updateToolCallStatus(
  supabase: any,
  callId: string,
  status: "running" | "done" | "failed" | "retry",
  result?: any,
  errorMsg?: string,
): Promise<void> {
  if (callId === "fallback" || callId === "error") return;
  try {
    const updates: Record<string, any> = { status };
    if (status === "running") updates.started_at = new Date().toISOString();
    if (status === "done" || status === "failed") updates.completed_at = new Date().toISOString();
    if (result !== undefined) updates.output_result = result;
    if (errorMsg) updates.error_message = errorMsg;

    await supabase
      .from("pandora_tool_calls")
      .update(updates)
      .eq("id", callId);
  } catch (e) {
    console.error("[pandora-session] updateToolCallStatus error:", e);
  }
}

/** Update session context snapshot (merge with existing) */
export async function updateSessionContext(
  supabase: any,
  sessionId: string,
  contextUpdates: Record<string, any>,
): Promise<void> {
  if (sessionId === "fallback") return;
  try {
    const { data: session } = await supabase
      .from("pandora_sessions")
      .select("context_snapshot")
      .eq("id", sessionId)
      .single();

    const merged = { ...(session?.context_snapshot || {}), ...contextUpdates };

    await supabase
      .from("pandora_sessions")
      .update({
        context_snapshot: merged,
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
  } catch (e) {
    console.error("[pandora-session] updateSessionContext error:", e);
  }
}

/** Fetch recent tool calls from the session (for prompt injection) */
export async function getRecentToolCalls(
  supabase: any,
  sessionId: string,
  limit = 10,
): Promise<PandoraToolCall[]> {
  if (sessionId === "fallback") return [];
  try {
    const { data, error } = await supabase
      .from("pandora_tool_calls")
      .select("id, tool_name, status, created_at, output_result")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[pandora-session] getRecentToolCalls error:", error);
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
}

/** Derive tool category from tool name */
export function deriveToolCategory(toolName: string): string {
  if (/task|subtask/.test(toolName)) return "tasks";
  if (/note/.test(toolName)) return "notes";
  if (/calendar|event|free_time/.test(toolName)) return "calendar";
  if (/contact|crm/.test(toolName)) return "contacts";
  if (/finance|budget|spending|goal|bank|investment/.test(toolName)) return "finance";
  if (/email|draft/.test(toolName)) return "email";
  if (/whatsapp/.test(toolName)) return "whatsapp";
  if (/habit/.test(toolName)) return "habits";
  if (/file|folder/.test(toolName)) return "files";
  if (/automation/.test(toolName)) return "automation";
  if (/memory/.test(toolName)) return "memory";
  if (/knowledge/.test(toolName)) return "knowledge";
  if (/social|post/.test(toolName)) return "social";
  if (/search|serp|web/.test(toolName)) return "search";
  if (/image|generate_image/.test(toolName)) return "images";
  if (/report|pdf/.test(toolName)) return "reports";
  if (/workspace/.test(toolName)) return "workspace";
  if (/plan|weekly|reminder/.test(toolName)) return "planning";
  return "general";
}

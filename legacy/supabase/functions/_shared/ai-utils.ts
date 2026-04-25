import { corsHeaders } from "./utils.ts";
import { deductCredits, insufficientCreditsResponse } from "./credits.ts";

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export async function checkCredits(userId: string, action: string, amount?: number) {
  const result = await deductCredits(userId, action, amount);
  if (!result.success) {
    return insufficientCreditsResponse(corsHeaders, result.error || "insufficient_credits");
  }
  return null;
}

export function getApiKey(): string {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  return key;
}

export async function callAI(
  apiKey: string,
  messages: any[],
  opts?: { model?: string; tools?: any[]; toolChoice?: any; temperature?: number; maxTokens?: number; timeoutMs?: number }
): Promise<Response> {
  const body: any = {
    model: opts?.model || "google/gemini-3-flash-preview",
    messages,
  };
  if (opts?.tools) body.tools = opts.tools;
  if (opts?.toolChoice) body.tool_choice = opts.toolChoice;
  if (opts?.temperature !== undefined) body.temperature = opts.temperature;
  if (opts?.maxTokens) body.max_tokens = opts.maxTokens;

  const controller = new AbortController();
  const timeoutMs = opts?.timeoutMs || 55_000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return resp;
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === "AbortError") {
      throw new Error(`AI gateway timeout after ${timeoutMs}ms`);
    }
    throw e;
  }
}

export function aiErrorResponse(status: number): Response {
  if (status === 429) return jsonRes({ error: "Muitas requisições. Tente novamente." }, 429);
  if (status === 402) return jsonRes({ error: "Créditos insuficientes." }, 402);
  return jsonRes({ error: "Erro no serviço de IA" }, 500);
}

export function jsonRes(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function parseJsonFromAI(raw: string): any {
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, raw];
  try {
    return JSON.parse(jsonMatch[1]!.trim());
  } catch (e) {
    // Attempt to extract JSON object or array directly
    const directMatch = raw.match(/[\[{][\s\S]*[\]}]/);
    if (directMatch) {
      try { return JSON.parse(directMatch[0]); } catch {}
    }
    throw new Error(`Failed to parse AI JSON response: ${raw.substring(0, 200)}`);
  }
}

export function parseToolCallResult(aiData: any): any | null {
  const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    return JSON.parse(toolCall.function.arguments);
  }
  return null;
}

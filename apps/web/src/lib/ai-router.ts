/**
 * Unified AI router helper.
 * Replaces direct calls to comms-ai, data-ai, productivity-ai.
 *
 * Usage:
 *   const data = await invokeAI("finance", { action: "categorize", ... });
 */
import { supabase } from "@/integrations/supabase/client";

export async function invokeAI<T = any>(
  module: string,
  params: Record<string, any> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("ai-router", {
    body: { module, ...params },
  });
  if (error) throw error;
  return data as T;
}

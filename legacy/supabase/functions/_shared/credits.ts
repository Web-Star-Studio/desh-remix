import { createClient } from "npm:@supabase/supabase-js@2.95.3";

export const CREDIT_COSTS: Record<string, number> = {
  // Lovable AI Gateway (Gemini Flash/Pro) — ~$0.003-0.01/req
  ai_chat: 1,
  ai_chat_mcp: 2,
  ai_summary: 2,
  ai_tasks: 1,
  ai_calendar: 1,
  ai_contacts: 1,
  ai_email: 1,
  ai_files: 1,
  ai_notes: 1,
  ai_messages: 1,
  ai_week_planner: 1,
  ai_map: 1,
  ai_proactive: 1,
  ai_automation: 1,
  ai_stock_analysis: 1,
  ai_finance: 1,
  ai_inbox: 1,
  ai_ocr: 1,
  ai_file_categorize: 1,

  // Perplexity Sonar — ~$0.008/req
  web_search: 1,

  // Perplexity Sonar Pro (Deep Research) — ~$0.30/session
  deep_research: 22,

  // SerpAPI — $0.025/search
  serp_search: 2,
  serp_news: 2,
  serp_images: 2,
  serp_shopping: 2,
  serp_trends: 2,
  serp_monitor_check: 2,
  serp_finance: 2,
  serp_flights: 2,
  serp_hotels: 2,
  serp_jobs: 2,
  serp_events: 2,
  serp_scholar: 2,
  serp_youtube: 2,
  serp_maps: 2,
  serp_patents: 2,

  // ElevenLabs TTS — ~$0.24/req (2K chars avg)
  elevenlabs_tts: 18,

  // Image Generation (Lovable AI Gateway)
  ai_image_generation: 1,          // Gemini Flash Image ~$0.01
  ai_image_generation_leonardo: 4, // Leonardo ~$0.05

  // WhatsApp / Late Proxy
  whatsapp_send: 1,
  ai_whatsapp_reply: 1,
  ai_whatsapp_mcp: 2,
  whatsapp_full_sync: 4,

  // Open Banking (Pluggy)
  open_banking_sync: 8,

  // Misc
  data_export: 1,
  pdf_report: 1,
  morning_briefing: 2,

  // Social Media — now flat-rate via social_subscriptions (no credits)
  // Kept here for reference only, all return 0 (not charged)

  // WhatsApp Business (Zernio)
  wa_connect: 1,
  wa_message_send: 1,        // single 1-to-1 message (text or template)
  wa_broadcast_create: 1,
  wa_broadcast_send: 3,
  wa_broadcast_schedule: 1,
  wa_template_create: 1,
  wa_contact_create: 1,
  wa_contact_import: 2,
};

export async function deductCredits(
  userId: string,
  action: string,
  amount?: number
): Promise<{ success: boolean; error?: string; balance?: number }> {
  const cost = amount ?? CREDIT_COSTS[action] ?? 1;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data, error } = await supabase.rpc("consume_credits", {
    _user_id: userId,
    _amount: cost,
    _action: action,
    _description: action,
  });

  if (error) {
    console.error("deductCredits RPC error:", error.message);
    return { success: false, error: error.message };
  }

  const result = data as { success: boolean; error?: string; balance?: number };
  return result;
}

export function insufficientCreditsResponse(corsHeaders: Record<string, string>, error: string) {
  const messages: Record<string, string> = {
    no_subscription: "Você não possui uma conta ativa. Crie sua conta para começar.",
    subscription_inactive: "Sua conta está inativa. Entre em contato com o suporte.",
    insufficient_credits: "Créditos insuficientes. Compre um pacote de créditos para continuar.",
  };

  return new Response(
    JSON.stringify({ error: messages[error] || "Erro de créditos", code: error }),
    {
      status: 402,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

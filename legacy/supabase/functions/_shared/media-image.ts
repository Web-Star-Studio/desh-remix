// Handler: generate-image logic extracted for media-gen consolidation
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { verifyAuth } from "./auth.ts";
import { deductCredits, insufficientCreditsResponse } from "./credits.ts";
import { corsHeaders } from "./utils.ts";

export async function handleGenerateImage(req: Request, params: any) {
  const authResult = await verifyAuth(req);
  if (authResult instanceof Response) {
    return new Response(authResult.body, { status: authResult.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { prompt, style, reference_image, high_quality } = params;
  if (!prompt) {
    return new Response(JSON.stringify({ error: "Prompt é obrigatório" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const creditResult = await deductCredits(authResult.userId, "ai_image_generation", high_quality ? 3 : 1);
  if (!creditResult.success) {
    return insufficientCreditsResponse(corsHeaders, creditResult.error || "insufficient_credits");
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const styleHints: Record<string, string> = {
    infographic: "Create a clean, modern infographic with data visualization. Use icons, charts and clear typography.",
    artistic: "Create an artistic, creative illustration with vibrant colors and expressive style.",
    diagram: "Create a clear, professional diagram or flowchart with labeled elements.",
    "photo-realistic": "Create a photo-realistic, high-quality image with natural lighting and details.",
  };
  const enhancedPrompt = styleHints[style] ? `${styleHints[style]} ${prompt}` : prompt;

  const messages: any[] = [];
  if (reference_image) {
    messages.push({ role: "user", content: [{ type: "text", text: enhancedPrompt }, { type: "image_url", image_url: { url: reference_image } }] });
  } else {
    messages.push({ role: "user", content: enhancedPrompt });
  }

  const model = high_quality ? "google/gemini-3-pro-image-preview" : "google/gemini-2.5-flash-image";
  const models = [...new Set([model, "google/gemini-2.5-flash-image"])];
  let aiResp: Response | null = null;

  for (const m of models) {
    aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: m, messages, modalities: ["image", "text"] }),
    });
    if (aiResp.ok) break;
    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const errText = await aiResp.text();
    console.error(`Image AI error (${m}):`, aiResp.status, errText);
  }

  if (!aiResp || !aiResp.ok) {
    return new Response(JSON.stringify({ error: "Erro ao gerar imagem" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const aiData = await aiResp.json();
  const imageBase64 = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  const textContent = aiData.choices?.[0]?.message?.content || "";

  if (!imageBase64) {
    return new Response(JSON.stringify({ error: "A IA não retornou uma imagem. Tente um prompt diferente.", text: textContent }), {
      status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
  const fileName = `${authResult.userId}/generated/${Date.now()}.png`;

  const { error: uploadError } = await supabase.storage.from("user-files").upload(fileName, imageBytes, { contentType: "image/png", upsert: false });
  if (uploadError) {
    console.error("Upload error:", uploadError);
    return new Response(JSON.stringify({ error: "Erro ao salvar imagem" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: publicUrlData } = supabase.storage.from("user-files").getPublicUrl(fileName);
  return new Response(JSON.stringify({ url: publicUrlData.publicUrl, text: textContent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

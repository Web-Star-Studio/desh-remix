import { corsHeaders } from "./utils.ts";

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const MODELS: Record<string, string> = {
  "nano-banana-2": "google/gemini-3.1-flash-image-preview",
  "nano-banana-pro": "google/gemini-3-pro-image-preview",
};

const STYLE_INSTRUCTIONS: Record<string, string> = {
  dynamic: "dynamic composition, professional quality",
  pro_photo: "professional color photograph, high-end DSLR quality, natural lighting",
  pro_bw: "professional black and white photograph, high contrast, dramatic tones",
  pro_film: "film photography aesthetic, analog grain, warm tones, cinematic",
  portrait: "portrait photography, shallow depth of field, studio lighting",
  portrait_cinema: "cinematic portrait, dramatic lighting, movie-like composition",
  portrait_fashion: "high fashion portrait, editorial style, striking pose",
  stock_photo: "clean stock photo, professional, commercial quality, versatile",
  illustration: "digital illustration, detailed, artistic, vibrant",
  creative: "creative art, experimental, bold colors, unique composition",
  "3d_render": "3D render, photorealistic CGI, volumetric lighting, detailed textures",
  watercolor: "watercolor painting style, soft edges, flowing colors, artistic",
  fashion: "fashion photography, editorial, trendy, high-end styling",
  game_concept: "game concept art, fantasy/sci-fi, detailed environment",
  graphic_2d: "2D graphic design, clean vectors, modern flat design",
  graphic_3d: "3D graphic design, isometric, polished, modern",
  ray_traced: "ray traced render, photorealistic, perfect reflections and lighting",
  acrylic: "acrylic painting style, textured brushstrokes, rich colors",
  anime: "anime art style, Japanese animation, detailed character design",
  none: "",
};

const DIMENSION_INSTRUCTIONS: Record<string, string> = {
  "1:1": "square 1:1 aspect ratio",
  "16:9": "widescreen 16:9 landscape aspect ratio",
  "9:16": "vertical 9:16 portrait aspect ratio (tall)",
  "4:5": "4:5 vertical aspect ratio",
  "4:3": "4:3 landscape aspect ratio",
  "3:4": "3:4 portrait aspect ratio",
  "2:3": "2:3 tall portrait aspect ratio",
  "3:2": "3:2 landscape aspect ratio",
  "5:4": "5:4 landscape aspect ratio",
  "21:9": "ultra-wide 21:9 panoramic aspect ratio",
};

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface NanoBananaParams {
  prompt: string;
  model_key?: string;
  style_key?: string;
  dimension_key?: string;
  negative_prompt?: string;
  quantity?: number;
  seed?: number;
  prompt_enhance?: boolean;
  edit_image_url?: string;
  reference_images?: string[];
  include_images?: string[];
}

export async function handleNanaBanana(_req: Request, params: NanoBananaParams) {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) return jsonResp({ error: "LOVABLE_API_KEY not configured" }, 500);

  const {
    prompt,
    model_key = "nano-banana-2",
    style_key = "dynamic",
    dimension_key = "1:1",
    negative_prompt,
    quantity = 1,
    seed,
    prompt_enhance = false,
    edit_image_url,
    reference_images,
    include_images,
  } = params;

  if (!prompt?.trim()) {
    return jsonResp({ error: "Prompt is required" }, 400);
  }

  const model = MODELS[model_key] || MODELS["nano-banana-2"];

  // Build the image generation prompt with explicit instructions
  const styleInstr = STYLE_INSTRUCTIONS[style_key] || "";
  const dimInstr = DIMENSION_INSTRUCTIONS[dimension_key] || DIMENSION_INSTRUCTIONS["1:1"];
  const negInstr = negative_prompt?.trim() ? `\nDo NOT include: ${negative_prompt.trim()}` : "";
  const seedInstr = seed ? `\nUse consistent seed/style reference: ${seed}` : "";
  const enhanceInstr = prompt_enhance
    ? "\nEnhance and improve the prompt for maximum visual quality and detail before generating."
    : "";

  const hasReferences = (reference_images && reference_images.length > 0) || edit_image_url;
  const hasIncludes = include_images && include_images.length > 0;

  const systemPrompt = [
    "You are an expert image generator. You MUST generate an image based on the user's description.",
    "ALWAYS output an image. Never respond with only text.",
    "Generate high-quality, detailed images that match the description precisely.",
    hasIncludes
      ? "CRITICAL: Some images are marked as 'INCLUDE' elements. You MUST faithfully reproduce these exact elements (logos, icons, graphics, watermarks) in the generated image. Place them naturally in the composition while preserving their original appearance, colors, and proportions."
      : "",
    hasReferences
      ? "Reference images are provided for style guidance. Use them as visual guidance for style, composition, color palette, lighting, and overall aesthetic. The new image should be inspired by the references but follow the text description."
      : "",
  ].filter(Boolean).join(" ");

  const imagePrompt = [
    `Generate an image: ${prompt.trim()}`,
    styleInstr ? `Style: ${styleInstr}.` : "",
    `Aspect ratio: ${dimInstr}.`,
    negInstr,
    seedInstr,
    enhanceInstr,
  ].filter(Boolean).join("\n");


  const allUrls: string[] = [];
  const totalRuns = Math.min(quantity, 4);

  for (let run = 0; run < totalRuns; run++) {
    const content: any[] = [{ type: "text", text: imagePrompt }];

    // Add edit image
    if (edit_image_url) {
      content.push({
        type: "image_url",
        image_url: { url: edit_image_url },
      });
    }

    // Add include images (logos, elements to reproduce) FIRST with explicit instructions
    if (include_images?.length) {
      content.push({
        type: "text",
        text: "The following images MUST be included and faithfully reproduced in the generated image. Preserve their exact appearance, colors, shape and proportions:",
      });
      for (const incUrl of include_images.slice(0, 4)) {
        content.push({
          type: "image_url",
          image_url: { url: incUrl },
        });
      }
    }

    // Add reference images for style guidance
    if (reference_images?.length) {
      if (include_images?.length) {
        content.push({
          type: "text",
          text: "The following images are STYLE REFERENCES ONLY — use them for inspiration on composition, colors, and aesthetic, but do NOT reproduce them literally:",
        });
      }
      for (const refUrl of reference_images.slice(0, 6)) {
        content.push({
          type: "image_url",
          image_url: { url: refUrl },
        });
      }
    }

    try {
      const res = await fetch(AI_GATEWAY, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content },
          ],
          modalities: ["image", "text"],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[nano-banana] API error: ${res.status}`, errText);

        if (res.status === 429) {
          return jsonResp({ error: "Rate limit. Aguarde antes de tentar novamente.", code: "rate_limit" }, 429);
        }
        if (res.status === 402) {
          return jsonResp({ error: "Créditos insuficientes.", code: "insufficient_credits" }, 402);
        }
        return jsonResp({ error: `Erro no serviço de IA: ${res.status}`, details: errText }, 500);
      }

      const data = await res.json();
      const message = data.choices?.[0]?.message;

      if (!message) {
        console.error("[nano-banana] No message in response");
        continue;
      }

      const images = message.images || [];
      if (images.length === 0) {
        const textResponse = message.content || "";
        console.warn(`[nano-banana] Run ${run + 1}: No images. Text: ${textResponse.slice(0, 200)}`);
        // If first run fails, retry with stronger instruction
        if (run === 0 && totalRuns === 1) {
          // One retry with even more explicit prompt
          const retryContent: any[] = [{
            type: "text",
            text: `CREATE AN IMAGE NOW. DO NOT RESPOND WITH TEXT. Generate this image:\n\n${imagePrompt}`,
          }];

          const retryRes = await fetch(AI_GATEWAY, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: "You are an image generator. You MUST output an image. Never output text only." },
                { role: "user", content: retryContent },
              ],
              modalities: ["image", "text"],
            }),
          });

          if (retryRes.ok) {
            const retryData = await retryRes.json();
            const retryImages = retryData.choices?.[0]?.message?.images || [];
            const retryUrls = retryImages.map((img: any) => img.image_url?.url || img.url).filter(Boolean);
            if (retryUrls.length > 0) {
              allUrls.push(...retryUrls);
            }
          }
        }
        continue;
      }

      const urls = images.map((img: any) => img.image_url?.url || img.url).filter(Boolean);
      allUrls.push(...urls);
    } catch (err: any) {
      console.error(`[nano-banana] Run ${run + 1} error:`, err.message);
    }

    // Small delay between runs
    if (run < totalRuns - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  if (allUrls.length === 0) {
    return jsonResp({
      error: "Nenhuma imagem gerada. Tente reformular o prompt com uma descrição visual mais clara (ex: 'foto de um pôr do sol sobre montanhas').",
      code: "no_image",
    }, 400);
  }

  return jsonResp({
    url: allUrls[0],
    all_urls: allUrls,
    generation_id: `nb-${Date.now()}`,
    quantity_generated: allUrls.length,
    model_used: model_key,
  });
}

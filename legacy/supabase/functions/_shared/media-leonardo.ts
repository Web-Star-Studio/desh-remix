import { corsHeaders } from "./utils.ts";

const LEONARDO_BASE = "https://cloud.leonardo.ai/api/rest/v1";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const STYLE_MAP: Record<string, string | null> = {
  dynamic: "DYNAMIC",
  pro_photo: "PHOTOGRAPHY",
  pro_bw: "PHOTOGRAPHY",
  pro_film: "PHOTOGRAPHY",
  portrait: "PHOTOGRAPHY",
  portrait_cinema: "CINEMATIC",
  portrait_fashion: "FASHION",
  stock_photo: "STOCK_PHOTO",
  illustration: "ILLUSTRATION",
  creative: "CREATIVE",
  "3d_render": "RENDER_3D",
  watercolor: "SKETCH_COLOR",
  fashion: "FASHION",
  game_concept: "CREATIVE",
  graphic_2d: "GRAPHIC_DESIGN_2D",
  graphic_3d: "GRAPHIC_DESIGN_3D",
  ray_traced: "RAY_TRACED",
  acrylic: "SKETCH_COLOR",
  anime: "ANIME",
  none: null,
};

const PHOTOREAL_STYLES = new Set([
  "pro_photo", "pro_bw", "pro_film", "portrait", "portrait_cinema", "portrait_fashion", "stock_photo",
]);

const DIM_MAP: Record<string, { width: number; height: number }> = {
  "1:1_1k": { width: 1024, height: 1024 },
  "16:9_1k": { width: 1376, height: 768 },
  "9:16_1k": { width: 768, height: 1376 },
  "4:5_1k": { width: 928, height: 1152 },
  "4:3_1k": { width: 1200, height: 896 },
  "3:4_1k": { width: 896, height: 1200 },
  "2:3_1k": { width: 848, height: 1264 },
  "3:2_1k": { width: 1264, height: 848 },
  "5:4_1k": { width: 1152, height: 928 },
  "21:9_1k": { width: 1584, height: 672 },
  "1:1_2k": { width: 2048, height: 2048 },
  "16:9_2k": { width: 2752, height: 1536 },
  "9:16_2k": { width: 1536, height: 2752 },
};

const DEFAULT_NEGATIVE = "blurry, low quality, watermark, text, deformed, bad anatomy, disfigured, poorly drawn, mutation, extra limbs, ugly, worst quality, low resolution, artifacts, noise, oversaturated";

const KINO_XL_MODEL = "aa77f04e-3eec-4034-9c07-d0f619684628";

// --- AI Models (primary + fallback) ---
const PRIMARY_MODEL = "google/gemini-2.5-flash";
const FALLBACK_MODEL = "google/gemini-2.5-flash-lite";

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// --- Brand context interface ---
interface BrandContext {
  business_name?: string;
  niche?: string;
  target_audience?: {
    age_range?: string;
    gender?: string;
    interests?: string[];
    pain_points?: string[];
    location?: string;
  };
  brand_voice?: string;
  content_pillars?: string[];
}

// --- Platform-specific prompt personas ---
const PLATFORM_PERSONAS: Record<string, string> = {
  instagram: `INSTAGRAM OPTIMIZATION:
- Colors: Vibrant, saturated, high contrast — thumb-stopping in a fast-scrolling feed
- Composition: Clean focal point, rule of thirds, bold negative space
- Style: Aspirational, aesthetic, lifestyle-driven, "Instagram-worthy"
- Avoid: Cluttered compositions, dull colors, overly complex scenes
- Mood: Polished, curated, visually stunning`,

  linkedin: `LINKEDIN OPTIMIZATION:
- Colors: Professional palette — blues, grays, whites, subtle accent colors
- Composition: Clean, structured, corporate-friendly, infographic-style when relevant
- Style: Professional, trustworthy, thought-leadership, editorial quality
- Avoid: Overly casual, meme-like, flashy neon colors
- Mood: Authoritative, inspiring, business-appropriate`,

  tiktok: `TIKTOK OPTIMIZATION:
- Colors: Bold, trending, neon accents, Gen-Z aesthetic, Y2K or maximalist vibes
- Composition: Vertical-first (9:16), eye-catching within 0.5 seconds, dynamic angles
- Style: Trendy, raw, energetic, meme-culture aware, pattern-interrupt visuals
- Avoid: Corporate/stiff imagery, outdated aesthetics
- Mood: Fun, edgy, authentic, viral-potential`,

  twitter: `TWITTER/X OPTIMIZATION:
- Colors: High contrast for small previews, bold and impactful
- Composition: Simple, clear message in the visual, minimalist but striking
- Style: Meme-friendly, shareable, conversation-starting, editorial
- Avoid: Complex scenes that lose detail in small thumbnails
- Mood: Punchy, provocative, scroll-stopping`,

  youtube: `YOUTUBE OPTIMIZATION:
- Colors: High saturation, contrasting foreground/background for thumbnail impact
- Composition: Clear focal point, faces/emotions prominent, text-friendly layout with space for overlay
- Style: Cinematic, dramatic lighting, professional thumbnail aesthetic
- Avoid: Busy backgrounds, low contrast, anything that doesn't read at small size
- Mood: Exciting, curiosity-inducing, click-worthy`,

  facebook: `FACEBOOK OPTIMIZATION:
- Colors: Warm, engaging, community-friendly
- Composition: Clear subject, works in both feed and sidebar preview sizes
- Style: Relatable, human-centric, story-telling
- Avoid: Overly polished/artificial, too corporate
- Mood: Authentic, warm, community-oriented`,
};

// --- Build brand context block for system prompt ---
function buildBrandBlock(ctx?: BrandContext): string {
  if (!ctx) return "";
  const parts: string[] = [];
  if (ctx.business_name) parts.push(`Business: ${ctx.business_name}`);
  if (ctx.niche) parts.push(`Niche: ${ctx.niche}`);
  if (ctx.brand_voice) parts.push(`Brand voice/tone: ${ctx.brand_voice}`);
  if (ctx.content_pillars?.length) parts.push(`Content pillars: ${ctx.content_pillars.join(", ")}`);
  if (ctx.target_audience) {
    const ta = ctx.target_audience;
    const audience: string[] = [];
    if (ta.age_range) audience.push(`age ${ta.age_range}`);
    if (ta.gender) audience.push(ta.gender);
    if (ta.interests?.length) audience.push(`interests: ${ta.interests.join(", ")}`);
    if (ta.location) audience.push(`location: ${ta.location}`);
    if (audience.length) parts.push(`Target audience: ${audience.join("; ")}`);
  }
  if (!parts.length) return "";
  return `\n\nBRAND CONTEXT (use this to align the image with the brand identity):\n${parts.join("\n")}`;
}

// --- Build platform block ---
function buildPlatformBlock(platforms?: string[]): string {
  if (!platforms?.length) return "";
  const blocks = platforms
    .map(p => PLATFORM_PERSONAS[p.toLowerCase()])
    .filter(Boolean);
  if (!blocks.length) return "";
  return `\n\nTARGET PLATFORM(S) — Optimize the image for these platforms:\n${blocks.join("\n\n")}`;
}

// --- AI call with fallback ---
async function callAI(
  systemPrompt: string,
  userMessage: string,
  lovableKey: string,
): Promise<string | null> {
  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
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
            { role: "user", content: userMessage },
          ],
        }),
      });

      if (!res.ok) {
        const status = res.status;
        console.warn(`[leonardo] AI ${model} failed: ${status}`);
        if (status === 429 || status >= 500) continue; // fallback
        return null;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content && content.length > 10) {
        return content;
      }
      continue;
    } catch (err: any) {
      console.error(`[leonardo] AI ${model} error:`, err.message);
      continue;
    }
  }
  return null;
}

// --- AI Prompt Enhancement (context-aware) ---
async function enhancePrompt(
  prompt: string,
  styleKey: string,
  brandContext?: BrandContext,
  postContent?: string,
  targetPlatforms?: string[],
): Promise<string> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) {
    console.warn("[leonardo] LOVABLE_API_KEY not available, skipping prompt enhancement");
    return prompt;
  }

  const styleHint = PHOTOREAL_STYLES.has(styleKey)
    ? "photorealistic with camera details (lens, aperture, ISO, film stock), professional lighting"
    : styleKey === "anime"
    ? "high-quality anime/manga with artistic detail"
    : styleKey === "illustration"
    ? "professional high-quality illustration"
    : "with professional visual details, composition and lighting";

  const brandBlock = buildBrandBlock(brandContext);
  const platformBlock = buildPlatformBlock(targetPlatforms);
  const postBlock = postContent
    ? `\n\nPOST CONTENT (the image must visually represent/complement this post):\n"${postContent.slice(0, 500)}"`
    : "";

  const systemPrompt = `You are an elite AI prompt engineer and art director specialized in creating high-converting social media visuals using Leonardo AI.

Your job: Transform the user's description into a masterful, detailed image generation prompt that produces stunning, scroll-stopping results.

PROMPT ENGINEERING FRAMEWORK:
1. SUBJECT — Clearly define the main subject with specific attributes (materials, textures, colors, expressions)
2. COMPOSITION — Rule of thirds, leading lines, negative space, framing, depth layers (foreground/midground/background)
3. LIGHTING — Type (Rembrandt, butterfly, split, rim, volumetric, golden hour, neon), direction, color temperature, shadows
4. CAMERA (for photos) — Lens (35mm, 50mm, 85mm, macro), aperture (f/1.4 bokeh, f/8 sharp), ISO, shutter speed, film stock
5. STYLE — Art movement references, artist influences, rendering technique, color palette (complementary, analogous, monochromatic)
6. ATMOSPHERE — Mood, emotion, environmental effects (fog, particles, lens flare, depth of field)
7. QUALITY BOOSTERS — "award-winning", "8K resolution", "ultra-detailed", "masterpiece", "professional", "cinematic"
8. SOCIAL MEDIA OPTIMIZATION — Eye-catching, thumb-stopping, high engagement, trending aesthetic

SENTIMENT-AWARE VISUAL DIRECTION:
- Analyze the emotional tone of any provided post content
- MOTIVATIONAL → warm golden lighting, upward angles, sunrise/hero compositions, empowering poses
- EDUCATIONAL → clean layouts, infographic-friendly, structured composition, professional lighting
- SALES/PROMOTIONAL → product-hero lighting, luxury feel, aspirational lifestyle, desire-triggering
- HUMOR/CASUAL → playful colors, dynamic angles, expressive elements, fun compositions
- URGENCY → high contrast, dramatic lighting, bold reds/oranges, intense atmosphere
- INSPIRATIONAL → epic scale, vast landscapes, golden hour, cinematic wide shots

Target style: ${styleHint}
${brandBlock}
${platformBlock}
${postBlock}

RULES:
- Output ONLY the enhanced prompt in ENGLISH, no explanations, no quotes
- Maximum 350 words
- Front-load the most important visual elements
- Use commas to separate concepts for better AI parsing
- Include at least 3 quality/technique keywords
- If brand context exists, ensure colors/mood/style align with brand identity
- If post content exists, the image MUST visually complement the message
- If platform targets exist, optimize composition and style for those platforms`;

  const result = await callAI(systemPrompt, prompt, lovableKey);
  return result || prompt;
}

// --- Smart Prompt Generator (from post content + brand) ---
async function generateSmartPrompt(
  postContent: string,
  brandContext: BrandContext | undefined,
  styleKey: string,
  userHint?: string,
  targetPlatforms?: string[],
  variations?: boolean,
): Promise<any> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) return null;

  const brandBlock = buildBrandBlock(brandContext);
  const platformBlock = buildPlatformBlock(targetPlatforms);

  const variationsInstruction = variations
    ? `\n\nOUTPUT FORMAT: Return EXACTLY a valid JSON array with 3 variations. Each must have "style" and "prompt" keys.
Format: [{"style":"Minimalist","prompt":"..."},{"style":"Vibrant","prompt":"..."},{"style":"Conceptual","prompt":"..."}]

VARIATION GUIDELINES:
1. MINIMALIST — Clean, simple, elegant. Fewer elements, lots of negative space, refined color palette, subtle lighting. Less is more.
2. VIBRANT — Bold, colorful, energetic. Rich saturated colors, dynamic composition, high contrast, eye-catching, maximum visual impact.
3. CONCEPTUAL — Abstract, metaphorical, artistic. Symbolic representation of the message, creative interpretation, thought-provoking visuals.

Each prompt must be 100-180 words maximum (MUST stay under 1400 characters), technically detailed, in ENGLISH. Output ONLY the JSON array, nothing else.`
    : `\nOUTPUT FORMAT: A single detailed prompt in ENGLISH, 100-200 words MAXIMUM (MUST stay under 1400 characters), comma-separated concepts, no explanations.`;

  const systemPrompt = `You are a senior digital art director for social media brands. Your specialty: creating image descriptions that generate maximum engagement on Instagram, LinkedIn, TikTok, and Twitter.

Given a social media post text and optionally a brand profile, create a detailed, technical image generation prompt that:

1. VISUALLY REPRESENTS the post's core message without repeating text literally
2. TRIGGERS EMOTIONAL RESPONSE aligned with the post's intent (inspire, educate, sell, entertain)
3. FOLLOWS PLATFORM BEST PRACTICES — bold colors, clear focal point, contrast, minimal clutter
4. ALIGNS WITH BRAND IDENTITY if brand context is provided
5. IS TECHNICALLY PRECISE — includes composition, lighting, camera/art details, color palette

SENTIMENT ANALYSIS (apply automatically):
- Read the post's emotional tone and intent
- MOTIVATIONAL posts → warm lighting, empowering imagery, sunrise/golden hour, upward movement
- EDUCATIONAL posts → clean structured visuals, infographic style, professional lighting
- SALES posts → product-hero compositions, luxury feel, aspirational lifestyle imagery
- ENTERTAINING posts → playful colors, dynamic angles, fun compositions
- STORYTELLING posts → cinematic framing, narrative depth, emotional lighting

VISUAL AIDA FRAMEWORK:
A — ATTENTION: Bold focal point, high contrast element, or unusual composition that stops the scroll
I — INTEREST: Supporting details, textures, lighting that draw the eye deeper into the image
D — DESIRE: Aspirational quality, emotional connection, lifestyle appeal that resonates with the target audience
A — ACTION: Clean composition that allows for text overlay or CTA placement if needed

${variationsInstruction}
${brandBlock}
${platformBlock}`;

  const userMessage = userHint
    ? `POST CONTENT:\n"${postContent.slice(0, 600)}"\n\nUSER DIRECTION:\n"${userHint}"\n\nCreate an optimized image prompt.`
    : `POST CONTENT:\n"${postContent.slice(0, 600)}"\n\nCreate an optimized image prompt that visually complements this post for social media.`;

  const result = await callAI(systemPrompt, userMessage, lovableKey);
  if (!result) return null;

  // For variations, parse JSON
  if (variations) {
    try {
      // Try to extract JSON array from the response
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          return { variations: parsed.slice(0, 3).map((v: any) => ({
            style: v.style || "Variation",
            prompt: v.prompt || "",
          }))};
        }
      }
    } catch (e) {
      console.error("[leonardo] Failed to parse variations JSON:", e);
    }
    // Fallback: return as single prompt
    return { enhanced_prompt: result };
  }

  return { enhanced_prompt: result };
}

// --- Poll Leonardo generation (adaptive interval: 2s first 5, then 3s) ---
async function pollGeneration(generationId: string, apiKey: string, maxAttempts = 60): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const delay = i < 5 ? 2000 : 3000; // faster initial polls
    await new Promise((r) => setTimeout(r, delay));
    try {
      const res = await fetch(`${LEONARDO_BASE}/generations/${generationId}`, {
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      });
      if (!res.ok) {
        if (res.status === 429) {
          console.warn(`[leonardo] Poll rate-limited, backing off...`);
          await new Promise((r) => setTimeout(r, 5000));
        }
        continue;
      }
      const data = await res.json();
      const gen = data.generations_by_pk;
      if (!gen) continue;
      if (gen.status === "COMPLETE") {
        return gen;
      }
      if (gen.status === "FAILED") {
        const failReason = gen.failure_reason || gen.status_message || "Unknown failure";
        throw new Error(`Leonardo generation failed: ${failReason}`);
      }
    } catch (err: any) {
      if (err.message?.includes("Leonardo generation failed")) throw err;
      console.warn(`[leonardo] Poll error (attempt ${i + 1}):`, err.message);
    }
  }
  throw new Error("Leonardo generation timed out after ~3 minutes");
}

// --- Main handler ---
export async function handleGenerateImageLeonardo(_req: Request, params: any) {
  const apiKey = Deno.env.get("LEONARDO_API_KEY");
  if (!apiKey) return jsonResp({ error: "LEONARDO_API_KEY not configured" }, 500);

  const {
    prompt,
    negative_prompt,
    style_key = "dynamic",
    dimension_key = "1:1_1k",
    quantity = 1,
    prompt_enhance = false,
    seed,
    generation_mode = "alchemy",
    contrast_ratio,
    guidance_scale,
    scheduler,
    auto_enhance = false,
    auto_negative = true,
    // Smart prompt context
    brand_context,
    post_content,
    smart_prompt = false,
    // New: platform + variations
    target_platforms,
    variations = false,
  } = params;

  // Smart prompt mode: generate prompt from post content + brand
  if (smart_prompt && post_content) {
    const smartResult = await generateSmartPrompt(
      post_content,
      brand_context as BrandContext | undefined,
      style_key,
      (prompt && typeof prompt === "string" && prompt.trim()) ? prompt.trim() : undefined,
      target_platforms as string[] | undefined,
      variations,
    );
    if (smartResult) {
      // Variations mode
      if (smartResult.variations) {
        return jsonResp({
          variations: smartResult.variations,
          url: null,
          all_urls: [],
          generation_id: null,
          quantity_generated: 0,
          smart: true,
        });
      }
      // Single prompt mode
      return jsonResp({
        enhanced_prompt: smartResult.enhanced_prompt,
        url: null,
        all_urls: [],
        generation_id: null,
        quantity_generated: 0,
        smart: true,
      });
    }
    return jsonResp({ error: "Não foi possível gerar prompt inteligente. Verifique se o conteúdo do post foi fornecido." }, 500);
  }

  // For non-smart modes, prompt is required
  const rawPrompt = prompt && typeof prompt === "string" ? prompt.trim() : "";
  if (!rawPrompt && !smart_prompt) {
    return jsonResp({ error: "Prompt is required" }, 400);
  }

  // 1. Enhance prompt with AI if requested
  let finalPrompt = rawPrompt;
  let enhancedPrompt: string | null = null;

  if (auto_enhance) {
    enhancedPrompt = await enhancePrompt(
      finalPrompt, style_key, brand_context as BrandContext | undefined,
      post_content, target_platforms as string[] | undefined,
    );
    finalPrompt = enhancedPrompt;
  }

  // 1b. Enhance-only mode: return enhanced prompt without generating
  if (quantity === 0) {
    return jsonResp({
      enhanced_prompt: enhancedPrompt || finalPrompt,
      url: null,
      all_urls: [],
      generation_id: null,
      quantity_generated: 0,
    });
  }

  // 2. Build negative prompt
  let finalNegative = negative_prompt?.trim() || "";
  if (auto_negative && !finalNegative) {
    finalNegative = DEFAULT_NEGATIVE;
  } else if (auto_negative && finalNegative) {
    const userTerms = new Set(finalNegative.toLowerCase().split(",").map((s: string) => s.trim()));
    const defaults = DEFAULT_NEGATIVE.split(",").map((s: string) => s.trim());
    const extras = defaults.filter(d => !userTerms.has(d.toLowerCase()));
    if (extras.length > 0) {
      finalNegative = finalNegative + ", " + extras.join(", ");
    }
  }

  // 3. Resolve dimensions
  const dim = DIM_MAP[dimension_key] ?? DIM_MAP["1:1_1k"];
  const presetStyle = STYLE_MAP[style_key] ?? "DYNAMIC";

  // 4. Determine mode-specific params
  const isPhotoReal = generation_mode === "photoreal" || (generation_mode === "alchemy" && PHOTOREAL_STYLES.has(style_key));
  const isCreative = generation_mode === "creative";
  const is2K = dim.width > 1600 || dim.height > 1600;

  // 5. Truncate prompt to Leonardo's 1500 char limit
  if (finalPrompt.length > 1500) {
    finalPrompt = finalPrompt.substring(0, 1497) + "...";
  }

  // 6. Build Leonardo API body
  const body: Record<string, any> = {
    prompt: finalPrompt,
    width: dim.width,
    height: dim.height,
    num_images: Math.min(Math.max(quantity, 1), 4),
    alchemy: !isCreative,
    expandedDomain: true,
    public: false, // keep generations private
  };

  if (presetStyle) body.presetStyle = presetStyle;
  if (finalNegative) body.negative_prompt = finalNegative;
  if (seed != null) body.seed = Number(seed);
  if (prompt_enhance) body.promptMagic = true;

  if (isPhotoReal && !is2K) {
    body.photoReal = true;
    body.photoRealVersion = "v2";
    body.modelId = KINO_XL_MODEL;
  }

  if (is2K) {
    body.ultra = true;
  }

  if (contrast_ratio != null) {
    const cr = Math.max(0, Math.min(1, Number(contrast_ratio)));
    body.contrastRatio = cr;
    if (cr > 0.7) body.highContrast = true;
  }

  if (guidance_scale != null) {
    body.guidance_scale = Math.max(1, Math.min(20, Number(guidance_scale)));
  }

  const validSchedulers = ["EULER_DISCRETE", "LEONARDO", "DPM_PLUS_PLUS_SDE"];
  if (scheduler && validSchedulers.includes(scheduler)) {
    body.scheduler = scheduler;
  }

    prompt: finalPrompt.slice(0, 80),
    dim,
    style: presetStyle,
    mode: generation_mode,
    photoReal: !!body.photoReal,
    qty: body.num_images,
    enhanced: !!enhancedPrompt,
    platforms: target_platforms,
  }));

  try {
    const createRes = await fetch(`${LEONARDO_BASE}/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error("[leonardo] Create failed:", createRes.status, errText);

      if (createRes.status === 429) {
        const retryAfter = parseInt(createRes.headers.get("retry-after") || "30", 10);
        return jsonResp({ error: "Rate limit da API Leonardo. Aguarde antes de tentar novamente.", code: "rate_limit", retry_after: retryAfter }, 429);
      }
      if (createRes.status === 400) {
        if (errText.includes("content moderation") || errText.includes("NSFW") || errText.includes("safety")) {
          return jsonResp({ error: "Conteúdo bloqueado pela moderação. Reformule seu prompt.", code: "content_moderation", refunded: true }, 400);
        }
        if (errText.includes("maximum length")) {
          return jsonResp({ error: "Prompt excede o limite de caracteres. Reduza o texto.", code: "prompt_too_long" }, 400);
        }
        return jsonResp({ error: "Parâmetros inválidos na requisição.", code: "bad_request", details: errText }, 400);
      }
      if (createRes.status === 402) {
        return jsonResp({ error: "Créditos Leonardo insuficientes no servidor.", code: "leonardo_no_credits" }, 502);
      }
      return jsonResp({ error: `Leonardo API error: ${createRes.status}`, details: errText }, 500);
    }

    const createData = await createRes.json();
    const generationId = createData?.sdGenerationJob?.generationId;
    if (!generationId) {
      console.error("[leonardo] No generationId in response:", JSON.stringify(createData));
      return jsonResp({ error: "No generation ID returned from Leonardo" }, 500);
    }


    const gen = await pollGeneration(generationId, apiKey);
    const images = gen.generated_images ?? [];

    if (images.length === 0) {
      return jsonResp({ error: "No images generated", generation_id: generationId }, 500);
    }

    const nsfwFiltered = (body.num_images as number) - images.length;
    const allUrls = images.map((img: any) => img.url);


    return jsonResp({
      url: allUrls[0],
      all_urls: allUrls,
      generation_id: generationId,
      quantity_generated: images.length,
      nsfw_filtered: nsfwFiltered > 0 ? nsfwFiltered : 0,
      nsfw_refunded: 0,
      enhanced_prompt: enhancedPrompt,
    });
  } catch (err: any) {
    console.error("[leonardo] Error:", err.message);
    return jsonResp({ error: err.message || "Leonardo generation failed" }, 500);
  }
}

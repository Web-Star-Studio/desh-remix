import { corsHeaders } from "./utils.ts";

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const PRIMARY_MODEL = "google/gemini-2.5-flash";
const FALLBACK_MODEL = "google/gemini-2.5-flash-lite";

// --- Platform visual optimization personas ---
const PLATFORM_PERSONAS: Record<string, string> = {
  instagram: `INSTAGRAM: Vibrant saturated colors, high contrast, clean focal point, aspirational lifestyle aesthetic, rule of thirds, "Instagram-worthy" polished look.`,
  linkedin: `LINKEDIN: Professional blues/grays/whites, structured clean composition, corporate-friendly, editorial quality, authoritative and trustworthy.`,
  tiktok: `TIKTOK: Bold trending neon accents, Gen-Z aesthetic, vertical 9:16, eye-catching in 0.5s, energetic dynamic angles, raw authentic viral-potential.`,
  twitter: `TWITTER/X: High contrast for small previews, minimalist but striking, shareable, punchy scroll-stopping composition.`,
  youtube: `YOUTUBE: High saturation, dramatic lighting, clear focal point, cinematic, thumbnail-optimized with space for text overlay.`,
  facebook: `FACEBOOK: Warm engaging colors, relatable human-centric, storytelling, community-oriented, works at multiple preview sizes.`,
  pinterest: `PINTEREST: Vertical format, inspirational aesthetic, clean typography-friendly, aspirational lifestyle, soft warm tones.`,
  threads: `THREADS: Clean modern aesthetic, conversational feel, minimalist yet engaging.`,
  bluesky: `BLUESKY: Clean modern aesthetic, tech-savvy, minimalist composition, professional yet approachable.`,
};

interface BrandContext {
  business_name?: string;
  niche?: string;
  brand_voice?: string;
  content_pillars?: string[];
  target_audience?: {
    age_range?: string;
    gender?: string;
    interests?: string[];
    location?: string;
    desires?: string[];
    pain_points?: string[];
  };
}

interface SmartPromptParams {
  post_content: string;
  brand_context?: BrandContext;
  style_key?: string;
  target_platforms?: string[];
  user_hint?: string;
  variations?: boolean;
}

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildBrandBlock(ctx?: BrandContext): string {
  if (!ctx) return "";
  const parts: string[] = [];
  if (ctx.business_name) parts.push(`Business: ${ctx.business_name}`);
  if (ctx.niche) parts.push(`Niche/Industry: ${ctx.niche}`);
  if (ctx.brand_voice) parts.push(`Brand voice/tone: ${ctx.brand_voice}`);
  if (ctx.content_pillars?.length) parts.push(`Content pillars: ${ctx.content_pillars.join(", ")}`);
  if (ctx.target_audience) {
    const ta = ctx.target_audience;
    const audience: string[] = [];
    if (ta.age_range) audience.push(`age ${ta.age_range}`);
    if (ta.gender) audience.push(ta.gender);
    if (ta.interests?.length) audience.push(`interests: ${ta.interests.join(", ")}`);
    if (ta.location) audience.push(`location: ${ta.location}`);
    if (ta.desires?.length) audience.push(`desires/aspirations: ${ta.desires.join(", ")}`);
    if (ta.pain_points?.length) audience.push(`pain points: ${ta.pain_points.join(", ")}`);
    if (audience.length) parts.push(`Target audience: ${audience.join("; ")}`);
  }
  if (!parts.length) return "";
  return `\n\nBRAND CONTEXT — Align the visual identity with this brand:\n${parts.join("\n")}`;
}

function buildPlatformBlock(platforms?: string[]): string {
  if (!platforms?.length) return "";
  const blocks = platforms
    .map(p => PLATFORM_PERSONAS[p.toLowerCase()])
    .filter(Boolean);
  if (!blocks.length) return "";
  return `\n\nTARGET PLATFORMS — Optimize the visual for:\n${blocks.join("\n")}`;
}

async function callAI(systemPrompt: string, userMessage: string, lovableKey: string): Promise<string | null> {
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
          temperature: 0.8,
          max_tokens: 2048,
        }),
      });

      if (!res.ok) {
        console.warn(`[smart-prompt] AI ${model} failed: ${res.status}`);
        if (res.status === 429 || res.status >= 500) continue;
        return null;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content && content.length > 20) {
        return content;
      }
      continue;
    } catch (err: any) {
      console.error(`[smart-prompt] ${model} error:`, err.message);
      continue;
    }
  }
  return null;
}

const STYLE_VISUAL_DIRECTION: Record<string, string> = {
  dynamic: "dynamic cinematic composition, dramatic lighting, professional quality, bold visual impact",
  pro_photo: "professional DSLR photograph, natural lighting, shallow depth of field, color-graded",
  pro_bw: "professional black and white, high contrast, dramatic tonal range, fine art quality",
  pro_film: "analog film photography, warm grain, Kodak Portra/Fuji tones, nostalgic cinematic feel",
  portrait: "portrait photography, 85mm f/1.4, studio lighting, creamy bokeh, sharp focus on subject",
  portrait_cinema: "cinematic portrait, dramatic Rembrandt lighting, movie-quality color grading, anamorphic feel",
  portrait_fashion: "high-fashion editorial portrait, Vogue-quality, dramatic pose, striking styling",
  stock_photo: "clean commercial stock photo, versatile, professional, well-lit, universally appealing",
  illustration: "detailed digital illustration, vibrant colors, clean lines, professional concept art quality",
  creative: "experimental creative art, bold unconventional composition, unique visual language",
  "3d_render": "photorealistic 3D render, volumetric lighting, ray tracing, detailed materials and textures",
  watercolor: "watercolor painting, soft flowing edges, expressive brushwork, artistic color blending",
  fashion: "high-end fashion photography, editorial lighting, trendy contemporary styling",
  game_concept: "game concept art, detailed environment design, fantasy/sci-fi atmosphere, epic scale",
  graphic_2d: "clean 2D graphic design, modern flat illustration, vector-quality, bold shapes",
  graphic_3d: "3D graphic design, isometric perspective, polished modern aesthetic, clean renders",
  ray_traced: "ray traced photorealistic render, perfect reflections, global illumination, studio quality",
  acrylic: "acrylic painting style, visible textured brushstrokes, rich impasto colors, fine art quality",
  anime: "high-quality anime art, detailed character design, Japanese animation style, expressive",
  none: "",
};

export async function handleSmartPrompt(_req: Request, params: SmartPromptParams) {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) return jsonResp({ error: "LOVABLE_API_KEY not configured" }, 500);

  const {
    post_content,
    brand_context,
    style_key = "dynamic",
    target_platforms,
    user_hint,
    variations = false,
  } = params;

  if (!post_content?.trim()) {
    return jsonResp({ error: "post_content is required" }, 400);
  }

  const brandBlock = buildBrandBlock(brand_context);
  const platformBlock = buildPlatformBlock(target_platforms);
  const styleDirection = STYLE_VISUAL_DIRECTION[style_key] || STYLE_VISUAL_DIRECTION["dynamic"];

  const variationsInstruction = variations
    ? `\n\nOUTPUT: Return EXACTLY a valid JSON array with 3 prompt variations. Each has "style" and "prompt" keys.
Format: [{"style":"Minimalist","prompt":"..."},{"style":"Vibrant","prompt":"..."},{"style":"Conceptual","prompt":"..."}]

VARIATION APPROACHES:
1. MINIMALIST — Clean, simple, elegant. Few elements, generous negative space, refined muted palette, subtle lighting. Less is more.
2. VIBRANT — Bold, colorful, energetic. Rich saturated colors, dynamic composition, high contrast, maximum visual impact.
3. CONCEPTUAL — Abstract, metaphorical, artistic. Symbolic representation, creative reinterpretation, thought-provoking visuals.

Each prompt: 120-200 words, ENGLISH only, under 1400 characters. Output ONLY the JSON array.`
    : `\n\nOUTPUT: A single detailed prompt in ENGLISH, 120-250 words, comma-separated technical concepts. No explanations, no quotes, no preamble. Just the prompt.`;

  const systemPrompt = `You are an elite Art Director and Visual Strategist for social media brands. You transform post scripts/content into highly technical, precise image generation prompts that produce stunning, scroll-stopping, engagement-maximizing visuals.

## YOUR PROCESS

### STEP 1 — DEEP CONTENT ANALYSIS
Analyze the post content to extract:
- CORE MESSAGE: The single most important idea to visualize
- EMOTIONAL TONE: What feeling should the image evoke? (inspire, educate, sell, entertain, provoke, comfort)
- KEY VISUAL ELEMENTS: Objects, scenes, metaphors, symbols that represent the message
- TARGET ACTION: What should the viewer feel/do after seeing this image?

### STEP 2 — VISUAL STRATEGY (AIDA Framework)
A — ATTENTION: Design a bold focal point or unusual element that stops the scroll in 0.3 seconds
I — INTEREST: Add supporting visual details (textures, lighting, secondary elements) that reward closer inspection
D — DESIRE: Create aspirational quality — the viewer should WANT to engage, share, or act
A — ACTION: Leave clean space for potential text overlays or CTAs

### STEP 3 — TECHNICAL PROMPT CONSTRUCTION
Build the prompt with these layers:
1. SUBJECT — Main visual subject with specific attributes (materials, textures, colors, poses, expressions)
2. COMPOSITION — Camera angle, framing (rule of thirds, centered, diagonal), depth layers (foreground/mid/background), negative space usage
3. LIGHTING — Type (golden hour, Rembrandt, butterfly, volumetric, neon, backlit, rim light), direction, color temperature, shadow quality
4. COLOR PALETTE — Specific color scheme (complementary, analogous, monochromatic, split-complementary), dominant + accent colors
5. ATMOSPHERE — Mood descriptors, environmental effects (bokeh, fog, particles, lens flare, reflections)
6. CAMERA/ART DETAILS — For photos: lens (35mm/50mm/85mm/macro), aperture, film stock. For art: medium, technique, art movement references
7. QUALITY KEYWORDS — "award-winning", "8K", "ultra-detailed", "masterpiece", "professional", "trending on artstation"

### STEP 4 — SENTIMENT-AWARE ADAPTATION
Match visual treatment to detected emotional tone:
- MOTIVATIONAL → Warm golden/amber tones, sunrise/hero lighting, upward angles, empowering scale, open sky
- EDUCATIONAL → Clean structured layout, infographic-friendly composition, cool professional lighting, organized elements
- SALES/PROMOTIONAL → Product-hero spotlight, luxury textures (marble, gold, glass), desire-triggering lifestyle, premium feel
- ENTERTAINING → Playful saturated colors, dynamic diagonal angles, expressive subjects, fun unexpected elements
- STORYTELLING → Cinematic 2.39:1 feel, narrative depth, emotional lighting, suggestive atmosphere
- URGENCY → High contrast, dramatic shadows, bold reds/oranges, intense close-up angles
- INSPIRATIONAL → Epic vast scale, dramatic landscapes, golden hour, cinematic wide establishing shots

### STEP 5 — STYLE APPLICATION
Requested visual style: ${styleDirection}
Adapt ALL technical choices to serve this style while maintaining the emotional connection to the post content.

## CRITICAL RULES
- The image MUST visually REPRESENT the post's message — not literally illustrate it word-by-word
- Use METAPHORICAL and SYMBOLIC thinking: "growth" → sprouting plant in golden light, NOT literal text
- NEVER include text, words, letters, watermarks, or logos in the image description
- Front-load the most important visual elements in the prompt
- Use commas to separate concepts for better AI model parsing
- If brand context exists, weave brand colors/mood/style naturally into the visual
- The prompt must work as a standalone image generation instruction
${variationsInstruction}
${brandBlock}
${platformBlock}`;

  const userMessage = user_hint
    ? `POST CONTENT/SCRIPT:\n"""${post_content.slice(0, 800)}"""\n\nADDITIONAL CREATIVE DIRECTION FROM USER:\n"${user_hint.slice(0, 300)}"\n\nGenerate the optimized image prompt.`
    : `POST CONTENT/SCRIPT:\n"""${post_content.slice(0, 800)}"""\n\nGenerate an optimized image generation prompt that visually captures the essence of this post for maximum social media impact.`;


  const result = await callAI(systemPrompt, userMessage, lovableKey);
  if (!result) {
    return jsonResp({ error: "Não foi possível gerar o prompt. Tente novamente." }, 500);
  }

  // For variations, parse JSON array
  if (variations) {
    try {
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          return jsonResp({
            variations: parsed.slice(0, 3).map((v: any) => ({
              style: v.style || "Variation",
              prompt: (v.prompt || "").slice(0, 1400),
            })),
          });
        }
      }
    } catch (e) {
      console.error("[smart-prompt] Failed to parse variations:", e);
    }
    // Fallback: return as single prompt
    return jsonResp({ prompt: result.slice(0, 1400) });
  }

  return jsonResp({ prompt: result.slice(0, 1400) });
}

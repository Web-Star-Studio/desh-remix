/**
 * @function media-gen
 * @description Geração de mídia (imagem, PDF, TTS) via IA
 * @status active
 * @calledBy MediaPage
 */
import { corsHeaders, handleCors, errorResponse } from "../_shared/utils.ts";
import { verifyAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  try {
    const body = await req.json();
    const { action, ...params } = body;

    switch (action) {
      case "image": {
        const { handleGenerateImage } = await import("../_shared/media-image.ts");
        return await handleGenerateImage(req, params);
      }
      case "image-leonardo": {
        const { handleGenerateImageLeonardo } = await import("../_shared/media-leonardo.ts");
        return await handleGenerateImageLeonardo(req, params);
      }
      case "tts": {
        const { handleTTS } = await import("../_shared/media-tts.ts");
        return await handleTTS(req, params);
      }
      case "pdf": {
        const { handleGeneratePDF } = await import("../_shared/media-pdf.ts");
        return await handleGeneratePDF(req, params);
      }
      case "nano-banana": {
        const { handleNanaBanana } = await import("../_shared/media-nano-banana.ts");
        return await handleNanaBanana(req, params);
      }
      case "smart-prompt": {
        const { handleSmartPrompt } = await import("../_shared/media-smart-prompt.ts");
        return await handleSmartPrompt(req, params);
      }
      default:
        return errorResponse(400, `Unknown action: ${action}`);
    }
  } catch (e: any) {
    console.error("media-gen error:", e);
    return errorResponse(500, e.message || "Internal error");
  }
});

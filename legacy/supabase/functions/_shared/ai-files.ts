import { checkCredits, getApiKey, callAI, aiErrorResponse, jsonRes, parseToolCallResult } from "./ai-utils.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.3";

const sanitize = (val: unknown, maxLen: number): string =>
  String(val ?? "").slice(0, maxLen).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

function getSupabase() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

/* ── Thumbnail generation (frontend canvas approach) ── */

async function generateThumbnail(fileId: string, userId: string, storagePath: string, mimeType: string): Promise<void> {
  // For images: generate a thumbnail key path and create presigned URL
  // The actual thumbnail is the original file itself (presigned URL used for display)
  // We store the thumbnail path pattern for reference
  if (mimeType.startsWith("image/")) {
    const sb = getSupabase();
    const thumbKey = `${userId}/thumbnails/${fileId}_thumb`;
    await sb.from("files").update({ thumbnail_url: thumbKey }).eq("id", fileId).eq("user_id", userId);
  }
  // PDFs and other types: no server-side thumbnail gen for now
}

/* ── OCR via Lovable AI (vision model) ── */

async function performOCR(fileId: string, userId: string, storagePath: string, mimeType: string): Promise<string | null> {
  const sb = getSupabase();

  // Only process images and PDFs
  if (!mimeType.startsWith("image/") && !mimeType.includes("pdf")) {
    await sb.from("files").update({ ocr_status: "skipped" }).eq("id", fileId);
    return null;
  }

  // Check credits (1 credit for OCR)
  const creditErr = await checkCredits(userId, "ai_ocr", 1);
  if (creditErr) {
    await sb.from("files").update({ ocr_status: "skipped" }).eq("id", fileId);
    return null; // Skip OCR if no credits, don't fail
  }

  try {
    // For images: use Gemini vision to extract text
    if (mimeType.startsWith("image/")) {
      // Get presigned URL for the image
      const { getPreviewUrl } = await import("./r2-client.ts");
      const imageUrl = await getPreviewUrl(storagePath, 600);

      const apiKey = getApiKey();
      const response = await callAI(apiKey, [
        { role: "system", content: "Extraia TODO o texto visível nesta imagem. Retorne apenas o texto extraído, sem formatação adicional. Se não houver texto, retorne 'SEM_TEXTO'." },
        { role: "user", content: [
          { type: "text", text: "Extraia o texto desta imagem:" },
          { type: "image_url", image_url: { url: imageUrl } }
        ]}
      ], { model: "google/gemini-2.5-flash" });

      if (!response.ok) {
        await sb.from("files").update({ ocr_status: "failed" }).eq("id", fileId);
        return null;
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content?.trim() || "";
      const ocrText = text === "SEM_TEXTO" ? null : text;

      await sb.from("files").update({
        ocr_text: ocrText,
        ocr_status: "done",
      }).eq("id", fileId);

      return ocrText;
    }

    // PDFs: use name-based analysis for now (full PDF OCR would require downloading and parsing)
    await sb.from("files").update({ ocr_status: "skipped" }).eq("id", fileId);
    return null;
  } catch (err) {
    console.error("OCR error:", err);
    await sb.from("files").update({ ocr_status: "failed" }).eq("id", fileId);
    return null;
  }
}

/* ── Auto-categorize with enhanced entity linking ── */

async function autoCategorize(
  fileId: string,
  userId: string,
  fileName: string,
  fileType: string,
  fileSize: string,
  ocrText: string | null
): Promise<any> {
  const sb = getSupabase();
  const apiKey = getApiKey();

  // Check credits (1 credit for categorization)
  const creditErr = await checkCredits(userId, "ai_file_categorize", 1);
  if (creditErr) {
    await sb.from("files").update({ ai_processing_status: "done" }).eq("id", fileId);
    return null;
  }

  const systemPrompt = `Você é um assistente de organização de arquivos. Categorize o arquivo e gere tags, resumo e sugestões de vinculação com base no nome, tipo e texto extraído (OCR).`;

  const userPrompt = `Arquivo: "${fileName}"
Tipo: ${fileType}
Tamanho: ${fileSize}
Texto extraído (OCR): ${ocrText ? ocrText.slice(0, 3000) : 'N/A'}

Categorize e analise este arquivo.`;

  const tools = [{
    type: "function",
    function: {
      name: "auto_categorize",
      description: "Categorizar arquivo automaticamente",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "Uma das opções: nota_fiscal, contrato, recibo, comprovante, foto_pessoal, foto_documento, video, documento_texto, planilha, apresentacao, codigo, audio, ebook, outro"
          },
          summary: { type: "string", description: "Resumo breve de 2-3 linhas do provável conteúdo" },
          tags: { type: "array", items: { type: "string" }, maxItems: 5 },
          suggested_links: {
            type: "array",
            items: {
              type: "object",
              properties: {
                entity_type: { type: "string", enum: ["contact", "task", "transaction", "note"] },
                search_term: { type: "string", description: "Termo para buscar entidade relacionada" },
                reason: { type: "string" }
              },
              required: ["entity_type", "search_term", "reason"],
              additionalProperties: false
            },
            maxItems: 3
          }
        },
        required: ["category", "summary", "tags"],
        additionalProperties: false
      }
    }
  }];

  const response = await callAI(apiKey, [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ], { tools, toolChoice: { type: "function", function: { name: "auto_categorize" } } });

  if (!response.ok) {
    await sb.from("files").update({ ai_processing_status: "failed" }).eq("id", fileId);
    return null;
  }

  const data = await response.json();
  const parsed = parseToolCallResult(data);

  if (parsed) {
    // Try to resolve entity links
    const resolvedLinks = [];
    if (parsed.suggested_links?.length) {
      for (const link of parsed.suggested_links.slice(0, 3)) {
        try {
          let entityId = null;
          const term = link.search_term;

          if (link.entity_type === "contact" && term) {
            const { data: contacts } = await sb.from("contacts")
              .select("id, name")
              .eq("user_id", userId)
              .ilike("name", `%${term}%`)
              .limit(1);
            if (contacts?.[0]) entityId = contacts[0].id;
          } else if (link.entity_type === "transaction" && term) {
            const { data: txns } = await sb.from("finance_transactions")
              .select("id, description")
              .eq("user_id", userId)
              .ilike("description", `%${term}%`)
              .limit(1);
            if (txns?.[0]) entityId = txns[0].id;
          } else if (link.entity_type === "task" && term) {
            const { data: tasks } = await sb.from("tasks")
              .select("id, title")
              .eq("user_id", userId)
              .ilike("title", `%${term}%`)
              .limit(1);
            if (tasks?.[0]) entityId = tasks[0].id;
          }

          resolvedLinks.push({
            ...link,
            entity_id: entityId,
            resolved: !!entityId,
          });
        } catch { resolvedLinks.push({ ...link, entity_id: null, resolved: false }); }
      }
    }

    await sb.from("files").update({
      ai_category: parsed.category,
      ai_summary: parsed.summary,
      ai_tags: parsed.tags || [],
      ai_suggested_links: resolvedLinks.length > 0 ? resolvedLinks : (parsed.suggested_links || []),
      ai_processing_status: "done",
    }).eq("id", fileId).eq("user_id", userId);
  } else {
    await sb.from("files").update({ ai_processing_status: "failed" }).eq("id", fileId);
  }

  return parsed;
}

/* ── Full pipeline (called by trigger) ── */

async function runFullPipeline(params: any): Promise<Response> {
  const fileId = sanitize(params.fileId, 100);
  const fileUserId = sanitize(params.userId, 100);
  const fileName = sanitize(params.fileName, 5000);
  const fileType = sanitize(params.fileType, 100);
  const fileSize = sanitize(params.fileSize, 30);

  if (!fileId || !fileUserId) return jsonRes({ error: "fileId and userId required" }, 400);

  const sb = getSupabase();

  // Mark as processing
  await sb.from("files").update({ ai_processing_status: "processing" }).eq("id", fileId);

  try {
    // Get file details
    const { data: file } = await sb.from("files")
      .select("storage_path, mime_type, name, size_bytes")
      .eq("id", fileId)
      .single();

    if (!file) {
      await sb.from("files").update({ ai_processing_status: "failed" }).eq("id", fileId);
      return jsonRes({ error: "File not found" }, 404);
    }

    const mime = file.mime_type || fileType;
    const name = file.name || fileName;
    const path = file.storage_path;

    // Step 1: Generate thumbnail (for images)
    try {
      await generateThumbnail(fileId, fileUserId, path, mime);
    } catch (e) { console.error("Thumbnail error:", e); }

    // Step 2: OCR (for images and PDFs)
    let ocrText: string | null = null;
    try {
      ocrText = await performOCR(fileId, fileUserId, path, mime);
    } catch (e) { console.error("OCR error:", e); }

    // Step 3: Auto-categorize (uses OCR text if available)
    try {
      await autoCategorize(fileId, fileUserId, name, mime, String(file.size_bytes || fileSize), ocrText);
    } catch (e) {
      console.error("Categorize error:", e);
      await sb.from("files").update({ ai_processing_status: "failed" }).eq("id", fileId);
    }

    return jsonRes({ result: { success: true, fileId } });
  } catch (e) {
    console.error("Pipeline error:", e);
    await sb.from("files").update({ ai_processing_status: "failed" }).eq("id", fileId);
    return jsonRes({ error: "Pipeline failed" }, 500);
  }
}

/* ── Main handler (dispatched from data-ai) ── */

export async function handleFilesAI(params: any, userId: string): Promise<Response> {
  const apiKey = getApiKey();
  const action = sanitize(params.action, 30);
  const fileName = sanitize(params.fileName, 5000);
  const fileType = sanitize(params.fileType, 100);
  const fileSize = sanitize(params.fileSize, 30);
  const fileNames: string[] = Array.isArray(params.fileNames) ? params.fileNames.slice(0, 500).map((n: unknown) => sanitize(n, 200)) : [];

  // Full pipeline (triggered by DB trigger)
  if (action === "auto_categorize") {
    return runFullPipeline(params);
  }

  let systemPrompt = "";
  let userPrompt = "";
  let tools: any[] = [];
  let toolChoice: any = undefined;

  if (action === "analyze_file") {
    systemPrompt = `Você é um assistente de organização de arquivos. Analise o arquivo e sugira categoria, pasta, descrição e tags.`;
    userPrompt = `Arquivo: "${fileName}"\nTipo: ${fileType}\nTamanho: ${fileSize}`;
    tools = [{ type: "function", function: { name: "analyze_file", description: "Analisar arquivo", parameters: { type: "object", properties: { category: { type: "string" }, folder: { type: "string" }, description: { type: "string" }, tags: { type: "array", items: { type: "string" }, maxItems: 4 } }, required: ["category", "folder", "description", "tags"], additionalProperties: false } } }];
    toolChoice = { type: "function", function: { name: "analyze_file" } };
  } else if (action === "suggest_organization") {
    const safeFileNames = fileName.split("\n").filter(Boolean).slice(0, 200);
    if (safeFileNames.length === 0) return jsonRes({ error: "Nenhum arquivo fornecido" }, 400);
    systemPrompt = `Você é um assistente de organização de arquivos. Sugira uma estrutura de pastas ideal. Use APENAS nomes que existem na lista.`;
    userPrompt = `Organize estes ${safeFileNames.length} arquivos em pastas:\n${safeFileNames.map((f: string, i: number) => `${i + 1}. ${f}`).join("\n")}`;
    tools = [{ type: "function", function: { name: "suggest_organization", description: "Sugerir estrutura de pastas", parameters: { type: "object", properties: { folders: { type: "array", items: { type: "object", properties: { name: { type: "string" }, files: { type: "array", items: { type: "string" } } }, required: ["name", "files"], additionalProperties: false } }, tips: { type: "array", items: { type: "string" }, maxItems: 3 } }, required: ["folders", "tips"], additionalProperties: false } } }];
    toolChoice = { type: "function", function: { name: "suggest_organization" } };
  } else if (action === "summarize_content") {
    systemPrompt = `Você é um assistente inteligente de análise de arquivos.`;
    userPrompt = `Arquivo: "${fileName}"\nTipo: ${fileType}\nTamanho: ${fileSize}`;
    tools = [{ type: "function", function: { name: "summarize_content", description: "Resumir conteúdo", parameters: { type: "object", properties: { summary: { type: "string" }, insights: { type: "array", items: { type: "string" }, maxItems: 3 }, suggested_actions: { type: "array", items: { type: "string" }, maxItems: 3 }, priority: { type: "string", enum: ["alta", "média", "baixa"] } }, required: ["summary", "insights", "suggested_actions", "priority"], additionalProperties: false } } }];
    toolChoice = { type: "function", function: { name: "summarize_content" } };
  } else if (action === "find_duplicates") {
    const filesData: { name: string; size?: string; type?: string }[] = Array.isArray(params.filesData)
      ? params.filesData.slice(0, 500).map((f: any) => ({ name: sanitize(f?.name, 200), size: sanitize(f?.size, 30), type: sanitize(f?.type, 100) }))
      : fileNames.map((n: string) => ({ name: n }));
    if (filesData.length < 2) return jsonRes({ result: { groups: [], tips: ["Envie pelo menos 2 arquivos."] } });
    systemPrompt = `Você é um assistente especializado em detecção de arquivos duplicados. Use APENAS nomes que existem na lista.`;
    const fileList = filesData.map((f, i) => { let line = `${i + 1}. ${f.name}`; if (f.size) line += ` (${f.size})`; if (f.type) line += ` [${f.type}]`; return line; }).join("\n");
    userPrompt = `Analise estes ${filesData.length} arquivos:\n${fileList}`;
    tools = [{ type: "function", function: { name: "find_duplicates", description: "Identificar duplicados", parameters: { type: "object", properties: { groups: { type: "array", items: { type: "object", properties: { reason: { type: "string" }, confidence: { type: "string", enum: ["alta", "média", "baixa"] }, files: { type: "array", items: { type: "string" } }, keep: { type: "string" } }, required: ["reason", "confidence", "files", "keep"], additionalProperties: false } }, tips: { type: "array", items: { type: "string" }, maxItems: 3 }, total_duplicates: { type: "number" } }, required: ["groups", "tips", "total_duplicates"], additionalProperties: false } } }];
    toolChoice = { type: "function", function: { name: "find_duplicates" } };
  } else if (action === "smart_rename") {
    systemPrompt = `Você é um assistente de organização de arquivos. Sugira um nome melhor para o arquivo.`;
    userPrompt = `Arquivo: "${fileName}"\nTipo: ${fileType}\nTamanho: ${fileSize}`;
    tools = [{ type: "function", function: { name: "smart_rename", description: "Sugerir nome", parameters: { type: "object", properties: { suggested_name: { type: "string" }, reason: { type: "string" } }, required: ["suggested_name", "reason"], additionalProperties: false } } }];
    toolChoice = { type: "function", function: { name: "smart_rename" } };
  } else {
    return jsonRes({ error: "Ação inválida" }, 400);
  }

  const response = await callAI(apiKey, [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ], { tools, toolChoice });

  if (!response.ok) return aiErrorResponse(response.status);

  const data = await response.json();

  // Deduct credits after successful AI response
  const creditErr = await checkCredits(userId, "ai_files");
  if (creditErr) return creditErr;

  const parsed = parseToolCallResult(data);
  if (parsed) return jsonRes({ result: parsed });

  // Fallback
  const raw = data.choices?.[0]?.message?.content || "{}";
  try {
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, raw];
    return jsonRes({ result: JSON.parse(jsonMatch[1]!.trim()) });
  } catch {
    return jsonRes({ result: { error: "Resposta inválida da IA" } });
  }
}

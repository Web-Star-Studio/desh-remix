/**
 * @function tool-worker
 * @description Executa tools de IA em background (Composio actions, DB ops)
 * @status active
 * @calledBy useAIToolExecution, DB trigger (dispatch_tool_job)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/utils.ts";
import { resolveWorkspaceId } from "../_shared/composio-client.ts";
import { hasGoogleConnection } from "../_shared/google-connection-check.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_RETRIES = 3;

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  try {
    const { job_id, user_id } = await req.json();
    if (!job_id) return errorResponse(400, "Missing job_id");

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch job
    const { data: job, error: jobErr } = await adminClient
      .from("tool_jobs")
      .select("*")
      .eq("id", job_id)
      .single();

    if (jobErr || !job) return errorResponse(404, "Job not found");
    if (job.status !== "pending") return jsonResponse({ skipped: true, reason: "already_processed" });

    // Mark as running
    await adminClient.from("tool_jobs").update({ status: "running" }).eq("id", job_id);

    try {
      // Resolve workspace for Composio calls
      const wsId = await resolveWorkspaceId(adminClient, job.user_id);
      const result = await executeTool(adminClient, job.user_id, job.tool_name, job.tool_args, wsId);

      await adminClient.from("tool_jobs").update({
        status: "done",
        result,
        completed_at: new Date().toISOString(),
      }).eq("id", job_id);

      return jsonResponse({ success: true, result });
    } catch (err: any) {
      const retryCount = (job.retry_count || 0) + 1;

      if (retryCount < MAX_RETRIES) {
        // Reset to pending for retry
        await adminClient.from("tool_jobs").update({
          status: "pending",
          retry_count: retryCount,
          error: err.message,
        }).eq("id", job_id);
      } else {
        await adminClient.from("tool_jobs").update({
          status: "failed",
          error: err.message,
          completed_at: new Date().toISOString(),
          retry_count: retryCount,
        }).eq("id", job_id);
      }

      return jsonResponse({ success: false, error: err.message });
    }
  } catch (e: any) {
    console.error("[tool-worker] Fatal:", e);
    return errorResponse(500, e.message);
  }
});

// ---- Tool execution ----

async function executeTool(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  toolName: string,
  args: Record<string, any>,
  wsId?: string,
): Promise<string> {
  switch (toolName) {
    case "search_emails":
      return await handleSearchEmails(adminClient, userId, args);
    case "trash_emails":
    case "archive_emails":
    case "star_emails":
    case "mark_emails_read":
      return await handleEmailManagement(adminClient, userId, toolName, args, wsId);
    case "send_email":
      return await handleSendEmail(adminClient, userId, args, wsId);
    case "reply_email":
      return await handleReplyEmail(adminClient, userId, args, wsId);
    case "search_web":
      return await handleSearchWeb(adminClient, userId, args);
    case "generate_image":
      return await handleGenerateImage(adminClient, userId, args);
    case "create_event":
      return await handleCreateEvent(adminClient, userId, args, wsId);
    case "serp_search":
      return await handleSerpSearch(adminClient, userId, args);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// Helper: invoke another edge function as service role
async function invokeEdgeFn(fnName: string, body: any, userToken?: string, wsId?: string, internalUserId?: string): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  };
  if (userToken) headers["x-user-token"] = userToken;
  if (!userToken && internalUserId) headers["x-user-id"] = String(internalUserId);

  // Inject workspace_id for composio-proxy calls
  const finalBody = fnName === "composio-proxy" && wsId
    ? { ...body, workspace_id: wsId, default_workspace_id: wsId }
    : body;

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: "POST",
    headers,
    body: JSON.stringify(finalBody),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${fnName} returned ${resp.status}: ${text}`);
  }
  return await resp.json();
}

// Note: hasGoogleConnection now imported from _shared/google-connection-check.ts

// ---- Handlers ----

async function handleSearchEmails(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  args: Record<string, any>
): Promise<string> {
  const q = (args.query || "").toLowerCase();
  const limit = Math.min(args.limit || 20, 50);

  const { data: emails } = await adminClient
    .from("gmail_messages_cache")
    .select("id,gmail_id,subject,from_name,from_email,is_unread,is_starred,snippet")
    .eq("user_id", userId)
    .or(`subject.ilike.%${q}%,from_name.ilike.%${q}%,from_email.ilike.%${q}%`)
    .order("internal_date", { ascending: false })
    .limit(limit);

  if (!emails?.length) return `Nenhum e-mail encontrado para "${args.query}".`;

  return `📧 E-mails encontrados (${emails.length}):\n${emails
    .map((e: any) => `- ${e.is_unread ? "🔵" : "⚪"} **${e.from_name || e.from_email}**: ${e.subject}`)
    .join("\n")}`;
}

async function handleEmailManagement(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  toolName: string,
  args: Record<string, any>,
  wsId?: string,
): Promise<string> {
  const q = (args.query || "").toLowerCase();
  const limit = Math.min(args.limit || 10, 50);

  const { data: matches } = await adminClient
    .from("gmail_messages_cache")
    .select("id,gmail_id,subject,from_name,from_email")
    .eq("user_id", userId)
    .or(`subject.ilike.%${q}%,from_name.ilike.%${q}%,from_email.ilike.%${q}%`)
    .order("internal_date", { ascending: false })
    .limit(limit);

  if (!matches?.length) return `Nenhum e-mail encontrado para "${args.query}".`;

  const hasGmail = await hasGoogleConnection(adminClient, userId, "gmail");
  if (!hasGmail) throw new Error("Nenhuma conexão Gmail encontrada.");
  let successCount = 0;
  let actionLabel = "";

  for (const email of matches) {
    const gmailId = email.gmail_id;
    if (!gmailId) continue;

    let reqBody: any;
    switch (toolName) {
      case "trash_emails":
        reqBody = { service: "gmail", path: `/gmail/v1/users/me/messages/${gmailId}/trash`, method: "POST" };
        actionLabel = "movidos para a lixeira";
        break;
      case "archive_emails":
        reqBody = { service: "gmail", path: `/gmail/v1/users/me/messages/${gmailId}/modify`, method: "POST", body: { removeLabelIds: ["INBOX"] } };
        actionLabel = "arquivados";
        break;
      case "star_emails":
        reqBody = { service: "gmail", path: `/gmail/v1/users/me/messages/${gmailId}/modify`, method: "POST", body: { addLabelIds: ["STARRED"] } };
        actionLabel = "marcados com estrela";
        break;
      case "mark_emails_read":
        reqBody = { service: "gmail", path: `/gmail/v1/users/me/messages/${gmailId}/modify`, method: "POST", body: { removeLabelIds: ["UNREAD"] } };
        actionLabel = "marcados como lidos";
        break;
    }

    try {
      await invokeEdgeFn("composio-proxy", reqBody, undefined, wsId, userId);
      successCount++;
    } catch { /* skip failed individual emails */ }
  }

  if (successCount === 0) return `[ERRO] Não foi possível processar os e-mails.`;
  return `[OK] ✅ ${successCount} e-mail(s) ${actionLabel} com sucesso.`;
}

async function handleSendEmail(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  args: Record<string, any>,
  wsId?: string,
): Promise<string> {
  const hasGmail = await hasGoogleConnection(adminClient, userId, "gmail");
  if (!hasGmail) return "[ERRO] Conexão Gmail não encontrada. Conecte sua conta Google no DESH.";

  const result = await invokeEdgeFn("composio-proxy", {
    service: "gmail",
    path: "/messages/send",
    method: "POST",
    data: {
      recipient_email: args.to,
      subject: args.subject,
      body: args.body,
    },
  }, undefined, wsId, userId);

  if (result?.error) return `[ERRO] Falha ao enviar e-mail: ${typeof result.error === 'string' ? result.error : JSON.stringify(result.error)}`;
  if (!result?.id && !result?.threadId) return `[ERRO] Falha ao enviar e-mail: resposta inesperada.`;

  // Log interaction
  const { data: contact } = await adminClient
    .from("contacts")
    .select("id")
    .eq("user_id", userId)
    .eq("email", args.to)
    .limit(1)
    .maybeSingle();

  if (contact) {
    await adminClient.from("contact_interactions").insert({
      user_id: userId,
      contact_id: contact.id,
      title: `E-mail enviado: ${args.subject}`,
      type: "email",
      description: (args.body || "").substring(0, 500),
    });
  }

  return `[OK] 📧 E-mail enviado para ${args.contact_name || args.to}: "${args.subject}"`;
}

async function handleReplyEmail(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  args: Record<string, any>,
  wsId?: string,
): Promise<string> {
  const { data: originalEmail } = await adminClient
    .from("gmail_messages_cache")
    .select("gmail_id,subject,from_email,from_name")
    .eq("user_id", userId)
    .eq("id", args.email_id)
    .single();

  if (!originalEmail) return `[ERRO] E-mail original não encontrado.`;

  const hasGmail = await hasGoogleConnection(adminClient, userId, "gmail");
  if (!hasGmail) return `[ERRO] Conexão Gmail não encontrada.`;

  // Get threadId
  const fullMsg = await invokeEdgeFn("composio-proxy", {
    service: "gmail",
    path: `/gmail/v1/users/me/messages/${originalEmail.gmail_id}`,
    method: "GET",
    params: { format: "metadata", metadataHeaders: "Message-Id" },
  }, undefined, wsId, userId);

  const threadId = fullMsg?.threadId || "";
  const messageIdHeader = fullMsg?.payload?.headers?.find((h: any) => h.name === "Message-Id")?.value || "";

  const replySubject = originalEmail.subject?.startsWith("Re:") ? originalEmail.subject : `Re: ${originalEmail.subject}`;
  const rawParts = [
    `To: ${originalEmail.from_email}`,
    `Subject: ${replySubject}`,
    `In-Reply-To: ${messageIdHeader}`,
    `References: ${messageIdHeader}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    args.body,
  ];

  const encoder = new TextEncoder();
  const bytes = encoder.encode(rawParts.join("\r\n"));
  const encodedMessage = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const result = await invokeEdgeFn("composio-proxy", {
    service: "gmail",
    path: "/gmail/v1/users/me/messages/send",
    method: "POST",
    body: { raw: encodedMessage, threadId },
  }, undefined, wsId, userId);

  if (result?.error) return `[ERRO] Falha ao responder: ${typeof result.error === 'string' ? result.error : JSON.stringify(result.error)}`;
  return `[OK] 📧 Resposta enviada para ${originalEmail.from_name || originalEmail.from_email}: "${replySubject}"`;
}

async function handleSearchWeb(
  _adminClient: ReturnType<typeof createClient>,
  _userId: string,
  args: Record<string, any>
): Promise<string> {
  const result = await invokeEdgeFn("search-web", {
    query: args.query,
  });

  if (result?.error) return `[ERRO] Busca web falhou: ${result.error}`;
  if (!result?.results?.length) return `Nenhum resultado encontrado para "${args.query}".`;

  return `🌐 Resultados para "${args.query}":\n${result.results.slice(0, 5).map((r: any) =>
    `- **${r.title}**: ${r.snippet || r.description || ""}\n  ${r.url || r.link || ""}`
  ).join("\n")}`;
}

async function handleGenerateImage(
  _adminClient: ReturnType<typeof createClient>,
  _userId: string,
  args: Record<string, any>
): Promise<string> {
  const result = await invokeEdgeFn("generate-image", {
    prompt: args.prompt,
    style: args.style || "artistic",
    high_quality: args.style === "infographic" || args.style === "photo-realistic",
  });

  if (result?.error) return `[ERRO] Falha ao gerar imagem: ${result.error}`;
  if (!result?.url) return "[ERRO] Não foi possível gerar a imagem.";
  return `[OK] 🖼️ Imagem gerada!\n\n![Imagem](${result.url})\n\n[📥 Baixar](${result.url})`;
}

async function handleCreateEvent(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  args: Record<string, any>,
  wsId?: string,
): Promise<string> {
  const now = new Date();
  const day = args.day;
  const rawMonth = args.month as number | undefined;
  const month = rawMonth != null ? rawMonth - 1 : now.getMonth();
  const year = args.year ?? now.getFullYear();

  // Save to user_data
  const { data: existing } = await adminClient
    .from("user_data")
    .select("id,data")
    .eq("user_id", userId)
    .eq("data_type", "calendar")
    .limit(1)
    .maybeSingle();

  const eventObj = { day, month, year, label: args.label, category: args.category || "outro" };

  if (existing) {
    const currentEvents = Array.isArray(existing.data) ? existing.data : [];
    await adminClient.from("user_data").update({
      data: [...currentEvents, eventObj],
    }).eq("id", existing.id);
  } else {
    await adminClient.from("user_data").insert({
      user_id: userId,
      data_type: "calendar",
      data: [eventObj],
    });
  }

  // Try Google Calendar sync (Composio-first)
  try {
    const hasCal = await hasGoogleConnection(adminClient, userId, "google_calendar");

    if (hasCal) {
      const timeMatch = (args.label as string).match(/^(\d{1,2}):(\d{2})\s*[-–]\s*/);
      let eventSummary = args.label;
      let eventStart = new Date(year, month, day, 9, 0).toISOString();
      let eventEnd = new Date(year, month, day, 10, 0).toISOString();

      if (timeMatch) {
        const h = parseInt(timeMatch[1], 10);
        const m = parseInt(timeMatch[2], 10);
        eventStart = new Date(year, month, day, h, m).toISOString();
        eventEnd = new Date(year, month, day, h + 1, m).toISOString();
        eventSummary = (args.label as string).replace(timeMatch[0], "").trim();
      }

      // Remove milissegundos que o Composio não aceita
      const cleanStart = eventStart.replace(/\.\d{3}Z$/, 'Z').replace(/\.\d{3}([+-])/, '$1');
      const cleanEnd = eventEnd.replace(/\.\d{3}Z$/, 'Z').replace(/\.\d{3}([+-])/, '$1');

      await invokeEdgeFn("composio-proxy", {
        service: "calendar",
        path: "/events",
        method: "POST",
        data: {
          summary: eventSummary,
          start_datetime: cleanStart,
          end_datetime: cleanEnd,
          calendar_id: "primary",
          description: args.description || "",
          attendees: args.attendees || [],
        },
      }, undefined, wsId, userId);
    }
  } catch { /* silent fail for Google Calendar sync */ }

  return `[OK] 📅 Evento "${args.label}" criado para ${day}/${month + 1}/${year}.`;
}

async function handleSerpSearch(
  _adminClient: ReturnType<typeof createClient>,
  _userId: string,
  args: Record<string, any>
): Promise<string> {
  const result = await invokeEdgeFn("serp-proxy", {
    action: "search",
    query: args.query,
    engine: args.engine,
  });

  if (result?.error) return `[ERRO] Busca especializada falhou: ${result.error}`;

  const engine = args.engine || "google";
  let output = `🔍 **Busca ${engine}**: "${args.query}"\n\n`;

  if (engine === "google_flights" && result?.best_flights) {
    const flights = [...(result.best_flights || []), ...(result.other_flights || [])].slice(0, 5);
    output += flights.map((f: any) => {
      const legs = f.flights || [];
      const dep = legs[0];
      const arr = legs[legs.length - 1];
      return `✈️ **${dep?.airline || "Voo"}** — R$${f.price || "?"}\n  ${dep?.departure_airport?.id || "?"} → ${arr?.arrival_airport?.id || "?"} | ${f.total_duration || "?"}min`;
    }).join("\n\n") || "Nenhum voo encontrado.";
  } else if (result?.organic_results) {
    output += result.organic_results.slice(0, 5).map((r: any) =>
      `- **${r.title}**: ${r.snippet || ""}\n  ${r.link || ""}`
    ).join("\n") || "Nenhum resultado.";
  } else {
    output += JSON.stringify(result).substring(0, 500);
  }

  return output;
}

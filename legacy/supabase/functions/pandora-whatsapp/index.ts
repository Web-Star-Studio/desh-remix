/**
 * @function pandora-whatsapp
 * @description Pandora IA integrada ao WhatsApp (auto-responder)
 * @status active
 * @calledBy WhatsApp webhook, whatsapp-web-proxy
 */
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { deductCredits } from "../_shared/credits.ts";
import { buildMaestroPrompt, getTemporalContext, shouldInjectSkill, parseWorkspaceMention, type MaestroContext } from "../_shared/pandora-prompt.ts";
import { processPandoraResponse } from "../_shared/pandora-response-cleaner.ts";
import { formatEventConfirmation, formatTaskConfirmation } from "../_shared/pandora-formatters.ts";
import { corsHeaders } from "../_shared/utils.ts";
import { shouldProcessMessage } from "../_shared/whatsapp-auth-guard.ts";
import { getOrCreateMcpServer, getMcpUrl } from "../_shared/mcp-composio.ts";
import { getOrCreateSession, getRecentToolCalls, registerToolCall, updateToolCallStatus, deriveToolCategory } from "../_shared/pandora-session.ts";
import { hasGoogleConnection } from "../_shared/google-connection-check.ts";

// ── WhatsApp Command Parser ──────────────────────────────────────────────────
function parseWhatsAppCommand(message: string): { isCommand: boolean; command?: string; args?: string } {
  const trimmed = message.trim();
  if (trimmed.startsWith("/")) {
    const [command, ...rest] = trimmed.slice(1).split(" ");
    return { isCommand: true, command: command.toLowerCase(), args: rest.join(" ").trim() || undefined };
  }
  return { isCommand: false };
}

// ── Helper: get user workspaces ──────────────────────────────────────────────
async function getUserWorkspaces(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data } = await supabase
    .from("workspaces")
    .select("id,name,icon,color,is_default,industry,context_summary,system_prompt_override")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });
  return data || [];
}

// ── Helper: get workspace agents ─────────────────────────────────────────────
async function getWorkspaceAgents(supabase: ReturnType<typeof createClient>, workspaceId: string) {
  const { data } = await supabase
    .from("ai_agents")
    .select("id,name,icon,system_prompt,model,tools_enabled")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .eq("is_template", false)
    .order("created_at", { ascending: false });
  return data || [];
}

// ── Helper: send WhatsApp text response ──────────────────────────────────────
async function sendWhatsAppText(instanceName: string, contactPhone: string, text: string, apiKey: string) {
  const jid = `${contactPhone}@s.whatsapp.net`;
  return fetchWithRetry(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ number: jid, text }),
  });
}

const EVOLUTION_API_URL = "https://evolution-api-4pkj.onrender.com";

/** Derive per-user+workspace instance name (must match frontend hook logic) */
function userInstanceName(userId: string, workspaceId?: string): string {
  const userPart = userId.replace(/-/g, "").slice(0, 8);
  if (workspaceId) {
    const wsPart = workspaceId.replace(/-/g, "").slice(0, 6);
    return `desh_${userPart}_${wsPart}`;
  }
  return `desh_${userPart}`;
}

/**
 * Retry-aware fetch wrapper for Evolution API sends.
 * Retries up to `maxRetries` times when the response body contains
 * "Connection Closed" (gateway lost the WA socket temporarily).
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 2,
  delayMs = 2000,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return res;

    const body = await res.text();
    const isConnectionClosed =
      body.toLowerCase().includes("connection closed") ||
      body.toLowerCase().includes("disconnected");

    if (isConnectionClosed && attempt < maxRetries) {
      console.warn(
        `[pandora-whatsapp] Connection Closed on attempt ${attempt + 1}/${maxRetries + 1}, retrying in ${delayMs}ms…`,
      );
      await new Promise((r) => setTimeout(r, delayMs));
      continue;
    }

    // Return a synthetic response with the body we already consumed
    return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
  }
  // Should never reach here, but satisfy TS
  return new Response("max retries exceeded", { status: 502 });
}

/** Normalize Brazilian mobile numbers */
function normalizeBrazilianNumber(num: string): string {
  const clean = num.replace(/\D/g, "");
  if (clean.length === 12 && clean.startsWith("55")) {
    const ddd = parseInt(clean.slice(2, 4), 10);
    if (ddd >= 11 && ddd <= 99) return clean.slice(0, 4) + "9" + clean.slice(4);
  }
  return clean;
}

/** Get all possible number variants for a Brazilian mobile (with/without 9th digit) */
function getNumberVariants(num: string): string[] {
  const clean = num.replace(/\D/g, "");
  const variants = new Set<string>();
  variants.add(clean);
  // 13 digits (55 + DDD + 9 + 8 digits) → try without the 9
  if (clean.length === 13 && clean.startsWith("55")) {
    const ddd = clean.slice(2, 4);
    variants.add("55" + ddd + clean.slice(5));
  }
  // 12 digits (55 + DDD + 8 digits) → try with the 9
  if (clean.length === 12 && clean.startsWith("55")) {
    const ddd = parseInt(clean.slice(2, 4), 10);
    if (ddd >= 11 && ddd <= 99) {
      variants.add(clean.slice(0, 4) + "9" + clean.slice(4));
    }
  }
  return Array.from(variants);
}

// ── UNIFIED tools (parity with chat/index.ts, minus UI-only tools) ──────────
import { ALL_TOOL_DEFINITIONS } from "../_shared/pandora-tools/index.ts";

// Strip UI-only tools that have no meaning on WhatsApp text channel
const UI_ONLY_TOOLS = new Set(["suggest_replies", "show_typing", "open_modal"]);
const tools = (ALL_TOOL_DEFINITIONS as any[]).filter((t) => !UI_ONLY_TOOLS.has(t?.function?.name));

// ── Helper: resolve contact by name or ID (exact → fuzzy → company) ────────
async function resolveContact(identifier: string, userId: string, supabase: ReturnType<typeof createClient>) {
  // 1. Try exact UUID match
  if (/^[0-9a-f-]{36}$/i.test(identifier)) {
    const { data } = await supabase.from("contacts").select("id,name,email,emails,phone,phones,tags,company,role,notes").eq("user_id", userId).eq("id", identifier).limit(1);
    if (data?.length) return enrichContact(data[0]);
  }

  // 2. Exact name match (case-insensitive)
  const { data: exact } = await supabase.from("contacts").select("id,name,email,emails,phone,phones,tags,company,role,notes").eq("user_id", userId).ilike("name", identifier).limit(1);
  if (exact?.length) return enrichContact(exact[0]);

  // 3. Fuzzy name match
  const { data: fuzzy } = await supabase.from("contacts").select("id,name,email,emails,phone,phones,tags,company,role,notes").eq("user_id", userId).ilike("name", `%${identifier}%`).limit(5);
  if (fuzzy?.length) return enrichContact(fuzzy[0]);

  // 4. Search by company
  const { data: byCompany } = await supabase.from("contacts").select("id,name,email,emails,phone,phones,tags,company,role,notes").eq("user_id", userId).ilike("company", `%${identifier}%`).limit(1);
  if (byCompany?.length) return enrichContact(byCompany[0]);

  return null;
}

function enrichContact(c: any) {
  if (!c.email && Array.isArray(c.emails) && c.emails.length) {
    const primary = c.emails.find((e: any) => e.is_primary);
    c.email = primary?.email || primary?.value || c.emails[0]?.email || c.emails[0]?.value || null;
  }
  if (!c.phone && Array.isArray(c.phones) && c.phones.length) {
    const primary = c.phones.find((p: any) => p.is_primary);
    c.phone = primary?.number || primary?.value || c.phones[0]?.number || c.phones[0]?.value || null;
  }
  return c;
}

// ── Helper: find task by identifier ──────────────────────────────────────────
async function findTask(identifier: string, userId: string, supabase: ReturnType<typeof createClient>) {
  if (!identifier) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  // 1) try by exact id first (safest)
  if (isUuid) {
    const { data } = await supabase.from("tasks").select("id,title,status,priority,due_date").eq("user_id", userId).eq("id", identifier).maybeSingle();
    if (data) return data;
  }
  // 2) ilike substring on title
  const { data: ilikeMatch } = await supabase.from("tasks").select("id,title,status,priority,due_date").eq("user_id", userId).ilike("title", `%${identifier}%`).limit(1);
  if (ilikeMatch?.[0]) return ilikeMatch[0];
  // 3) fuzzy: split into significant words (>3 chars) and find best overlap among recent open tasks
  const words = identifier.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  if (words.length === 0) return null;
  const { data: candidates } = await supabase.from("tasks").select("id,title,status,priority,due_date").eq("user_id", userId).neq("status", "done").order("created_at", { ascending: false }).limit(50);
  let best: any = null;
  let bestScore = 0;
  for (const t of candidates ?? []) {
    const title = String(t.title || "").toLowerCase();
    const score = words.filter((w) => title.includes(w)).length;
    if (score > bestScore && score >= Math.max(1, Math.ceil(words.length / 2))) {
      best = t;
      bestScore = score;
    }
  }
  return best;
}

// ── Helper: find note by identifier ──────────────────────────────────────────
async function findNote(identifier: string, userId: string, supabase: ReturnType<typeof createClient>) {
  if (!identifier) return null;
  const { data } = await supabase.from("user_data").select("id,data").eq("user_id", userId).eq("data_type", "note").limit(50);
  const idLower = identifier.toLowerCase();
  const exact = (data ?? []).find((n: any) => n.id === identifier || String(n.data?.title || "").toLowerCase() === idLower);
  if (exact) return exact;
  const partial = (data ?? []).find((n: any) => String(n.data?.title || "").toLowerCase().includes(idLower));
  if (partial) return partial;
  // fuzzy word overlap
  const words = idLower.split(/\s+/).filter((w) => w.length > 3);
  if (!words.length) return null;
  let best: any = null, bestScore = 0;
  for (const n of data ?? []) {
    const title = String(n.data?.title || "").toLowerCase();
    const score = words.filter((w) => title.includes(w)).length;
    if (score > bestScore && score >= Math.max(1, Math.ceil(words.length / 2))) { best = n; bestScore = score; }
  }
  return best;
}

async function findEvent(identifier: string, userId: string, supabase: ReturnType<typeof createClient>) {
  if (!identifier) return null;
  const { data } = await supabase.from("user_data").select("id,data").eq("user_id", userId).eq("data_type", "event").limit(50);
  const idLower = identifier.toLowerCase();
  const exact = (data ?? []).find((e: any) => e.id === identifier || String(e.data?.label || "").toLowerCase() === idLower);
  if (exact) return exact;
  const partial = (data ?? []).find((e: any) => String(e.data?.label || "").toLowerCase().includes(idLower));
  if (partial) return partial;
  const words = idLower.split(/\s+/).filter((w) => w.length > 3);
  if (!words.length) return null;
  let best: any = null, bestScore = 0;
  for (const e of data ?? []) {
    const lbl = String(e.data?.label || "").toLowerCase();
    const score = words.filter((w) => lbl.includes(w)).length;
    if (score > bestScore && score >= Math.max(1, Math.ceil(words.length / 2))) { best = e; bestScore = score; }
  }
  return best;
}

// ── Tool executor ────────────────────────────────────────────────────────────
async function executeTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  supabase: ReturnType<typeof createClient>,
  workspaceId?: string,
): Promise<string> {
  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    switch (name) {
      case "get_current_time":
        return `[OK] ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;

      // ── Tasks ──
      case "get_tasks": {
        const { data } = await supabase.from("tasks").select("id,title,status,priority,due_date").eq("user_id", userId).in("status", ["todo", "in_progress"]).order("created_at", { ascending: false }).limit(20);
        return `[OK] ${JSON.stringify(data ?? [])}`;
      }
      case "add_task": {
        const priority = (args.priority as string) || "medium";
        const dueDate = (args.due_date as string) || null;
        const insertPayload: any = { user_id: userId, title: args.title as string, priority, status: "todo" };
        if (dueDate) insertPayload.due_date = dueDate;
        const { data: inserted, error } = await supabase.from("tasks").insert(insertPayload).select("id").single();
        if (error) return `[ERRO] Falha ao criar tarefa: ${error.message}`;
        if (!inserted?.id) return `[ERRO] Tarefa não foi salva no banco de dados`;
        const card = formatTaskConfirmation({ title: args.title as string, priority, dueDate, action: "created" });
        return `[OK]\n${card}`;
      }
      case "complete_task": {
        const task = await findTask(args.task_identifier as string, userId, supabase);
        if (!task) return `[ERRO] Tarefa não encontrada: ${args.task_identifier}`;
        await supabase.from("tasks").update({ status: "done" }).eq("id", task.id);
        const card = formatTaskConfirmation({ title: task.title, action: "completed" });
        return `[OK]\n${card}`;
      }
      case "delete_task": {
        const task = await findTask(args.task_identifier as string, userId, supabase);
        if (!task) return `[ERRO] Tarefa não encontrada: ${args.task_identifier}`;
        await supabase.from("tasks").delete().eq("id", task.id);
        const card = formatTaskConfirmation({ title: task.title, action: "deleted" });
        return `[OK]\n${card}`;
      }
      case "edit_task": {
        const task = await findTask(args.task_identifier as string, userId, supabase);
        if (!task) return `[ERRO] Tarefa não encontrada: ${args.task_identifier}`;
        const updates: any = {};
        if (args.new_title) updates.title = args.new_title;
        if (args.new_priority) updates.priority = args.new_priority;
        if (args.new_due_date) updates.due_date = args.new_due_date;
        if (Object.keys(updates).length === 0) return `[ERRO] Nenhuma alteração especificada`;
        await supabase.from("tasks").update(updates).eq("id", task.id);
        const card = formatTaskConfirmation({
          title: (args.new_title as string) || task.title,
          priority: (args.new_priority as string) || task.priority,
          dueDate: (args.new_due_date as string) || task.due_date || null,
          action: "updated",
        });
        return `[OK]\n${card}`;
      }

      // ── Subtasks ──
      case "add_subtask": {
        const task = await findTask(args.task_identifier as string, userId, supabase);
        if (!task) return `[ERRO] Tarefa não encontrada: ${args.task_identifier}`;
        const { error } = await supabase.from("task_subtasks" as any).insert({ task_id: task.id, title: args.title as string, completed: false });
        return error ? `[ERRO] ${error.message}` : `[OK] Subtarefa "${args.title}" adicionada a "${task.title}"`;
      }
      case "complete_subtask": {
        const task = await findTask(args.task_identifier as string, userId, supabase);
        if (!task) return `[ERRO] Tarefa não encontrada: ${args.task_identifier}`;
        const { data: subs } = await supabase.from("task_subtasks" as any).select("id,title,completed").eq("task_id", task.id);
        const sub = (subs as any[] ?? []).find((s: any) => s.title?.toLowerCase().includes((args.subtask_title as string).toLowerCase()));
        if (!sub) return `[ERRO] Subtarefa "${args.subtask_title}" não encontrada`;
        await supabase.from("task_subtasks" as any).update({ completed: !sub.completed }).eq("id", sub.id);
        return `[OK] Subtarefa "${sub.title}" ${sub.completed ? "reaberta" : "concluída"}`;
      }
      case "delete_subtask": {
        const task = await findTask(args.task_identifier as string, userId, supabase);
        if (!task) return `[ERRO] Tarefa não encontrada: ${args.task_identifier}`;
        const { data: subs } = await supabase.from("task_subtasks" as any).select("id,title").eq("task_id", task.id);
        const sub = (subs as any[] ?? []).find((s: any) => s.title?.toLowerCase().includes((args.subtask_title as string).toLowerCase()));
        if (!sub) return `[ERRO] Subtarefa "${args.subtask_title}" não encontrada`;
        await supabase.from("task_subtasks" as any).delete().eq("id", sub.id);
        return `[OK] Subtarefa "${sub.title}" excluída`;
      }
      case "get_subtasks": {
        const task = await findTask(args.task_identifier as string, userId, supabase);
        if (!task) return `[ERRO] Tarefa não encontrada: ${args.task_identifier}`;
        const { data } = await supabase.from("task_subtasks" as any).select("id,title,completed,sort_order").eq("task_id", task.id).order("sort_order", { ascending: true });
        return `[OK] Subtarefas de "${task.title}": ${JSON.stringify(data ?? [])}`;
      }

      // ── Notes ──
      case "get_notes": {
        const { data } = await supabase.from("user_data").select("id,data").eq("user_id", userId).eq("data_type", "note").order("updated_at", { ascending: false }).limit(15);
        const notes = (data ?? []).map((r: any) => ({ id: r.id, title: r.data?.title, preview: (r.data?.content || "").substring(0, 80), favorited: r.data?.favorited, tags: r.data?.tags }));
        return `[OK] ${JSON.stringify(notes)}`;
      }
      case "add_note": {
        const { error } = await supabase.from("user_data").insert({ user_id: userId, data_type: "note", data: { title: args.title, content: args.content, favorited: false, tags: [] } });
        return error ? `[ERRO] ${error.message}` : `[OK] Nota "${args.title}" criada`;
      }
      case "edit_note": {
        const note = await findNote(args.note_identifier as string, userId, supabase);
        if (!note) return `[ERRO] Nota não encontrada: ${args.note_identifier}`;
        const updated = { ...note.data };
        if (args.new_title) updated.title = args.new_title;
        if (args.new_content) updated.content = args.new_content;
        await supabase.from("user_data").update({ data: updated }).eq("id", note.id);
        return `[OK] Nota "${updated.title}" atualizada`;
      }
      case "delete_note": {
        const note = await findNote(args.note_identifier as string, userId, supabase);
        if (!note) return `[ERRO] Nota não encontrada: ${args.note_identifier}`;
        await supabase.from("user_data").delete().eq("id", note.id);
        return `[OK] Nota "${note.data?.title}" excluída`;
      }
      case "favorite_note": {
        const note = await findNote(args.note_identifier as string, userId, supabase);
        if (!note) return `[ERRO] Nota não encontrada: ${args.note_identifier}`;
        const updated = { ...note.data, favorited: args.favorited as boolean };
        await supabase.from("user_data").update({ data: updated }).eq("id", note.id);
        return `[OK] Nota "${note.data?.title}" ${args.favorited ? "favoritada" : "desfavoritada"}`;
      }
      case "set_note_tags": {
        const note = await findNote(args.note_identifier as string, userId, supabase);
        if (!note) return `[ERRO] Nota não encontrada: ${args.note_identifier}`;
        const updated = { ...note.data, tags: args.tags as string[] };
        await supabase.from("user_data").update({ data: updated }).eq("id", note.id);
        return `[OK] Tags da nota "${note.data?.title}" atualizadas: ${(args.tags as string[]).join(", ")}`;
      }

      // ── Calendar ──
      case "get_calendar_events": {
        // Check Google Calendar via Composio
        const hasCalendarComposio = await hasGoogleConnection(supabase, userId, "google_calendar");
        if (hasCalendarComposio) {
          try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
            const timeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const timeMax = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
            const proxyRes = await fetch(`${supabaseUrl}/functions/v1/composio-proxy`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}`, apikey: Deno.env.get("SUPABASE_ANON_KEY")!, "x-supabase-client-platform": "edge-function", "x-user-id": userId }, body: JSON.stringify({ service: "calendar", path: "/calendars/primary/events", method: "GET", params: { timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "50" }, workspace_id: workspaceId, default_workspace_id: workspaceId }) });
            if (proxyRes.ok) {
              const gData = await proxyRes.json();
              const items = gData?.items || gData || [];
              if (items.length > 0) {
                const formatted = items.map((e: any) => {
                  const start = e.start?.dateTime || e.start?.date || "";
                  const d = new Date(start);
                  return { date: `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`, time: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }), summary: e.summary || "Sem título", id: e.id };
                });
                return `[OK] ${JSON.stringify(formatted)}`;
              }
            }
          } catch (e) { console.error("[pandora-whatsapp] Google calendar fetch error:", e); }
        }
        // Fallback to local
        const { data } = await supabase.from("user_data").select("id,data").eq("user_id", userId).eq("data_type", "event").order("updated_at", { ascending: false }).limit(20);
        const events = (data ?? []).map((r: any) => ({ id: r.id, ...r.data }));
        return `[OK] ${JSON.stringify(events)}`;
      }
      case "add_calendar_event": {
        // Accept month as 1-indexed from AI, convert to 0-indexed for internal storage
        const rawMonth = args.month as number | undefined;
        const month = rawMonth != null ? rawMonth - 1 : now.getMonth();
        const year = (args.year as number) ?? now.getFullYear();
        const day = args.day as number;
        let label = (args.label as string) || "Evento";

        // Rich fields with backwards-compat extraction from "HH:MM - desc" label
        let startTime = (args.start_time as string | undefined) || null;
        let endTime = (args.end_time as string | undefined) || null;
        const durationMin = (args.duration_minutes as number | undefined) || null;
        const location = (args.location as string | undefined) || null;
        const description = (args.description as string | undefined) || null;
        const attendees = (args.attendees_emails as string[] | undefined) || null;

        if (!startTime) {
          const m = label.match(/^(\d{1,2}):(\d{2})\s*[-–]\s*/);
          if (m) {
            startTime = `${m[1].padStart(2, "0")}:${m[2]}`;
            label = label.replace(m[0], "").trim();
          }
        }

        // Compute end time
        if (!endTime && startTime) {
          const [h, mm] = startTime.split(":").map(Number);
          const totalMin = h * 60 + mm + (durationMin || 60);
          endTime = `${String(Math.floor(totalMin / 60) % 24).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
        }

        const eventData: Record<string, any> = {
          day, month, year, label,
          category: args.category || "pessoal",
        };
        if (startTime) eventData.start_time = startTime;
        if (endTime) eventData.end_time = endTime;
        if (location) eventData.location = location;
        if (description) eventData.description = description;
        if (attendees?.length) eventData.attendees = attendees;

        // Duplicate detection: same title+date in last 24h
        const { data: existingDups } = await supabase
          .from("user_data")
          .select("id,data")
          .eq("user_id", userId)
          .eq("data_type", "event")
          .gte("created_at", new Date(Date.now() - 86400000).toISOString())
          .limit(20);
        const dup = (existingDups ?? []).find((r: any) =>
          r.data?.day === day &&
          r.data?.month === month &&
          r.data?.year === year &&
          (r.data?.label || "").toLowerCase().trim() === label.toLowerCase().trim()
        );
        if (dup) return `[ERRO] Evento "${label}" já existe nessa data. Use edit_calendar_event se quer ajustar.`;

        const { data: inserted, error } = await supabase.from("user_data").insert({ user_id: userId, data_type: "event", data: eventData }).select("id").single();
        if (error) return `[ERRO] Falha ao salvar evento: ${error.message}`;
        if (!inserted?.id) return `[ERRO] Evento não foi salvo no banco de dados`;

        // Sync to Google Calendar (rich payload)
        let googleOk = false;
        const hasCalComposio2 = await hasGoogleConnection(supabase, userId, "google_calendar");
        if (hasCalComposio2) {
          try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
            const [sh, sm] = (startTime || "09:00").split(":").map(Number);
            const [eh, em] = (endTime || `${String(sh + 1).padStart(2, "0")}:${String(sm).padStart(2, "0")}`).split(":").map(Number);
            const startAt = new Date(year, month, day, sh, sm).toISOString();
            const endAt = new Date(year, month, day, eh, em).toISOString();
            const gcalBody: Record<string, any> = {
              summary: label,
              start: { dateTime: startAt, timeZone: "America/Sao_Paulo" },
              end: { dateTime: endAt, timeZone: "America/Sao_Paulo" },
            };
            if (location) gcalBody.location = location;
            if (description) gcalBody.description = description;
            if (attendees?.length) gcalBody.attendees = attendees.map((email) => ({ email }));

            const proxyRes = await fetch(`${supabaseUrl}/functions/v1/composio-proxy`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}`, apikey: Deno.env.get("SUPABASE_ANON_KEY")!, "x-supabase-client-platform": "edge-function", "x-user-id": userId },
              body: JSON.stringify({ service: "calendar", path: "/calendars/primary/events", method: "POST", body: gcalBody, workspace_id: workspaceId, default_workspace_id: workspaceId }),
            });
            googleOk = proxyRes.ok;
            if (!proxyRes.ok) { const errText = await proxyRes.text(); console.error("[pandora-whatsapp] Google Calendar create error:", errText); }
          } catch (e) { console.error("[pandora-whatsapp] Google Calendar create exception:", e); }
        }

        const card = formatEventConfirmation({
          title: label, day, month, year,
          startTime, endTime, location, description,
          attendees: attendees || null,
          googleSynced: googleOk,
          action: "created",
        });
        return `[OK]\n${card}`;
      }
      case "edit_calendar_event": {
        // Try local first
        const event = await findEvent(args.event_identifier as string, userId, supabase);
        if (event) {
          const updated = { ...event.data };
          if (args.new_label) updated.label = args.new_label;
          if (args.new_day) updated.day = args.new_day;
          if (args.new_month !== undefined) updated.month = (args.new_month as number) - 1;
          if (args.new_year) updated.year = args.new_year;
          if (args.new_category) updated.category = args.new_category;
          if (args.new_start_time) updated.start_time = args.new_start_time;
          if (args.new_end_time) updated.end_time = args.new_end_time;
          if (args.new_location !== undefined) updated.location = args.new_location;
          if (args.new_description !== undefined) updated.description = args.new_description;
          await supabase.from("user_data").update({ data: updated }).eq("id", event.id);
          const card = formatEventConfirmation({
            title: updated.label, day: updated.day, month: updated.month, year: updated.year,
            startTime: updated.start_time || null, endTime: updated.end_time || null,
            location: updated.location || null, description: updated.description || null,
            attendees: updated.attendees || null, googleSynced: false, action: "updated",
          });
          return `[OK]\n${card}`;
        }
        const hasCalComposio3 = await hasGoogleConnection(supabase, userId, "google_calendar");
        if (hasCalComposio3) {
          try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
            const timeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const timeMax = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();
            const listRes = await fetch(`${supabaseUrl}/functions/v1/composio-proxy`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}`, apikey: Deno.env.get("SUPABASE_ANON_KEY")!, "x-supabase-client-platform": "edge-function", "x-user-id": userId }, body: JSON.stringify({ service: "calendar", path: "/calendars/primary/events", method: "GET", params: { timeMin, timeMax, singleEvents: "true", maxResults: "50" }, workspace_id: workspaceId, default_workspace_id: workspaceId }) });
            if (listRes.ok) {
              const gData = await listRes.json();
              const items = gData?.items || gData || [];
              const identifier = (args.event_identifier as string).toLowerCase();
              const match = items.find((e: any) => (e.summary || "").toLowerCase().includes(identifier) || e.id === args.event_identifier);
              if (match) {
                const patchBody: any = {};
                if (args.new_label) patchBody.summary = args.new_label;
                const patchRes = await fetch(`${supabaseUrl}/functions/v1/composio-proxy`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}`, apikey: Deno.env.get("SUPABASE_ANON_KEY")!, "x-supabase-client-platform": "edge-function", "x-user-id": userId }, body: JSON.stringify({ service: "calendar", path: `/calendars/primary/events/${match.id}`, method: "PATCH", body: patchBody, workspace_id: workspaceId, default_workspace_id: workspaceId }) });
                if (patchRes.ok) return `[OK] Evento "${match.summary}" atualizado no Google Calendar`;
              }
            }
          } catch (e) { console.error("[pandora-whatsapp] Google Calendar edit error:", e); }
        }
        return `[ERRO] Evento não encontrado: ${args.event_identifier}`;
      }
      case "delete_calendar_event": {
        // Try local first
        const event = await findEvent(args.event_identifier as string, userId, supabase);
        if (event) {
          await supabase.from("user_data").delete().eq("id", event.id);
          return `[OK] Evento "${event.data?.label}" excluído`;
        }
        const hasCalComposio4 = await hasGoogleConnection(supabase, userId, "google_calendar");
        if (hasCalComposio4) {
          try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
            const timeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const timeMax = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();
            const listRes = await fetch(`${supabaseUrl}/functions/v1/composio-proxy`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}`, apikey: Deno.env.get("SUPABASE_ANON_KEY")!, "x-supabase-client-platform": "edge-function", "x-user-id": userId }, body: JSON.stringify({ service: "calendar", path: "/calendars/primary/events", method: "GET", params: { timeMin, timeMax, singleEvents: "true", maxResults: "50" }, workspace_id: workspaceId, default_workspace_id: workspaceId }) });
            if (listRes.ok) {
              const gData = await listRes.json();
              const items = gData?.items || gData || [];
              const identifier = (args.event_identifier as string).toLowerCase();
              const match = items.find((e: any) => (e.summary || "").toLowerCase().includes(identifier) || e.id === args.event_identifier);
              if (match) {
                const delRes = await fetch(`${supabaseUrl}/functions/v1/composio-proxy`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}`, apikey: Deno.env.get("SUPABASE_ANON_KEY")!, "x-supabase-client-platform": "edge-function", "x-user-id": userId }, body: JSON.stringify({ service: "calendar", path: `/calendars/primary/events/${match.id}`, method: "DELETE", workspace_id: workspaceId, default_workspace_id: workspaceId }) });
                if (delRes.ok) return `[OK] Evento "${match.summary}" excluído do Google Calendar`;
              }
            }
          } catch (e) { console.error("[pandora-whatsapp] Google Calendar delete error:", e); }
        }
        return `[ERRO] Evento não encontrado: ${args.event_identifier}`;
      }

      // ── Contacts (FULL CRUD) ──
      case "add_contact": {
        const { data: inserted, error } = await supabase.from("contacts").insert({ user_id: userId, name: args.name as string, email: (args.email as string) || null, phone: (args.phone as string) || null, company: (args.company as string) || null, role: (args.role as string) || null }).select("id").single();
        if (error) return `[ERRO] Falha ao criar contato: ${error.message}`;
        if (!inserted?.id) return `[ERRO] Contato não foi salvo no banco de dados`;
        return `[OK] Contato "${args.name}" criado (ID: ${inserted.id})`;
      }
      case "edit_contact": {
        const contact = await resolveContact(args.contact_identifier as string, userId, supabase);
        if (!contact) return `[ERRO] Contato não encontrado: ${args.contact_identifier}`;
        const updates: any = {};
        if (args.new_name) updates.name = args.new_name;
        if (args.new_email) updates.email = args.new_email;
        if (args.new_phone) updates.phone = args.new_phone;
        if (args.new_company) updates.company = args.new_company;
        if (args.new_role) updates.role = args.new_role;
        if (Object.keys(updates).length === 0) return `[ERRO] Nenhuma alteração especificada`;
        await supabase.from("contacts").update(updates).eq("id", contact.id);
        return `[OK] Contato "${contact.name}" atualizado`;
      }
      case "delete_contact": {
        const contact = await resolveContact(args.contact_identifier as string, userId, supabase);
        if (!contact) return `[ERRO] Contato não encontrado: ${args.contact_identifier}`;
        await supabase.from("contacts").delete().eq("id", contact.id);
        return `[OK] Contato "${contact.name}" excluído`;
      }
      case "get_contacts": {
        const { data } = await supabase.from("contacts").select("id,name,email,phone,company,role,tags").eq("user_id", userId).order("name", { ascending: true }).limit(50);
        return `[OK] ${JSON.stringify(data ?? [])}`;
      }
      case "search_contacts": {
        const query = (args.query as string) || "";
        const { data } = await supabase.from("contacts").select("id,name,phone,email,company,tags").eq("user_id", userId).or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%,company.ilike.%${query}%`).limit(10);
        return `[OK] ${JSON.stringify(data ?? [])}`;
      }
      case "get_contact_details": {
        const contact = await resolveContact(args.contact_identifier as string, userId, supabase);
        if (!contact) return `[ERRO] Contato não encontrado: ${args.contact_identifier}`;
        return `[OK] ${JSON.stringify(contact)}`;
      }
      case "smart_find_contact": {
        const query = (args.query as string) || "";
        const { data } = await supabase.from("contacts").select("id,name,email,emails,phone,phones,company,tags").eq("user_id", userId).or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%,company.ilike.%${query}%`).limit(10);
        const results = (data ?? []).map((c: any) => {
          let email = c.email;
          if (!email && Array.isArray(c.emails) && c.emails.length) email = c.emails[0]?.email || c.emails[0]?.value;
          let phone = c.phone;
          if (!phone && Array.isArray(c.phones) && c.phones.length) phone = c.phones[0]?.number || c.phones[0]?.value;
          return { id: c.id, name: c.name, email, phone, company: c.company, tags: c.tags, has_whatsapp: !!phone };
        });
        return `[OK] ${JSON.stringify(results)}`;
      }
      case "add_contact_note": {
        const contact = await resolveContact(args.contact_identifier as string, userId, supabase);
        if (!contact) return `[ERRO] Contato não encontrado: ${args.contact_identifier}`;
        const { error } = await supabase.from("contact_interactions").insert({ user_id: userId, contact_id: contact.id, title: (args.note as string).substring(0, 100), type: "note", description: args.note as string });
        return error ? `[ERRO] ${error.message}` : `[OK] Nota adicionada ao contato "${contact.name}"`;
      }
      case "update_contact_tags": {
        const contact = await resolveContact(args.contact_identifier as string, userId, supabase);
        if (!contact) return `[ERRO] Contato não encontrado: ${args.contact_identifier}`;
        const newTags = args.tags as string[];
        const mode = (args.mode as string) || "replace";
        let finalTags = newTags;
        if (mode === "add") finalTags = [...new Set([...(contact.tags || []), ...newTags])];
        else if (mode === "remove") finalTags = (contact.tags || []).filter((t: string) => !newTags.includes(t));
        await supabase.from("contacts").update({ tags: finalTags }).eq("id", contact.id);
        return `[OK] Tags do contato "${contact.name}" atualizadas: ${finalTags.join(", ")}`;
      }
      case "add_interaction": {
        const contact = await resolveContact(args.contact_identifier as string, userId, supabase);
        if (!contact) return `[ERRO] Contato não encontrado: ${args.contact_identifier}`;
        const { error } = await supabase.from("contact_interactions").insert({ user_id: userId, contact_id: contact.id, title: args.title as string, type: args.type as string, description: (args.description as string) || "" });
        return error ? `[ERRO] ${error.message}` : `[OK] Interação "${args.title}" registrada para "${contact.name}"`;
      }
      case "get_interactions": {
        const contact = await resolveContact(args.contact_identifier as string, userId, supabase);
        if (!contact) return `[ERRO] Contato não encontrado: ${args.contact_identifier}`;
        const limit = (args.limit as number) || 10;
        const { data } = await supabase.from("contact_interactions").select("id,title,type,description,interaction_date").eq("contact_id", contact.id).order("interaction_date", { ascending: false }).limit(limit);
        return `[OK] Interações com "${contact.name}": ${JSON.stringify(data ?? [])}`;
      }

      // ── Finances ──
      case "get_finance_summary": {
        const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        const { data: txs } = await supabase.from("finance_transactions").select("amount,type").eq("user_id", userId).gte("date", startOfMonth);
        let income = 0, expense = 0;
        (txs ?? []).forEach((t: any) => { if (t.type === "income") income += Number(t.amount); else expense += Number(t.amount); });
        return `[OK] Receitas: R$${income.toFixed(2)}, Despesas: R$${expense.toFixed(2)}, Saldo: R$${(income - expense).toFixed(2)}`;
      }
      case "add_finance_transaction": {
        const type = args.type as string;
        const amount = args.amount as number;
        const desc = args.description as string;
        const cat = (args.category as string) || "Outros";
        const { error } = await supabase.from("finance_transactions").insert({ user_id: userId, description: desc, amount, type, category: cat });
        if (error) return `[ERRO] ${error.message}`;
        const icon = type === "income" ? "💰" : "💸";
        const verb = type === "income" ? "recebida" : "registrada";
        const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
        return `[OK]\n${icon} *${desc}* ${verb}\n${formatted} · ${cat}`;
      }
      case "get_finance_goals": {
        const { data } = await supabase.from("finance_goals").select("id,name,target,current,color").eq("user_id", userId);
        return `[OK] ${JSON.stringify(data ?? [])}`;
      }
      case "add_finance_goal": {
        const { error } = await supabase.from("finance_goals").insert({ user_id: userId, name: args.name as string, target: args.target as number, current: (args.current as number) || 0 });
        return error ? `[ERRO] ${error.message}` : `[OK] Meta "${args.name}" criada (alvo: R$${args.target})`;
      }
      case "update_finance_goal": {
        const { data: goals } = await supabase.from("finance_goals").select("id,name").eq("user_id", userId);
        const goal = (goals ?? []).find((g: any) => g.id === args.goal_identifier || g.name?.toLowerCase().includes((args.goal_identifier as string).toLowerCase()));
        if (!goal) return `[ERRO] Meta não encontrada: ${args.goal_identifier}`;
        await supabase.from("finance_goals").update({ current: args.new_current as number }).eq("id", goal.id);
        return `[OK] Meta "${goal.name}" atualizada para R$${args.new_current}`;
      }
      case "add_finance_recurring": {
        const { error } = await supabase.from("finance_recurring").insert({ user_id: userId, description: args.description as string, amount: args.amount as number, type: args.type as string, category: (args.category as string) || "Outros", day_of_month: (args.day_of_month as number) || 1 });
        return error ? `[ERRO] ${error.message}` : `[OK] Recorrência "${args.description}" criada`;
      }
      case "delete_finance_recurring": {
        const { data: recs } = await supabase.from("finance_recurring").select("id,description").eq("user_id", userId);
        const rec = (recs ?? []).find((r: any) => r.id === args.recurring_identifier || r.description?.toLowerCase().includes((args.recurring_identifier as string).toLowerCase()));
        if (!rec) return `[ERRO] Recorrência não encontrada: ${args.recurring_identifier}`;
        await supabase.from("finance_recurring").delete().eq("id", rec.id);
        return `[OK] Recorrência "${rec.description}" excluída`;
      }
      case "toggle_finance_recurring": {
        const { data: recs } = await supabase.from("finance_recurring").select("id,description").eq("user_id", userId);
        const rec = (recs ?? []).find((r: any) => r.id === args.recurring_identifier || r.description?.toLowerCase().includes((args.recurring_identifier as string).toLowerCase()));
        if (!rec) return `[ERRO] Recorrência não encontrada: ${args.recurring_identifier}`;
        await supabase.from("finance_recurring").update({ active: args.active as boolean }).eq("id", rec.id);
        return `[OK] Recorrência "${rec.description}" ${args.active ? "ativada" : "desativada"}`;
      }
      case "get_finance_recurring": {
        const { data } = await supabase.from("finance_recurring").select("id,description,amount,type,category,active,day_of_month").eq("user_id", userId);
        return `[OK] ${JSON.stringify(data ?? [])}`;
      }
      case "get_recent_transactions": {
        const limit = (args.limit as number) || 15;
        let q = supabase.from("finance_transactions").select("id,description,amount,type,category,date").eq("user_id", userId).order("date", { ascending: false }).limit(limit);
        if (args.type_filter && args.type_filter !== "all") q = q.eq("type", args.type_filter as string);
        const { data } = await q;
        return `[OK] ${JSON.stringify(data ?? [])}`;
      }
      case "add_budget": {
        const { error } = await supabase.from("finance_budgets").insert({ user_id: userId, category: args.category as string, monthly_limit: args.monthly_limit as number });
        return error ? `[ERRO] ${error.message}` : `[OK] Orçamento "${args.category}" criado (limite: R$${args.monthly_limit})`;
      }
      case "get_budgets": {
        const { data: budgets } = await supabase.from("finance_budgets").select("id,category,monthly_limit").eq("user_id", userId);
        // Calculate spent per category this month
        const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        const { data: txs } = await supabase.from("finance_transactions").select("category,amount").eq("user_id", userId).eq("type", "expense").gte("date", startOfMonth);
        const spentByCategory: Record<string, number> = {};
        (txs ?? []).forEach((t: any) => { spentByCategory[t.category] = (spentByCategory[t.category] || 0) + Number(t.amount); });
        const result = (budgets ?? []).map((b: any) => ({ ...b, spent: spentByCategory[b.category] || 0, remaining: b.monthly_limit - (spentByCategory[b.category] || 0) }));
        return `[OK] ${JSON.stringify(result)}`;
      }

      // ── Habits (FIXED: unified completedToday + streak + completedDates) ──
      case "get_habits": {
        const { data } = await supabase.from("user_data").select("id,data").eq("user_id", userId).eq("data_type", "habits").limit(1).maybeSingle();
        const habits = Array.isArray(data?.data) ? data.data : (data?.data?.habits || []);
        const result = habits.map((h: any) => {
          const completedDates = h.completedDates || [];
          const completedToday = completedDates.includes(today);
          return { id: h.id, name: h.name, category: h.category, completedToday, streak: h.streak || 0, completedDates: completedDates.slice(-7) };
        });
        return `[OK] ${JSON.stringify(result)}`;
      }
      case "complete_habit": {
        const { data: habitsRow } = await supabase.from("user_data").select("id,data").eq("user_id", userId).eq("data_type", "habits").limit(1).maybeSingle();
        if (!habitsRow) return "[ERRO] Nenhum hábito encontrado";
        const habits = Array.isArray(habitsRow.data) ? habitsRow.data : (habitsRow.data?.habits || []);
        const target = args.habit_identifier as string;
        const idx = habits.findIndex((h: any) => h.name?.toLowerCase().includes(target.toLowerCase()) || h.id === target);
        if (idx === -1) return `[ERRO] Hábito "${target}" não encontrado`;
        // Update completedDates
        if (!habits[idx].completedDates) habits[idx].completedDates = [];
        if (!habits[idx].completedDates.includes(today)) habits[idx].completedDates.push(today);
        // Update completedToday (frontend compatibility)
        habits[idx].completedToday = true;
        // Calculate and update streak
        let streak = 1;
        const dates = [...habits[idx].completedDates].sort().reverse();
        for (let i = 1; i < dates.length; i++) {
          const prev = new Date(dates[i - 1]);
          const curr = new Date(dates[i]);
          const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000);
          if (diffDays === 1) streak++;
          else break;
        }
        habits[idx].streak = streak;
        // Save — handle both array and object format
        const saveData = Array.isArray(habitsRow.data) ? habits : { ...habitsRow.data, habits };
        await supabase.from("user_data").update({ data: saveData }).eq("id", habitsRow.id);
        return `[OK] Hábito "${habits[idx].name}" completado hoje (streak: ${streak} dias)`;
      }
      case "add_habit": {
        const { data: habitsRow } = await supabase.from("user_data").select("id,data").eq("user_id", userId).eq("data_type", "habits").limit(1).maybeSingle();
        const habits = habitsRow ? (Array.isArray(habitsRow.data) ? habitsRow.data : (habitsRow.data?.habits || [])) : [];
        const newHabit = { id: crypto.randomUUID(), name: args.name as string, category: (args.category as string) || "Outro", completedDates: [], completedToday: false, streak: 0, createdAt: now.toISOString() };
        habits.push(newHabit);
        if (habitsRow) {
          const saveData = Array.isArray(habitsRow.data) ? habits : { ...habitsRow.data, habits };
          await supabase.from("user_data").update({ data: saveData }).eq("id", habitsRow.id);
        } else {
          await supabase.from("user_data").insert({ user_id: userId, data_type: "habits", data: habits });
        }
        return `[OK] Hábito "${args.name}" criado`;
      }
      case "delete_habit": {
        const { data: habitsRow } = await supabase.from("user_data").select("id,data").eq("user_id", userId).eq("data_type", "habits").limit(1).maybeSingle();
        if (!habitsRow) return "[ERRO] Nenhum hábito encontrado";
        const habits = Array.isArray(habitsRow.data) ? habitsRow.data : (habitsRow.data?.habits || []);
        const target = (args.habit_identifier as string).toLowerCase();
        const idx = habits.findIndex((h: any) => h.name?.toLowerCase().includes(target) || h.id === target);
        if (idx === -1) return `[ERRO] Hábito "${args.habit_identifier}" não encontrado`;
        const removed = habits.splice(idx, 1);
        const saveData = Array.isArray(habitsRow.data) ? habits : { ...habitsRow.data, habits };
        await supabase.from("user_data").update({ data: saveData }).eq("id", habitsRow.id);
        return `[OK] Hábito "${removed[0].name}" excluído`;
      }

      // ── Memory ──
      case "save_memory": {
        const { error } = await supabase.from("ai_memories").insert({ user_id: userId, content: args.content as string, category: (args.category as string) || "general", importance: (args.importance as string) || "normal" });
        return error ? `[ERRO] ${error.message}` : `[OK] Memória salva`;
      }
      case "get_memories": {
        let q = supabase.from("ai_memories").select("id,content,category,importance").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
        if (args.category) q = q.eq("category", args.category as string);
        const { data } = await q;
        return `[OK] ${JSON.stringify(data ?? [])}`;
      }
      case "delete_memory": {
        const identifier = args.memory_identifier as string;
        const { data: mems } = await supabase.from("ai_memories").select("id,content").eq("user_id", userId).limit(50);
        const mem = (mems ?? []).find((m: any) => m.id === identifier || m.content?.toLowerCase().includes(identifier.toLowerCase()));
        if (!mem) return `[ERRO] Memória não encontrada: ${identifier}`;
        await supabase.from("ai_memories").delete().eq("id", mem.id);
        return `[OK] Memória excluída`;
      }

      // ── WhatsApp ──
      case "send_whatsapp": {
        let phone = (args.phone_number as string) || "";
        const contactName = args.contact_name as string;
        const message = args.message as string;
        if (!phone && contactName) {
          const contact = await resolveContact(contactName, userId, supabase);
          if (contact) phone = contact.phone || "";
          if (!phone) return `[ERRO] Contato "${contactName}" não encontrado ou sem telefone`;
        }
        phone = normalizeBrazilianNumber(phone);
        if (!phone || phone.replace(/\D/g, "").length < 10) return "[ERRO] Número de telefone inválido ou muito curto";
        // Dedup check
        const { data: recentDup } = await supabase.from("whatsapp_messages").select("id").eq("direction", "outbound").eq("content_text", message).contains("content_raw", { pandora_auto_reply: true }).gte("sent_at", new Date(Date.now() - 60000).toISOString()).limit(1).maybeSingle();
        if (recentDup) return `[OK] Mensagem já enviada anteriormente para ${phone}`;
        const waApiKey = Deno.env.get("WHATSAPP_WEB_GATEWAY_SECRET") ?? "";
        const waInstance = userInstanceName(userId, workspaceId);

        // Try sending with number variants (with/without 9th digit for BR numbers)
        const variants = getNumberVariants(phone);
        let lastError = "";
        for (const variant of variants) {
          const jid = variant.includes("@") ? variant : `${variant}@s.whatsapp.net`;
          const res = await fetchWithRetry(`${EVOLUTION_API_URL}/message/sendText/${waInstance}`, { method: "POST", headers: { "Content-Type": "application/json", apikey: waApiKey }, body: JSON.stringify({ number: jid, text: message }) });
          if (res.ok) return `[OK] Mensagem WhatsApp enviada para ${contactName || variant}`;
          lastError = await res.text();
          const lower = lastError.toLowerCase();
          if (lower.includes("not registered") || lower.includes("invalid") || lower.includes("not on whatsapp")) {
            console.warn(`[pandora-whatsapp] Number ${variant} failed, trying next variant...`);
            continue;
          }
          // Non-number error, don't retry variants
          return `[ERRO] Falha ao enviar WhatsApp: ${lastError.substring(0, 150)}`;
        }
        return `[ERRO] Número não registrado no WhatsApp. Tentei: ${variants.join(", ")}. Verifique o número do contato.`;
      }
      case "get_whatsapp_conversations": {
        const { data } = await supabase.from("whatsapp_conversations").select("id,contact_name,contact_phone,last_message_at,unread_count").eq("user_id", userId).order("last_message_at", { ascending: false }).limit(15);
        return `[OK] ${JSON.stringify(data ?? [])}`;
      }
      case "get_whatsapp_chat_history": {
        const contactName = args.contact_name as string;
        const limit = (args.limit as number) || 15;
        const { data: convs } = await supabase.from("whatsapp_conversations").select("id,contact_name").eq("user_id", userId).ilike("contact_name", `%${contactName}%`).limit(1);
        if (!convs?.length) return `[ERRO] Conversa com "${contactName}" não encontrada`;
        const { data: msgs } = await supabase.from("whatsapp_messages").select("direction,content_text,sent_at,type").eq("conversation_id", convs[0].id).order("sent_at", { ascending: false }).limit(limit);
        return `[OK] Histórico com ${convs[0].contact_name}: ${JSON.stringify((msgs ?? []).reverse())}`;
      }

      // ── Email (CRITICAL - separate channel) ──
      case "send_email": {
        const hasGmailComposio = await hasGoogleConnection(supabase, userId, "gmail");
        if (!hasGmailComposio) return "[ERRO] Conexão Gmail não encontrada. Conecte sua conta Google no DESH.";
        let toEmail = args.to as string;
        if (!toEmail && args.contact_name) {
          const contact = await resolveContact(args.contact_name as string, userId, supabase);
          if (contact) toEmail = contact.email || "";
          if (!toEmail) return `[ERRO] Contato "${args.contact_name}" não tem email cadastrado`;
        }
        if (!toEmail) return "[ERRO] Destinatário de email não especificado";
        const subject = args.subject as string;
        const body = args.body as string;
        // Robust email encoding using TextEncoder for proper UTF-8 handling
        const subjectB64 = base64Encode(new TextEncoder().encode(subject));
        const rawEmail = [`To: ${toEmail}`, `Subject: =?UTF-8?B?${subjectB64}?=`, `Content-Type: text/plain; charset=UTF-8`, `Content-Transfer-Encoding: base64`, ``, base64Encode(new TextEncoder().encode(body))].join("\r\n");
        const encodedMessage = base64Encode(new TextEncoder().encode(rawEmail)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const proxyRes = await fetch(`${supabaseUrl}/functions/v1/composio-proxy`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}`, apikey: Deno.env.get("SUPABASE_ANON_KEY")!, "x-supabase-client-platform": "edge-function", "x-user-id": userId }, body: JSON.stringify({ service: "gmail", path: "/gmail/v1/users/me/messages/send", method: "POST", body: { raw: encodedMessage }, workspace_id: workspaceId, default_workspace_id: workspaceId }) });
        if (!proxyRes.ok) { const errText = await proxyRes.text(); console.error("[pandora-whatsapp] send_email error:", errText); return `[ERRO] Falha ao enviar email: ${errText.substring(0, 100)}`; }
        if (args.contact_name) {
          const contact = await resolveContact(args.contact_name as string, userId, supabase);
          if (contact) { try { await supabase.from("contact_interactions").insert({ user_id: userId, contact_id: contact.id, title: `Email: ${subject}`, type: "email", description: `Para: ${toEmail}\nAssunto: ${subject}` }); } catch {} }
        }
        return `[OK]\n📧 *Email enviado*\n📬 Para: ${toEmail}\n📝 Assunto: ${subject}`;
      }
      case "get_emails": {
        const limit = (args.limit as number) || 10;
        const { data } = await supabase.from("gmail_messages_cache").select("gmail_id,subject,from_name,from_email,date,is_unread,is_starred,snippet").eq("user_id", userId).order("date", { ascending: false }).limit(limit);
        return `[OK] ${JSON.stringify(data ?? [])}`;
      }
      case "search_emails": {
        const query = (args.query as string) || "";
        const { data } = await supabase.from("gmail_messages_cache").select("gmail_id,subject,from_name,from_email,date,is_unread,snippet").eq("user_id", userId).or(`subject.ilike.%${query}%,from_name.ilike.%${query}%,from_email.ilike.%${query}%`).order("date", { ascending: false }).limit(10);
        return `[OK] ${JSON.stringify(data ?? [])}`;
      }
      case "get_email_stats": {
        const { count: total } = await supabase.from("gmail_messages_cache").select("id", { count: "exact", head: true }).eq("user_id", userId);
        const { count: unread } = await supabase.from("gmail_messages_cache").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_unread", true);
        const { count: starred } = await supabase.from("gmail_messages_cache").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_starred", true);
        return `[OK] Total: ${total ?? 0}, Não lidos: ${unread ?? 0}, Estrelados: ${starred ?? 0}`;
      }

      // ── Web Search ──
      case "web_search": {
        const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
        if (!perplexityKey) return "[ERRO] Busca web não configurada";
        const searchRes = await fetch("https://api.perplexity.ai/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${perplexityKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: args.query as string }], max_tokens: 500 }) });
        if (!searchRes.ok) return "[ERRO] Falha na busca web";
        const searchData = await searchRes.json();
        return `[OK] ${searchData.choices?.[0]?.message?.content || "Sem resultados"}`;
      }

      // No-op tools (chat-only metadata, safe to ignore on WhatsApp)
      case "suggest_replies":
      case "show_typing":
      case "open_modal":
        return `[OK]`;
      default:
        console.warn(`[pandora-whatsapp] Tool not implemented: ${name}`);
        return `[ERRO] Ferramenta não implementada: ${name}`;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[pandora-whatsapp] executeTool(${name}) crash:`, msg, e instanceof Error ? e.stack : undefined);
    return `[ERRO_INTERNO] ${name}: ${msg.substring(0, 180)}`;
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, conversationId, messageText, contactPhone, messageType, messageKeyId, workspaceId } = await req.json();
    if (!userId || !messageText) {
      return new Response(JSON.stringify({ error: "Missing userId or messageText" }), { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── DEFENSE IN DEPTH: Second authorization check ──
    if (contactPhone) {
      const authCheck = await shouldProcessMessage(supabase, userId, contactPhone, false, {
        messagePreview: messageText?.slice(0, 100),
        skipAuditLog: true, // webhook-handler already logged
        workspaceId: workspaceId || undefined,
      });
      if (!authCheck.allowed) {
        console.log(`[pandora-whatsapp] BLOCKED by auth-guard: ${authCheck.reason}`);
        if (conversationId) {
          try { await supabase.from("pandora_processing_locks").delete().eq("conversation_id", conversationId); } catch {}
        }
        return new Response(
          JSON.stringify({ error: "unauthorized", reason: authCheck.reason }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ── LAYER 4: Dedup by messageKeyId (precise match) ──
    if (messageKeyId) {
      const { data: alreadyProcessed } = await supabase.from("whatsapp_messages").select("id").eq("conversation_id", conversationId).eq("direction", "outbound").contains("content_raw", { pandora_auto_reply: true, reply_to_key: messageKeyId }).limit(1).maybeSingle();
      if (alreadyProcessed) {
        if (conversationId) { try { await supabase.from("pandora_processing_locks").delete().eq("conversation_id", conversationId); } catch {} }
        return new Response(JSON.stringify({ ok: true, skipped: "already_processed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const startTime = Date.now();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const apiKey = Deno.env.get("WHATSAPP_WEB_GATEWAY_SECRET") ?? "";

    // ── AI settings will be fetched AFTER workspace resolution (see below) ──

    // ═══════════════════════════════════════════════════════
    // WORKSPACE RESOLUTION (Rule 1 + Rule 2) — parallelized
    // ═══════════════════════════════════════════════════════

    // 1. Fetch user workspaces + session in parallel (independent reads)
    //    Session uses fallback workspace until allWorkspaces resolves; we'll re-resolve below.
    let activeWorkspaceId = workspaceId || null;
    const initialWorkspaceForSession = activeWorkspaceId; // may be null; that's fine

    const [allWorkspaces, sessionPreliminary] = await Promise.all([
      getUserWorkspaces(supabase, userId),
      getOrCreateSession(supabase, userId, initialWorkspaceForSession, "whatsapp"),
    ]);

    // 2. Resolve activeWorkspaceId: webhook → session → primary (is_default) → first
    if (!activeWorkspaceId && sessionPreliminary.context_snapshot?.whatsapp_workspace_id) {
      activeWorkspaceId = sessionPreliminary.context_snapshot.whatsapp_workspace_id;
    }
    if (!activeWorkspaceId) {
      activeWorkspaceId = allWorkspaces.find(w => w.is_default)?.id || allWorkspaces[0]?.id || null;
    }
    const session = sessionPreliminary;

    const activeWorkspace = allWorkspaces.find(w => w.id === activeWorkspaceId) || allWorkspaces[0] || null;
    const instanceName = userInstanceName(userId, activeWorkspaceId || undefined);

    // ═══════════════════════════════════════════════════════
    // COMMAND PARSING (before AI processing)
    // ═══════════════════════════════════════════════════════

    const parsed = parseWhatsAppCommand(messageText);

    if (parsed.isCommand) {
      let cmdResponse = "";

      switch (parsed.command) {
        case "ws":
        case "workspace":
        case "workspaces": {
          if (!parsed.args) {
            // List workspaces
            const list = allWorkspaces.map((w, i) =>
              `${i + 1}. ${w.icon} ${w.name}${w.id === activeWorkspaceId ? " ← ativo" : ""}`
            ).join("\n");
            cmdResponse = `🏢 *Seus workspaces:*\n${list}\n\nEnvie */ws [número]* para trocar.`;
          } else {
            // Switch workspace
            const target = parseInt(parsed.args);
            let newWs: typeof allWorkspaces[0] | undefined;

            if (target && target > 0 && target <= allWorkspaces.length) {
              newWs = allWorkspaces[target - 1];
            } else {
              newWs = allWorkspaces.find(w =>
                w.name.toLowerCase().includes(parsed.args!.toLowerCase())
              );
            }

            if (newWs) {
              // Persist in session
              const updatedSnapshot = { ...(session.context_snapshot || {}), whatsapp_workspace_id: newWs.id };
              await supabase.from("pandora_sessions").update({ context_snapshot: updatedSnapshot }).eq("id", session.id);
              cmdResponse = `✅ Workspace alterado para ${newWs.icon} *${newWs.name}*`;
            } else {
              cmdResponse = `❌ Workspace não encontrado. Envie */ws* para ver a lista.`;
            }
          }
          break;
        }

        case "agente":
        case "agent": {
          if (!activeWorkspaceId) {
            cmdResponse = "❌ Nenhum workspace ativo. Use */ws* primeiro.";
            break;
          }
          const agents = await getWorkspaceAgents(supabase, activeWorkspaceId);
          const activeAgentId = session.context_snapshot?.active_agent_id;

          if (!parsed.args) {
            if (agents.length === 0) {
              cmdResponse = `🤖 Nenhum agente configurado em ${activeWorkspace?.icon} ${activeWorkspace?.name}.`;
            } else {
              const agentList = agents.map((a, i) =>
                `${i + 1}. ${a.icon || "🤖"} ${a.name}${a.id === activeAgentId ? " ← ativo" : ""}`
              ).join("\n");
              cmdResponse = `🤖 *Agentes de ${activeWorkspace?.icon} ${activeWorkspace?.name}:*\n${agentList}\n\nEnvie */agente [número]* para trocar.`;
            }
          } else {
            const idx = parseInt(parsed.args);
            let targetAgent: typeof agents[0] | undefined;
            if (idx && idx > 0 && idx <= agents.length) {
              targetAgent = agents[idx - 1];
            } else {
              targetAgent = agents.find(a => a.name.toLowerCase().includes(parsed.args!.toLowerCase()));
            }

            if (targetAgent) {
              const updatedSnapshot = { ...(session.context_snapshot || {}), active_agent_id: targetAgent.id };
              await supabase.from("pandora_sessions").update({ context_snapshot: updatedSnapshot }).eq("id", session.id);
              cmdResponse = `✅ Agente alterado para ${targetAgent.icon || "🤖"} *${targetAgent.name}*`;
            } else {
              cmdResponse = `❌ Agente não encontrado. Envie */agente* para ver a lista.`;
            }
          }
          break;
        }

        case "help":
        case "ajuda":
          cmdResponse =
            `📖 *Comandos disponíveis:*\n` +
            `*/ws* — Ver/trocar workspace\n` +
            `*/agente* — Ver/trocar agente\n` +
            `*@workspace mensagem* — Enviar para workspace específico\n` +
            `*/help* — Esta ajuda`;
          break;

        default:
          cmdResponse = `❌ Comando desconhecido: /${parsed.command}. Envie */help* para ver os comandos.`;
      }

      // Send command response directly (no AI call)
      if (cmdResponse) {
        await sendWhatsAppText(instanceName, contactPhone, cmdResponse, apiKey);

        if (conversationId) {
          await supabase.from("whatsapp_messages").insert({ conversation_id: conversationId, direction: "outbound", type: "text", content_text: cmdResponse, content_raw: { pandora_auto_reply: true, command: parsed.command }, sent_at: new Date().toISOString(), status: "sent" });
          try { await supabase.from("pandora_processing_locks").delete().eq("conversation_id", conversationId); } catch {}
        }

        return new Response(JSON.stringify({ ok: true, response: cmdResponse, command: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ═══════════════════════════════════════════════════════
    // @WORKSPACE MENTION PARSING (Rule 5)
    // ═══════════════════════════════════════════════════════

    let effectiveMessage = messageText;
    let effectiveWorkspaceId = activeWorkspaceId;

    const { cleanMessage, targetWorkspaceId } = parseWorkspaceMention(
      messageText,
      allWorkspaces.map(w => ({ id: w.id, name: w.name }))
    );

    if (targetWorkspaceId) {
      effectiveMessage = cleanMessage;
      effectiveWorkspaceId = targetWorkspaceId;
    }

    const effectiveWorkspace = allWorkspaces.find(w => w.id === effectiveWorkspaceId) || activeWorkspace;

    // ── Fetch AI settings scoped to the resolved workspace ──
    const { data: aiSettingsRow } = await supabase
      .from("whatsapp_ai_settings")
      .select("preferred_model,use_mcp")
      .eq("user_id", userId)
      .eq("workspace_id", effectiveWorkspaceId!)
      .maybeSingle();
    const userPreferredModel = aiSettingsRow?.preferred_model || "google/gemini-2.5-pro";
    const useMcp = aiSettingsRow?.use_mcp === true;

    // Deduct credits (different cost for MCP vs classic)
    const creditResult = await deductCredits(userId, useMcp ? "ai_whatsapp_mcp" : "ai_whatsapp_reply");
    const creditsConsumed = creditResult.success ? (creditResult.cost ?? 0) : 0;
    if (!creditResult.success) {
      const jid = `${contactPhone}@s.whatsapp.net`;
      await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, { method: "POST", headers: { "Content-Type": "application/json", apikey: apiKey }, body: JSON.stringify({ number: jid, text: "⚠️ Créditos insuficientes no DESH. Recarregue para continuar usando a Pandora pelo WhatsApp." }) });
      return new Response(JSON.stringify({ error: "insufficient_credits" }), { status: 402, headers: corsHeaders });
    }

    // ── Fetch full context for Maestro prompt ──
    // Fetch context in parallel — memories are GLOBAL (no workspace filter) for parity with chat
    const [tasksCountRes, memoriesRes, profileRes, docsRes, skillsRes, pendingTasksRes, upcomingEventsRes] = await Promise.all([
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("workspace_id", effectiveWorkspaceId!).in("status", ["todo", "in_progress"]),
      supabase.from("ai_memories").select("content,category,importance").eq("user_id", userId).order("created_at", { ascending: false }).limit(25),
      supabase.from("profiles").select("display_name,personal_context").eq("user_id", userId).maybeSingle(),
      supabase.from("workspace_documents").select("title,content,doc_type,is_active").eq("workspace_id", effectiveWorkspaceId!).eq("is_active", true).limit(10),
      supabase.from("ai_skills").select("name,trigger_description,instructions,is_system").or(`workspace_id.eq.${effectiveWorkspaceId},is_system.eq.true`).eq("is_active", true).limit(20),
      // Dashboard context: pending tasks
      supabase.from("tasks").select("id,title,priority,due_date").eq("user_id", userId).in("status", ["todo", "in_progress"]).order("created_at", { ascending: false }).limit(10),
      // Dashboard context: upcoming calendar events (next 48h)
      supabase.from("user_data").select("id,data").eq("user_id", userId).eq("data_type", "event").limit(20),
    ]);

    // Build minimal dashboardContext for Maestro parity with chat
    const pendingTasks = pendingTasksRes.data || [];
    const calendarEvents = (upcomingEventsRes.data || []).map((e: any) => e.data).filter(Boolean);
    const dashboardContext: Record<string, any> = {
      tasksPending: tasksCountRes.count ?? pendingTasks.length,
      tasks: pendingTasks.slice(0, 5),
      events: calendarEvents.slice(0, 5),
    };

    // Resolve active agent
    let activeAgent: { id: string; name: string; icon: string; system_prompt: string | null; model?: string; tools_enabled?: string[] | null } | null = null;
    const agentId = session.context_snapshot?.active_agent_id;
    if (agentId && effectiveWorkspaceId) {
      const { data: agentData } = await supabase.from("ai_agents").select("id,name,icon,system_prompt,model,tools_enabled").eq("id", agentId).eq("workspace_id", effectiveWorkspaceId).eq("is_active", true).maybeSingle();
      if (agentData) {
        activeAgent = {
          id: agentData.id,
          name: agentData.name,
          icon: agentData.icon || "🤖",
          system_prompt: agentData.system_prompt,
          model: agentData.model,
          tools_enabled: agentData.tools_enabled,
        };
      }
    }

    // Fetch recent WhatsApp messages for conversation context
    let recentMessages: any[] = [];
    if (conversationId) {
      const { data: msgs } = await supabase.from("whatsapp_messages").select("direction,content_text,sent_at").eq("conversation_id", conversationId).order("sent_at", { ascending: false }).limit(12);
      recentMessages = (msgs ?? []).reverse();
      if (recentMessages.length > 0) {
        const lastIdx = recentMessages.length - 1;
        if (recentMessages[lastIdx].direction === "inbound" && recentMessages[lastIdx].content_text === messageText) {
          recentMessages = recentMessages.slice(0, lastIdx);
        }
      }
    }

    // Fetch recent action logs for anti-repetition
    let recentActionContext = "";
    if (conversationId) {
      const { data: recentLogs } = await supabase.from("pandora_interaction_logs").select("tools_used,input_text,output_text,created_at").eq("user_id", userId).eq("conversation_id", conversationId).gte("created_at", new Date(Date.now() - 7200000).toISOString()).order("created_at", { ascending: false }).limit(5);
      if (recentLogs?.length) {
        recentActionContext = "\n--- AÇÕES JÁ REALIZADAS NESTA CONVERSA (apenas referência — NÃO significa que não pode criar novos itens, só não repita a MESMA ação com argumentos IDÊNTICOS) ---\n";
        for (const log of recentLogs.reverse()) {
          const toolsList = (log.tools_used || []).join(", ");
          if (toolsList) recentActionContext += `• Tools: ${toolsList} | Pedido: "${(log.input_text || "").substring(0, 50)}" | Resultado: "${(log.output_text || "").substring(0, 80)}"\n`;
        }
      }
    }

    const sessionToolCalls = await getRecentToolCalls(supabase, session.id, 10);

    // ── Build MAESTRO system prompt (Rule 3, 4, 6) ──
    const temporalContext = getTemporalContext();
    const maestroCtx: MaestroContext = {
      workspace: effectiveWorkspace ? {
        id: effectiveWorkspace.id,
        name: effectiveWorkspace.name,
        icon: effectiveWorkspace.icon || "🏠",
        industry: effectiveWorkspace.industry,
        context_summary: effectiveWorkspace.context_summary,
        system_prompt_override: effectiveWorkspace.system_prompt_override,
        is_default: effectiveWorkspace.is_default,
      } : null,
      agent: activeAgent,
      documents: (docsRes.data || []) as any[],
      memories: memoriesRes.data || [],
      skills: (skillsRes.data || []).map((s: any) => ({ name: s.name, trigger_description: s.trigger_description, instructions: s.instructions })),
      allWorkspaces: allWorkspaces.map(w => ({ id: w.id, name: w.name, icon: w.icon || "🏠", context_summary: w.context_summary })),
      isAllMode: false,
      defaultWorkspace: allWorkspaces.find(w => w.is_default) ? { id: allWorkspaces.find(w => w.is_default)!.id, name: allWorkspaces.find(w => w.is_default)!.name, icon: allWorkspaces.find(w => w.is_default)!.icon || "🏠" } : null,
      personalContext: profileRes?.data?.personal_context || null,
      userMessage: effectiveMessage,
      userName: profileRes?.data?.display_name || "Usuário",
      temporalContext,
      recentActions: recentActionContext,
      sessionContext: {
        sessionId: session.id,
        activeChannel: session.active_channel,
        contextSnapshot: session.context_snapshot,
        recentToolCalls: sessionToolCalls,
      },
      channel: useMcp ? "whatsapp-mcp" : "whatsapp",
      dashboardContext,
    };

    // Add WhatsApp-specific instructions
    const whatsappHint = useMcp
      ? "\nMODO MCP via WhatsApp: Acesso DIRETO aos apps conectados via Composio MCP. Aja com autonomia para leitura, confirme para escrita."
      : "";
    const voiceHint = messageType === "audio" ? "\nMODO VOZ: Máximo 2-3 frases. ZERO formatação. Tom natural e fluido." : "";

    const systemPrompt = buildMaestroPrompt(maestroCtx) + whatsappHint + voiceHint;

    // ── Build messages array ──
    const aiMessages: any[] = [{ role: "system", content: systemPrompt }];
    for (const msg of recentMessages) {
      if (!msg.content_text) continue;
      aiMessages.push({ role: msg.direction === "inbound" ? "user" : "assistant", content: msg.content_text });
    }
    aiMessages.push({ role: "user", content: messageText });

    let finalText = "";
    let mcpToolsUsed: string[] = [];

    if (useMcp) {
      // ── MCP HYBRID MODE: Claude + Composio MCP + local DESH tools ──
      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
      const composioKey = Deno.env.get("COMPOSIO_API_KEY");

      if (!anthropicKey || !composioKey) {
        console.error("[pandora-whatsapp] MCP mode enabled but missing ANTHROPIC_API_KEY or COMPOSIO_API_KEY");
        finalText = "Modo MCP não está configurado corretamente. Desative nas configurações ou contate o suporte.";
      } else {
        try {
          // Resolve entityId (Rule 1 — always include workspace)
          const entityId = `${userId}_${effectiveWorkspaceId || "default"}`;

          const serverId = await getOrCreateMcpServer(composioKey);
          const mcpUrl = await getMcpUrl(entityId, serverId, composioKey);

          // Convert OpenAI tools format → Anthropic tools format for hybrid execution
          const anthropicTools = tools.map((t: any) => ({
            name: t.function.name,
            description: t.function.description,
            input_schema: t.function.parameters,
          }));

          // Build Claude messages (convert from OpenAI format to Anthropic format)
          const claudeMessages: any[] = [];
          for (const msg of aiMessages) {
            if (msg.role === "system") continue;
            claudeMessages.push({ role: msg.role === "assistant" ? "assistant" : "user", content: msg.content });
          }

          // Tool execution loop for hybrid mode (MCP + local tools)
          const MAX_HYBRID_ITERATIONS = 6;
          let hybridDone = false;

          for (let iter = 0; iter < MAX_HYBRID_ITERATIONS && !hybridDone; iter++) {
            const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": anthropicKey,
                "anthropic-version": "2023-06-01",
                "anthropic-beta": "mcp-client-2025-04-04",
              },
              body: JSON.stringify({
                model: "claude-sonnet-4-5",
                max_tokens: 4096,
                system: systemPrompt,
                messages: claudeMessages,
                tools: anthropicTools,
                mcp_servers: [{
                  type: "url",
                  url: mcpUrl,
                  name: "composio",
                  authorization_token: composioKey,
                }],
              }),
            });

            if (!claudeResponse.ok) {
              const errText = await claudeResponse.text();
              console.error("[pandora-whatsapp] Claude MCP error:", claudeResponse.status, errText);
              finalText = "";
              break;
            }

            const claudeData = await claudeResponse.json();
            const contentBlocks = claudeData.content || [];

            // Extract text from response
            const textParts = contentBlocks.filter((b: any) => b.type === "text").map((b: any) => b.text);

            // Collect MCP tool uses (handled by Claude/Composio automatically)
            const mcpUses = contentBlocks.filter((b: any) => b.type === "mcp_tool_use");
            for (const mu of mcpUses) {
              mcpToolsUsed.push(mu.name);
              registerToolCall(supabase, session.id, userId, mu.name, deriveToolCategory(mu.name), "whatsapp").catch(() => {});
            }

            // Check for local tool_use blocks (DESH tools that need local execution)
            const localToolUses = contentBlocks.filter((b: any) => b.type === "tool_use");

            if (localToolUses.length > 0) {
              // Execute local tools and continue the conversation
              claudeMessages.push({ role: "assistant", content: contentBlocks });

              const toolResults: any[] = [];
              for (const tu of localToolUses) {
                const callId = await registerToolCall(supabase, session.id, userId, tu.name, deriveToolCategory(tu.name), "whatsapp", tu.input || {});
                await updateToolCallStatus(supabase, callId, "running");
                const result = await executeTool(tu.name, tu.input || {}, userId, supabase, effectiveWorkspaceId || undefined);
                const isError = typeof result === "string" && (result.startsWith("[ERRO]") || result.startsWith("[ERRO_INTERNO]"));
                await updateToolCallStatus(supabase, callId, isError ? "failed" : "done", isError ? undefined : { summary: (result || "").substring(0, 200) }, isError ? result : undefined);
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: tu.id,
                  content: result,
                });
                mcpToolsUsed.push(tu.name);
              }
              claudeMessages.push({ role: "user", content: toolResults });
              // Continue loop — Claude will process tool results
              continue;
            }

            // No more tool calls — we have the final response
            finalText = textParts.join("\n") || "";
            hybridDone = true;
          }

          if (mcpToolsUsed.length) console.log("[pandora-whatsapp] MCP+local tools used:", [...new Set(mcpToolsUsed)]);
        } catch (mcpErr) {
          console.error("[pandora-whatsapp] MCP mode failed, falling back:", mcpErr);
          finalText = "";
        }
      }

      // Fallback to classic mode if MCP failed
      if (!finalText && !mcpToolsUsed.length) {
        console.log("[pandora-whatsapp] MCP fallback → classic mode");
      }
    }

    // ── CLASSIC MODE: Lovable AI Gateway + local tools ──
    if (!finalText) {
      const aiHeaders = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };
      const defaultModels = ["google/gemini-2.5-pro", "google/gemini-2.5-flash", "openai/gpt-5-mini"];
      const models = [userPreferredModel, ...defaultModels.filter(m => m !== userPreferredModel)];
      const MAX_TOOL_ITERATIONS = 5;

      for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        let response: Response | null = null;
        for (const model of models) {
          response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", { method: "POST", headers: aiHeaders, body: JSON.stringify({ model, messages: aiMessages, tools, tool_choice: "auto" }) });
          if (response.ok) break;
          console.error(`[pandora-whatsapp] AI error (${model}):`, response.status);
        }
        if (!response || !response.ok) { finalText = "Desculpe, estou com dificuldades técnicas. Tente novamente em alguns minutos."; break; }

        const data = await response.json();
        const choice = data.choices?.[0];
        const message = choice?.message;
        if (!message) { finalText = "Desculpe, não consegui processar sua mensagem."; break; }

        if (message.tool_calls?.length) {
          aiMessages.push(message);
          for (const tc of message.tool_calls) {
            const toolName = tc.function.name;
            let toolArgs: Record<string, unknown> = {};
            try { toolArgs = JSON.parse(tc.function.arguments || "{}"); } catch { }
            const callId = await registerToolCall(supabase, session.id, userId, toolName, deriveToolCategory(toolName), "whatsapp", toolArgs as Record<string, any>);
            await updateToolCallStatus(supabase, callId, "running");
            const result = await executeTool(toolName, toolArgs, userId, supabase, effectiveWorkspaceId || undefined);
            const isError = result.startsWith("[ERRO]") || result.startsWith("[ERRO_INTERNO]");
            await updateToolCallStatus(supabase, callId, isError ? "failed" : "done", isError ? undefined : { summary: result.substring(0, 200) }, isError ? result : undefined);
            aiMessages.push({ role: "tool", tool_call_id: tc.id, content: result });
          }
          continue;
        }

        finalText = message.content || "";
        break;
      }
    }

    if (!finalText) finalText = "Pronto! Ação executada.";

    // ── Clean AI response: strip JSON leaks, normalize formatting ──
    const { text: cleanedText } = processPandoraResponse(finalText, "whatsapp");
    finalText = cleanedText;

    // Workspace prefix removed — users found it redundant in WhatsApp responses

    // ── Send response via Evolution API ──
    const jid = `${contactPhone}@s.whatsapp.net`;
    const sendRes = await fetchWithRetry(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, { method: "POST", headers: { "Content-Type": "application/json", apikey: apiKey }, body: JSON.stringify({ number: jid, text: finalText }) });
    if (!sendRes.ok) console.error("[pandora-whatsapp] Failed to send:", await sendRes.text());

    // ── TTS: Send voice response when input was audio ──
    if (messageType === "audio" && finalText) {
      const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
      if (ELEVENLABS_API_KEY) {
        (async () => {
          try {
            const ttsText = finalText
              .replace(/```[\s\S]*?```/g, "")
              .replace(/`[^`]*`/g, "")
              .replace(/[*_~`#>\[\]()!|]/g, "")
              .replace(/\n{2,}/g, ". ")
              .replace(/\n/g, " ")
              .replace(/\s{2,}/g, " ")
              .trim()
              .slice(0, 2000);

            if (!ttsText) return;

            const ttsRes = await fetch(
              `https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL?output_format=mp3_44100_128`,
              {
                method: "POST",
                headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({
                  text: ttsText,
                  model_id: "eleven_multilingual_v2",
                  voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: 1.0 },
                }),
              }
            );

            if (!ttsRes.ok) {
              console.error("[pandora-whatsapp] TTS error:", ttsRes.status);
              return;
            }

            const audioBuffer = await ttsRes.arrayBuffer();
            const b64Audio = base64Encode(new Uint8Array(audioBuffer));

            const audioRes = await fetchWithRetry(`${EVOLUTION_API_URL}/message/sendMedia/${instanceName}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: apiKey },
              body: JSON.stringify({
                number: jid,
                media: b64Audio,
                mediatype: "audio",
                mimetype: "audio/mpeg",
                fileName: "pandora-response.mp3",
              }),
            });

            if (!audioRes.ok) console.error("[pandora-whatsapp] Audio send error:", await audioRes.text());
          } catch (e) {
            console.error("[pandora-whatsapp] TTS/audio send failed:", e);
          }
        })();
      }
    }

    // ── Save outbound message ──
    if (conversationId) {
      await supabase.from("whatsapp_messages").insert({ conversation_id: conversationId, direction: "outbound", type: "text", content_text: finalText, content_raw: { pandora_auto_reply: true, ...(messageKeyId ? { reply_to_key: messageKeyId } : {}) }, sent_at: new Date().toISOString(), status: "sent" });
    }

    // ── Log interaction ──
    // Combine classic tool tracking with MCP tools
    const classicToolsUsed = aiMessages.filter((m: any) => m.role === "tool").map((m: any) => {
      const tc = aiMessages.find((am: any) => am.tool_calls?.some((t: any) => t.id === m.tool_call_id));
      return tc?.tool_calls?.find((t: any) => t.id === m.tool_call_id)?.function?.name;
    }).filter(Boolean);
    const allToolsUsed = [...new Set([...classicToolsUsed, ...mcpToolsUsed])];

    await supabase.from("pandora_interaction_logs").insert({ user_id: userId, contact_phone: contactPhone || "", conversation_id: conversationId || null, message_type: useMcp ? "mcp" : (messageType || "text"), input_text: messageText, output_text: finalText, credits_consumed: creditsConsumed, tools_used: allToolsUsed, response_time_ms: Date.now() - startTime, system_prompt_used: systemPrompt.substring(0, 4000), workspace_id: effectiveWorkspaceId, agent_id: activeAgent?.id || null }).then(({ error }) => { if (error) console.error("[pandora-whatsapp] Log error:", error); });

    // ── Release lock ──
    if (conversationId) {
      try { await supabase.from("pandora_processing_locks").delete().eq("conversation_id", conversationId); } catch {}
    }

    return new Response(JSON.stringify({ ok: true, response: finalText }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("[pandora-whatsapp] Error:", e);
    try {
      const { conversationId } = await req.clone().json().catch(() => ({}));
      if (conversationId) {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        try { await supabase.from("pandora_processing_locks").delete().eq("conversation_id", conversationId); } catch {}
      }
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

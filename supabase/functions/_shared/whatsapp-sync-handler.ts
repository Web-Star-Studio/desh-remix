/**
 * @module whatsapp-sync-handler
 * @description Sync history handlers (start, batch, cancel, sync-unread, legacy sync)
 */
import { callEvolution, type WaContext } from "./whatsapp-evolution.ts";
import { numberVariants, mapMessageType } from "./whatsapp-utils.ts";

export async function handleSyncUnread(ctx: WaContext) {
  try {
    const chatsRes = await callEvolution(ctx.apiKey, `/chat/findChats/${ctx.instance}`, "POST", { where: {} });
    if (!chatsRes.ok || !Array.isArray(chatsRes.data)) {
      console.warn("[sync-unread] Evolution API unavailable or session disconnected, skipping sync");
      return { data: { ok: true, synced: 0, skipped: "evolution_unavailable" }, status: 200 };
    }

    const evolutionChats = chatsRes.data as Array<Record<string, unknown>>;
    const unreadMap = new Map<string, number>();
    for (const chat of evolutionChats) {
      const remoteJid = (chat.remoteJid as string) ?? "";
      if (!remoteJid || remoteJid === "status@broadcast" || !remoteJid.includes("@")) continue;
      const contactId = remoteJid.endsWith("@g.us") ? remoteJid : remoteJid.replace(/@.*/, "");
      const unread = typeof chat.unreadCount === "number" ? chat.unreadCount : 0;
      unreadMap.set(contactId, unread);
    }

    const { data: dbConvos } = await ctx.adminClient
      .from("whatsapp_conversations").select("id, external_contact_id, unread_count")
      .eq("user_id", ctx.userId);

    if (!dbConvos || dbConvos.length === 0) return { data: { ok: true, synced: 0 }, status: 200 };

    let synced = 0;
    for (const conv of dbConvos) {
      const extId = conv.external_contact_id as string;
      const variants = extId.endsWith("@g.us") ? [extId] : numberVariants(extId);
      let realUnread: number | undefined;
      for (const v of variants) {
        if (unreadMap.has(v)) { realUnread = unreadMap.get(v); break; }
      }
      if (realUnread === undefined) continue;
      if (realUnread !== (conv.unread_count as number)) {
        await ctx.adminClient.from("whatsapp_conversations").update({ unread_count: realUnread }).eq("id", conv.id);
        synced++;
      }
    }

    const zeroUnreadIds = dbConvos
      .filter(c => {
        const extId = c.external_contact_id as string;
        const vs = extId.endsWith("@g.us") ? [extId] : numberVariants(extId);
        for (const v of vs) { if (unreadMap.has(v) && unreadMap.get(v) === 0) return true; }
        return false;
      }).map(c => c.id as string);

    if (zeroUnreadIds.length > 0) {
      await ctx.adminClient.from("whatsapp_messages").update({ status: "read" })
        .in("conversation_id", zeroUnreadIds).eq("direction", "inbound").neq("status", "read");
    }

    return { data: { ok: true, synced }, status: 200 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[sync-unread] Error:", msg);
    return { data: { error: msg }, status: 500 };
  }
}

export async function handleSyncHistoryStart(ctx: WaContext) {
  try {
    const ONE_HOUR_AGO = new Date(Date.now() - 3600_000).toISOString();
    const TWO_HOURS_AGO = new Date(Date.now() - 7200_000).toISOString();
    await ctx.adminClient.from("whatsapp_sync_jobs")
      .update({ status: "failed", error_message: "Auto-expired: job stalled without progress", completed_at: new Date().toISOString(), current_chat: null })
      .eq("user_id", ctx.userId).in("status", ["pending", "running"]).lt("created_at", ONE_HOUR_AGO).eq("chats_done", 0);
    await ctx.adminClient.from("whatsapp_sync_jobs")
      .update({ status: "failed", error_message: "Auto-expired: job exceeded maximum duration", completed_at: new Date().toISOString(), current_chat: null })
      .in("status", ["pending", "running"]).lt("created_at", TWO_HOURS_AGO);

    const { data: activeJob } = await ctx.adminClient
      .from("whatsapp_sync_jobs").select("id, status, chats_done, chats_total")
      .eq("user_id", ctx.userId).in("status", ["pending", "running"]).maybeSingle();

    if (activeJob) return { data: { error: "Já existe uma sincronização em andamento", jobId: activeJob.id, status: activeJob.status }, status: 409 };

    const { data: recentJob } = await ctx.adminClient
      .from("whatsapp_sync_jobs").select("id, created_at")
      .eq("user_id", ctx.userId).in("status", ["completed", "failed", "cancelled"])
      .gte("created_at", new Date(Date.now() - 3600_000).toISOString())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (recentJob) {
      const cooldownLeft = Math.ceil((3600_000 - (Date.now() - new Date(recentJob.created_at).getTime())) / 60_000);
      return { data: { error: `Aguarde mais ${cooldownLeft} minutos antes de sincronizar novamente`, cooldownMinutes: cooldownLeft }, status: 429 };
    }

    const { deductCredits, insufficientCreditsResponse } = await import("./credits.ts");
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-workspace-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    };
    const creditResult = await deductCredits(ctx.userId, "whatsapp_full_sync", 4);
    if (!creditResult.success) {
      return { data: { error: creditResult.error ?? "insufficient_credits" }, status: 402 };
    }

    const chatsRes = await callEvolution(ctx.apiKey, `/chat/findChats/${ctx.instance}`, "POST", {});
    if (!chatsRes.ok) {
      try { await ctx.adminClient.rpc("add_credits", { _user_id: ctx.userId, _amount: 5, _action: "whatsapp_full_sync_refund", _description: "Reembolso: falha ao buscar chats" }); } catch {}
      return { data: { error: "Falha ao buscar chats", detail: chatsRes.data }, status: 502 };
    }

    const allChats = Array.isArray(chatsRes.data) ? chatsRes.data : [];
    const validChats = allChats.filter((c: any) => {
      const jid = c.id?._serialized ?? c.id ?? c.remoteJid ?? "";
      return (jid.endsWith("@s.whatsapp.net") || jid.endsWith("@g.us")) && jid !== "status@broadcast";
    });

    const MAX_CHATS = 500;
    const cappedChats = validChats.slice(0, MAX_CHATS);

    const pendingChats = cappedChats.map((c: any) => ({
      jid: c.id?._serialized ?? c.id ?? c.remoteJid ?? "",
      name: c.name || c.pushName || c.contact?.pushName || c.contact?.name || c.formattedTitle || "",
      lastMessageAt: c.lastMessageAt ?? null, unreadCount: c.unreadCount ?? 0,
    }));

    if (pendingChats.length === 0) {
      try { await ctx.adminClient.rpc("add_credits", { _user_id: ctx.userId, _amount: 5, _action: "whatsapp_full_sync_refund", _description: "Reembolso: nenhuma conversa encontrada" }); } catch {}
      return { data: { error: "Nenhuma conversa encontrada no WhatsApp" }, status: 404 };
    }

    const { data: job, error: jobErr } = await ctx.adminClient
      .from("whatsapp_sync_jobs").insert({ user_id: ctx.userId, status: "running", chats_total: pendingChats.length, chats_done: 0, messages_synced: 0, pending_chats: pendingChats })
      .select("id").single();

    if (jobErr || !job) {
      try { await ctx.adminClient.rpc("add_credits", { _user_id: ctx.userId, _amount: 5, _action: "whatsapp_full_sync_refund", _description: "Reembolso: erro ao criar job" }); } catch {}
      return { data: { error: "Falha ao criar job", detail: jobErr?.message }, status: 500 };
    }

    const batchUrl = `${ctx.supabaseUrl}/functions/v1/whatsapp-web-proxy/sync-history-batch`;
    fetch(batchUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.serviceRoleKey}`, apikey: ctx.supabaseAnonKey },
      body: JSON.stringify({ jobId: job.id, userId: ctx.userId, instance: ctx.instance, workspaceId: ctx.workspaceId }),
    }).catch(e => console.error("[sync-start] fire-and-forget error:", e));

    return { data: { ok: true, jobId: job.id, chatsTotal: pendingChats.length, chatsCapped: validChats.length > MAX_CHATS }, status: 200 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[sync-start] Error:", msg);
    return { data: { error: msg }, status: 500 };
  }
}

export async function handleSyncHistoryBatch(ctx: WaContext, body: Record<string, unknown>) {
  const BATCH_SIZE = 5;
  const TIMEOUT_MS = 45_000;
  const MAX_MSGS_PER_CHAT = 5000;
  const startTime = Date.now();

  try {
    const { jobId, userId: jobUserId, instance: jobInstance, workspaceId: jobWorkspaceId } = body as {
      jobId?: string; userId?: string; instance?: string; workspaceId?: string;
    };
    if (!jobId) return { data: { error: "jobId required" }, status: 400 };

    const targetUserId = jobUserId ?? ctx.userId;
    const targetInstance = jobInstance ?? ctx.instance;

    const { data: job, error: jobErr } = await ctx.adminClient
      .from("whatsapp_sync_jobs").select("*").eq("id", jobId).single();
    if (jobErr || !job) return { data: { error: "Job not found" }, status: 404 };
    if (job.status === "cancelled" || job.status === "completed" || job.status === "failed") {
      return { data: { ok: true, skipped: "job already " + job.status }, status: 200 };
    }

    const pendingChats = (job.pending_chats as any[]) ?? [];
    const chatsDone = job.chats_done ?? 0;
    const remaining = pendingChats.slice(chatsDone);

    if (remaining.length === 0) {
      await ctx.adminClient.from("whatsapp_sync_jobs").update({ status: "completed", completed_at: new Date().toISOString(), current_chat: null }).eq("id", jobId);
      return { data: { ok: true, completed: true }, status: 200 };
    }

    const batch = remaining.slice(0, BATCH_SIZE);
    let batchMessagesSynced = 0;
    let chatsProcessedInBatch = 0;

    // Bulk fetch contacts
    const batchContactsMap = new Map<string, { name?: string; pic?: string }>();
    try {
      const contactsRes = await callEvolution(ctx.apiKey, `/chat/findContacts/${targetInstance}`, "POST", { where: {} });
      if (contactsRes.ok && Array.isArray(contactsRes.data)) {
        for (const contact of contactsRes.data as any[]) {
          const cId = (contact.id as string) ?? (contact.remoteJid as string) ?? "";
          const phone = cId.replace(/@.*/, "");
          const name = contact.pushName || contact.name || contact.verifiedName || contact.notify || null;
          const pic = contact.profilePictureUrl || null;
          if (phone && (name || pic)) batchContactsMap.set(phone, { name: name || undefined, pic: pic || undefined });
        }
      }
    } catch {}

    for (const chatInfo of batch) {
      if (Date.now() - startTime > TIMEOUT_MS) break;

      if (chatsProcessedInBatch > 0 && chatsProcessedInBatch % 3 === 0) {
        const { data: freshJob } = await ctx.adminClient.from("whatsapp_sync_jobs").select("status").eq("id", jobId).single();
        if (freshJob?.status === "cancelled") return { data: { ok: true, cancelled: true }, status: 200 };
      }

      const remoteJid = chatInfo.jid as string;
      const isGroupChat = remoteJid.endsWith("@g.us");
      const phoneNumber = remoteJid.replace(/@.*/, "");
      const contactId = isGroupChat ? remoteJid : phoneNumber;
      const bulkContact = batchContactsMap.get(phoneNumber);
      const contactName = bulkContact?.name || chatInfo.name || (isGroupChat ? remoteJid : phoneNumber);

      try {
        await ctx.adminClient.from("whatsapp_sync_jobs").update({ current_chat: contactName || contactId }).eq("id", jobId);

        let profilePictureUrl: string | null = bulkContact?.pic || null;
        if (!profilePictureUrl && !isGroupChat) {
          try {
            const picRes = await callEvolution(ctx.apiKey, `/chat/fetchProfilePictureUrl/${targetInstance}`, "POST", { number: remoteJid });
            if (picRes.ok) profilePictureUrl = (picRes.data as any)?.profilePictureUrl || null;
          } catch {}
        }

        const upsertData: Record<string, unknown> = {
          user_id: targetUserId, channel: "whatsapp_web", external_contact_id: contactId,
          title: contactName, last_message_at: chatInfo.lastMessageAt ? new Date(chatInfo.lastMessageAt).toISOString() : new Date().toISOString(),
          unread_count: chatInfo.unreadCount ?? 0,
        };
        if (profilePictureUrl) upsertData.profile_picture_url = profilePictureUrl;
        const batchWsId = jobWorkspaceId ?? ctx.workspaceId;
        if (batchWsId) upsertData.workspace_id = batchWsId;

        const { data: conv, error: convErr } = await ctx.adminClient
          .from("whatsapp_conversations").upsert(upsertData, { onConflict: "user_id,external_contact_id" }).select("id").single();

        if (convErr || !conv) {
          console.error(`[sync-batch] Conv upsert error for ${contactId}:`, convErr?.message);
          chatsProcessedInBatch++;
          continue;
        }

        let rawMsgs: any[] = [];
        try {
          const msgsRes = await callEvolution(ctx.apiKey, `/chat/findMessages/${targetInstance}`, "POST", { where: { key: { remoteJid } } });
          rawMsgs = Array.isArray(msgsRes.data) ? msgsRes.data : (msgsRes.data as any)?.messages ?? [];
        } catch (fetchErr) {
          console.error(`[sync-batch] findMessages failed for ${contactId}:`, fetchErr);
        }

        if (rawMsgs.length === 0) {
          try {
            const msgsRes2 = await callEvolution(ctx.apiKey, `/chat/findMessages/${targetInstance}`, "POST", {});
            const allMsgs = Array.isArray(msgsRes2.data) ? msgsRes2.data : (msgsRes2.data as any)?.messages ?? [];
            rawMsgs = allMsgs.filter((m: any) => (m.key?.remoteJid ?? "") === remoteJid);
          } catch {}
        }

        if (rawMsgs.length > MAX_MSGS_PER_CHAT) {
          rawMsgs = rawMsgs.slice(-MAX_MSGS_PER_CHAT);
        }

        if (!rawMsgs.length) { chatsProcessedInBatch++; continue; }

        const existingKeyIds = new Set<string>();
        let dedupOffset = 0;
        const DEDUP_PAGE = 1000;
        while (true) {
          const { data: existingBatch } = await ctx.adminClient
            .from("whatsapp_messages").select("content_raw->key->id")
            .eq("conversation_id", conv.id).range(dedupOffset, dedupOffset + DEDUP_PAGE - 1);
          if (!existingBatch || existingBatch.length === 0) break;
          for (const em of existingBatch) { const kid = (em as any)?.id; if (kid) existingKeyIds.add(kid); }
          if (existingBatch.length < DEDUP_PAGE) break;
          dedupOffset += DEDUP_PAGE;
        }

        const newMessages: any[] = [];
        for (const m of rawMsgs) {
          const key = m.key ?? {};
          if (!key.id || existingKeyIds.has(key.id)) continue;
          const fromMe = Boolean(key.fromMe);
          const msgObj = m.message ?? {};
          const msgText = msgObj.conversation ?? msgObj.extendedTextMessage?.text ?? msgObj.imageMessage?.caption ?? msgObj.videoMessage?.caption ?? msgObj.documentMessage?.caption ?? null;
          const ts = m.messageTimestamp;
          const sentAt = ts ? new Date((typeof ts === "number" ? ts : parseInt(ts)) * 1000).toISOString() : new Date().toISOString();
          const dbType = mapMessageType(m.messageType ?? "text");

          const cleanRaw = { ...m };
          if (cleanRaw.message) {
            const cleaned = { ...cleanRaw.message };
            for (const mediaKey of ["imageMessage", "audioMessage", "videoMessage", "documentMessage", "stickerMessage"]) {
              if (cleaned[mediaKey]?.jpegThumbnail) cleaned[mediaKey] = { ...cleaned[mediaKey], jpegThumbnail: "[stripped]" };
              if (cleaned[mediaKey]?.mediaKey) cleaned[mediaKey] = { ...cleaned[mediaKey] };
            }
            cleanRaw.message = cleaned;
          }

          newMessages.push({ conversation_id: conv.id, direction: fromMe ? "outbound" : "inbound", type: dbType, content_text: msgText, content_raw: cleanRaw, sent_at: sentAt, status: "delivered" });
        }

        for (let i = 0; i < newMessages.length; i += 50) {
          const insertBatch = newMessages.slice(i, i + 50);
          const { error: insErr } = await ctx.adminClient.from("whatsapp_messages").insert(insertBatch);
          if (!insErr) batchMessagesSynced += insertBatch.length;
          else console.error(`[sync-batch] Insert error (batch ${i}):`, insErr.message);
          if (Date.now() - startTime > TIMEOUT_MS) break;
        }
      } catch (chatErr) {
        console.error(`[sync-batch] Error processing chat ${contactId}:`, chatErr instanceof Error ? chatErr.message : chatErr);
      }

      chatsProcessedInBatch++;
      const newDone = chatsDone + chatsProcessedInBatch;
      await ctx.adminClient.from("whatsapp_sync_jobs").update({
        chats_done: newDone, messages_synced: (job.messages_synced ?? 0) + batchMessagesSynced,
      }).eq("id", jobId);
    }

    const newDoneTotal = chatsDone + chatsProcessedInBatch;
    const totalMsgsSynced = (job.messages_synced ?? 0) + batchMessagesSynced;

    await ctx.adminClient.from("whatsapp_sync_jobs").update({ chats_done: newDoneTotal, messages_synced: totalMsgsSynced }).eq("id", jobId);

    if (newDoneTotal >= pendingChats.length) {
      await ctx.adminClient.from("whatsapp_sync_jobs").update({
        status: "completed", completed_at: new Date().toISOString(),
        chats_done: pendingChats.length, messages_synced: totalMsgsSynced, current_chat: null,
      }).eq("id", jobId);
    } else {
      await new Promise(r => setTimeout(r, 2000));
      const batchUrl = `${ctx.supabaseUrl}/functions/v1/whatsapp-web-proxy/sync-history-batch`;
      fetch(batchUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.serviceRoleKey}`, apikey: ctx.supabaseAnonKey },
        body: JSON.stringify({ jobId, userId: targetUserId, instance: targetInstance, workspaceId: jobWorkspaceId ?? ctx.workspaceId }),
      }).catch(e => console.error("[sync-batch] next batch fire-and-forget error:", e));
    }

    return { data: { ok: true, chatsDone: newDoneTotal, chatsTotal: pendingChats.length, messagesSynced: totalMsgsSynced }, status: 200 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[sync-batch] Error:", msg);

    try {
      const jid = (body as any)?.jobId;
      if (jid) {
        const { data: failJob } = await ctx.adminClient.from("whatsapp_sync_jobs").select("retry_count").eq("id", jid).single();
        const retries = (failJob?.retry_count ?? 0) + 1;
        if (retries >= 3) {
          await ctx.adminClient.from("whatsapp_sync_jobs").update({
            status: "failed", error_message: `Falha após ${retries} tentativas: ${msg}`, retry_count: retries, current_chat: null,
          }).eq("id", jid);
        } else {
          await ctx.adminClient.from("whatsapp_sync_jobs").update({ retry_count: retries, error_message: `Tentativa ${retries}/3: ${msg}` }).eq("id", jid);
          const backoffMs = retries * 5000;
          await new Promise(r => setTimeout(r, backoffMs));
          const batchUrl = `${ctx.supabaseUrl}/functions/v1/whatsapp-web-proxy/sync-history-batch`;
          fetch(batchUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.serviceRoleKey}`, apikey: ctx.supabaseAnonKey },
            body: JSON.stringify(body),
          }).catch(() => {});
        }
      }
    } catch {}

    return { data: { error: msg }, status: 500 };
  }
}

export async function handleSyncHistoryCancel(ctx: WaContext, body: Record<string, unknown>) {
  const { jobId } = body as { jobId?: string };
  if (!jobId) return { data: { error: "jobId required" }, status: 400 };

  const { error: upErr } = await ctx.adminClient.from("whatsapp_sync_jobs")
    .update({ status: "cancelled", completed_at: new Date().toISOString(), current_chat: null })
    .eq("id", jobId).eq("user_id", ctx.userId).in("status", ["pending", "running"]);

  if (upErr) return { data: { error: upErr.message }, status: 500 };
  return { data: { ok: true }, status: 200 };
}

export async function handleSyncHistoryLegacy(ctx: WaContext) {
  try {
    const chatsRes = await callEvolution(ctx.apiKey, `/chat/findChats/${ctx.instance}`, "POST", {});
    if (!chatsRes.ok) {
      return { data: { error: "Falha ao buscar chats da Evolution API", detail: chatsRes.data }, status: 502 };
    }

    const allChats = Array.isArray(chatsRes.data) ? chatsRes.data : [];
    const individualChats = allChats.filter((c: any) => {
      const jid = c.id?._serialized ?? c.id ?? c.remoteJid ?? "";
      return (jid.endsWith("@s.whatsapp.net") || jid.endsWith("@g.us")) && jid !== "status@broadcast";
    });

    const contactsNameMap = new Map<string, string>();
    try {
      const contactsRes = await callEvolution(ctx.apiKey, `/chat/findContacts/${ctx.instance}`, "POST", { where: {} });
      if (contactsRes.ok && Array.isArray(contactsRes.data)) {
        for (const contact of contactsRes.data as any[]) {
          const cId = (contact.id as string) ?? (contact.remoteJid as string) ?? "";
          const phone = cId.replace(/@.*/, "");
          const name = contact.pushName || contact.name || contact.verifiedName || contact.notify || null;
          if (phone && name) contactsNameMap.set(phone, name);
        }
      }
    } catch {}

    let chatsSynced = 0;
    let messagesSynced = 0;

    for (const chat of individualChats) {
      const remoteJid = chat.id?._serialized ?? chat.id ?? chat.remoteJid ?? "";
      const isGroupChat = remoteJid.endsWith("@g.us");
      const phoneNumber = remoteJid.replace(/@.*/, "");
      const contactId = isGroupChat ? remoteJid : phoneNumber;
      const evolutionName = contactsNameMap.get(phoneNumber);
      const contactName = evolutionName || chat.name || chat.pushName || chat.contact?.pushName || chat.contact?.name || chat.formattedTitle || (isGroupChat ? chat.subject : phoneNumber);

      let profilePictureUrl: string | null = null;
      if (!isGroupChat) {
        try {
          const picRes = await callEvolution(ctx.apiKey, `/chat/fetchProfilePictureUrl/${ctx.instance}`, "POST", { number: remoteJid });
          if (picRes.ok) profilePictureUrl = (picRes.data as any)?.profilePictureUrl || null;
        } catch {}
      }

      const syncUpsertData: Record<string, unknown> = {
        user_id: ctx.userId, channel: "whatsapp_web", external_contact_id: contactId,
        title: contactName, last_message_at: chat.lastMessageAt ? new Date(chat.lastMessageAt).toISOString() : new Date().toISOString(),
        unread_count: chat.unreadCount ?? 0,
      };
      if (profilePictureUrl) syncUpsertData.profile_picture_url = profilePictureUrl;
      if (ctx.workspaceId) syncUpsertData.workspace_id = ctx.workspaceId;

      const { data: conv, error: convErr } = await ctx.adminClient
        .from("whatsapp_conversations").upsert(syncUpsertData, { onConflict: "user_id,external_contact_id" }).select("id").single();
      if (convErr || !conv) continue;
      chatsSynced++;

      const msgsRes = await callEvolution(ctx.apiKey, `/chat/findMessages/${ctx.instance}`, "POST", { where: { key: { remoteJid } } });
      let rawMsgs = Array.isArray(msgsRes.data) ? msgsRes.data : (msgsRes.data as any)?.messages ?? [];
      if (rawMsgs.length > 50) rawMsgs = rawMsgs.slice(-50);
      if (!rawMsgs.length) continue;

      const { data: existingMsgs } = await ctx.adminClient.from("whatsapp_messages").select("content_raw").eq("conversation_id", conv.id);
      const existingKeyIds = new Set<string>();
      if (existingMsgs) for (const em of existingMsgs) { const kid = (em.content_raw as any)?.key?.id; if (kid) existingKeyIds.add(kid); }

      const newMessages: any[] = [];
      for (const m of rawMsgs) {
        const key = m.key ?? {};
        if (!key.id || existingKeyIds.has(key.id)) continue;
        const fromMe = Boolean(key.fromMe);
        const msgObj = m.message ?? {};
        const msgText = msgObj.conversation ?? msgObj.extendedTextMessage?.text ?? msgObj.imageMessage?.caption ?? msgObj.videoMessage?.caption ?? msgObj.documentMessage?.caption ?? null;
        const ts = m.messageTimestamp;
        const sentAt = ts ? new Date((typeof ts === "number" ? ts : parseInt(ts)) * 1000).toISOString() : new Date().toISOString();
        const dbType = mapMessageType(m.messageType ?? "text");
        newMessages.push({ conversation_id: conv.id, direction: fromMe ? "outbound" : "inbound", type: dbType, content_text: msgText, content_raw: m, sent_at: sentAt, status: "delivered" });
      }

      if (newMessages.length > 0) {
        for (let i = 0; i < newMessages.length; i += 100) {
          const batchSlice = newMessages.slice(i, i + 100);
          const { error: insErr } = await ctx.adminClient.from("whatsapp_messages").insert(batchSlice);
          if (!insErr) messagesSynced += batchSlice.length;
        }
      }
    }

    return { data: { ok: true, chatsFound: individualChats.length, chatsSynced, messagesSynced }, status: 200 };
  } catch (e) {
    return { data: { error: e instanceof Error ? e.message : String(e) }, status: 500 };
  }
}

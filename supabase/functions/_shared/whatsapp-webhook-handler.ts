/**
 * @module whatsapp-webhook-handler
 * @description Handles Evolution API push webhook events (POST /webhook)
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.95.3";
import { callEvolution } from "./whatsapp-evolution.ts";
import { normalizeBrazilianNumber, numberVariants, mapEvolutionState, mapMessageType } from "./whatsapp-utils.ts";
import { emitEvent } from "./event-emitter.ts";
import { shouldProcessMessage, normalizePhone } from "./whatsapp-auth-guard.ts";

interface WebhookDeps {
  adminClient: SupabaseClient;
  apiKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  serviceRoleKey: string;
}

export async function handleWebhook(
  req: Request,
  deps: WebhookDeps,
): Promise<Response | { data: unknown; status: number }> {
  const { adminClient, apiKey, supabaseUrl, supabaseAnonKey, serviceRoleKey } = deps;

  const incomingKey = req.headers.get("apikey") ?? req.headers.get("x-api-key") ?? "";
  if (!apiKey || incomingKey !== apiKey) {
    return { data: { error: "Unauthorized" }, status: 401 };
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return { data: { error: "Invalid JSON" }, status: 400 };
  }

  const event = (payload.event as string) ?? "";
  const instance = (payload.instance as string) ?? "";
  const data = (payload.data as Record<string, unknown>) ?? {};

  if (instance !== "desh" && !instance.startsWith("desh_")) {
    return { data: { ok: true, skipped: "wrong instance prefix" }, status: 200 };
  }

  const { data: sessionRow } = await adminClient
    .from("whatsapp_web_sessions")
    .select("user_id, workspace_id")
    .eq("session_id", instance)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sessionRow) {
    return { data: { ok: true, skipped: "no session record" }, status: 200 };
  }

  const userId = sessionRow.user_id as string;
  const webhookWorkspaceId = (sessionRow.workspace_id as string) ?? null;

  // ── SECURITY: Validate instance name matches session owner ──
  // Instance format: desh_{userId_8}_{workspaceId_6}
  if (instance.startsWith("desh_") && instance !== "desh") {
    const parts = instance.split("_");
    // parts[0] = "desh", parts[1] = userId prefix (8 chars), parts[2] = workspaceId prefix (6 chars)
    if (parts.length >= 2) {
      const instanceUserPrefix = parts[1];
      if (!userId.startsWith(instanceUserPrefix)) {
        console.error(`[whatsapp-webhook] SECURITY: Instance ${instance} userId prefix mismatch. Session user: ${userId}, instance prefix: ${instanceUserPrefix}`);
        return { data: { ok: true, skipped: "session_owner_mismatch" }, status: 200 };
      }
    }
  }

  // ── qrcode.updated ──
  if (event === "qrcode.updated" || event === "QRCODE_UPDATED") {
    const qrObj = data.qrcode as Record<string, unknown> | undefined;
    const qrCode =
      (qrObj?.base64 as string) ??
      (data.base64 as string) ??
      (typeof qrObj === "string" ? qrObj : null);

    if (qrCode) {
      await adminClient
        .from("whatsapp_web_sessions")
        .update({ last_qr_code: qrCode, status: "QR_PENDING", updated_at: new Date().toISOString() })
        .eq("session_id", instance);
    }
    return { data: { ok: true, event }, status: 200 };
  }

  // ── connection.update ──
  if (event === "connection.update" || event === "CONNECTION_UPDATE") {
    const state = (data.state as string) ?? (data.connection as string) ?? "";
    const mappedStatus = mapEvolutionState(state);
    const extra: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (mappedStatus === "CONNECTED") extra.last_connected_at = new Date().toISOString();

    await adminClient
      .from("whatsapp_web_sessions")
      .update({ status: mappedStatus, ...extra })
      .eq("session_id", instance);

    return { data: { ok: true, event, status: mappedStatus }, status: 200 };
  }

  // ── messages.upsert ──
  if (event === "messages.upsert" || event === "MESSAGES_UPSERT") {
    return await handleMessagesUpsert(data, instance, userId, webhookWorkspaceId, deps);
  }

  // ── messages.update ──
  if (event === "messages.update" || event === "MESSAGES_UPDATE") {
    return await handleMessagesUpdate(data, userId, deps);
  }

  // ── groups.upsert ──
  if (event === "groups.upsert" || event === "GROUPS_UPSERT") {
    return await handleGroupsUpsert(data, userId, deps);
  }

  // ── presence.update ──
  if (event === "presence.update" || event === "PRESENCE_UPDATE") {
    return await handlePresenceUpdate(data, userId, deps);
  }

  // ── messages.delete ──
  if (event === "messages.delete" || event === "MESSAGES_DELETE") {
    return await handleMessagesDelete(data, deps);
  }

  return { data: { ok: true, event, skipped: "unhandled event" }, status: 200 };
}

// ── messages.upsert handler ──
async function handleMessagesUpsert(
  data: Record<string, unknown>,
  instance: string,
  userId: string,
  webhookWorkspaceId: string | null,
  deps: WebhookDeps,
) {
  const { adminClient, apiKey, supabaseUrl, supabaseAnonKey, serviceRoleKey } = deps;
  const msgData = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  const key = (msgData.key ?? {}) as Record<string, unknown>;
  const fromMe = Boolean(key.fromMe);
  const remoteJid = (key.remoteJid as string) ?? "";
  const keyId = (key.id as string) ?? "";

  if (remoteJid === "status@broadcast") {
    return { data: { ok: true, skipped: "status broadcast" }, status: 200 };
  }

  const isGroup = remoteJid.endsWith("@g.us");
  const phoneNumber = remoteJid.replace(/@.*/, "");
  const contactId = isGroup ? remoteJid : phoneNumber;
  const msgObj = (msgData.message ?? {}) as Record<string, unknown>;
  const msgText =
    (msgObj.conversation as string) ??
    ((msgObj.extendedTextMessage as Record<string, unknown>)?.text as string) ??
    null;
  const timestamp = msgData.messageTimestamp as number | undefined;
  const pushName = (msgData.pushName as string) || phoneNumber;
  const sentAt = timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString();

  const messageType = (msgData.messageType as string) ?? "conversation";
  const dbType = mapMessageType(messageType);

  // Use number variants to match existing conversation
  const contactVariants = isGroup ? [contactId] : numberVariants(contactId);
  const { data: existingConvRows } = await adminClient
    .from("whatsapp_conversations")
    .select("id, unread_count, title, profile_picture_url")
    .eq("user_id", userId)
    .in("external_contact_id", contactVariants)
    .order("last_message_at", { ascending: false })
    .limit(1);
  const existingConv = existingConvRows?.[0] ?? null;

  let conversationTitle = pushName;
  if (isGroup) {
    if (existingConv?.title && !existingConv.title.includes("@g.us") && existingConv.title !== contactId) {
      conversationTitle = existingConv.title;
    } else {
      try {
        const groupRes = await callEvolution(apiKey, `/group/findGroupInfos/${instance}?groupJid=${remoteJid}`);
        if (groupRes.ok && groupRes.data) {
          const gData = Array.isArray(groupRes.data) ? groupRes.data[0] : groupRes.data;
          conversationTitle = (gData as any)?.subject || (gData as any)?.name || contactId;
        } else {
          conversationTitle = contactId;
        }
      } catch {
        conversationTitle = contactId;
      }
    }
  }

  let profilePictureUrl: string | null = existingConv?.profile_picture_url ?? null;
  if (!profilePictureUrl) {
    try {
      const picRes = await callEvolution(apiKey, `/chat/fetchProfilePictureUrl/${instance}`, "POST", { number: remoteJid });
      if (picRes.ok && picRes.data) {
        profilePictureUrl = (picRes.data as Record<string, unknown>).profilePictureUrl as string || null;
      }
    } catch {}
  }

  let convId: string;

  if (existingConv) {
    const newUnread = fromMe ? existingConv.unread_count : (existingConv.unread_count ?? 0) + 1;
    const shouldUpdateTitle = !isGroup && !fromMe && pushName && pushName.trim();
    const newTitle = isGroup ? conversationTitle : (shouldUpdateTitle ? pushName : existingConv.title);
    const updateData: Record<string, unknown> = { title: newTitle, last_message_at: sentAt, unread_count: newUnread };
    if (profilePictureUrl && !existingConv.profile_picture_url) {
      updateData.profile_picture_url = profilePictureUrl;
    }
    await adminClient.from("whatsapp_conversations").update(updateData).eq("id", existingConv.id);
    convId = existingConv.id;
  } else {
    const insertData: Record<string, unknown> = {
      user_id: userId, channel: "whatsapp_web", external_contact_id: contactId,
      title: isGroup ? conversationTitle : (fromMe ? contactId : (pushName || contactId)),
      last_message_at: sentAt, unread_count: fromMe ? 0 : 1, profile_picture_url: profilePictureUrl,
    };
    if (webhookWorkspaceId) insertData.workspace_id = webhookWorkspaceId;
    const { data: newConv, error: convError } = await adminClient
      .from("whatsapp_conversations").insert(insertData).select("id").single();

    if (convError || !newConv) {
      console.error("[webhook] Error inserting conversation:", convError);
      return { data: { error: "DB error", detail: convError?.message }, status: 500 };
    }
    convId = newConv.id;
  }

  // Sync profile picture to contacts table
  if (profilePictureUrl && !isGroup) {
    try {
      await adminClient.from("contacts").update({ avatar_url: profilePictureUrl })
        .eq("user_id", userId).ilike("phone", `%${phoneNumber.slice(-8)}%`).is("avatar_url", null);
    } catch {}
  }

  // ── Handle reactionMessage ──
  if (dbType === "reaction" && msgObj.reactionMessage) {
    const reactionMsg = msgObj.reactionMessage as Record<string, unknown>;
    const targetKey = (reactionMsg.key as Record<string, unknown>) ?? {};
    const targetKeyId = targetKey.id as string;
    const reactionText = (reactionMsg.text as string) ?? "";

    if (targetKeyId) {
      const { data: targetMsgRows } = await adminClient
        .from("whatsapp_messages").select("id, reactions")
        .contains("content_raw", { key: { id: targetKeyId } }).limit(1);

      if (targetMsgRows && targetMsgRows.length > 0) {
        const targetMsg = targetMsgRows[0];
        const currentReactions = (targetMsg.reactions as any[]) ?? [];

        if (reactionText) {
          const filtered = currentReactions.filter(
            (r: any) => !(r.fromMe === fromMe && r.senderJid === (key.participant || key.remoteJid))
          );
          filtered.push({
            emoji: reactionText, fromMe,
            senderJid: (key.participant as string) || remoteJid,
            timestamp: timestamp ?? Math.floor(Date.now() / 1000),
          });
          await adminClient.from("whatsapp_messages").update({ reactions: filtered }).eq("id", targetMsg.id);
        } else {
          const filtered = currentReactions.filter(
            (r: any) => !(r.fromMe === fromMe && r.senderJid === (key.participant || key.remoteJid))
          );
          await adminClient.from("whatsapp_messages").update({ reactions: filtered }).eq("id", targetMsg.id);
        }
      }
    }
    return { data: { ok: true, event: "messages.upsert", type: "reaction", conversationId: existingConv?.id }, status: 200 };
  }

  // Extract caption
  const captionText = msgText
    || (msgObj.imageMessage as Record<string, unknown>)?.caption as string
    || (msgObj.videoMessage as Record<string, unknown>)?.caption as string
    || (msgObj.documentMessage as Record<string, unknown>)?.caption as string
    || null;

  // Deduplicate
  if (keyId) {
    const { data: existingMsg } = await adminClient
      .from("whatsapp_messages").select("id").eq("conversation_id", convId)
      .contains("content_raw", { key: { id: keyId } }).maybeSingle();
    if (existingMsg) {
      return { data: { ok: true, event: "messages.upsert", skipped: "duplicate", conversationId: convId }, status: 200 };
    }
  }

  // Insert message
  try {
    const { error: msgError } = await adminClient.from("whatsapp_messages").insert({
      conversation_id: convId, direction: fromMe ? "outbound" : "inbound",
      type: dbType, content_text: captionText, content_raw: msgData,
      sent_at: sentAt, status: "delivered",
    });
    if (msgError) console.error("[webhook] Error inserting message:", msgError);

    // Emit event for inbound messages (fire-and-forget)
    if (!fromMe) {
      emitEvent(adminClient, userId, webhookWorkspaceId, "whatsapp.message_received", "whatsapp", {
        from: phoneNumber, body: captionText || "", isGroup, conversationId: convId, type: dbType,
      }).catch(() => {});
    }
  } catch (insertErr) {
    console.error("[webhook] Unexpected error inserting message:", insertErr);
  }

  // ── Pandora AI auto-reply trigger (centralized auth guard) ──
  const senderNumber = String(phoneNumber ?? "").replace(/\D/g, "");
  const isEligibleType = dbType === "text" || dbType === "audio";
  const hasContent = dbType === "text" ? !!msgText?.trim() : true;

  if (!isGroup && hasContent && isEligibleType) {
    // Use centralized fail-closed auth guard
    const authResult = await shouldProcessMessage(
      adminClient,
      userId,
      senderNumber,
      isGroup,
      { messagePreview: msgText?.slice(0, 100), skipAuditLog: false, workspaceId: webhookWorkspaceId ?? undefined },
    );

    if (!authResult.allowed) {
      console.log(`[webhook] Pandora blocked: ${authResult.reason} for ${senderNumber}`);
      // Do NOT call pandora-whatsapp, do NOT process
    } else {
      // fromMe check: only allow self-chat
      if (fromMe) {
        let ownerNumber = "";
        try {
          const instanceInfo = await callEvolution(apiKey, `/instance/fetchInstances`, "GET");
          const payload = instanceInfo.data as any;
          const instances = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.instances)
              ? payload.instances
              : Array.isArray(payload?.data)
                ? payload.data
                : [];
          const myInstance = instances.find((i: any) => {
            const instanceName = i?.instance?.instanceName ?? i?.instanceName ?? i?.name;
            return instanceName === instance;
          });
          const ownerJid =
            myInstance?.instance?.ownerJid ??
            myInstance?.ownerJid ??
            myInstance?.instance?.owner ??
            myInstance?.owner ??
            "";
          if (ownerJid) {
            ownerNumber = String(ownerJid).replace(/@.*/, "").replace(/\D/g, "");
          }
        } catch {}

        const normalizedOwner = normalizePhone(ownerNumber);
        const normalizedChat = normalizePhone(senderNumber);
        if (normalizedOwner !== normalizedChat) {
          // Not a self-chat — do not trigger Pandora
          return { data: { ok: true, event: "messages.upsert", conversationId: convId, skipped: "fromMe_not_self_chat" }, status: 200 };
        }
      }

      // Authorized — proceed with Pandora trigger
      await adminClient.rpc("cleanup_pandora_locks");

      const { data: lockInserted, error: lockErr } = await adminClient
        .from("pandora_processing_locks")
        .upsert(
          { conversation_id: convId, locked_at: new Date().toISOString(), message_key_id: keyId },
          { onConflict: "conversation_id", ignoreDuplicates: true },
        )
        .select("conversation_id")
        .maybeSingle();

      if (!lockInserted && !lockErr) {
        const { data: existingLock } = await adminClient
          .from("pandora_processing_locks")
          .select("locked_at, message_key_id")
          .eq("conversation_id", convId)
          .maybeSingle();

        if (existingLock) {
          const lockAge = Date.now() - new Date(existingLock.locked_at).getTime();
          if (lockAge < 30000) {
            return {
              data: { ok: true, event: "messages.upsert", conversationId: convId, skipped: "pandora_locked" },
              status: 200,
            };
          }
          await adminClient
            .from("pandora_processing_locks")
            .update({ locked_at: new Date().toISOString(), message_key_id: keyId })
            .eq("conversation_id", convId);
        }
      }

      let pandoraMessageText = msgText || "";

      if (dbType === "audio" && key) {
        try {
          const evoMediaRes = await callEvolution(
            apiKey,
            `/chat/getBase64FromMediaMessage/${instance}`,
            "POST",
            { message: { key }, convertToMp4: false },
          );

          if (evoMediaRes.ok) {
            const mediaJson = evoMediaRes.data as any;
            const base64Audio = mediaJson?.base64 ?? mediaJson?.data?.base64 ?? "";
            const mimeType = mediaJson?.mimetype ?? mediaJson?.data?.mimetype ?? "audio/ogg";

            if (base64Audio) {
              const binaryStr = atob(base64Audio);
              const bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

              const audioBlob = new Blob([bytes], { type: mimeType });
              const formData = new FormData();
              formData.append("file", audioBlob, `audio.${mimeType.includes("ogg") ? "ogg" : "webm"}`);
              formData.append("model_id", "scribe_v2");
              formData.append("language_code", "por");

              const elevenLabsKey = Deno.env.get("ELEVENLABS_API_KEY");
              if (elevenLabsKey) {
                const sttRes = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
                  method: "POST",
                  headers: { "xi-api-key": elevenLabsKey },
                  body: formData,
                });

                if (sttRes.ok) {
                  const sttData = await sttRes.json();
                  pandoraMessageText = sttData.text || "";
                } else {
                  const errText = await sttRes.text();
                  console.error(`[webhook] ElevenLabs STT error: ${sttRes.status} ${errText}`);
                }
              }
            }
          }
        } catch (audioErr) {
          console.error("[webhook] Audio transcription error:", audioErr);
        }
      }

      if (pandoraMessageText.trim()) {
        const pandoraPrefix = dbType === "audio" ? "[Áudio transcrito] " : "";
        const pandoraUrl = `${supabaseUrl}/functions/v1/pandora-whatsapp`;
        fetch(pandoraUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: supabaseAnonKey,
          },
          body: JSON.stringify({
            userId,
            conversationId: convId,
            messageText: pandoraPrefix + pandoraMessageText,
            contactPhone: senderNumber,
            messageType: dbType,
            messageKeyId: keyId,
            workspaceId: webhookWorkspaceId || undefined,
          }),
        }).catch((e) => console.error("[webhook] pandora-whatsapp fire-and-forget error:", e));
      } else {
        await adminClient.from("pandora_processing_locks").delete().eq("conversation_id", convId);
      }
    }
  }

  return { data: { ok: true, event: "messages.upsert", conversationId: convId, isGroup }, status: 200 };
}

// ── messages.update handler ──
async function handleMessagesUpdate(
  data: Record<string, unknown>,
  userId: string,
  deps: WebhookDeps,
) {
  const { adminClient } = deps;
  const updates = Array.isArray(data) ? data : [data];
  let updatedCount = 0;
  const recalculatedConvIds = new Set<string>();

  for (const upd of updates) {
    const key = (upd as any).key ?? (upd as any).keyId ?? {};
    const keyId = typeof key === "string" ? key : (key.id as string) ?? "";
    const remoteJid = typeof key === "object" ? (key.remoteJid as string) ?? "" : "";
    const ack = (upd as any).update?.status ?? (upd as any).status ?? (upd as any).ack;

    if (!keyId && !remoteJid) continue;

    let newStatus = "delivered";
    if (ack === 3 || ack === 4 || ack === "READ" || ack === "PLAYED") newStatus = "read";
    else if (ack === 2 || ack === "DELIVERY_ACK") newStatus = "delivered";
    else if (ack === 1 || ack === "SERVER_ACK") newStatus = "delivered";

    if (keyId) {
      const { data: msgRows } = await adminClient
        .from("whatsapp_messages").select("id, status, conversation_id, direction")
        .contains("content_raw", { key: { id: keyId } }).limit(1);

      if (msgRows && msgRows.length > 0) {
        const msg = msgRows[0];
        const statusOrder: Record<string, number> = { pending: 0, sending: 1, sent: 2, delivered: 3, read: 4 };
        if ((statusOrder[newStatus] ?? 0) > (statusOrder[msg.status] ?? 0)) {
          await adminClient.from("whatsapp_messages").update({ status: newStatus }).eq("id", msg.id);
          updatedCount++;
          if (newStatus === "read" && msg.direction === "inbound" && msg.conversation_id) {
            recalculatedConvIds.add(msg.conversation_id);
          }
        }
      }
    }

    if (newStatus === "read" && remoteJid && remoteJid !== "status@broadcast") {
      const isGroup = remoteJid.endsWith("@g.us");
      const contactId = isGroup ? remoteJid : remoteJid.replace(/@.*/, "");
      const variants = isGroup ? [contactId] : numberVariants(contactId);

      const { data: convRows } = await adminClient
        .from("whatsapp_conversations").select("id, unread_count")
        .eq("user_id", userId).in("external_contact_id", variants).limit(1);

      if (convRows && convRows.length > 0 && !recalculatedConvIds.has(convRows[0].id)) {
        recalculatedConvIds.add(convRows[0].id);
      }
    }
  }

  for (const convId of recalculatedConvIds) {
    const { count } = await adminClient
      .from("whatsapp_messages").select("id", { count: "exact", head: true })
      .eq("conversation_id", convId).eq("direction", "inbound").neq("status", "read");

    await adminClient.from("whatsapp_conversations").update({ unread_count: count ?? 0 }).eq("id", convId);

    if ((count ?? 0) === 0) {
      await adminClient.from("whatsapp_messages").update({ status: "read" })
        .eq("conversation_id", convId).eq("direction", "inbound").neq("status", "read");
    }
  }

  return { data: { ok: true, event: "messages.update", updatedCount, recalculated: recalculatedConvIds.size }, status: 200 };
}

// ── groups.upsert handler ──
async function handleGroupsUpsert(
  data: Record<string, unknown>,
  userId: string,
  deps: WebhookDeps,
) {
  const { adminClient } = deps;
  const groups = Array.isArray(data) ? data : [data];
  let updatedCount = 0;

  for (const group of groups) {
    const groupId = (group as any).id ?? (group as any).jid ?? "";
    const subject = (group as any).subject ?? (group as any).name ?? "";
    if (!groupId || !subject) continue;

    const contactId = groupId.endsWith("@g.us") ? groupId : `${groupId}@g.us`;
    const { data: conv } = await adminClient
      .from("whatsapp_conversations").select("id")
      .eq("user_id", userId).eq("external_contact_id", contactId).maybeSingle();

    if (conv) {
      await adminClient.from("whatsapp_conversations").update({ title: subject }).eq("id", conv.id);
      updatedCount++;
    }
  }

  return { data: { ok: true, event: "groups.upsert", updatedCount }, status: 200 };
}

// ── presence.update handler ──
async function handlePresenceUpdate(
  data: Record<string, unknown>,
  userId: string,
  deps: WebhookDeps,
) {
  const { adminClient } = deps;
  const participantJid = (data.id as string) ?? (data.participant as string) ?? "";
  const presenceStatus = (data.presence as string) ?? (data.status as string) ?? "unavailable";
  const lastSeen = data.lastSeen as number | undefined;

  if (participantJid) {
    const contactId = participantJid.replace(/@.*/, "");
    await adminClient.from("whatsapp_presence").upsert({
      user_id: userId, contact_jid: contactId,
      status: presenceStatus === "composing" ? "typing" : presenceStatus === "available" ? "online" : "unavailable",
      last_seen_at: lastSeen ? new Date(lastSeen * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,contact_jid" });
  }
  return { data: { ok: true, event: "presence.update" }, status: 200 };
}

// ── messages.delete handler ──
async function handleMessagesDelete(
  data: Record<string, unknown>,
  deps: WebhookDeps,
) {
  const { adminClient } = deps;
  const keyId = ((data.key as Record<string, unknown>)?.id as string) ?? "";
  if (keyId) {
    const { data: msgRows } = await adminClient
      .from("whatsapp_messages").select("id")
      .contains("content_raw", { key: { id: keyId } }).limit(1);
    if (msgRows && msgRows.length > 0) {
      await adminClient.from("whatsapp_messages")
        .update({ deleted_for_everyone: true, content_text: "🚫 Mensagem apagada" })
        .eq("id", msgRows[0].id);
    }
  }
  return { data: { ok: true, event: "messages.delete" }, status: 200 };
}

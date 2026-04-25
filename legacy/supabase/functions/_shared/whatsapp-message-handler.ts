/**
 * @module whatsapp-message-handler
 * @description Message send/receive/reaction/delete/star/forward handlers
 */
import { callEvolution, type WaContext } from "./whatsapp-evolution.ts";
import { normalizeBrazilianNumber, numberVariants } from "./whatsapp-utils.ts";

export async function handleSendText(ctx: WaContext, body: Record<string, unknown>) {
  const { to, text } = body as { to?: string; text?: string };
  if (!to || !text) return { data: { error: "to e text são obrigatórios" }, status: 400 };

  const isGroupSend = (to as string).includes("@g.us");
  const number = isGroupSend ? to : normalizeBrazilianNumber((to as string).replace(/\D/g, "").replace(/@c\.us$/, ""));

  const { ok, data: gwData } = await callEvolution(ctx.apiKey, `/message/sendText/${ctx.instance}`, "POST", { number, text });

  if (!ok) {
    const gwArr = Array.isArray((gwData as any)?.message) ? (gwData as any).message : [];
    const notExists = gwArr.some((m: any) => m?.exists === false);
    if (notExists) {
      return {
        data: { error: "Número não encontrado no WhatsApp", detail: `O número ${number} não possui conta no WhatsApp. Verifique se o número está correto e inclui o código do país (ex: 55) e DDD.`, code: "NUMBER_NOT_FOUND" },
        status: 422,
      };
    }
    return { data: { error: "Falha ao enviar mensagem", detail: gwData }, status: 502 };
  }

  try {
    const variants = isGroupSend ? [number] : numberVariants(number as string);
    const { data: convRows } = await ctx.adminClient
      .from("whatsapp_conversations").select("id")
      .eq("user_id", ctx.userId).in("external_contact_id", variants)
      .order("last_message_at", { ascending: false }).limit(1);
    const convRow = convRows?.[0] ?? null;

    let convId = convRow?.id;
    if (!convId) {
      const { data: newConv } = await ctx.adminClient.from("whatsapp_conversations")
        .insert({ user_id: ctx.userId, channel: "whatsapp_web", external_contact_id: number, title: number, last_message_at: new Date().toISOString(), unread_count: 0 })
        .select("id").single();
      convId = newConv?.id;
    } else {
      await ctx.adminClient.from("whatsapp_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convId);
    }

    if (convId) {
      await ctx.adminClient.from("whatsapp_messages").insert({
        conversation_id: convId, direction: "outbound", type: "text",
        content_text: text, content_raw: gwData ?? {}, sent_at: new Date().toISOString(), status: "sent",
      });
    }
  } catch (persistErr) {
    console.error("[messages] Error persisting:", persistErr);
  }

  return { data: { ok: true, detail: gwData }, status: 200 };
}

export async function handleSendMedia(ctx: WaContext, body: Record<string, unknown>) {
  const { to, media, mediatype, mimetype, fileName, caption } = body as {
    to?: string; media?: string; mediatype?: string; mimetype?: string; fileName?: string; caption?: string;
  };
  if (!to || !media || !mediatype || !mimetype) {
    return { data: { error: "to, media, mediatype e mimetype são obrigatórios" }, status: 400 };
  }

  const isGroupMedia = (to as string).includes("@g.us");
  const number = isGroupMedia ? to : normalizeBrazilianNumber((to as string).replace(/\D/g, ""));

  let mediaValue = media as string;
  if (mediaValue.startsWith("data:")) {
    const commaIdx = mediaValue.indexOf(",");
    if (commaIdx !== -1) mediaValue = mediaValue.substring(commaIdx + 1);
  }

  const { ok, data: gwData } = await callEvolution(ctx.apiKey, `/message/sendMedia/${ctx.instance}`, "POST", {
    number, media: mediaValue, mediatype, mimetype, fileName: fileName ?? "file", caption: caption ?? "",
  });

  if (!ok) return { data: { error: "Falha ao enviar mídia", detail: gwData }, status: 502 };

  try {
    const variants = isGroupMedia ? [number] : numberVariants(number as string);
    const { data: convRows } = await ctx.adminClient
      .from("whatsapp_conversations").select("id")
      .eq("user_id", ctx.userId).in("external_contact_id", variants)
      .order("last_message_at", { ascending: false }).limit(1);

    let convId = convRows?.[0]?.id;
    if (!convId) {
      const { data: newConv } = await ctx.adminClient.from("whatsapp_conversations")
        .insert({ user_id: ctx.userId, channel: "whatsapp_web", external_contact_id: number, title: number, last_message_at: new Date().toISOString(), unread_count: 0 })
        .select("id").single();
      convId = newConv?.id;
    } else {
      await ctx.adminClient.from("whatsapp_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convId);
    }

    if (convId) {
      let dbType = "document";
      if (mediatype === "image") dbType = "image";
      else if (mediatype === "video") dbType = "video";
      else if (mediatype === "audio") dbType = "audio";

      await ctx.adminClient.from("whatsapp_messages").insert({
        conversation_id: convId, direction: "outbound", type: dbType,
        content_text: caption || null, content_raw: gwData ?? {}, sent_at: new Date().toISOString(), status: "sent",
      });
    }
  } catch (persistErr) {
    console.error("[send-media] Error persisting:", persistErr);
  }

  return { data: { ok: true, detail: gwData }, status: 200 };
}

export async function handleMediaDownload(ctx: WaContext, body: Record<string, unknown>) {
  const { messageId } = body as { messageId?: string };
  if (!messageId) return { data: { error: "messageId é obrigatório" }, status: 400 };

  const { data: msgRow, error: msgErr } = await ctx.adminClient
    .from("whatsapp_messages").select("content_raw").eq("id", messageId).maybeSingle();
  if (msgErr || !msgRow) return { data: { error: "Mensagem não encontrada" }, status: 404 };

  const key = (msgRow.content_raw as any)?.key;
  if (!key) return { data: { error: "Mensagem sem key para download" }, status: 400 };

  try {
    const { ok, data: mediaData } = await callEvolution(ctx.apiKey, `/chat/getBase64FromMediaMessage/${ctx.instance}`, "POST", { message: { key }, convertToMp4: false });
    if (!ok) return { data: { error: "Falha ao baixar mídia", detail: mediaData }, status: 502 };
    return { data: { ok: true, data: mediaData }, status: 200 };
  } catch (e) {
    return { data: { error: e instanceof Error ? e.message : String(e) }, status: 500 };
  }
}

export async function handleMarkRead(ctx: WaContext, body: Record<string, unknown>) {
  const { conversationId } = body as { conversationId?: string };
  if (!conversationId) return { data: { error: "conversationId é obrigatório" }, status: 400 };

  try {
    const { data: conv } = await ctx.adminClient
      .from("whatsapp_conversations").select("external_contact_id")
      .eq("id", conversationId).eq("user_id", ctx.userId).single();
    if (!conv) return { data: { error: "Conversa não encontrada" }, status: 404 };

    const { data: unreadMsgs } = await ctx.adminClient
      .from("whatsapp_messages").select("id, content_raw")
      .eq("conversation_id", conversationId).eq("direction", "inbound").neq("status", "read")
      .order("sent_at", { ascending: false }).limit(50);

    if (!unreadMsgs || unreadMsgs.length === 0) return { data: { ok: true, marked: 0 }, status: 200 };

    const isGroupConv = conv.external_contact_id.endsWith("@g.us");
    const remoteJid = isGroupConv ? conv.external_contact_id : `${normalizeBrazilianNumber(conv.external_contact_id)}@s.whatsapp.net`;
    const readMessages: { remoteJid: string; fromMe: boolean; id: string }[] = [];

    for (const msg of unreadMsgs) {
      const keyId = (msg.content_raw as any)?.key?.id;
      if (keyId) readMessages.push({ remoteJid, fromMe: false, id: keyId });
    }

    if (readMessages.length > 0) {
      await callEvolution(ctx.apiKey, `/chat/markMessageAsRead/${ctx.instance}`, "POST", { readMessages });
    }

    const msgIds = unreadMsgs.map(m => m.id);
    await ctx.adminClient.from("whatsapp_messages").update({ status: "read" }).in("id", msgIds);

    return { data: { ok: true, marked: msgIds.length }, status: 200 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[mark-read] Error:", msg);
    return { data: { error: msg }, status: 500 };
  }
}

export async function handleSendReaction(ctx: WaContext, body: Record<string, unknown>) {
  const { messageId, reaction } = body as { messageId?: string; reaction?: string };
  if (!messageId || !reaction) return { data: { error: "messageId and reaction required" }, status: 400 };

  const { data: msgRow } = await ctx.adminClient
    .from("whatsapp_messages").select("content_raw, conversation_id").eq("id", messageId).maybeSingle();
  if (!msgRow) return { data: { error: "Message not found" }, status: 404 };

  const key = (msgRow.content_raw as any)?.key;
  if (!key) return { data: { error: "Message has no key" }, status: 400 };

  const { ok, data: gwData } = await callEvolution(ctx.apiKey, `/message/sendReaction/${ctx.instance}`, "POST", { key, reaction });

  if (ok) {
    const currentReactions = (await ctx.adminClient.from("whatsapp_messages").select("reactions").eq("id", messageId).single()).data?.reactions ?? [];
    const updated = [...(currentReactions as any[]), { emoji: reaction, fromMe: true, timestamp: Date.now() }];
    await ctx.adminClient.from("whatsapp_messages").update({ reactions: updated }).eq("id", messageId);
  }

  return { data: { ok, detail: gwData }, status: 200 };
}

export async function handleDeleteMessage(ctx: WaContext, body: Record<string, unknown>) {
  const { messageId } = body as { messageId?: string };
  if (!messageId) return { data: { error: "messageId required" }, status: 400 };

  const { data: msgRow } = await ctx.adminClient
    .from("whatsapp_messages").select("content_raw").eq("id", messageId).maybeSingle();
  if (!msgRow) return { data: { error: "Message not found" }, status: 404 };

  const key = (msgRow.content_raw as any)?.key;
  if (!key) return { data: { error: "Message has no key" }, status: 400 };

  const { ok, data: gwData } = await callEvolution(ctx.apiKey, `/chat/deleteMessageForEveryone/${ctx.instance}`, "DELETE", {
    id: key.remoteJid, fromMe: key.fromMe, participant: key.participant, message: { key },
  });

  await ctx.adminClient.from("whatsapp_messages")
    .update({ deleted_for_everyone: true, content_text: "🚫 Mensagem apagada" }).eq("id", messageId);

  return { data: { ok, detail: gwData }, status: 200 };
}

export async function handleStarMessage(ctx: WaContext, body: Record<string, unknown>) {
  const { messageId, starred } = body as { messageId?: string; starred?: boolean };
  if (!messageId) return { data: { error: "messageId required" }, status: 400 };

  await ctx.adminClient.from("whatsapp_messages").update({ starred: starred ?? true }).eq("id", messageId);

  const { data: msgRow } = await ctx.adminClient
    .from("whatsapp_messages").select("content_raw").eq("id", messageId).maybeSingle();
  if (msgRow) {
    const key = (msgRow.content_raw as any)?.key;
    if (key) {
      await callEvolution(ctx.apiKey, `/chat/starMessage/${ctx.instance}`, "POST", { keys: [key], star: starred ?? true }).catch(() => {});
    }
  }

  return { data: { ok: true }, status: 200 };
}

export async function handleForwardMessage(ctx: WaContext, body: Record<string, unknown>) {
  const { messageId, toContactId } = body as { messageId?: string; toContactId?: string };
  if (!messageId || !toContactId) return { data: { error: "messageId and toContactId required" }, status: 400 };

  const { data: msgRow } = await ctx.adminClient
    .from("whatsapp_messages").select("content_text, content_raw").eq("id", messageId).maybeSingle();
  if (!msgRow) return { data: { error: "Message not found" }, status: 404 };

  const isGroupTarget = (toContactId as string).includes("@g.us");
  const number = isGroupTarget ? toContactId : normalizeBrazilianNumber((toContactId as string).replace(/\D/g, ""));
  const text = msgRow.content_text || "";

  const raw = msgRow.content_raw as any;
  const msgKey = raw?.key;
  let ok = false;
  let gwData: any = {};

  if (msgKey) {
    const fwdRes = await callEvolution(ctx.apiKey, `/chat/forwardMessage/${ctx.instance}`, "POST", {
      number: isGroupTarget ? toContactId : `${number}@s.whatsapp.net`, message: { key: msgKey },
    });
    ok = fwdRes.ok;
    gwData = fwdRes.data;

    if (!ok && text) {
      const fallback = await callEvolution(ctx.apiKey, `/message/sendText/${ctx.instance}`, "POST", { number, text: `↩️ ${text}` });
      ok = fallback.ok;
      gwData = fallback.data;
    }
  } else if (text) {
    const fwdRes = await callEvolution(ctx.apiKey, `/message/sendText/${ctx.instance}`, "POST", { number, text: `↩️ ${text}` });
    ok = fwdRes.ok;
    gwData = fwdRes.data;
  }

  return { data: { ok, detail: gwData }, status: 200 };
}

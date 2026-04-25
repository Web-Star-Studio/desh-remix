/**
 * @module whatsapp-contact-handler
 * @description Contact enrichment, profile picture, presence handlers
 */
import { callEvolution, type WaContext } from "./whatsapp-evolution.ts";
import { normalizeBrazilianNumber, numberVariants } from "./whatsapp-utils.ts";

export async function handleFetchProfilePicture(ctx: WaContext, body: Record<string, unknown>) {
  try {
    const contactId = (body.contactId as string) ?? "";
    if (!contactId) return { data: { error: "contactId required" }, status: 400 };

    const jid = contactId.includes("@") ? contactId : `${contactId}@s.whatsapp.net`;
    const picRes = await callEvolution(ctx.apiKey, `/chat/fetchProfilePictureUrl/${ctx.instance}`, "POST", { number: jid });

    const profilePictureUrl = (picRes.data as any)?.profilePictureUrl || null;

    if (profilePictureUrl) {
      await ctx.adminClient.from("whatsapp_conversations")
        .update({ profile_picture_url: profilePictureUrl })
        .eq("user_id", ctx.userId).eq("external_contact_id", contactId);
    }

    return { data: { ok: true, profilePictureUrl }, status: 200 };
  } catch (e) {
    return { data: { error: e instanceof Error ? e.message : String(e) }, status: 500 };
  }
}

export async function handleEnrichContacts(ctx: WaContext) {
  const TIMEOUT_MS = 50_000;
  const startTime = Date.now();
  try {
    const { data: convos } = await ctx.adminClient
      .from("whatsapp_conversations").select("id, external_contact_id, title, profile_picture_url")
      .eq("user_id", ctx.userId).order("last_message_at", { ascending: false }).limit(500);

    if (!convos || convos.length === 0) return { data: { ok: true, enriched: 0, reason: "no conversations" }, status: 200 };

    const needsEnrichment = convos.filter((c: any) => {
      const extId = c.external_contact_id as string;
      if (extId.endsWith("@g.us")) return !c.profile_picture_url;
      const title = (c.title as string) ?? "";
      const isPhoneTitle = /^\+?\d[\d\s\-().]*$/.test(title.trim()) || title === extId || !title;
      return !c.profile_picture_url || isPhoneTitle;
    });

    if (needsEnrichment.length === 0) return { data: { ok: true, enriched: 0, reason: "all contacts already enriched" }, status: 200 };

    let contactsMap = new Map<string, { name?: string; profilePictureUrl?: string }>();
    try {
      const contactsRes = await callEvolution(ctx.apiKey, `/chat/findContacts/${ctx.instance}`, "POST", { where: {} });
      if (contactsRes.ok && Array.isArray(contactsRes.data)) {
        for (const contact of contactsRes.data as any[]) {
          const id = (contact.id as string) ?? (contact.remoteJid as string) ?? "";
          const phone = id.replace(/@.*/, "");
          if (!phone) continue;
          const name = contact.pushName || contact.name || contact.verifiedName || contact.notify || null;
          const pic = contact.profilePictureUrl || null;
          if (name || pic) {
            const entry = { name: name || undefined, profilePictureUrl: pic || undefined };
            for (const v of numberVariants(phone)) contactsMap.set(v, entry);
          }
        }
      }
    } catch (e) {
      console.error("[enrich-contacts] findContacts error:", e);
    }

    let enrichedCount = 0;
    for (const conv of needsEnrichment) {
      if (Date.now() - startTime > TIMEOUT_MS) break;

      const extId = conv.external_contact_id as string;
      const isGroup = extId.endsWith("@g.us");
      const updateData: Record<string, unknown> = {};

      const extPhone = extId.replace(/@.*/, "");
      const variants = isGroup ? [extId] : numberVariants(extPhone);
      let contactInfo: { name?: string; profilePictureUrl?: string } | undefined;
      for (const v of variants) { contactInfo = contactsMap.get(v); if (contactInfo) break; }

      if (!isGroup && contactInfo?.name) {
        const currentTitle = (conv.title as string) ?? "";
        const isPhoneTitle = /^\+?\d[\d\s\-().]*$/.test(currentTitle.trim()) || currentTitle === extId || !currentTitle;
        if (isPhoneTitle) updateData.title = contactInfo.name;
      }

      if (!conv.profile_picture_url) {
        let picUrl = contactInfo?.profilePictureUrl || null;
        if (!picUrl) {
          try {
            const jid = isGroup ? extId : `${extId}@s.whatsapp.net`;
            const picRes = await callEvolution(ctx.apiKey, `/chat/fetchProfilePictureUrl/${ctx.instance}`, "POST", { number: jid });
            if (picRes.ok) picUrl = (picRes.data as any)?.profilePictureUrl || null;
          } catch {}
        }
        if (picUrl) updateData.profile_picture_url = picUrl;
      }

      const groupTitle = (conv.title as string) ?? "";
      const groupTitleIsJid = isGroup && (!groupTitle || groupTitle.includes("@g.us") || /^\d+[-@]/.test(groupTitle));
      if (isGroup && groupTitleIsJid) {
        try {
          const groupRes = await callEvolution(ctx.apiKey, `/group/findGroupInfos/${ctx.instance}?groupJid=${extId}`);
          if (groupRes.ok && groupRes.data) {
            const gData = Array.isArray(groupRes.data) ? groupRes.data[0] : groupRes.data;
            const subject = (gData as any)?.subject || (gData as any)?.name;
            if (subject) updateData.title = subject;
          }
        } catch {}
      }

      if (Object.keys(updateData).length > 0) {
        await ctx.adminClient.from("whatsapp_conversations").update(updateData).eq("id", conv.id);
        enrichedCount++;
      }
    }

    if (enrichedCount > 0) {
      try {
        const { data: enrichedConvos } = await ctx.adminClient
          .from("whatsapp_conversations").select("external_contact_id, title, profile_picture_url")
          .eq("user_id", ctx.userId).not("profile_picture_url", "is", null);

        if (enrichedConvos) {
          for (const ec of enrichedConvos) {
            const extId = ec.external_contact_id as string;
            if (extId.endsWith("@g.us")) continue;
            const pic = ec.profile_picture_url as string;
            if (pic) {
              await ctx.adminClient.from("contacts").update({ avatar_url: pic })
                .eq("user_id", ctx.userId).ilike("phone", `%${extId.slice(-8)}%`).is("avatar_url", null);
            }
          }
        }
      } catch {}
    }

    return { data: { ok: true, enriched: enrichedCount, total: needsEnrichment.length }, status: 200 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[enrich-contacts] Error:", msg);
    return { data: { error: msg }, status: 500 };
  }
}

export async function handleFindPresence(ctx: WaContext, body: Record<string, unknown>) {
  const { contactId } = body as { contactId?: string };
  if (!contactId) return { data: { error: "contactId required" }, status: 400 };

  const jid = contactId.includes("@") ? contactId : `${contactId}@s.whatsapp.net`;
  const { ok, data: gwData } = await callEvolution(ctx.apiKey, `/chat/findPresence/${ctx.instance}`, "POST", { number: jid });
  return { data: { ok, data: gwData }, status: 200 };
}

export async function handleFindContactInfo(ctx: WaContext, body: Record<string, unknown>) {
  const { contactId } = body as { contactId?: string };
  if (!contactId) return { data: { error: "contactId required" }, status: 400 };

  const jid = contactId.includes("@") ? contactId : `${contactId}@s.whatsapp.net`;
  const { ok, data: gwData } = await callEvolution(ctx.apiKey, `/chat/findContacts/${ctx.instance}`, "POST", { where: { id: jid } });
  return { data: { ok, data: gwData }, status: 200 };
}

export async function handleUpdatePresence(ctx: WaContext, body: Record<string, unknown>) {
  const { contactId, presence } = body as { contactId?: string; presence?: string };
  if (!contactId) return { data: { error: "contactId required" }, status: 400 };

  const jid = contactId.includes("@") ? contactId : `${contactId}@s.whatsapp.net`;
  const { ok, data: gwData } = await callEvolution(ctx.apiKey, `/chat/updatePresence/${ctx.instance}`, "POST", { number: jid, presence: presence || "composing" });
  return { data: { ok, data: gwData }, status: 200 };
}

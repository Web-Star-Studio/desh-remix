/**
 * @module whatsapp-session-handler
 * @description Session/instance management handlers
 */
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { callEvolution, upsertSession, type WaContext } from "./whatsapp-evolution.ts";
import { mapEvolutionState, extractQrCode } from "./whatsapp-utils.ts";

export async function handleInstanceCreate(ctx: WaContext) {
  try {
    const instanceToken = Deno.env.get("EVOLUTION_INSTANCE_TOKEN") ?? "";
    const { ok, status, data: gwData } = await callEvolution(ctx.apiKey, "/instance/create", "POST", {
      instanceName: ctx.instance,
      token: instanceToken,
      integration: "WHATSAPP-BAILEYS",
      webhook: {
        url: `${ctx.supabaseUrl}/functions/v1/whatsapp-web-proxy/webhook`,
        webhook_by_events: false, webhook_base64: false,
        events: ["QRCODE_UPDATED","CONNECTION_UPDATE","MESSAGES_UPSERT","MESSAGES_UPDATE","MESSAGES_DELETE","SEND_MESSAGE"],
        headers: { apikey: ctx.apiKey },
      },
    });

    if (!ok) {
      const errData = gwData as Record<string, unknown>;
      const alreadyExists = JSON.stringify(errData).toLowerCase().includes("already");
      if (!alreadyExists) return { data: { error: "Falha ao criar instância", detail: gwData }, status };
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
    const connectRes = await callEvolution(ctx.apiKey, `/instance/connect/${ctx.instance}`);
    const qrCode = extractQrCode(connectRes.data as Record<string, unknown>);

    await upsertSession(ctx, ctx.instance, "QR_PENDING", { last_qr_code: qrCode ?? null, last_error: null });

    return { data: { ok: true, instanceName: ctx.instance, created: ok, qrCode, connectDetail: connectRes.data }, status: 200 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[instance-create] Error:", msg);
    return { data: { error: msg }, status: 500 };
  }
}

export async function handleInstanceDelete(ctx: WaContext) {
  try {
    const { ok, status, data: gwData } = await callEvolution(ctx.apiKey, `/instance/delete/${ctx.instance}`, "DELETE");
    await ctx.adminClient.from("whatsapp_web_sessions").delete().eq("session_id", ctx.instance);
    return { data: { ok: true, apiOk: ok, status, detail: gwData }, status: 200 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[instance-delete] Error:", msg);
    return { data: { error: msg }, status: 500 };
  }
}

export async function handleRestart(ctx: WaContext) {
  try {
    await callEvolution(ctx.apiKey, `/instance/restart/${ctx.instance}`, "PUT");
    await new Promise(resolve => setTimeout(resolve, 2000));
    const connectRes = await callEvolution(ctx.apiKey, `/instance/connect/${ctx.instance}`);
    const qrCode = extractQrCode(connectRes.data as Record<string, unknown>);

    await upsertSession(ctx, ctx.instance, "QR_PENDING", { last_qr_code: qrCode ?? null });

    return { data: { ok: true, qrCode, detail: connectRes.data }, status: 200 };
  } catch (e) {
    return { data: { error: e instanceof Error ? e.message : String(e) }, status: 500 };
  }
}

export async function handleQr(ctx: WaContext) {
  try {
    const { ok: stateOk, data: stateData } = await callEvolution(ctx.apiKey, `/instance/connectionState/${ctx.instance}`);

    if (stateOk && stateData) {
      const s = stateData as Record<string, unknown>;
      const instanceState = (s.instance as Record<string, unknown>)?.state as string ?? s.state as string ?? "close";
      const mappedStatus = mapEvolutionState(instanceState);

      if (mappedStatus === "CONNECTED") {
        await upsertSession(ctx, ctx.instance, "CONNECTED", { last_connected_at: new Date().toISOString() });
        return { data: { status: "CONNECTED", qrCode: null }, status: 200 };
      }
    }

    const { ok, data: gwData } = await callEvolution(ctx.apiKey, `/instance/connect/${ctx.instance}`);

    if (!ok) return { data: { status: "QR_PENDING", qrCode: null, error: "Evolution API indisponível" }, status: 200 };

    const gw = gwData as Record<string, unknown>;
    const qrCode = extractQrCode(gw);
    const pairingCode = (gw.pairingCode as string) ?? null;

    if (qrCode) {
      upsertSession(ctx, ctx.instance, "QR_PENDING", { last_qr_code: qrCode });
    } else {
      const { data: dbSession } = await ctx.adminClient
        .from("whatsapp_web_sessions").select("last_qr_code, status")
        .eq("session_id", ctx.instance).maybeSingle();

      if (dbSession?.last_qr_code) {
        return { data: { status: "QR_PENDING", qrCode: dbSession.last_qr_code, pairingCode, source: "db" }, status: 200 };
      }
    }

    return { data: { status: "QR_PENDING", qrCode, pairingCode }, status: 200 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[/qr] Error:", msg);
    return { data: { status: "QR_PENDING", qrCode: null, error: msg }, status: 200 };
  }
}

export async function handleStatus(ctx: WaContext) {
  try {
    const { ok, data: gwData } = await callEvolution(ctx.apiKey, `/instance/connectionState/${ctx.instance}`);
    if (!ok) return { data: { status: "DISCONNECTED", error: "Evolution API indisponível" }, status: 200 };

    const s = gwData as Record<string, unknown>;
    const instanceState = (s.instance as Record<string, unknown>)?.state as string ?? s.state as string ?? "close";
    const mappedStatus = mapEvolutionState(instanceState);

    const extra: Record<string, unknown> = {};
    if (mappedStatus === "CONNECTED") extra.last_connected_at = new Date().toISOString();
    upsertSession(ctx, ctx.instance, mappedStatus, extra);

    return { data: { status: mappedStatus }, status: 200 };
  } catch (e) {
    return { data: { status: "DISCONNECTED", error: e instanceof Error ? e.message : String(e) }, status: 200 };
  }
}

export async function handleSessionCreate(ctx: WaContext) {
  try {
    const { ok: stateOk, data: stateData } = await callEvolution(ctx.apiKey, `/instance/connectionState/${ctx.instance}`);

    if (stateOk) {
      const s = stateData as Record<string, unknown>;
      const instanceState = (s.instance as Record<string, unknown>)?.state as string ?? s.state as string ?? "close";
      if (instanceState === "open") {
        await upsertSession(ctx, ctx.instance, "CONNECTED", { last_connected_at: new Date().toISOString() });
        return { data: { sessionId: ctx.instance, status: "CONNECTED" }, status: 200 };
      }
    }

    const stateStatus = (stateData as any)?.status;
    if (!stateOk && (stateStatus === 404 || stateStatus === 400)) {
      const instanceToken = Deno.env.get("EVOLUTION_INSTANCE_TOKEN") ?? "";
      await callEvolution(ctx.apiKey, "/instance/create", "POST", {
        instanceName: ctx.instance, token: instanceToken, integration: "WHATSAPP-BAILEYS",
        webhook: {
          url: `${ctx.supabaseUrl}/functions/v1/whatsapp-web-proxy/webhook`,
          webhook_by_events: false, webhook_base64: false,
          events: ["QRCODE_UPDATED","CONNECTION_UPDATE","MESSAGES_UPSERT","MESSAGES_UPDATE","MESSAGES_DELETE","SEND_MESSAGE","GROUPS_UPSERT","PRESENCE_UPDATE"],
          headers: { apikey: ctx.apiKey },
        },
      });
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    const { data: connectData } = await callEvolution(ctx.apiKey, `/instance/connect/${ctx.instance}`);
    const qrCode = extractQrCode(connectData as Record<string, unknown>);
    await upsertSession(ctx, ctx.instance, "QR_PENDING", { last_qr_code: qrCode ?? null, last_error: null });

    return { data: { sessionId: ctx.instance, status: "QR_PENDING", qrCode }, status: 200 };
  } catch (e) {
    return { data: { error: e instanceof Error ? e.message : String(e) }, status: 500 };
  }
}

export async function handleSessionDelete(ctx: WaContext) {
  try {
    const logoutRes = await callEvolution(ctx.apiKey, `/instance/logout/${ctx.instance}`, "DELETE");
    await ctx.adminClient.from("whatsapp_web_sessions")
      .update({ status: "DISCONNECTED", last_qr_code: null, last_error: null, updated_at: new Date().toISOString() })
      .eq("user_id", ctx.userId).eq("session_id", ctx.instance);
    return { data: { ok: true, logoutOk: logoutRes.ok }, status: 200 };
  } catch (e) {
    console.error("[disconnect] Error:", e instanceof Error ? e.message : String(e));
    await ctx.adminClient.from("whatsapp_web_sessions")
      .update({ status: "DISCONNECTED", last_qr_code: null, updated_at: new Date().toISOString() })
      .eq("user_id", ctx.userId).eq("session_id", ctx.instance);
    return { data: { ok: true, logoutOk: false }, status: 200 };
  }
}

export async function handleWebhookSetup(ctx: WaContext) {
  const webhookUrl = `${ctx.supabaseUrl}/functions/v1/whatsapp-web-proxy/webhook`;
  const { ok, data: gwData } = await callEvolution(ctx.apiKey, `/webhook/set/${ctx.instance}`, "POST", {
    webhook: {
      url: webhookUrl, webhook_by_events: false, webhook_base64: false,
      headers: { apikey: ctx.apiKey },
      events: ["QRCODE_UPDATED","CONNECTION_UPDATE","MESSAGES_UPSERT","MESSAGES_UPDATE","MESSAGES_DELETE","SEND_MESSAGE","GROUPS_UPSERT","PRESENCE_UPDATE"],
    },
  });
  return { data: { ok, webhookUrl, detail: gwData }, status: 200 };
}

export async function handleWebhookStatus(ctx: WaContext) {
  const { ok, status, data: gwData } = await callEvolution(ctx.apiKey, `/webhook/find/${ctx.instance}`);
  return { data: { ok, status, data: gwData }, status: 200 };
}

export async function handleQrRaw(ctx: WaContext) {
  const stateRes = await callEvolution(ctx.apiKey, `/instance/connectionState/${ctx.instance}`);
  const connectRes = await callEvolution(ctx.apiKey, `/instance/connect/${ctx.instance}`);
  return { data: { state: stateRes, connect: connectRes }, status: 200 };
}

export async function handleDebugAuth(ctx: WaContext) {
  const [stateRes, connectRes, webhookRes] = await Promise.all([
    callEvolution(ctx.apiKey, `/instance/connectionState/${ctx.instance}`),
    callEvolution(ctx.apiKey, `/instance/connect/${ctx.instance}`),
    callEvolution(ctx.apiKey, `/webhook/find/${ctx.instance}`),
  ]);

  const { data: dbSession } = await ctx.adminClient
    .from("whatsapp_web_sessions")
    .select("session_id, status, last_qr_code, last_error, updated_at")
    .eq("session_id", ctx.instance).maybeSingle();

  const parsedQr = extractQrCode(connectRes.data as Record<string, unknown>);

  return {
    data: {
      timestamp: new Date().toISOString(), instance: ctx.instance,
      evolution: {
        connectionState: { ok: stateRes.ok, status: stateRes.status, data: stateRes.data },
        connect: { ok: connectRes.ok, status: connectRes.status, data: connectRes.data },
        webhookConfig: { ok: webhookRes.ok, status: webhookRes.status, data: webhookRes.data },
      },
      parsed: { qrCodeExtracted: parsedQr ? `${parsedQr.substring(0, 60)}... (${parsedQr.length} chars)` : null },
      database: dbSession ?? null,
    },
    status: 200,
  };
}

export async function handleHealthCheck(
  adminClient: ReturnType<typeof createClient>,
  apiKey: string,
) {
  const { data: staleSessions } = await adminClient
    .from("whatsapp_web_sessions")
    .select("session_id, user_id, status, updated_at")
    .in("status", ["CONNECTED"])
    .lt("updated_at", new Date(Date.now() - 5 * 60_000).toISOString());

  const results: Array<{ session: string; action: string; result: string }> = [];

  if (staleSessions && staleSessions.length > 0) {
    for (const sess of staleSessions) {
      const sid = sess.session_id as string;
      try {
        const statusRes = await callEvolution(apiKey, `/instance/connectionState/${sid}`);
        const state = (statusRes.data as any)?.instance?.state ?? (statusRes.data as any)?.state ?? "close";
        const mapped = mapEvolutionState(state);

        if (mapped === "CONNECTED") {
          await adminClient.from("whatsapp_web_sessions").update({ updated_at: new Date().toISOString() }).eq("session_id", sid);
          results.push({ session: sid, action: "heartbeat_refreshed", result: "ok" });
        } else {
          const connectRes = await callEvolution(apiKey, `/instance/connect/${sid}`, "GET");
          const qr = extractQrCode(connectRes.data as Record<string, unknown>);
          await adminClient.from("whatsapp_web_sessions").update({
            status: qr ? "QR_PENDING" : "DISCONNECTED", last_qr_code: qr ?? null, updated_at: new Date().toISOString(),
          }).eq("session_id", sid);
          results.push({ session: sid, action: "reconnect_attempted", result: qr ? "qr_pending" : "disconnected" });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[health-check] Error for ${sid}:`, msg);
        results.push({ session: sid, action: "error", result: msg });
      }
    }
  }

  // Auto-expire stale sync jobs
  let expiredJobs = 0;
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
  const twoHoursAgo = new Date(Date.now() - 7200_000).toISOString();
  const { data: staleZero } = await adminClient
    .from("whatsapp_sync_jobs")
    .update({ status: "failed", error_message: "Auto-expired: job stalled without progress", completed_at: new Date().toISOString(), current_chat: null })
    .in("status", ["pending", "running"]).lt("created_at", oneHourAgo).eq("chats_done", 0).select("id");
  expiredJobs += staleZero?.length ?? 0;
  const { data: staleOld } = await adminClient
    .from("whatsapp_sync_jobs")
    .update({ status: "failed", error_message: "Auto-expired: job exceeded maximum duration", completed_at: new Date().toISOString(), current_chat: null })
    .in("status", ["pending", "running"]).lt("created_at", twoHoursAgo).select("id");
  expiredJobs += staleOld?.length ?? 0;

  return { data: { ok: true, processed: results.length, results, expiredSyncJobs: expiredJobs }, status: 200 };
}

export async function handleDebugAdmin(
  req: Request,
  adminClient: ReturnType<typeof createClient>,
  apiKey: string,
  supabaseUrl: string,
  supabaseAnonKey: string,
) {
  const debugAuthHeader = req.headers.get("Authorization");
  if (!debugAuthHeader?.startsWith("Bearer ")) return { data: { error: "Unauthorized" }, status: 401 };

  const debugSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: debugAuthHeader } },
  });
  const debugToken = debugAuthHeader.replace("Bearer ", "");
  const { data: { user: debugUser }, error: debugAuthErr } = await debugSupabase.auth.getUser(debugToken);
  if (debugAuthErr || !debugUser) return { data: { error: "Unauthorized" }, status: 401 };

  const { data: isAdminData } = await adminClient.rpc("has_role", { _user_id: debugUser.id, _role: "admin" });
  if (!isAdminData) return { data: { error: "Forbidden: admin only" }, status: 403 };

  await adminClient.from("admin_logs").insert({
    user_id: debugUser.id, user_email: debugUser.email ?? null,
    action: "whatsapp_debug_access",
    details: { endpoint: "/debug", timestamp: new Date().toISOString() },
  });

  const fetchRes = await callEvolution(apiKey, `/instance/fetchInstances`);

  return {
    data: {
      timestamp: new Date().toISOString(),
      evolution: { fetchInstances: { ok: fetchRes.ok, status: fetchRes.status, data: fetchRes.data } },
    },
    status: 200,
  };
}

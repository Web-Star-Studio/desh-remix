import { corsHeaders, jsonResponse, errorResponse } from "./utils.ts";
import { getPluggyApiKey, buildServiceClient } from "./pluggy-utils.ts";

const friendlyMessages: Record<string, string> = {
  PAYMENT_INITIATION_NOT_ALLOWED: "Sua conta Pluggy não possui o recurso de Iniciação de Pagamentos habilitado. Entre em contato com a Pluggy para ativar.",
  RECIPIENT_NOT_FOUND: "Destinatário não encontrado na Pluggy.",
  INVALID_PAYMENT_AMOUNT: "Valor de pagamento inválido.",
  PAYMENT_REQUEST_ALREADY_COMPLETED: "Este pagamento já foi concluído.",
};

export async function handlePluggyPayments(body: Record<string, any>, userId: string) {
  const { action, ...params } = body;
  const apiKey = await getPluggyApiKey();
  const headers: Record<string, string> = { "X-API-KEY": apiKey, "Content-Type": "application/json" };
  const serviceSupabase = buildServiceClient();

  try {
    switch (action) {
      case "list_institutions": {
        const res = await fetch("https://api.pluggy.ai/payments/recipients/institutions", { headers });
        if (!res.ok) throw new Error(`Institutions fetch failed: ${res.status}`);
        const data = await res.json();
        return jsonResponse({ institutions: data.results || data });
      }
      case "list_connectors": {
        const res = await fetch("https://api.pluggy.ai/connectors?sandbox=false", { headers });
        if (!res.ok) throw new Error(`Connectors fetch failed: ${res.status}`);
        const data = await res.json();
        const connectors = (data.results || []).map((c: any) => ({
          id: c.id, name: c.name, imageUrl: c.imageUrl, country: c.country,
          products: c.products || [], supportsPaymentInitiation: c.supportsPaymentInitiation || false,
          supportsScheduledPayments: c.supportsScheduledPayments || false,
          supportsSmartTransfers: c.supportsSmartTransfers || false, health: c.health || {},
        }));
        return jsonResponse({ connectors });
      }
      case "create_recipient": {
        const { tax_number, name, institution_id, account, workspace_id } = params;
        if (!account?.branch || !account?.number) throw new Error("Agência e número da conta são obrigatórios.");
        if (!institution_id) throw new Error("Instituição financeira é obrigatória.");
        const payload: any = {
          taxNumber: (tax_number || "").replace(/\D/g, ""), name,
          paymentInstitutionId: institution_id,
          account: { branch: (account.branch || "").replace(/\D/g, ""), number: (account.number || "").replace(/\D/g, ""), type: account.type || "CHECKING_ACCOUNT" },
        };
        const res = await fetch("https://api.pluggy.ai/payments/recipients", { method: "POST", headers, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(`Create recipient failed (${res.status}): ${await res.text()}`);
        const recipient = await res.json();
        await serviceSupabase.from("financial_payment_recipients").upsert({
          user_id: userId, provider_recipient_id: recipient.id, name: recipient.name,
          tax_number: recipient.taxNumber, institution_name: recipient.paymentInstitution?.name || null,
          account_type: recipient.account?.type || null, account_branch: recipient.account?.branch || null,
          account_number: recipient.account?.number || null, pix_key: recipient.pixKey || null,
          ...(workspace_id ? { workspace_id } : {}),
        }, { onConflict: "user_id,provider_recipient_id" });
        return jsonResponse({ success: true, recipient });
      }
      case "create_recipient_qr": {
        const { qr_code, workspace_id } = params;
        const res = await fetch("https://api.pluggy.ai/payments/recipients/pix-qr", { method: "POST", headers, body: JSON.stringify({ pixQrCode: qr_code }) });
        if (!res.ok) throw new Error(`QR recipient failed (${res.status}): ${await res.text()}`);
        const recipient = await res.json();
        await serviceSupabase.from("financial_payment_recipients").upsert({
          user_id: userId, provider_recipient_id: recipient.id, name: recipient.name || "PIX QR",
          tax_number: recipient.taxNumber || null, institution_name: recipient.paymentInstitution?.name || null,
          pix_key: recipient.pixKey || null, ...(workspace_id ? { workspace_id } : {}),
        }, { onConflict: "user_id,provider_recipient_id" });
        return jsonResponse({ success: true, recipient });
      }
      case "create_payment": {
        const { recipient_id, amount, description, callback_urls, workspace_id } = params;
        const { data: dbRecipient } = await serviceSupabase.from("financial_payment_recipients").select("provider_recipient_id").eq("id", recipient_id).eq("user_id", userId).single();
        if (!dbRecipient) throw new Error("Recipient not found");
        const payload: any = { amount, description: description || "Pagamento via Desh", recipientId: dbRecipient.provider_recipient_id };
        if (callback_urls) payload.callbackUrls = callback_urls;
        const res = await fetch("https://api.pluggy.ai/payments/requests", { method: "POST", headers, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(`Create payment failed (${res.status}): ${await res.text()}`);
        const paymentReq = await res.json();
        await serviceSupabase.from("financial_payment_requests").upsert({
          user_id: userId, provider_request_id: paymentReq.id, recipient_id, amount: paymentReq.amount,
          description: paymentReq.description, status: paymentReq.status, payment_url: paymentReq.paymentUrl,
          payment_type: "instant", callback_urls: paymentReq.callbackUrls, raw_data: paymentReq,
          ...(workspace_id ? { workspace_id } : {}),
        }, { onConflict: "user_id,provider_request_id" });
        return jsonResponse({ success: true, payment: paymentReq });
      }
      case "create_scheduled_payment": {
        const { recipient_id, amount, description, schedule, callback_urls, workspace_id } = params;
        const { data: dbRecipient } = await serviceSupabase.from("financial_payment_recipients").select("provider_recipient_id").eq("id", recipient_id).eq("user_id", userId).single();
        if (!dbRecipient) throw new Error("Recipient not found");
        const payload: any = { amount, description: description || "Pagamento agendado via Desh", recipientId: dbRecipient.provider_recipient_id, schedule: { type: schedule.type, startDate: schedule.start_date } };
        if (schedule.occurrences) payload.schedule.occurrences = schedule.occurrences;
        if (schedule.type === "CUSTOM" && schedule.dates) payload.schedule.dates = schedule.dates;
        if (callback_urls) payload.callbackUrls = callback_urls;
        const res = await fetch("https://api.pluggy.ai/payments/requests", { method: "POST", headers, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(`Create scheduled payment failed (${res.status}): ${await res.text()}`);
        const paymentReq = await res.json();
        await serviceSupabase.from("financial_payment_requests").upsert({
          user_id: userId, provider_request_id: paymentReq.id, recipient_id, amount: paymentReq.amount,
          description: paymentReq.description, status: paymentReq.status, payment_url: paymentReq.paymentUrl,
          payment_type: "scheduled", schedule_type: schedule.type, schedule_start_date: schedule.start_date,
          schedule_occurrences: schedule.occurrences || null, schedule_dates: schedule.dates || null,
          callback_urls: paymentReq.callbackUrls, raw_data: paymentReq, ...(workspace_id ? { workspace_id } : {}),
        }, { onConflict: "user_id,provider_request_id" });
        return jsonResponse({ success: true, payment: paymentReq });
      }
      case "create_pix_automatico": {
        const { recipient_id, description: desc, interval, start_date, fixed_amount, min_variable, max_variable, scheduler_enabled, scheduler_description, first_payment, callback_urls, workspace_id } = params;
        const { data: dbRecipient } = await serviceSupabase.from("financial_payment_recipients").select("provider_recipient_id").eq("id", recipient_id).eq("user_id", userId).single();
        if (!dbRecipient) throw new Error("Recipient not found");
        const payload: any = { description: desc || "Pix Automático via Desh", recipientId: dbRecipient.provider_recipient_id, interval, startDate: start_date };
        if (fixed_amount != null) payload.fixedAmount = fixed_amount;
        else { if (min_variable != null) payload.minimumVariableAmount = min_variable; if (max_variable != null) payload.maximumVariableAmount = max_variable; }
        if (first_payment?.date && first_payment?.amount) { payload.firstPayment = { date: first_payment.date, amount: first_payment.amount }; if (first_payment.description) payload.firstPayment.description = first_payment.description; }
        if (scheduler_enabled) payload.schedulerConfiguration = { enabled: true, description: scheduler_description || desc || "Pagamento automático" };
        if (callback_urls) payload.callbackUrls = callback_urls;
        const res = await fetch("https://api.pluggy.ai/payments/requests/automatic-pix", { method: "POST", headers, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(`Create Pix Automático failed (${res.status}): ${await res.text()}`);
        const paymentReq = await res.json();
        await serviceSupabase.from("financial_payment_requests").upsert({
          user_id: userId, provider_request_id: paymentReq.id, recipient_id, amount: fixed_amount || max_variable || 0,
          description: paymentReq.description, status: paymentReq.status, payment_url: paymentReq.paymentUrl,
          payment_type: "pix_automatico", pix_auto_interval: interval, pix_auto_fixed_amount: fixed_amount || null,
          pix_auto_min_variable: min_variable || null, pix_auto_max_variable: max_variable || null,
          schedule_start_date: start_date, callback_urls: paymentReq.callbackUrls, raw_data: paymentReq,
          ...(workspace_id ? { workspace_id } : {}),
        }, { onConflict: "user_id,provider_request_id" });
        return jsonResponse({ success: true, payment: paymentReq });
      }
      case "list_pix_auto_schedules": {
        const res = await fetch(`https://api.pluggy.ai/payments/requests/${params.provider_request_id}/automatic-pix/schedules`, { headers });
        if (!res.ok) throw new Error(`List schedules failed: ${res.status}`);
        const data = await res.json();
        return jsonResponse({ schedules: data.results || data });
      }
      case "cancel_pix_auto": {
        const res = await fetch(`https://api.pluggy.ai/payments/requests/${params.provider_request_id}/automatic-pix/cancel`, { method: "POST", headers });
        if (!res.ok && res.status !== 204) throw new Error(`Cancel Pix Auto failed (${res.status}): ${await res.text()}`);
        await serviceSupabase.from("financial_payment_requests").update({ status: "CANCELED", updated_at: new Date().toISOString() }).eq("provider_request_id", params.provider_request_id).eq("user_id", userId);
        return jsonResponse({ success: true });
      }
      case "schedule_pix_auto_payment": {
        const res = await fetch(`https://api.pluggy.ai/payments/requests/${params.provider_request_id}/automatic-pix/schedule`, {
          method: "POST", headers, body: JSON.stringify({ amount: params.amount, date: params.date, description: params.description || "Cobrança Pix Automático" }),
        });
        if (!res.ok) throw new Error(`Schedule Pix Auto failed (${res.status}): ${await res.text()}`);
        return jsonResponse({ success: true, schedule: await res.json() });
      }
      case "get_payment": {
        const res = await fetch(`https://api.pluggy.ai/payments/requests/${params.provider_request_id}`, { headers });
        if (!res.ok) throw new Error(`Get payment failed: ${res.status}`);
        const data = await res.json();
        await serviceSupabase.from("financial_payment_requests").update({ status: data.status, raw_data: data, updated_at: new Date().toISOString() }).eq("provider_request_id", params.provider_request_id).eq("user_id", userId);
        return jsonResponse({ payment: data });
      }
      case "list_intents": {
        const res = await fetch(`https://api.pluggy.ai/payments/requests/${params.provider_request_id}/intents`, { headers });
        if (!res.ok) throw new Error(`List intents failed: ${res.status}`);
        const data = await res.json();
        return jsonResponse({ intents: data.results || data });
      }
      case "delete_payment": {
        const res = await fetch(`https://api.pluggy.ai/payments/requests/${params.provider_request_id}`, { method: "DELETE", headers });
        if (!res.ok && res.status !== 204) throw new Error(`Delete payment failed (${res.status}): ${await res.text()}`);
        await serviceSupabase.from("financial_payment_requests").update({ status: "CANCELED", updated_at: new Date().toISOString() }).eq("provider_request_id", params.provider_request_id).eq("user_id", userId);
        return jsonResponse({ success: true });
      }
      default:
        return errorResponse(400, `Unknown payment action: ${action}`);
    }
  } catch (error: any) {
    console.error("pluggy-payments-handler error:", error);
    const rawMsg = error.message || "Unknown error";
    let userMsg = rawMsg;
    for (const [code, msg] of Object.entries(friendlyMessages)) {
      if (rawMsg.includes(code)) { userMsg = msg; break; }
    }
    // Return 200 with error field so client gets the body
    return jsonResponse({ error: userMsg, raw: rawMsg });
  }
}

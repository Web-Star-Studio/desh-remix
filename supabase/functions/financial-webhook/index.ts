/**
 * @function financial-webhook
 * @description Webhook financeiro Pluggy (item updates, transactions sync)
 * @status active
 * @calledBy Pluggy platform
 */
import { createClient } from "npm:@supabase/supabase-js@2.95.3";

Deno.serve(async (req) => {
  const startTime = Date.now();
  let logEvent = "unknown";
  let logItemId: string | null = null;
  let logConnectionId: string | null = null;
  let logStatus = "success";
  let logError: string | null = null;
  let body: any = {};

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    body = await req.json();
    const isPluggy = !!body.itemId || !!body.event;
    logEvent = body.event || "unknown";
    logItemId = body.itemId || body.paymentRequestId || null;

    if (isPluggy) {
      const event = body.event;
      const itemId = body.itemId;

      // ---- item/created & item/updated → full sync ----
      if (["item/created", "item/updated"].includes(event)) {
        const { data: connection } = await supabase
          .from("financial_connections")
          .select("id, user_id, workspace_id")
          .eq("provider_connection_id", itemId)
          .eq("provider", "pluggy")
          .single();

        if (connection) {
          logConnectionId = connection.id;
          await supabase
            .from("financial_connections")
            .update({ status: "syncing", updated_at: new Date().toISOString() })
            .eq("id", connection.id);

          // Call sync-financial-data via direct HTTP to avoid invoke issues
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          fetch(`${supabaseUrl}/functions/v1/sync-financial-data`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              provider: "pluggy",
              connection_id: connection.id,
              provider_connection_id: itemId,
              user_id: connection.user_id,
              workspace_id: connection.workspace_id || null,
            }),
          }).catch(e => console.error("Sync invoke error:", e));
        } else {
          logStatus = "ignored";
        }
      }

      // ---- item/login_succeeded → mark syncing ----
      if (event === "item/login_succeeded") {
        await supabase
          .from("financial_connections")
          .update({ status: "syncing", updated_at: new Date().toISOString() })
          .eq("provider_connection_id", itemId)
          .eq("provider", "pluggy");
      }

      // ---- item/error → mark error ----
      if (event === "item/error") {
        await supabase
          .from("financial_connections")
          .update({ status: "error", updated_at: new Date().toISOString() })
          .eq("provider_connection_id", itemId)
          .eq("provider", "pluggy");
      }

      // ---- item/waiting_user_input → awaiting_input ----
      if (event === "item/waiting_user_input") {
        await supabase
          .from("financial_connections")
          .update({ status: "awaiting_input", updated_at: new Date().toISOString() })
          .eq("provider_connection_id", itemId)
          .eq("provider", "pluggy");
      }

      // ---- item/deleted → remove connection + cascade ----
      if (event === "item/deleted") {
        await supabase
          .from("financial_connections")
          .delete()
          .eq("provider_connection_id", itemId)
          .eq("provider", "pluggy");
      }

      // ---- transactions/deleted → remove specific transactions ----
      if (event === "transactions/deleted" && Array.isArray(body.transactionIds)) {
        for (const txId of body.transactionIds) {
          await supabase
            .from("financial_transactions_unified")
            .delete()
            .eq("provider_transaction_id", txId);
        }
      }

      // ---- transactions/updated → re-fetch and upsert updated transactions ----
      if (event === "transactions/updated" && Array.isArray(body.transactionIds) && body.transactionIds.length > 0) {
        try {
          const authRes = await fetch("https://api.pluggy.ai/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clientId: Deno.env.get("PLUGGY_CLIENT_ID"),
              clientSecret: Deno.env.get("PLUGGY_CLIENT_SECRET"),
            }),
          });
          const { apiKey } = await authRes.json();
          const headers = { "X-API-KEY": apiKey, "Content-Type": "application/json" };

          for (const txId of body.transactionIds) {
            const txRes = await fetch(`https://api.pluggy.ai/transactions/${txId}`, { headers });
            if (!txRes.ok) continue;
            const tx = await txRes.json();

            const { data: dbAcc } = await supabase
              .from("financial_accounts")
              .select("id, user_id")
              .eq("provider_account_id", tx.accountId)
              .single();

            if (dbAcc) {
              await supabase.from("financial_transactions_unified").upsert({
                account_id: dbAcc.id,
                user_id: dbAcc.user_id,
                provider_transaction_id: tx.id,
                date: tx.date?.split("T")[0] || tx.date,
                description: tx.description,
                amount: Math.abs(tx.amount),
                type: tx.type === "CREDIT" ? "inflow" : "outflow",
                category: tx.category || null,
                subcategory: null,
                merchant_name: tx.merchant?.name || null,
                currency: tx.currencyCode || "BRL",
                status: tx.status === "POSTED" ? "posted" : "pending",
                raw_data: tx,
              }, { onConflict: "user_id,provider_transaction_id", ignoreDuplicates: false });
            }
          }
        } catch (e) {
          console.error("Error updating transactions:", e);
          logStatus = "error";
          logError = String(e);
        }
      }

      // ---- transactions/created → fetch new transactions via createdTransactionsLink ----
      if (event === "transactions/created" && body.createdTransactionsLink) {
        try {
          const authRes = await fetch("https://api.pluggy.ai/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clientId: Deno.env.get("PLUGGY_CLIENT_ID"),
              clientSecret: Deno.env.get("PLUGGY_CLIENT_SECRET"),
            }),
          });
          const { apiKey } = await authRes.json();
          const headers: Record<string, string> = { "X-API-KEY": apiKey };

          let nextUrl: string | null = body.createdTransactionsLink;
          while (nextUrl) {
            const res = await fetch(nextUrl, { headers });
            if (!res.ok) { console.error("Failed to fetch created transactions:", res.status); break; }
            const data = await res.json();
            const results = data.results || [];

            for (const tx of results) {
              const { data: dbAcc } = await supabase
                .from("financial_accounts")
                .select("id, user_id")
                .eq("provider_account_id", tx.accountId)
                .single();

              if (dbAcc) {
                await supabase.from("financial_transactions_unified").upsert({
                  account_id: dbAcc.id,
                  user_id: dbAcc.user_id,
                  provider_transaction_id: tx.id,
                  date: tx.date?.split("T")[0] || tx.date,
                  description: tx.description,
                  amount: Math.abs(tx.amount),
                  type: tx.type === "CREDIT" ? "inflow" : "outflow",
                  category: tx.category || null,
                  subcategory: null,
                  merchant_name: tx.merchant?.name || null,
                  currency: tx.currencyCode || "BRL",
                  status: tx.status === "POSTED" ? "posted" : "pending",
                  raw_data: tx,
                }, { onConflict: "user_id,provider_transaction_id", ignoreDuplicates: false });
              }
            }

            nextUrl = data.nextPage || null;
          }
        } catch (e) {
          console.error("Error processing transactions/created:", e);
          logStatus = "error";
          logError = String(e);
        }
      }

    }

    // ─── Pluggy Payments Webhooks ──────────────────────────────
    const isPaymentEvent = !!body.event && (
      body.event.startsWith("payment_intent/") || 
      body.event.startsWith("scheduled_payment/")
    );

    if (isPaymentEvent) {
      const event = body.event as string;
      const paymentRequestId = body.paymentRequestId;
      const paymentIntentId = body.paymentIntentId;
      const scheduledPaymentId = body.scheduledPaymentId;

      // ── Payment Intent events ──
      if (event.startsWith("payment_intent/") && paymentIntentId) {
        const statusMap: Record<string, string> = {
          "payment_intent/created": "CREATED",
          "payment_intent/completed": "PAYMENT_COMPLETED",
          "payment_intent/error": "ERROR",
          "payment_intent/consent_rejected": "CONSENT_REJECTED",
          "payment_intent/payment_rejected": "PAYMENT_REJECTED",
          "payment_intent/canceled": "CANCELED",
          "payment_intent/expired": "EXPIRED",
          "payment_intent/partially_accepted": "PAYMENT_PARTIALLY_ACCEPTED",
        };
        const newStatus = statusMap[event] || event.split("/")[1]?.toUpperCase() || "UNKNOWN";

        const { data: reqRow } = await supabase
          .from("financial_payment_requests")
          .select("id, user_id")
          .eq("provider_request_id", paymentRequestId)
          .single();

        if (reqRow) {
          await supabase.from("financial_payment_intents").upsert({
            user_id: reqRow.user_id,
            request_id: reqRow.id,
            provider_intent_id: paymentIntentId,
            status: newStatus,
            end_to_end_id: body.endToEndId || null,
            error_code: body.errorCode || null,
            error_detail: body.errorDetail || null,
            raw_data: body,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,provider_intent_id", ignoreDuplicates: false });

          if (["PAYMENT_COMPLETED", "CONSENT_REJECTED", "PAYMENT_REJECTED", "ERROR", "CANCELED", "EXPIRED"].includes(newStatus)) {
            await supabase.from("financial_payment_requests")
              .update({ status: newStatus, updated_at: new Date().toISOString() })
              .eq("id", reqRow.id);
          }
        }
      }

      // ── Scheduled Payment events ──
      if (event.startsWith("scheduled_payment/") && scheduledPaymentId) {
        const statusMap: Record<string, string> = {
          "scheduled_payment/created": "CREATED",
          "scheduled_payment/completed": "COMPLETED",
          "scheduled_payment/error": "ERROR",
          "scheduled_payment/canceled": "CANCELED",
        };
        const newStatus = statusMap[event] || event.split("/")[1]?.toUpperCase() || "UNKNOWN";

        const { data: reqRow } = await supabase
          .from("financial_payment_requests")
          .select("id, user_id")
          .eq("provider_request_id", paymentRequestId)
          .single();

        if (reqRow) {
          await supabase.from("financial_scheduled_payments").upsert({
            user_id: reqRow.user_id,
            request_id: reqRow.id,
            provider_scheduled_id: scheduledPaymentId,
            status: newStatus,
            end_to_end_id: body.endToEndId || null,
            error_code: body.errorCode || null,
            raw_data: body,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,provider_scheduled_id", ignoreDuplicates: false });
        }
      }

      // ── Bulk completion events ──
      if (event === "scheduled_payment/all_completed" && body.paymentRequestId) {
        await supabase.from("financial_payment_requests")
          .update({ status: "COMPLETED", updated_at: new Date().toISOString() })
          .eq("provider_request_id", body.paymentRequestId);
      }
    }

    // ─── Log webhook event (best-effort) ──────────────────────
    const processingTime = Date.now() - startTime;
    await supabase.from("financial_webhook_logs").insert({
      event: logEvent,
      item_id: logItemId,
      connection_id: logConnectionId,
      status: logStatus,
      error_message: logError,
      payload: body,
      processing_time_ms: processingTime,
    }).then(({ error }) => { if (error) console.error("Log insert error:", error); });

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    // Best-effort log on error
    const processingTime = Date.now() - startTime;
    await supabase.from("financial_webhook_logs").insert({
      event: logEvent,
      item_id: logItemId,
      connection_id: logConnectionId,
      status: "error",
      error_message: String(error),
      payload: body,
      processing_time_ms: processingTime,
    }).catch(() => {});

    return new Response("Error", { status: 500 });
  }
});

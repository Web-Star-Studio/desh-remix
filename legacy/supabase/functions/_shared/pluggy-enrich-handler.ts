import { corsHeaders } from "./utils.ts";
import { getPluggyApiKey, buildServiceClient } from "./pluggy-utils.ts";

export async function handlePluggyEnrich(params: any, userId: string): Promise<Response> {
  const { account_id, account_type } = params;
  const serviceSupabase = buildServiceClient();

  const { data: transactions } = await serviceSupabase
    .from("financial_transactions_unified")
    .select("id, provider_transaction_id, description, amount, date, raw_data")
    .eq("user_id", userId)
    .eq("account_id", account_id)
    .or("category.is.null,category.eq.Outros,merchant_name.is.null")
    .order("date", { ascending: false })
    .limit(500);

  if (!transactions || transactions.length === 0) {
    return json({ success: true, enriched: 0, message: "No transactions to enrich" });
  }

  const apiKey = await getPluggyApiKey();
  const pluggyAccountType = account_type === "credit_card" ? "CREDIT_CARD" : "CHECKING";

  const enrichPayload = {
    transactions: transactions.map((tx: any) => {
      const payload: any = {
        id: tx.provider_transaction_id,
        amount: tx.raw_data?.originalAmount ?? (tx.amount * -1),
        date: tx.date,
        description: tx.description || "",
      };
      if (tx.raw_data?.paymentData) payload.paymentData = tx.raw_data.paymentData;
      if (pluggyAccountType === "CREDIT_CARD" && tx.raw_data?.creditCardMetadata) {
        payload.creditCardMetadata = tx.raw_data.creditCardMetadata;
      }
      return payload;
    }),
    clientUserId: userId,
    accountType: pluggyAccountType,
    isBusiness: false,
  };

  const enrichRes = await fetch("https://enrichment-api.pluggy.ai/categorize", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(enrichPayload),
  });

  if (!enrichRes.ok) {
    const body = await enrichRes.text();
    throw new Error(`Enrichment failed (${enrichRes.status}): ${body}`);
  }

  const enrichData = await enrichRes.json();
  const results = enrichData.results || [];
  const enrichMap = new Map<string, any>();
  for (const r of results) enrichMap.set(r.id, r);

  let enrichedCount = 0;
  for (const tx of transactions) {
    const enriched = enrichMap.get(tx.provider_transaction_id);
    if (!enriched) continue;

    const updates: any = {};
    if (enriched.category) updates.category = enriched.category;
    if (enriched.merchant) {
      updates.merchant_name = enriched.merchant.businessName || enriched.merchant.name || null;
      updates.raw_data = {
        ...(tx.raw_data || {}),
        enriched_merchant: enriched.merchant,
        enriched_category: enriched.category,
        enriched_type: enriched.type,
      };
    }

    if (Object.keys(updates).length > 0) {
      await serviceSupabase.from("financial_transactions_unified").update(updates).eq("id", tx.id);
      enrichedCount++;
    }
  }

  return json({ success: true, enriched: enrichedCount, total: transactions.length });
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

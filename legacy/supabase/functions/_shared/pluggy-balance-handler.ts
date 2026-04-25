import { corsHeaders } from "./utils.ts";
import { getPluggyApiKey, buildServiceClient } from "./pluggy-utils.ts";

export async function handleRealtimeBalance(params: any, userId: string): Promise<Response> {
  const { account_id } = params;
  if (!account_id) return json({ error: "account_id is required" }, 400);

  const supabase = buildServiceClient();

  const { data: account } = await supabase
    .from("financial_accounts")
    .select("provider_account_id, id")
    .eq("id", account_id)
    .eq("user_id", userId)
    .single();

  if (!account) return json({ error: "Account not found" }, 404);

  const apiKey = await getPluggyApiKey();

  const balanceRes = await fetch(
    `https://api.pluggy.ai/accounts/${account.provider_account_id}/balance`,
    { headers: { "X-API-KEY": apiKey } }
  );

  if (balanceRes.status === 429) {
    return json({ error: "Rate limited by institution. Try again later." }, 429);
  }

  if (!balanceRes.ok) {
    const body = await balanceRes.text();
    return json({ error: `Balance fetch failed: ${body}`, not_supported: true }, balanceRes.status);
  }

  const balanceData = await balanceRes.json();

  await supabase.from("financial_accounts").update({
    current_balance: balanceData.balance ?? null,
    available_balance: balanceData.balance ?? null,
    last_synced_at: new Date().toISOString(),
  }).eq("id", account.id);

  return json({
    success: true,
    balance: balanceData.balance,
    blocked_balance: balanceData.blockedBalance ?? null,
    auto_invested_balance: balanceData.automaticallyInvestedBalance ?? null,
    currency: balanceData.currencyCode || "BRL",
    updated_at: balanceData.updateDateTime || new Date().toISOString(),
  });
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

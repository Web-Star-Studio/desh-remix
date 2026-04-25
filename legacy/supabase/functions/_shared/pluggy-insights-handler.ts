import { corsHeaders, jsonResponse, errorResponse } from "./utils.ts";
import { getPluggyApiKey, buildServiceClient } from "./pluggy-utils.ts";

export async function handlePluggyInsights(body: Record<string, any>, userId: string) {
  const { action, connection_id, item_id, workspace_id, transaction_id, category_id, rule_action, rule_data } = body;
  const apiKey = await getPluggyApiKey();
  const headers: Record<string, string> = { "X-API-KEY": apiKey, "Content-Type": "application/json" };

  try {
    switch (action) {
      case "kpis":
        return jsonResponse({ success: true, kpis: await handleKpis(headers, item_id, connection_id, userId, workspace_id || null) });
      case "recurring":
        return jsonResponse({ success: true, payments: await handleRecurring(headers, item_id, connection_id, userId, workspace_id || null) });
      case "behavior_analysis":
        return jsonResponse({ success: true, analysis: await handleBehaviorAnalysis(headers, item_id, connection_id, userId, workspace_id || null) });
      case "list_consents":
      case "revoke_consent":
        return jsonResponse({ success: true, ...(await handleConsents(headers, item_id, action)) });
      case "update_category":
        return jsonResponse({ success: true, transaction: await handleUpdateCategory(headers, transaction_id, category_id) });
      case "list_categories":
        return jsonResponse({ success: true, ...(await handleListCategories(headers)) });
      case "category_rules":
        return jsonResponse({ success: true, ...(await handleCategoryRules(headers, rule_action, rule_data)) });
      case "item_status":
        return jsonResponse({ success: true, item: await handleItemStatus(headers, item_id) });
      case "connectors_catalog":
        return jsonResponse({ success: true, ...(await handleConnectorsCatalog(headers)) });
      default:
        return errorResponse(400, `Unknown insight action: ${action}`);
    }
  } catch (error: any) {
    console.error("pluggy-insights-handler error:", error);
    return errorResponse(500, error.message || "Unknown error");
  }
}

// ─── KPIs ──────────────────────────────────────────────
async function handleKpis(headers: Record<string, string>, itemId: string, connectionId: string, userId: string, workspaceId: string | null) {
  const serviceSupabase = buildServiceClient();
  const kpiRes = await fetch(`https://insights-api.pluggy.ai/book?itemIds=${itemId}`, { method: "POST", headers });
  if (kpiRes.status === 404) return { status: "NOT_FOUND", itemNotFound: true };
  if (!kpiRes.ok) throw new Error(`KPI fetch failed (${kpiRes.status}): ${await kpiRes.text()}`);
  const kpiData = await kpiRes.json();
  const book = kpiData.book || {};
  const summary: Record<string, any> = { status: kpiData.status };

  for (const prefix of ["bankAccount", "creditCard"]) {
    const raw = book[prefix];
    if (!raw) continue;
    const months: Record<string, any> = {};
    for (let m = 1; m <= 6; m++) {
      const mk = `M${m}`;
      const dateRanges: Record<string, any> = {};
      for (const range of ["1-5", "6-10", "11-15", "16-20", "21-25", "26-31"]) {
        dateRanges[range] = {
          debit_pct: raw[`percentage_transactions_debit_dates_${range}_${mk}`] ?? null,
          credit_pct: raw[`percentage_transactions_credit_dates_${range}_${mk}`] ?? null,
          debit_count: raw[`count_transactions_debit_dates_${range}_${mk}`] ?? 0,
          credit_count: raw[`count_transactions_credit_dates_${range}_${mk}`] ?? 0,
          debit_amount: raw[`amount_transactions_debit_dates_${range}_${mk}`] ?? 0,
          credit_amount: raw[`amount_transactions_credit_dates_${range}_${mk}`] ?? 0,
        };
      }
      const amountRanges: Record<string, any> = {};
      for (const range of ["0-50", "50-100", "100-200", "200-500", "500-1000", "1000-2000", "2000-5000", "5000-10000", "10000-20000", "20000-50000", "50000-MAX"]) {
        amountRanges[range] = {
          debit_pct: raw[`percentage_transactions_debit_amount_${range}_${mk}`] ?? null,
          credit_pct: raw[`percentage_transactions_credit_amount_${range}_${mk}`] ?? null,
          debit_count: raw[`count_transactions_debit_amount_${range}_${mk}`] ?? 0,
          credit_count: raw[`count_transactions_credit_amount_${range}_${mk}`] ?? 0,
          debit_amount: raw[`amount_transactions_debit_amount_${range}_${mk}`] ?? 0,
          credit_amount: raw[`amount_transactions_credit_amount_${range}_${mk}`] ?? 0,
        };
      }
      months[mk] = {
        net_amount: raw[`diff_transactions_net_amount_${mk}`] ?? null,
        credit_count: raw[`count_transactions_credit_${mk}`] ?? 0,
        debit_count: raw[`count_transactions_debit_${mk}`] ?? 0,
        credit_sum: raw[`sum_transactions_credit_${mk}`] ?? 0,
        debit_sum: raw[`sum_transactions_debit_${mk}`] ?? 0,
        credit_debit_ratio: raw[`ratio_transactions_creditdebit_${mk}`] ?? null,
        inflow_commitment: raw[`ratio_inflow_commitment_${mk}`] ?? null,
        avg_credit: raw[`avg_transactions_credit_${mk}`] ?? null,
        avg_debit: raw[`avg_transactions_debit_${mk}`] ?? null,
        min_balance: raw[`min_transactions_balance_${mk}`] ?? null,
        max_balance: raw[`max_transactions_balance_${mk}`] ?? null,
        avg_credit_balance: raw[`avg_transactions_credit_balance_${mk}`] ?? null,
        avg_debit_balance: raw[`avg_transactions_debit_balance_${mk}`] ?? null,
        max_debit_period: raw[`max_transactions_debit_period_${mk}`] ?? null,
        max_credit_period: raw[`max_transactions_credit_period_${mk}`] ?? null,
        dateRanges, amountRanges,
      };
    }
    summary[prefix] = months;
  }
  if (book.incomeReport) summary.incomeReport = book.incomeReport;

  try {
    const incomeRes = await fetch(`https://insights-api.pluggy.ai/income?itemIds=${itemId}`, { method: "POST", headers });
    if (incomeRes.ok) {
      const incomeData = await incomeRes.json();
      if (incomeData.result) {
        summary.incomeStatistics = {
          total: incomeData.result.totalIncomeStatistics || null,
          irregular: incomeData.result.irregularIncomeStatistics || null,
          sources: incomeData.result.incomeSources || [],
        };
      }
    }
  } catch (incomeErr) {
    console.warn("Income statistics fetch failed (non-critical):", incomeErr);
  }

  await serviceSupabase.from("financial_insights").upsert({
    connection_id: connectionId, user_id: userId, insight_type: "kpi",
    data: summary, fetched_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    ...(workspaceId ? { workspace_id: workspaceId } : {}),
  }, { onConflict: "user_id,connection_id,insight_type" });
  return summary;
}

// ─── Recurring ─────────────────────────────────────────
async function handleRecurring(headers: Record<string, string>, itemId: string, connectionId: string, userId: string, workspaceId: string | null) {
  const serviceSupabase = buildServiceClient();
  const recRes = await fetch("https://enrichment-api.pluggy.ai/recurring-payments", { method: "POST", headers, body: JSON.stringify({ itemId }) });
  if (recRes.status === 404) return [];
  if (!recRes.ok) throw new Error(`Recurring fetch failed (${recRes.status}): ${await recRes.text()}`);
  const recData = await recRes.json();
  const payments = (recData.recurringPayments || []).map((p: any) => ({
    description: p.description, average_amount: p.averageAmount, occurrences_count: p.occurrences?.length || 0,
    regularity_score: p.regularityScore, type: p.averageAmount < 0 ? "expense" : "income", occurrences: p.occurrences || [],
  }));
  payments.sort((a: any, b: any) => b.regularity_score - a.regularity_score);
  await serviceSupabase.from("financial_insights").upsert({
    connection_id: connectionId, user_id: userId, insight_type: "recurring_payments",
    data: { payments, fetched_at: new Date().toISOString() }, fetched_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    ...(workspaceId ? { workspace_id: workspaceId } : {}),
  }, { onConflict: "user_id,connection_id,insight_type" });
  return payments;
}

// ─── Behavior Analysis ────────────────────────────────
async function handleBehaviorAnalysis(headers: Record<string, string>, itemId: string, connectionId: string, userId: string, workspaceId: string | null) {
  const serviceSupabase = buildServiceClient();
  const res = await fetch("https://enrichment-api.pluggy.ai/behavior-analysis", { method: "POST", headers, body: JSON.stringify({ itemId }) });
  if (res.status === 404) return { categories: [], summary: null, monthlyPatterns: [], topMerchants: [], itemNotFound: true, fetchedAt: new Date().toISOString() };
  if (!res.ok) throw new Error(`Behavior analysis failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  const analysis = {
    categories: data.categories || data.categoryAnalysis || [], summary: data.summary || null,
    monthlyPatterns: data.monthlyPatterns || data.monthly || [], topMerchants: data.topMerchants || [],
    fetchedAt: new Date().toISOString(), raw: data,
  };
  await serviceSupabase.from("financial_insights").upsert({
    connection_id: connectionId, user_id: userId, insight_type: "behavior_analysis",
    data: analysis, fetched_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    ...(workspaceId ? { workspace_id: workspaceId } : {}),
  }, { onConflict: "user_id,connection_id,insight_type" });
  return analysis;
}

// ─── Consents ─────────────────────────────────────────
async function handleConsents(headers: Record<string, string>, itemId: string, action: string) {
  if (action === "list_consents") {
    const res = await fetch(`https://api.pluggy.ai/consents?itemId=${itemId}`, { headers });
    if (res.status === 404) return { results: [], total: 0, itemNotFound: true };
    if (!res.ok) throw new Error(`Consent list failed: ${res.status}`);
    return await res.json();
  }
  if (action === "revoke_consent") {
    const res = await fetch(`https://api.pluggy.ai/items/${itemId}`, { method: "DELETE", headers });
    if (res.status === 404) return { revoked: true, alreadyDeleted: true };
    if (!res.ok) throw new Error(`Consent revoke failed (${res.status}): ${await res.text()}`);
    return { revoked: true };
  }
  throw new Error(`Unknown consent action: ${action}`);
}

// ─── Category Update ──────────────────────────────────
async function handleUpdateCategory(headers: Record<string, string>, transactionId: string, categoryId: string) {
  const res = await fetch(`https://api.pluggy.ai/transactions/${transactionId}`, { method: "PATCH", headers, body: JSON.stringify({ categoryId }) });
  if (!res.ok) throw new Error(`Category update failed (${res.status}): ${await res.text()}`);
  return await res.json();
}

// ─── List Categories ──────────────────────────────────
async function handleListCategories(headers: Record<string, string>) {
  const res = await fetch("https://api.pluggy.ai/categories", { headers });
  if (!res.ok) throw new Error(`Categories list failed: ${res.status}`);
  return await res.json();
}

// ─── Category Rules ───────────────────────────────────
async function handleCategoryRules(headers: Record<string, string>, ruleAction: string, ruleData?: any) {
  if (ruleAction === "list") {
    const res = await fetch("https://api.pluggy.ai/categories/rules", { headers });
    if (!res.ok) throw new Error(`Category rules list failed: ${res.status}`);
    return await res.json();
  }
  if (ruleAction === "create") {
    const res = await fetch("https://api.pluggy.ai/categories/rules", { method: "POST", headers, body: JSON.stringify(ruleData) });
    if (!res.ok) throw new Error(`Category rule create failed (${res.status}): ${await res.text()}`);
    return await res.json();
  }
  throw new Error(`Unknown rule action: ${ruleAction}`);
}

// ─── Item Status ──────────────────────────────────────
async function handleItemStatus(headers: Record<string, string>, itemId: string) {
  const res = await fetch(`https://api.pluggy.ai/items/${itemId}`, { headers });
  if (res.status === 404) return { id: itemId, status: "NOT_FOUND", itemNotFound: true };
  if (!res.ok) throw new Error(`Item status failed: ${res.status}`);
  return await res.json();
}

// ─── Connectors Catalog ──────────────────────────────
async function handleConnectorsCatalog(headers: Record<string, string>) {
  const res = await fetch("https://api.pluggy.ai/connectors", { headers });
  if (!res.ok) throw new Error(`Connectors list failed: ${res.status}`);
  return await res.json();
}

/**
 * @function sync-financial-data
 * @description Full Pluggy sync: accounts, transactions, investments, loans
 * @status active
 * @calledBy finance-sync, financial-webhook
 */
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { emitEvent } from "../_shared/event-emitter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncParams {
  provider: string;
  connection_id: string;
  provider_connection_id: string;
  user_id: string;
  workspace_id?: string | null;
}

async function getPluggyApiKey(): Promise<string> {
  const res = await fetch("https://api.pluggy.ai/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: Deno.env.get("PLUGGY_CLIENT_ID"),
      clientSecret: Deno.env.get("PLUGGY_CLIENT_SECRET"),
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Pluggy auth failed: ${res.status} ${errText}`);
  }
  return (await res.json()).apiKey;
}

async function pluggyGet(apiKey: string, path: string): Promise<any> {
  const res = await fetch(`https://api.pluggy.ai${path}`, {
    headers: { "X-API-KEY": apiKey },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Pluggy GET ${path} failed: ${res.status} ${errText}`);
  }
  return res.json();
}

async function pluggyGetPaginated(apiKey: string, path: string): Promise<any[]> {
  const results: any[] = [];
  let page = 1;
  const pageSize = 500;
  while (true) {
    const separator = path.includes("?") ? "&" : "?";
    const data = await pluggyGet(apiKey, `${path}${separator}pageSize=${pageSize}&page=${page}`);
    const items = data.results || [];
    results.push(...items);
    if (items.length < pageSize || results.length >= (data.total || Infinity)) break;
    page++;
  }
  return results;
}

function mapAccountType(type: string, subtype?: string): string {
  if (type === "BANK") {
    return subtype === "SAVINGS_ACCOUNT" ? "savings" : "checking";
  }
  const map: Record<string, string> = { CREDIT: "credit_card", INVESTMENT: "investment", LOAN: "loan" };
  return map[type] || "other";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let params: SyncParams;
  try {
    params = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { provider, connection_id, provider_connection_id, user_id, workspace_id } = params;
  if (!connection_id || !provider_connection_id || !user_id) {
    return new Response(JSON.stringify({ error: "Missing required params" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let accountsSynced = 0;
  let transactionsSynced = 0;
  let investmentsSynced = 0;
  let loansSynced = 0;

  try {
    console.log(`[sync] Starting sync for connection ${connection_id}, item ${provider_connection_id}`);

    // 1. Authenticate with Pluggy
    const apiKey = await getPluggyApiKey();

    // 2. Check item status
    const item = await pluggyGet(apiKey, `/items/${provider_connection_id}`);
    const execStatus = item.executionStatus || item.status;

    // Update connection with institution info
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (item.connector) {
      updateData.institution_name = item.connector.name || null;
      updateData.institution_logo_url = item.connector.imageUrl || null;
      updateData.raw_metadata = {
        connector_id: item.connector.id,
        connector_name: item.connector.name,
        last_execution: item.lastUpdatedAt,
        execution_status: execStatus,
      };
    }
    await supabase.from("financial_connections").update(updateData).eq("id", connection_id);

    // Check for blocking statuses
    const blockingStatuses = ["LOGIN_ERROR", "INVALID_CREDENTIALS", "INVALID_CREDENTIALS_MFA", "WAITING_USER_INPUT", "ACCOUNT_LOCKED", "SITE_NOT_AVAILABLE"];
    if (blockingStatuses.includes(execStatus)) {
      const statusMap: Record<string, string> = {
        WAITING_USER_INPUT: "awaiting_input",
        INVALID_CREDENTIALS: "error",
        INVALID_CREDENTIALS_MFA: "awaiting_input",
        LOGIN_ERROR: "error",
        ACCOUNT_LOCKED: "error",
        SITE_NOT_AVAILABLE: "error",
      };
      await supabase.from("financial_connections")
        .update({ status: statusMap[execStatus] || "error", updated_at: new Date().toISOString() })
        .eq("id", connection_id);

      await supabase.from("financial_sync_logs").insert({
        connection_id,
        user_id,
        provider: "pluggy",
        status: "error",
        error_message: `Item status: ${execStatus}`,
        duration_ms: Date.now() - startTime,
      });

      return new Response(JSON.stringify({
        success: false,
        error: execStatus,
        message: `Item has status: ${execStatus}`,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Sync accounts
    console.log(`[sync] Fetching accounts for item ${provider_connection_id}`);
    const accountsData = await pluggyGet(apiKey, `/accounts?itemId=${provider_connection_id}`);
    const pluggyAccounts = accountsData.results || [];

    for (const acc of pluggyAccounts) {
      let availableBalance: number | null = null;
      let creditLimit: number | null = null;

      if (acc.type === "BANK") {
        availableBalance = acc.bankData?.closingBalance ?? acc.balance ?? null;
      } else if (acc.type === "CREDIT") {
        availableBalance = acc.creditData?.availableCreditLimit ?? null;
        creditLimit = acc.creditData?.creditLimit ?? null;
      }

      const { error } = await supabase.from("financial_accounts").upsert({
        connection_id,
        user_id,
        provider_account_id: acc.id,
        name: acc.name || acc.marketingName || "Conta",
        type: mapAccountType(acc.type, acc.subtype),
        currency: acc.currencyCode || "BRL",
        current_balance: acc.balance ?? null,
        available_balance: availableBalance,
        credit_limit: creditLimit,
        institution_name: acc.connector?.name || item.connector?.name || null,
        last_synced_at: new Date().toISOString(),
        workspace_id: workspace_id || null,
        raw_data: acc,
      }, { onConflict: "user_id,provider_account_id", ignoreDuplicates: false });

      if (error) console.error(`[sync] Account upsert error:`, error);
      else accountsSynced++;
    }

    // 4. Sync transactions for each account (last 90 days)
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 90);
    const fromStr = fromDate.toISOString().split("T")[0];

    for (const acc of pluggyAccounts) {
      // Get the DB account ID
      const { data: dbAcc } = await supabase
        .from("financial_accounts")
        .select("id")
        .eq("user_id", user_id)
        .eq("provider_account_id", acc.id)
        .single();

      if (!dbAcc) continue;

      console.log(`[sync] Fetching transactions for account ${acc.id} from ${fromStr}`);
      const transactions = await pluggyGetPaginated(apiKey, `/transactions?accountId=${acc.id}&from=${fromStr}`);

      for (const tx of transactions) {
        let txType: string;
        const amount = Math.abs(tx.amount);

        if (acc.type === "CREDIT") {
          txType = tx.amount >= 0 ? "outflow" : "inflow";
        } else {
          txType = tx.type === "CREDIT" ? "inflow" : "outflow";
        }

        const { error } = await supabase.from("financial_transactions_unified").upsert({
          account_id: dbAcc.id,
          user_id,
          provider_transaction_id: tx.id,
          date: tx.date?.split("T")[0] || tx.date,
          description: tx.description,
          amount,
          type: txType,
          category: tx.category || null,
          subcategory: tx.categoryId || null,
          merchant_name: tx.merchant?.businessName || tx.merchant?.name || null,
          currency: tx.currencyCode || "BRL",
          status: tx.status === "POSTED" ? "posted" : "pending",
          raw_data: tx,
        }, { onConflict: "user_id,provider_transaction_id", ignoreDuplicates: false });

        if (error) {
          console.error(`[sync] Tx upsert error:`, error);
        } else {
          transactionsSynced++;
          // Emit event for each new transaction (fire-and-forget)
          emitEvent(supabase, user_id, workspace_id || null, "finance.transaction_synced", "finance", {
            amount: Math.abs(tx.amount), description: tx.description, category: tx.category || "outros",
            type: txType, merchant: tx.merchant?.businessName || tx.merchant?.name || null,
          }).catch(() => {});
        }
      }
    }

    // 5. Sync investments
    try {
      console.log(`[sync] Fetching investments for item ${provider_connection_id}`);
      const investmentsData = await pluggyGet(apiKey, `/investments?itemId=${provider_connection_id}`);
      const investments = investmentsData.results || [];

      for (const inv of investments) {
        const { error } = await supabase.from("financial_investments").upsert({
          connection_id,
          user_id,
          provider_investment_id: inv.id,
          name: inv.name,
          type: inv.type || null,
          ticker: inv.code || inv.isin || null,
          quantity: inv.quantity ?? null,
          current_value: inv.balance ?? inv.amount ?? null,
          cost_basis: inv.amountOriginal ?? null,
          currency: inv.currencyCode || "BRL",
          last_synced_at: new Date().toISOString(),
          workspace_id: workspace_id || null,
          raw_data: inv,
        }, { onConflict: "user_id,provider_investment_id", ignoreDuplicates: false });

        if (error) console.error(`[sync] Investment upsert error:`, error);
        else investmentsSynced++;
      }
    } catch (e) {
      // Investments may not be available for all connectors
      console.log(`[sync] Investments not available: ${e}`);
    }

    // 6. Sync loans
    try {
      console.log(`[sync] Fetching loans for item ${provider_connection_id}`);
      const loansData = await pluggyGet(apiKey, `/loans?itemId=${provider_connection_id}`);
      const loans = loansData.results || [];

      for (const loan of loans) {
        const { error } = await supabase.from("financial_loans").upsert({
          connection_id,
          user_id,
          provider_loan_id: loan.id,
          contract_number: loan.contractNumber || null,
          product_name: loan.productName || null,
          loan_type: loan.type || null,
          contract_date: loan.contractDate?.split("T")[0] || null,
          contract_amount: loan.contractAmount ?? null,
          outstanding_balance: loan.payments?.contractOutstandingBalance ?? null,
          currency: loan.currencyCode || "BRL",
          due_date: loan.dueDate?.split("T")[0] || null,
          cet: loan.CET ?? null,
          installment_periodicity: loan.instalmentPeriodicity || null,
          total_installments: loan.installments?.totalNumberOfInstallments ?? null,
          paid_installments: loan.installments?.paidInstallments ?? null,
          due_installments: loan.installments?.dueInstallments ?? null,
          status: loan.status || "active",
          workspace_id: workspace_id || null,
          raw_data: loan,
        }, { onConflict: "user_id,provider_loan_id", ignoreDuplicates: false });

        if (error) console.error(`[sync] Loan upsert error:`, error);
        else loansSynced++;
      }
    } catch (e) {
      console.log(`[sync] Loans not available: ${e}`);
    }

    // 7. Update connection status to active
    await supabase.from("financial_connections").update({
      status: "active",
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", connection_id);

    // 8. Log sync
    const durationMs = Date.now() - startTime;
    await supabase.from("financial_sync_logs").insert({
      connection_id,
      user_id,
      provider: "pluggy",
      status: "success",
      accounts_synced: accountsSynced,
      transactions_synced: transactionsSynced,
      investments_synced: investmentsSynced,
      duration_ms: durationMs,
    });

    console.log(`[sync] Complete: ${accountsSynced} accounts, ${transactionsSynced} txs, ${investmentsSynced} investments, ${loansSynced} loans in ${durationMs}ms`);

    return new Response(JSON.stringify({
      success: true,
      accounts_synced: accountsSynced,
      transactions_synced: transactionsSynced,
      investments_synced: investmentsSynced,
      loans_synced: loansSynced,
      duration_ms: durationMs,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error(`[sync] Error:`, error);

    // Update connection status to error
    await supabase.from("financial_connections").update({
      status: "error",
      updated_at: new Date().toISOString(),
    }).eq("id", connection_id);

    // Log failure
    await supabase.from("financial_sync_logs").insert({
      connection_id,
      user_id,
      provider: "pluggy",
      status: "error",
      error_message: error.message || String(error),
      accounts_synced: accountsSynced,
      transactions_synced: transactionsSynced,
      investments_synced: investmentsSynced,
      duration_ms: Date.now() - startTime,
    });

    return new Response(JSON.stringify({
      success: false,
      error: error.message || "Sync failed",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

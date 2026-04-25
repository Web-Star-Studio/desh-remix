import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { checkCredits, getApiKey, callAI, aiErrorResponse, jsonRes, parseToolCallResult } from "./ai-utils.ts";

export async function handleFinanceAI(req: Request, params: any, userId: string): Promise<Response> {
  const creditErr = await checkCredits(userId, "ai_finance");
  if (creditErr) return creditErr;

  const apiKey = getApiKey();
  const { action } = params;

  if (action === "categorize") {
    const uncategorized = (params.transactions || []).filter((t: any) => !t.category || t.category === "Outros");
    if (uncategorized.length === 0) return jsonRes({ categorized: [], message: "Nenhuma transação para categorizar" });

    const txList = uncategorized.slice(0, 50).map((t: any, i: number) => `${i + 1}. "${t.description}" - R$${t.amount} (${t.type === "income" ? "receita" : "despesa"})`).join("\n");

    const response = await callAI(apiKey, [
      { role: "system", content: `Você é um assistente financeiro. Categorize transações nas seguintes categorias: Renda, Moradia, Alimentação, Transporte, Lazer, Saúde, Educação, Outros.` },
      { role: "user", content: `Categorize estas transações:\n${txList}` },
    ], {
      tools: [{
        type: "function",
        function: {
          name: "categorize_transactions",
          description: "Categorize financial transactions",
          parameters: {
            type: "object",
            properties: {
              categories: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    index: { type: "number" },
                    category: { type: "string", enum: ["Renda", "Moradia", "Alimentação", "Transporte", "Lazer", "Saúde", "Educação", "Outros"] },
                  },
                  required: ["index", "category"],
                  additionalProperties: false,
                },
              },
            },
            required: ["categories"],
            additionalProperties: false,
          },
        },
      }],
      toolChoice: { type: "function", function: { name: "categorize_transactions" } },
    });

    if (!response.ok) return aiErrorResponse(response.status);

    const aiData = await response.json();
    const parsed = parseToolCallResult(aiData);
    const categories = parsed?.categories || [];

    const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const results: any[] = [];
    for (const cat of categories) {
      const tx = uncategorized[cat.index - 1];
      if (!tx) continue;
      await serviceClient.from("finance_transactions").update({ category: cat.category }).eq("id", tx.id);
      results.push({ id: tx.id, category: cat.category });
    }

    return jsonRes({ categorized: results, total: results.length });
  }

  if (action === "analyze") {
    const expensesByCategory = params.category_breakdown || {};
    const totalExpense = Object.values(expensesByCategory).reduce((s: number, v: any) => s + Number(v), 0);
    const prevExpenses = params.previous_month_expenses || {};

    const parts: string[] = [];
    parts.push(`Mês atual: ${params.month}`);
    parts.push(`Total despesas até agora: R$${totalExpense.toFixed(2)}`);
    if (Object.keys(expensesByCategory).length > 0) parts.push(`Gastos por categoria: ${Object.entries(expensesByCategory).map(([k, v]) => `${k}: R$${Number(v).toFixed(2)}`).join(", ")}`);
    if (Object.keys(prevExpenses).length > 0) parts.push(`Mês anterior: ${Object.entries(prevExpenses).map(([k, v]) => `${k}: R$${Number(v).toFixed(2)}`).join(", ")}`);
    if (params.budgets?.length > 0) parts.push(`Orçamentos: ${params.budgets.map((b: any) => `${b.category}: R$${b.monthly_limit}`).join(", ")}`);
    parts.push(`Total de transações: ${(params.transactions || []).length}`);

    const now = new Date();
    const [yearStr, monthStr] = (params.month || "").split("-");
    const daysInMonth = new Date(Number(yearStr), Number(monthStr), 0).getDate();
    const daysPassed = Number(yearStr) === now.getFullYear() && Number(monthStr) === now.getMonth() + 1 ? now.getDate() : daysInMonth;
    parts.push(`Dias passados: ${daysPassed}/${daysInMonth}`);

    const response = await callAI(apiKey, [
      { role: "system", content: `Você é um analista financeiro pessoal. Analise os dados e forneça previsão, alertas e dicas. Valores em R$.` },
      { role: "user", content: parts.join("\n") },
    ], {
      tools: [{
        type: "function",
        function: {
          name: "financial_analysis",
          description: "Provide spending forecast, anomaly alerts, and tips",
          parameters: {
            type: "object",
            properties: {
              forecast: {
                type: "object",
                properties: {
                  projected_total: { type: "number" },
                  categories: { type: "array", items: { type: "object", properties: { name: { type: "string" }, current: { type: "number" }, projected: { type: "number" }, trend: { type: "string", enum: ["up", "down", "stable"] } }, required: ["name", "current", "projected", "trend"], additionalProperties: false } },
                  daily_budget_remaining: { type: "number" },
                  summary: { type: "string" },
                },
                required: ["projected_total", "categories", "daily_budget_remaining", "summary"],
                additionalProperties: false,
              },
              anomalies: { type: "array", items: { type: "object", properties: { category: { type: "string" }, severity: { type: "string", enum: ["info", "warning", "critical"] }, message: { type: "string" }, change_pct: { type: "number" } }, required: ["category", "severity", "message", "change_pct"], additionalProperties: false } },
              tips: { type: "array", items: { type: "object", properties: { icon: { type: "string", enum: ["💡", "⚠️", "🎯", "📉", "🔥", "💰"] }, text: { type: "string" } }, required: ["icon", "text"], additionalProperties: false } },
            },
            required: ["forecast", "anomalies", "tips"],
            additionalProperties: false,
          },
        },
      }],
      toolChoice: { type: "function", function: { name: "financial_analysis" } },
    });

    if (!response.ok) return aiErrorResponse(response.status);

    const aiData = await response.json();
    const result = parseToolCallResult(aiData);
    return jsonRes(result || { forecast: null, anomalies: [], tips: [] });
  }

  if (action === "chat") {
    const { message, context, conversation_history } = params;
    const messages = [
      { role: "system", content: `Você é a Pandora, assistente financeira pessoal do DESH. Responda em pt-BR, use R$, seja direta e prática. Máximo 300 palavras.\n\nDADOS:\n${context}` },
      ...(conversation_history || []),
      { role: "user", content: message },
    ];

    const response = await callAI(apiKey, messages);
    if (!response.ok) return aiErrorResponse(response.status);

    const aiData = await response.json();
    return jsonRes({ reply: aiData.choices?.[0]?.message?.content || "Desculpe, não consegui processar." });
  }

  if (action === "plan") {
    const { transactions: txs, category_breakdown, budgets: bgt, month, total_income, total_expense, savings_rate, recurring } = params;
    const now = new Date();
    const [yearStr, monthStr] = (month || "").split("-");
    const daysInMonth = new Date(Number(yearStr), Number(monthStr), 0).getDate();
    const daysPassed = Number(yearStr) === now.getFullYear() && Number(monthStr) === now.getMonth() + 1 ? now.getDate() : daysInMonth;
    const daysRemaining = daysInMonth - daysPassed;

    const contextParts: string[] = [];
    contextParts.push(`Mês: ${month} | Dia ${daysPassed}/${daysInMonth} | ${daysRemaining} dias restantes`);
    contextParts.push(`Receita: R$${Number(total_income).toFixed(2)} | Despesa: R$${Number(total_expense).toFixed(2)}`);
    contextParts.push(`Taxa de poupança: ${Number(savings_rate).toFixed(1)}%`);
    if (category_breakdown && Object.keys(category_breakdown).length > 0) contextParts.push(`Gastos por categoria: ${Object.entries(category_breakdown).sort((a: any, b: any) => b[1] - a[1]).map(([k, v]) => `${k}: R$${Number(v).toFixed(2)}`).join(", ")}`);
    if (bgt?.length > 0) contextParts.push(`Orçamentos atuais: ${bgt.map((b: any) => `${b.category}: R$${b.monthly_limit}`).join(", ")}`);
    if (recurring?.length > 0) contextParts.push(`Recorrentes: ${recurring.map((r: any) => `${r.description} R$${r.amount} (${r.type}, dia ${r.day})`).join("; ")}`);
    contextParts.push(`Total transações: ${(txs || []).length}`);

    const response = await callAI(apiKey, [
      { role: "system", content: `Você é um planejador financeiro pessoal especializado. Analise os dados e crie um plano detalhado e personalizado.` },
      { role: "user", content: contextParts.join("\n") },
    ], {
      tools: [{
        type: "function",
        function: {
          name: "financial_plan",
          description: "Generate a personalized financial plan",
          parameters: {
            type: "object",
            properties: {
              health_summary: { type: "string" },
              health_score: { type: "number" },
              savings_goal: { type: "object", properties: { target: { type: "number" }, achievable: { type: "boolean" }, tip: { type: "string" } }, required: ["target", "achievable", "tip"], additionalProperties: false },
              budget_suggestions: { type: "array", items: { type: "object", properties: { category: { type: "string" }, current_spend: { type: "number" }, suggested_limit: { type: "number" }, reason: { type: "string" } }, required: ["category", "current_spend", "suggested_limit", "reason"], additionalProperties: false } },
              alerts: { type: "array", items: { type: "object", properties: { type: { type: "string", enum: ["warning", "danger", "success"] }, message: { type: "string" } }, required: ["type", "message"], additionalProperties: false } },
              monthly_projection: { type: "object", properties: { end_of_month_balance: { type: "number" }, trend: { type: "string", enum: ["positive", "negative", "stable"] } }, required: ["end_of_month_balance", "trend"], additionalProperties: false },
            },
            required: ["health_summary", "health_score", "savings_goal", "budget_suggestions", "alerts", "monthly_projection"],
            additionalProperties: false,
          },
        },
      }],
      toolChoice: { type: "function", function: { name: "financial_plan" } },
    });

    if (!response.ok) return aiErrorResponse(response.status);

    const aiData = await response.json();
    const result = parseToolCallResult(aiData);
    if (!result) return jsonRes({ error: "Failed to generate plan" }, 500);
    return jsonRes(result);
  }

  return jsonRes({ error: "Invalid action" }, 400);
}

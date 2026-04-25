/**
 * AI Tool Handlers — Finance (transactions, goals, recurring, budgets, analytics)
 * Extracted from useAIToolExecution for maintainability.
 */
import type { ToolContext } from "./toolContext";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { fetchBankAccounts, fetchInvestments, fetchFinancialConnections } from "./dataQueries";

export async function handleFinanceTool(name: string, args: Record<string, any>, ctx: ToolContext): Promise<string | null> {
  const { user, supabase, getInsertWorkspaceId, financeTransactionsRef, financeGoalsRef, financeRecurringRef, budgetsRef, state, habitsRef } = ctx;

  switch (name) {
    case "add_finance_transaction": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const wsId = getInsertWorkspaceId();
      const { data: insertedTx, error } = await supabase.from("finance_transactions").insert({
        user_id: user.id, description: args.description, amount: args.amount, type: args.type, category: args.category || "Outros",
        ...(args.date ? { date: args.date } : {}), ...(wsId ? { workspace_id: wsId } : {}),
      }).select("id").single();
      if (error || !insertedTx) return `[ERRO] Falha ao registrar transação: ${error?.message || "sem retorno"}`;
      financeTransactionsRef.current = [{ id: insertedTx.id, description: args.description, amount: args.amount, type: args.type, category: args.category || "Outros", date: args.date }, ...financeTransactionsRef.current];
      return `[OK] ${args.type === "income" ? "Receita" : "Despesa"} de R$${args.amount.toFixed(2)} registrada: "${args.description}"${args.date ? ` em ${args.date}` : ""}.`;
    }
    case "get_finance_summary": {
      const period = args.period || "month";
      const now = new Date();
      let txs = financeTransactionsRef.current;
      if (period !== "all") {
        const cutoff = new Date();
        if (period === "today") cutoff.setHours(0, 0, 0, 0);
        else if (period === "week") cutoff.setDate(now.getDate() - 7);
        else if (period === "month") cutoff.setMonth(now.getMonth() - 1);
        else if (period === "year") cutoff.setFullYear(now.getFullYear() - 1);
        txs = txs.filter((t: any) => new Date(t.date || t.created_at || 0) >= cutoff);
      }
      const income = txs.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const expense = txs.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const goals = financeGoalsRef.current;
      let summary = `💰 **Resumo Financeiro**\n- Receitas: R$${income.toFixed(2)}\n- Despesas: R$${expense.toFixed(2)}\n- Saldo: R$${(income - expense).toFixed(2)}`;
      if (goals.length > 0) summary += `\n\n🎯 **Metas (${goals.length})**:\n${goals.map((g: any) => `- ${g.name}: R$${Number(g.current).toFixed(2)} / R$${Number(g.target).toFixed(2)} (${Math.round((Number(g.current) / Number(g.target)) * 100)}%)`).join("\n")}`;
      return summary;
    }
    case "add_finance_goal": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const wsId = getInsertWorkspaceId();
      const { data: insertedGoal, error } = await supabase.from("finance_goals").insert({ user_id: user.id, name: args.name, target: args.target, current: args.current || 0, ...(wsId ? { workspace_id: wsId } : {}) }).select("id").single();
      if (error || !insertedGoal) return `[ERRO] Falha ao criar meta: ${error?.message || "sem retorno"}`;
      financeGoalsRef.current = [...financeGoalsRef.current, { id: insertedGoal.id, name: args.name, target: args.target, current: args.current || 0 }];
      return `[OK] Meta financeira "${args.name}" criada com alvo de R$${args.target.toFixed(2)}.`;
    }
    case "update_finance_goal": {
      const goal = financeGoalsRef.current.find((g: any) => g.name?.toLowerCase().includes(args.goal_identifier.toLowerCase()) || g.id === args.goal_identifier);
      if (!goal) return `[ERRO] Meta "${args.goal_identifier}" não encontrada.`;
      const { error } = await supabase.from("finance_goals").update({ current: args.new_current }).eq("id", goal.id);
      if (error) return `[ERRO] Falha ao atualizar meta: ${error.message}`;
      goal.current = args.new_current;
      return `[OK] Meta "${goal.name}" atualizada para R$${args.new_current.toFixed(2)} / R$${Number(goal.target).toFixed(2)}.`;
    }
    case "get_finance_goals":
      if (financeGoalsRef.current.length === 0) return "Nenhuma meta financeira encontrada.";
      return `Metas financeiras:\n${financeGoalsRef.current.map((g: any) => `- **${g.name}**: R$${Number(g.current).toFixed(2)} / R$${Number(g.target).toFixed(2)} (${Math.round((Number(g.current) / Number(g.target)) * 100)}%)`).join("\n")}`;
    case "add_finance_recurring": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const wsId = getInsertWorkspaceId();
      const { data: inserted, error } = await supabase.from("finance_recurring").insert({ user_id: user.id, description: args.description, amount: args.amount, type: args.type, category: args.category || "Outros", day_of_month: args.day_of_month || 1, ...(wsId ? { workspace_id: wsId } : {}) } as any).select("id").single();
      if (error || !inserted) return `[ERRO] Falha ao criar recorrência: ${error?.message || "sem retorno"}`;
      financeRecurringRef.current = [...financeRecurringRef.current, { id: inserted?.id, description: args.description, amount: args.amount, type: args.type, category: args.category || "Outros", active: true, day_of_month: args.day_of_month || 1 }];
      return `[OK] Recorrência "${args.description}" criada: R$${args.amount.toFixed(2)} (${args.type === "income" ? "receita" : "despesa"}) no dia ${args.day_of_month || 1}.`;
    }
    case "delete_finance_recurring": {
      const rec = financeRecurringRef.current.find((r: any) => r.description?.toLowerCase().includes(args.recurring_identifier.toLowerCase()) || r.id === args.recurring_identifier);
      if (!rec) return `[ERRO] Recorrência "${args.recurring_identifier}" não encontrada.`;
      const { error } = await supabase.from("finance_recurring").delete().eq("id", rec.id);
      if (error) return `[ERRO] Falha ao excluir: ${error.message}`;
      financeRecurringRef.current = financeRecurringRef.current.filter((r: any) => r.id !== rec.id);
      return `[OK] Recorrência "${rec.description}" excluída.`;
    }
    case "toggle_finance_recurring": {
      const rec = financeRecurringRef.current.find((r: any) => r.description?.toLowerCase().includes(args.recurring_identifier.toLowerCase()) || r.id === args.recurring_identifier);
      if (!rec) return `[ERRO] Recorrência "${args.recurring_identifier}" não encontrada.`;
      const { error } = await supabase.from("finance_recurring").update({ active: args.active }).eq("id", rec.id);
      if (error) return `[ERRO] Falha ao atualizar: ${error.message}`;
      rec.active = args.active;
      return `[OK] Recorrência "${rec.description}" ${args.active ? "ativada" : "desativada"}.`;
    }
    case "get_finance_recurring":
      if (financeRecurringRef.current.length === 0) return "Nenhuma recorrência financeira encontrada.";
      return `Recorrências financeiras:\n${financeRecurringRef.current.map((r: any) => `- ${r.active ? "✅" : "⏸️"} **${r.description}**: R$${Number(r.amount).toFixed(2)} (${r.type === "income" ? "receita" : "despesa"}) - dia ${r.day_of_month} - ${r.category}`).join("\n")}`;
    case "add_budget": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const wsId = getInsertWorkspaceId();
      const { data: inserted, error } = await supabase.from("finance_budgets").insert({ user_id: user.id, category: args.category, monthly_limit: args.monthly_limit, ...(wsId ? { workspace_id: wsId } : {}) }).select("id,category,monthly_limit").single();
      if (error || !inserted) return `[ERRO] Falha ao criar orçamento: ${error?.message || "sem retorno"}`;
      budgetsRef.current = [...budgetsRef.current, inserted];
      return `[OK] 💳 Orçamento de R$${args.monthly_limit.toFixed(2)}/mês criado para "${args.category}".`;
    }
    case "get_budgets": {
      if (budgetsRef.current.length === 0) return "Nenhum orçamento cadastrado.";
      const txs = financeTransactionsRef.current;
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const budgetStatus = budgetsRef.current.map(b => {
        const spent = txs.filter(t => t.type === "expense" && t.category === b.category && (() => { const d = new Date(t.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; })()).reduce((s: number, t: any) => s + Number(t.amount), 0);
        const pct = Math.round((spent / b.monthly_limit) * 100);
        const status = pct >= 100 ? "🔴 Estourado" : pct >= 80 ? "🟡 Atenção" : "🟢 OK";
        return `- ${status} **${b.category}**: R$${spent.toFixed(2)} / R$${Number(b.monthly_limit).toFixed(2)} (${pct}%)`;
      });
      return `💳 **Orçamentos do mês**:\n${budgetStatus.join("\n")}`;
    }
    case "get_recent_transactions": {
      const limit = args.limit || 15;
      const typeFilter = args.type_filter || "all";
      let txs = financeTransactionsRef.current;
      if (typeFilter !== "all") txs = txs.filter(t => t.type === typeFilter);
      const sliced = txs.slice(0, limit);
      if (sliced.length === 0) return "Nenhuma transação encontrada.";
      return `💰 **Transações recentes** (${sliced.length}):\n${sliced.map(t => `- ${t.type === "income" ? "📈" : "📉"} **${t.description}**: R$${Number(t.amount).toFixed(2)} (${t.category}) — ${new Date(t.date).toLocaleDateString("pt-BR")}`).join("\n")}`;
    }
    case "delete_finance_transaction": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const tx = financeTransactionsRef.current.find((t: any) => t.description?.toLowerCase().includes(args.transaction_identifier.toLowerCase()) || t.id === args.transaction_identifier);
      if (!tx) return `[ERRO] Transação "${args.transaction_identifier}" não encontrada.`;
      const { error } = await supabase.from("finance_transactions").delete().eq("id", tx.id);
      if (error) return `[ERRO] Falha ao excluir transação: ${error.message}`;
      financeTransactionsRef.current = financeTransactionsRef.current.filter((t: any) => t.id !== tx.id);
      return `[OK] 💰 Transação "${tx.description}" (R$${Number(tx.amount).toFixed(2)}) excluída.`;
    }
    case "edit_finance_transaction": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const tx = financeTransactionsRef.current.find((t: any) => t.description?.toLowerCase().includes(args.transaction_identifier.toLowerCase()) || t.id === args.transaction_identifier);
      if (!tx) return `[ERRO] Transação "${args.transaction_identifier}" não encontrada.`;
      const updates: TablesUpdate<"finance_transactions"> = {};
      if (args.new_description) updates.description = args.new_description;
      if (args.new_amount !== undefined) updates.amount = args.new_amount;
      if (args.new_category) updates.category = args.new_category;
      if (args.new_type) updates.type = args.new_type;
      if (Object.keys(updates).length === 0) return "[ERRO] Nenhuma alteração especificada.";
      const { error } = await supabase.from("finance_transactions").update(updates).eq("id", tx.id);
      if (error) return `[ERRO] Falha ao editar transação: ${error.message}`;
      Object.assign(tx, updates);
      return `[OK] 💰 Transação "${tx.description}" atualizada.`;
    }
    case "delete_budget": {
      const budget = budgetsRef.current.find(b => b.category?.toLowerCase().includes(args.budget_identifier.toLowerCase()) || b.id === args.budget_identifier);
      if (!budget) return `[ERRO] Orçamento "${args.budget_identifier}" não encontrado.`;
      const { error } = await supabase.from("finance_budgets").delete().eq("id", budget.id);
      if (error) return `[ERRO] Falha ao excluir orçamento: ${error.message}`;
      budgetsRef.current = budgetsRef.current.filter(b => b.id !== budget.id);
      return `[OK] 💳 Orçamento de "${budget.category}" excluído.`;
    }
    case "edit_budget": {
      const budget = budgetsRef.current.find(b => b.category?.toLowerCase().includes(args.budget_identifier.toLowerCase()) || b.id === args.budget_identifier);
      if (!budget) return `[ERRO] Orçamento "${args.budget_identifier}" não encontrado.`;
      const { error } = await supabase.from("finance_budgets").update({ monthly_limit: args.new_monthly_limit }).eq("id", budget.id);
      if (error) return `[ERRO] Falha ao editar orçamento: ${error.message}`;
      budget.monthly_limit = args.new_monthly_limit;
      return `[OK] 💳 Orçamento de "${budget.category}" atualizado para R$${args.new_monthly_limit.toFixed(2)}/mês.`;
    }
    case "get_category_stats": {
      const period = args.period || "month";
      const typeFilter = args.type_filter || "all";
      const now = new Date();
      const cutoff = new Date();
      if (period === "week") cutoff.setDate(now.getDate() - 7);
      else if (period === "month") cutoff.setMonth(now.getMonth() - 1);
      else cutoff.setFullYear(now.getFullYear() - 1);
      let txs = financeTransactionsRef.current.filter((t: any) => new Date(t.date || 0) >= cutoff);
      if (typeFilter !== "all") txs = txs.filter((t: any) => t.type === typeFilter);
      const byCategory: Record<string, { total: number; count: number }> = {};
      for (const t of txs) { const cat = (t as any).category || "Outros"; if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0 }; byCategory[cat].total += Number((t as any).amount); byCategory[cat].count++; }
      const sorted = Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total);
      const grandTotal = sorted.reduce((s, [, v]) => s + v.total, 0);
      if (sorted.length === 0) return `Nenhuma transação ${typeFilter !== "all" ? `(${typeFilter}) ` : ""}encontrada no período (${period}).`;
      return `📊 **Estatísticas por Categoria** (${period}${typeFilter !== "all" ? ` - ${typeFilter}` : ""}):\n${sorted.map(([cat, v]) => `- **${cat}**: R$${v.total.toFixed(2)} (${v.count}x) — ${Math.round((v.total / grandTotal) * 100)}%`).join("\n")}\n\n💰 Total: R$${grandTotal.toFixed(2)}`;
    }
    case "analyze_spending_patterns": {
      const monthsBack = args.months || 3;
      const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - monthsBack);
      const txs = financeTransactionsRef.current.filter((t: any) => t.type === "expense" && new Date(t.date || 0) >= cutoff);
      if (txs.length < 3) return "Dados insuficientes para análise de padrões. Registre mais transações.";
      const byMonth: Record<string, Record<string, number>> = {};
      const byCategory: Record<string, number[]> = {};
      for (const t of txs) { const d = new Date((t as any).date || 0); const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; const cat = (t as any).category || "Outros"; if (!byMonth[monthKey]) byMonth[monthKey] = {}; byMonth[monthKey][cat] = (byMonth[monthKey][cat] || 0) + Number((t as any).amount); if (!byCategory[cat]) byCategory[cat] = []; byCategory[cat].push(Number((t as any).amount)); }
      const totalByMonth = Object.entries(byMonth).map(([m, cats]) => ({ month: m, total: Object.values(cats).reduce((s, v) => s + v, 0) })).sort((a, b) => a.month.localeCompare(b.month));
      const avgMonthly = totalByMonth.reduce((s, m) => s + m.total, 0) / totalByMonth.length;
      const anomalies: string[] = [];
      for (const [cat, amounts] of Object.entries(byCategory)) { const catAvg = amounts.reduce((s, v) => s + v, 0) / amounts.length; const lastAmount = amounts[amounts.length - 1]; if (lastAmount > catAvg * 1.3 && amounts.length >= 2) anomalies.push(`⚠️ **${cat}**: último gasto (R$${lastAmount.toFixed(2)}) está ${Math.round(((lastAmount / catAvg) - 1) * 100)}% acima da média (R$${catAvg.toFixed(2)})`); }
      const trend = totalByMonth.length >= 2 ? totalByMonth[totalByMonth.length - 1].total > totalByMonth[totalByMonth.length - 2].total ? "📈 crescente" : "📉 decrescente" : "↔️ estável";
      let result = `🔍 **Análise de Padrões de Gasto** (últimos ${monthsBack} meses)\n\n📊 **Tendência geral**: ${trend}\n💰 **Média mensal**: R$${avgMonthly.toFixed(2)}\n\n📅 **Por mês**:\n${totalByMonth.map(m => `- ${m.month}: R$${m.total.toFixed(2)}`).join("\n")}\n\n`;
      if (anomalies.length > 0) result += `🚨 **Anomalias detectadas**:\n${anomalies.join("\n")}\n\n`;
      const catTotals = Object.entries(byCategory).map(([cat, amounts]) => ({ cat, total: amounts.reduce((s, v) => s + v, 0) })).sort((a, b) => b.total - a.total);
      result += `🏆 **Top categorias**:\n${catTotals.slice(0, 5).map((c, i) => `${i + 1}. **${c.cat}**: R$${c.total.toFixed(2)}`).join("\n")}`;
      return result;
    }
    case "compare_periods": {
      const periodType = args.period_type || "month";
      const offset = args.offset || 1;
      const now = new Date();
      let currentStart: Date, currentEnd: Date, prevStart: Date, prevEnd: Date;
      if (periodType === "month") { currentStart = new Date(now.getFullYear(), now.getMonth(), 1); currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0); prevStart = new Date(now.getFullYear(), now.getMonth() - offset, 1); prevEnd = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0); }
      else if (periodType === "quarter") { const q = Math.floor(now.getMonth() / 3); currentStart = new Date(now.getFullYear(), q * 3, 1); currentEnd = new Date(now.getFullYear(), q * 3 + 3, 0); prevStart = new Date(now.getFullYear(), (q - offset) * 3, 1); prevEnd = new Date(now.getFullYear(), (q - offset) * 3 + 3, 0); }
      else { currentStart = new Date(now.getFullYear(), 0, 1); currentEnd = new Date(now.getFullYear(), 11, 31); prevStart = new Date(now.getFullYear() - offset, 0, 1); prevEnd = new Date(now.getFullYear() - offset, 11, 31); }
      const currentTxs = financeTransactionsRef.current.filter((t: any) => { const d = new Date(t.date || 0); return d >= currentStart && d <= currentEnd; });
      const prevTxs = financeTransactionsRef.current.filter((t: any) => { const d = new Date(t.date || 0); return d >= prevStart && d <= prevEnd; });
      const calc = (txs: any[]) => ({ income: txs.filter(t => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0), expense: txs.filter(t => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0), count: txs.length });
      const curr = calc(currentTxs); const prev = calc(prevTxs);
      const pctChange = (c: number, p: number) => p === 0 ? "N/A" : `${c > p ? "+" : ""}${Math.round(((c / p) - 1) * 100)}%`;
      const formatPeriod = (start: Date) => start.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
      let result = `📊 **Comparação: ${formatPeriod(currentStart)} vs ${formatPeriod(prevStart)}**\n\n| | Atual | Anterior | Variação |\n|---|---|---|---|\n`;
      result += `| 📈 Receitas | R$${curr.income.toFixed(2)} | R$${prev.income.toFixed(2)} | ${pctChange(curr.income, prev.income)} |\n`;
      result += `| 📉 Despesas | R$${curr.expense.toFixed(2)} | R$${prev.expense.toFixed(2)} | ${pctChange(curr.expense, prev.expense)} |\n`;
      result += `| 💰 Saldo | R$${(curr.income - curr.expense).toFixed(2)} | R$${(prev.income - prev.expense).toFixed(2)} | ${pctChange(curr.income - curr.expense, prev.income - prev.expense)} |\n`;
      result += `| 📋 Transações | ${curr.count} | ${prev.count} | ${pctChange(curr.count, prev.count)} |\n`;
      return result;
    }
    case "goal_projections": {
      const goals = financeGoalsRef.current;
      if (goals.length === 0) return "Nenhuma meta financeira cadastrada.";
      const txs = financeTransactionsRef.current;
      const income = txs.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const expense = txs.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const monthlySavings = income - expense;
      let result = `🎯 **Projeção de Metas Financeiras**\n\n💵 Capacidade de economia estimada: R$${monthlySavings.toFixed(2)}/mês\n\n`;
      for (const g of goals) {
        const remaining = Number(g.target) - Number(g.current);
        const pct = Math.round((Number(g.current) / Number(g.target)) * 100);
        if (remaining <= 0) result += `✅ **${g.name}**: Meta atingida! 🎉\n`;
        else if (monthlySavings <= 0) result += `⚠️ **${g.name}**: R$${Number(g.current).toFixed(2)} / R$${Number(g.target).toFixed(2)} (${pct}%) — Sem capacidade de economia atual\n`;
        else { const monthsToGoal = Math.ceil(remaining / monthlySavings); const projectedDate = new Date(); projectedDate.setMonth(projectedDate.getMonth() + monthsToGoal); result += `📌 **${g.name}**: R$${Number(g.current).toFixed(2)} / R$${Number(g.target).toFixed(2)} (${pct}%)\n   → Faltam R$${remaining.toFixed(2)} — previsão: **${projectedDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}** (~${monthsToGoal} meses)\n\n`; }
      }
      return result;
    }
    case "get_productivity_score": {
      const now = new Date();
      const totalTasks = state.tasks.length; const doneTasks = state.tasks.filter(t => t.done).length; const pendingTasks = totalTasks - doneTasks;
      const overdue = state.tasks.filter(t => !t.done && (t as any).due_date && (t as any).due_date < now.toISOString().split("T")[0]).length;
      const highPriPending = state.tasks.filter(t => !t.done && (t.priority === "high" || (t as any).priority === "urgent")).length;
      const habits = habitsRef.current.data?.habits || []; const habitsDoneToday = habits.filter((h: any) => h.completedToday).length;
      const avgStreak = habits.length ? habits.reduce((s: number, h: any) => s + (h.streak || 0), 0) / habits.length : 0;
      const txs = financeTransactionsRef.current;
      const income = txs.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const expense = txs.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;
      const budgetsTotal = budgetsRef.current.length;
      const budgetsOk = budgetsRef.current.filter(b => { const spent = txs.filter((t: any) => t.type === "expense" && t.category === b.category && (() => { const d = new Date(t.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })()).reduce((s: number, t: any) => s + Number(t.amount), 0); return spent <= Number(b.monthly_limit); }).length;
      const taskScore = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100 - (overdue * 10)) : 50;
      const habitScore = habits.length > 0 ? Math.round((habitsDoneToday / habits.length) * 50 + Math.min(avgStreak * 5, 50)) : 50;
      const financeScore = Math.min(100, Math.max(0, Math.round(savingsRate + (budgetsTotal > 0 ? (budgetsOk / budgetsTotal) * 30 : 15))));
      const overallScore = Math.round((taskScore * 0.35 + habitScore * 0.30 + financeScore * 0.35));
      const scoreEmoji = (s: number) => s >= 80 ? "🟢" : s >= 60 ? "🟡" : s >= 40 ? "🟠" : "🔴";
      const gradeLabel = (s: number) => s >= 90 ? "Excelente" : s >= 75 ? "Muito Bom" : s >= 60 ? "Bom" : s >= 40 ? "Regular" : "Precisa melhorar";
      let result = `📊 **Score de Produtividade**: ${scoreEmoji(overallScore)} **${overallScore}/100** — ${gradeLabel(overallScore)}\n\n`;
      result += `📋 **Tarefas** ${scoreEmoji(taskScore)} ${taskScore}/100\n  ${doneTasks} concluídas, ${pendingTasks} pendentes${overdue > 0 ? `, ⚠️ ${overdue} atrasadas` : ""}${highPriPending > 0 ? `, 🔥 ${highPriPending} alta prioridade` : ""}\n\n`;
      result += `🏋️ **Hábitos** ${scoreEmoji(habitScore)} ${habitScore}/100\n  ${habitsDoneToday}/${habits.length} hoje | Streak médio: ${avgStreak.toFixed(1)} dias\n\n`;
      result += `💰 **Finanças** ${scoreEmoji(financeScore)} ${financeScore}/100\n  Taxa de economia: ${savingsRate.toFixed(1)}%${budgetsTotal > 0 ? ` | Orçamentos OK: ${budgetsOk}/${budgetsTotal}` : ""}\n\n`;
      const insights: string[] = [];
      if (overdue > 0) insights.push(`⚠️ Resolva ${overdue} tarefa(s) atrasada(s) para melhorar seu score`);
      if (habitsDoneToday < habits.length && habits.length > 0) insights.push(`💪 Complete mais ${habits.length - habitsDoneToday} hábito(s) hoje`);
      if (savingsRate < 20 && income > 0) insights.push(`💡 Tente economizar mais — meta ideal: >20% da receita`);
      if (highPriPending > 3) insights.push(`🔥 Muitas tarefas de alta prioridade pendentes — priorize!`);
      if (avgStreak > 7) insights.push(`🎉 Ótimos streaks de hábitos — continue assim!`);
      if (insights.length > 0) result += `\n💡 **Insights**:\n${insights.join("\n")}`;
      return result;
    }
    // Open Banking
    case "get_bank_accounts": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      if (ctx.bankAccountsRef.current.length === 0) { const { data } = await fetchBankAccounts(user.id); ctx.bankAccountsRef.current = data || []; }
      if (ctx.bankAccountsRef.current.length === 0) return "Nenhuma conta bancária conectada. Conecte seus bancos em Finanças > Open Banking.";
      const typeEmoji: Record<string, string> = { checking: "🏦", savings: "💰", credit: "💳", investment: "📈" };
      const total = ctx.bankAccountsRef.current.reduce((s: number, a: any) => s + (["checking", "savings"].includes(a.type) ? (a.current_balance || 0) : 0), 0);
      return `🏦 **Contas Bancárias** (${ctx.bankAccountsRef.current.length}):\n${ctx.bankAccountsRef.current.map((a: any) => `- ${typeEmoji[a.type] || "🏦"} **${a.name || a.institution_name}** (${a.type})\n  Saldo: R$ ${(a.current_balance || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${a.credit_limit ? ` | Limite: R$ ${a.credit_limit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}`).join("\n")}\n\n💰 **Saldo total (corrente + poupança)**: R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    }
    case "get_investments": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      if (ctx.investmentsRef.current.length === 0) { const { data } = await fetchInvestments(user.id); ctx.investmentsRef.current = data || []; }
      if (ctx.investmentsRef.current.length === 0) return "Nenhum investimento encontrado. Conecte seus bancos/corretoras em Finanças > Open Banking.";
      const total = ctx.investmentsRef.current.reduce((s: number, i: any) => s + (i.current_value || 0), 0);
      const typeEmoji: Record<string, string> = { MUTUAL_FUND: "📊", FIXED_INCOME: "🔒", EQUITY: "📈", ETF: "📉", CRYPTO: "₿", COE: "📋" };
      return `📈 **Investimentos** (${ctx.investmentsRef.current.length}):\n${ctx.investmentsRef.current.map((i: any) => `- ${typeEmoji[i.type] || "📊"} **${i.name}**${i.ticker ? ` (${i.ticker})` : ""}\n  Valor: R$ ${(i.current_value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${i.quantity ? ` | Qtd: ${i.quantity}` : ""}${i.cost_basis ? ` | Custo: R$ ${i.cost_basis.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}`).join("\n")}\n\n💎 **Total investido**: R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    }
    case "get_financial_connections": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      if (ctx.financialConnectionsRef.current.length === 0) { const { data } = await fetchFinancialConnections(user.id); ctx.financialConnectionsRef.current = data || []; }
      if (ctx.financialConnectionsRef.current.length === 0) return "Nenhuma instituição financeira conectada. Use Finanças > Open Banking para conectar seus bancos.";
      const statusEmoji: Record<string, string> = { active: "🟢", syncing: "🔄", error: "🔴", credentials_error: "🟡" };
      return `🔗 **Conexões Financeiras** (${ctx.financialConnectionsRef.current.length}):\n${ctx.financialConnectionsRef.current.map((c: any) => `- ${statusEmoji[c.status] || "⚪"} **${c.institution_name || c.provider}** — ${c.status}${c.last_synced_at ? `\n  Última sync: ${new Date(c.last_synced_at).toLocaleString("pt-BR")}` : ""}`).join("\n")}`;
    }
    case "get_bank_transactions": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const limit = args.limit || 20;
      let query = (supabase as any).from("financial_transactions_unified").select("id,description,amount,type,category,date,account_name,currency").eq("user_id", user.id).order("date", { ascending: false }).limit(limit);
      if (args.account_id) query = query.eq("account_id", args.account_id);
      const { data: txs } = await query;
      if (!txs?.length) return "Nenhuma transação bancária encontrada.";
      return `🏦 **Transações Bancárias** (${txs.length}):\n${txs.map((t: any) => `- ${t.type === "inflow" ? "📈" : "📉"} **${t.description || "Sem descrição"}**: R$ ${Math.abs(t.amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n  ${t.category || "Sem categoria"} | ${t.account_name || ""} | ${new Date(t.date).toLocaleDateString("pt-BR")}`).join("\n")}`;
    }
    default:
      return null;
  }
}

export const FINANCE_TOOL_NAMES = new Set([
  "add_finance_transaction", "get_finance_summary", "add_finance_goal", "update_finance_goal", "get_finance_goals",
  "add_finance_recurring", "delete_finance_recurring", "toggle_finance_recurring", "get_finance_recurring",
  "add_budget", "get_budgets", "get_recent_transactions", "delete_finance_transaction", "edit_finance_transaction",
  "delete_budget", "edit_budget", "get_category_stats", "analyze_spending_patterns", "compare_periods",
  "goal_projections", "get_productivity_score",
  "get_bank_accounts", "get_investments", "get_financial_connections", "get_bank_transactions",
]);

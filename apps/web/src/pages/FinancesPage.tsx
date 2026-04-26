import { lazy, Suspense } from "react";
import PageLayout from "@/components/dashboard/PageLayout";
import { usePageMeta } from "@/contexts/PageMetaContext";
import ConnectionBadge from "@/components/dashboard/ConnectionBadge";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import YearlySummary from "@/components/dashboard/YearlySummary";
import ConnectBankWidget from "@/components/finance/ConnectBankWidget";
import OpenBankingAccountsCard from "@/components/finance/OpenBankingAccountsCard";
import EnrichButton from "@/components/finance/EnrichButton";
import FinanceLoadingSkeleton from "@/components/finance/FinanceLoadingSkeleton";
import OverviewTab from "@/components/finance/tabs/OverviewTab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useFinanceAI } from "@/hooks/finance/useFinanceAI";
import { useConnections } from "@/contexts/ConnectionsContext";
import { usePlatformIntegrationsContext } from "@/contexts/PlatformIntegrationsContext";
import { useDbFinances } from "@/hooks/finance/useDbFinances";
import { useFinancialAccounts, useFinancialConnections, useFinancialInvestments } from "@/hooks/finance/useFinance";
import { useFinancialLoans } from "@/hooks/finance/useFinanceExtended";
import { usePluggyInsights } from "@/hooks/finance/usePluggyInsights";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { exportToCsv } from "@/lib/exportCsv";
import { MONTH_NAMES, formatCurrency } from "@/components/finance/financeConstants";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Download, CalendarDays, Calendar,
  BarChart3, ArrowLeftRight, TrendingUp, Landmark, Loader2,
} from "lucide-react";
import { useFinanceWidgetPrefs } from "@/hooks/finance/useFinanceWidgetPrefs";

// Lazy-load heavy tabs (only one visible at a time)
const TransactionsTab = lazy(() => import("@/components/finance/tabs/TransactionsTab"));
const InvestmentsTab = lazy(() => import("@/components/finance/tabs/InvestmentsTab"));
const OpenBankingTab = lazy(() => import("@/components/finance/tabs/OpenBankingTab"));
const FinanceCustomizePanel = lazy(() => import("@/components/finance/FinanceCustomizePanel"));

const FinancesPage = () => {
  const navigate = useNavigate();
  const { activeWorkspaceId } = useWorkspace();
  const { getConnectionByCategory } = useConnections();
  const { isIntegrationEnabled } = usePlatformIntegrationsContext();
  const isConnected = false;
  const widgetPrefs = useFinanceWidgetPrefs();

  // ── Data hooks ──
  const {
    goals, transactions, recurring, budgets, isLoading: dbLoading,
    addGoal, updateGoalAmount, deleteGoal,
    addTransaction, updateTransaction, deleteTransaction,
    addRecurring, toggleRecurring, deleteRecurring, generateRecurring,
    setBudgetLimit,
    totalIncome, totalExpense, balance, categoryBreakdown,
    dailyTrend, insights,
    selectedMonth, setSelectedMonth,
    selectedYear, setSelectedYear,
    yearlySummary, yearlyTotals, isLoadingYearly,
    refetch,
  } = useDbFinances();

  const { accounts: obAccounts, refresh: refreshObAccounts } = useFinancialAccounts();
  const { connections: obConnections, syncConnection, removeConnection, refresh: refreshObConnections } = useFinancialConnections();
  const hasObConnections = obConnections.length > 0;
  const [reconnectItemId, setReconnectItemId] = useState<string | null>(null);
  const { investments } = useFinancialInvestments();
  const totalInvestments = useMemo(() => investments.reduce((s, i) => s + (i.current_value || 0), 0), [investments]);
  const { loans } = useFinancialLoans();

  const {
    kpis, recurringPayments, behaviorAnalysis, categories,
    fetching: insightsFetching, fetchKpis, fetchRecurring, fetchBehaviorAnalysis,
    fetchConsents, revokeConsent, fetchItemStatus, fetchCategories, fetchCategoryRules,
    createCategoryRule, enrichTransactions,
  } = usePluggyInsights();

  // ── AI ──
  const { categorize, analyze, isCategorizing, isAnalyzing, analysis } = useFinanceAI();

  // ── Auto-sync stale connections (once per session per workspace) ──
  const obConnectionIds = useMemo(() => obConnections.map(c => c.id).sort().join(","), [obConnections]);
  useEffect(() => {
    const key = `finance-auto-sync-${activeWorkspaceId || "all"}`;
    if (sessionStorage.getItem(key)) return;
    if (!obConnectionIds) return;
    sessionStorage.setItem(key, "1");
    const staleConnections = obConnections.filter(c => {
      if (!["active", "synced"].includes(c.status || "")) return false;
      if (!c.last_synced_at) return true;
      return Date.now() - new Date(c.last_synced_at).getTime() > 60 * 60 * 1000;
    });
    if (staleConnections.length > 0) {
      staleConnections.forEach(c => {
        syncConnection(c).then((result) => {
          if (result?.error === "INVALID_CREDENTIALS") {
            setReconnectItemId(c.provider_connection_id);
            toast({
              title: "Credenciais inválidas",
              description: `${c.institution_name || "Banco"} precisa ser reconectado.`,
              variant: "destructive",
            });
          } else if (result?.error === "WAITING_USER_INPUT") {
            setReconnectItemId(c.provider_connection_id);
            toast({
              title: "Verificação necessária",
              description: `${c.institution_name || "Banco"} requer verificação adicional (MFA).`,
              variant: "destructive",
            });
          } else if (result?.error === "ITEM_NOT_FOUND") {
            toast({
              title: "Conexão expirada",
              description: `${c.institution_name || "Banco"} não foi encontrado. Reconecte o banco.`,
              variant: "destructive",
            });
          } else {
            refetch();
            refreshObAccounts();
          }
        });
      });
    }
  }, [obConnectionIds, activeWorkspaceId]);

  // ── View state ──
  const [viewMode, setViewMode] = useState<"monthly" | "yearly">("monthly");
  const [activeTab, setActiveTab] = useState("overview");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterSource, setFilterSource] = useState<"all" | "manual" | "openbanking">("all");
  const [filterAccount, setFilterAccount] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // ── Month navigation ──
  const [monthYear, monthNum] = selectedMonth.split("-").map(Number);
  const monthLabel = `${MONTH_NAMES[monthNum - 1]} ${monthYear}`;
  const prevMonth = () => {
    const d = new Date(monthYear, monthNum - 2, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const nextMonth = () => {
    const d = new Date(monthYear, monthNum, 1);
    const now = new Date();
    if (d <= new Date(now.getFullYear(), now.getMonth() + 1, 1)) {
      setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
  };

  // ── Computed data ──
  const budgetAlerts = useMemo(() => {
    return budgets
      .filter(b => b.monthly_limit > 0)
      .map(b => {
        const spent = categoryBreakdown[b.category] || 0;
        const pct = (spent / b.monthly_limit) * 100;
        return { category: b.category, spent, limit: b.monthly_limit, pct };
      })
      .filter(a => a.pct >= 80)
      .sort((a, b) => b.pct - a.pct);
  }, [budgets, categoryBreakdown]);

  const recurringTotals = useMemo(() => {
    const active = recurring.filter(r => r.active);
    const income = active.filter(r => r.type === "income").reduce((s, r) => s + Number(r.amount), 0);
    const expense = active.filter(r => r.type === "expense").reduce((s, r) => s + Number(r.amount), 0);
    return { income, expense, net: income - expense };
  }, [recurring]);

  const savingsRate = insights.savingsRate;
  const uncategorizedCount = useMemo(() => transactions.filter(t => !t.category || t.category === "Outros").length, [transactions]);
  const incomeCount = useMemo(() => transactions.filter(t => t.type === "income").length, [transactions]);
  const expenseCount = useMemo(() => transactions.filter(t => t.type === "expense").length, [transactions]);

  const prevMonthCategoryBreakdown = useMemo(() => {
    if (!insights.prevMonthTotals) return {};
    return { total: insights.prevMonthTotals.expense };
  }, [insights.prevMonthTotals]);

  // Use refs to avoid stale closures when passing to categorize/analyze
  const transactionsRef = useRef(transactions);
  transactionsRef.current = transactions;
  const categoryBreakdownRef = useRef(categoryBreakdown);
  categoryBreakdownRef.current = categoryBreakdown;
  const budgetsRef = useRef(budgets);
  budgetsRef.current = budgets;

  const handleAutoCategorize = useCallback(async () => {
    const count = await categorize(transactionsRef.current);
    if (count > 0) refetch();
  }, [categorize, refetch]);

  const handleAnalyze = useCallback(async () => {
    await analyze(transactionsRef.current, categoryBreakdownRef.current, budgetsRef.current, selectedMonth, prevMonthCategoryBreakdown);
  }, [analyze, selectedMonth, prevMonthCategoryBreakdown]);

  const isLoading = dbLoading;

  usePageMeta({ title: "Financeiro" });

  return (
    <PageLayout maxWidth="7xl">
      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-end mb-4 sm:mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <ConnectionBadge isConnected={isConnected} isLoading={isLoading} size="lg" />
            <Suspense fallback={null}><FinanceCustomizePanel prefs={widgetPrefs} /></Suspense>
            {/* View mode toggle */}
            <div className="flex items-center glass-card rounded-full overflow-hidden">
              <button onClick={() => setViewMode("monthly")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 min-h-[44px] sm:min-h-0 ${viewMode === "monthly" ? "bg-primary/20 text-primary" : "text-foreground/60 hover:text-foreground"}`}>
                <CalendarDays className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Mensal</span>
              </button>
              <button onClick={() => setViewMode("yearly")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 min-h-[44px] sm:min-h-0 ${viewMode === "yearly" ? "bg-primary/20 text-primary" : "text-foreground/60 hover:text-foreground"}`}>
                <Calendar className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Anual</span>
              </button>
            </div>
            {viewMode === "monthly" && (
              <>
                <button
                  onClick={() => {
                    if (transactions.length === 0) return;
                    exportToCsv(
                      `financeiro-${selectedMonth}`,
                      ["Data", "Descrição", "Tipo", "Categoria", "Valor (R$)", "Fonte", "Conta"],
                      transactions.map(t => [
                        t.date, t.description, t.type === "income" ? "Receita" : "Despesa",
                        t.category, String(Number(t.amount).toFixed(2)),
                        (t as any).source === "openbanking" ? "Open Banking" : "Manual",
                        (t as any).account_name ?? "",
                      ])
                    );
                  }}
                  disabled={transactions.length === 0}
                  className="glass-card px-3 py-1.5 rounded-full text-foreground/60 hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Exportar CSV">
                  <Download className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2 glass-card px-3 py-1.5 rounded-full">
                  <button onClick={prevMonth} className="text-foreground/60 hover:text-foreground transition-colors p-1 min-h-[44px] sm:min-h-0 flex items-center">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs sm:text-sm font-medium text-foreground min-w-[110px] sm:min-w-[140px] text-center">{monthLabel}</span>
                  <button onClick={nextMonth} className="text-foreground/60 hover:text-foreground transition-colors p-1 min-h-[44px] sm:min-h-0 flex items-center">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Content ── */}
      {dbLoading ? (
        <FinanceLoadingSkeleton />
      ) : viewMode === "yearly" ? (
        <YearlySummary
          yearlySummary={yearlySummary}
          yearlyTotals={yearlyTotals}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          isLoading={isLoadingYearly}
        />
      ) : (
        <>
          {/* Open Banking Accounts */}
          {hasObConnections && (
            <AnimatedItem index={0}>
              <OpenBankingAccountsCard
                connections={obConnections}
                accounts={obAccounts}
                onSync={async (conn) => { await syncConnection(conn); refreshObAccounts(); refetch(); }}
                onRemove={async (id) => { await removeConnection(id); refreshObAccounts(); refetch(); }}
                onReconnect={(conn) => setReconnectItemId(conn.provider_connection_id)}
                onBalanceRefreshed={() => refreshObAccounts()}
                onEnrich={async (accountId, accountType) => {
                  const result = await enrichTransactions(accountId, accountType);
                  if (result?.enriched > 0) refetch();
                  return result;
                }}
              />
            </AnimatedItem>
          )}

          {/* Connect bank */}
          <AnimatedItem index={hasObConnections ? 1 : 0}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {hasObConnections && obAccounts.length > 0 && (
                  <EnrichButton
                    fetching={insightsFetching}
                    onEnrich={() => {
                      const firstAcc = obAccounts[0];
                      if (firstAcc) enrichTransactions(firstAcc.id, firstAcc.type);
                    }}
                  />
                )}
                <ConnectBankWidget
                  updateItemId={reconnectItemId || undefined}
                  onSuccess={() => {
                    setReconnectItemId(null);
                    refetch(); refreshObAccounts(); refreshObConnections();
                  }}
                />
              </div>
            </div>
          </AnimatedItem>

          {/* ── Tab Navigation ── */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start glass-card border border-border/30 bg-background/60 rounded-xl p-1 mb-4 gap-0.5 flex-wrap h-auto overflow-x-auto no-scrollbar">
              <TabsTrigger value="overview" className="flex items-center gap-1.5 text-xs font-medium data-[state=active]:bg-primary/12 data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:border-primary/20 border border-transparent rounded-lg px-3.5 py-2 transition-all duration-200 min-h-[44px] sm:min-h-0">
                <BarChart3 className="w-3.5 h-3.5" /> Visão Geral
              </TabsTrigger>
              <TabsTrigger value="transactions" className="flex items-center gap-1.5 text-xs font-medium data-[state=active]:bg-primary/12 data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:border-primary/20 border border-transparent rounded-lg px-3.5 py-2 transition-all duration-200 min-h-[44px] sm:min-h-0">
                <ArrowLeftRight className="w-3.5 h-3.5" /> Transações
                {transactions.length > 0 && (
                  <span className="ml-0.5 text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-full bg-foreground/8 text-muted-foreground">{transactions.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="investments" className="flex items-center gap-1.5 text-xs font-medium data-[state=active]:bg-primary/12 data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:border-primary/20 border border-transparent rounded-lg px-3.5 py-2 transition-all duration-200 min-h-[44px] sm:min-h-0">
                <TrendingUp className="w-3.5 h-3.5" /> Investimentos
                {investments.length > 0 && (
                  <span className="ml-0.5 text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-full bg-foreground/8 text-muted-foreground">{investments.length}</span>
                )}
              </TabsTrigger>
              {hasObConnections && (
                <TabsTrigger value="openbanking" className="flex items-center gap-1.5 text-xs font-medium data-[state=active]:bg-emerald-500/12 data-[state=active]:text-emerald-400 data-[state=active]:shadow-none data-[state=active]:border-emerald-400/20 border border-transparent rounded-lg px-3.5 py-2 transition-all duration-200 min-h-[44px] sm:min-h-0">
                  <Landmark className="w-3.5 h-3.5" /> Open Banking
                  <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="overview">
              <OverviewTab
                transactions={transactions}
                totalIncome={totalIncome}
                totalExpense={totalExpense}
                balance={balance}
                insights={insights}
                budgetAlerts={budgetAlerts}
                recurringTotals={recurringTotals}
                selectedMonth={selectedMonth}
                monthYear={monthYear}
                monthNum={monthNum}
                dailyTrend={dailyTrend}
                obAccounts={obAccounts}
                totalInvestments={totalInvestments}
                incomeCount={incomeCount}
                expenseCount={expenseCount}
                analysis={analysis}
                isAnalyzing={isAnalyzing}
                onAnalyze={handleAnalyze}
                budgets={budgets}
                categoryBreakdown={categoryBreakdown}
                savingsRate={savingsRate}
                recurring={recurring}
                isWidgetEnabled={widgetPrefs.isWidgetEnabled}
              />
            </TabsContent>

            <TabsContent value="transactions">
              <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}>
                <TransactionsTab
                  transactions={transactions}
                  dailyTrend={dailyTrend}
                  recurring={recurring}
                  budgets={budgets}
                  budgetAlerts={budgetAlerts}
                  categoryBreakdown={categoryBreakdown}
                  totalExpense={totalExpense}
                  filterCategory={filterCategory}
                  setFilterCategory={setFilterCategory}
                  filterSource={filterSource}
                  setFilterSource={setFilterSource as (v: string) => void}
                  filterAccount={filterAccount}
                  setFilterAccount={setFilterAccount}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  onAddTransaction={addTransaction}
                  onUpdateTransaction={updateTransaction}
                  onDeleteTransaction={deleteTransaction}
                  onAddRecurring={addRecurring}
                  onToggleRecurring={toggleRecurring}
                  onDeleteRecurring={deleteRecurring}
                  onGenerateRecurring={generateRecurring}
                  onAutoCategorize={handleAutoCategorize}
                  isCategorizing={isCategorizing}
                  uncategorizedCount={uncategorizedCount}
                  recurringTotals={recurringTotals}
                  onSetBudgetLimit={setBudgetLimit}
                  isWidgetEnabled={widgetPrefs.isWidgetEnabled}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="investments">
              <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}>
                <InvestmentsTab
                  investments={investments}
                  obAccounts={obAccounts}
                  loans={loans}
                  goals={goals}
                  onAddGoal={addGoal}
                  onUpdateGoalAmount={updateGoalAmount}
                  onDeleteGoal={deleteGoal}
                  isWidgetEnabled={widgetPrefs.isWidgetEnabled}
                />
              </Suspense>
            </TabsContent>

            {hasObConnections && (
              <TabsContent value="openbanking">
                <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}>
                  <OpenBankingTab
                    obConnections={obConnections}
                    kpis={kpis}
                    behaviorAnalysis={behaviorAnalysis}
                    categories={categories}
                    insightsFetching={insightsFetching}
                    recurringPayments={recurringPayments}
                    fetchKpis={fetchKpis}
                    fetchBehaviorAnalysis={fetchBehaviorAnalysis}
                    fetchRecurring={fetchRecurring}
                    fetchConsents={fetchConsents}
                    revokeConsent={revokeConsent}
                    fetchItemStatus={fetchItemStatus}
                    fetchCategories={fetchCategories}
                    fetchCategoryRules={fetchCategoryRules}
                    createCategoryRule={createCategoryRule}
                    onImportRecurring={async (payment) => {
                      await addRecurring(
                        payment.description || "Recorrente detectado",
                        Math.abs(payment.amount),
                        payment.amount < 0 ? "expense" : "income",
                        "Outros",
                        payment.day_of_month || 1,
                      );
                    }}
                    hasObConnections={hasObConnections}
                    isWidgetEnabled={widgetPrefs.isWidgetEnabled}
                  />
                </Suspense>
              </TabsContent>
            )}
          </Tabs>
        </>
      )}
    </PageLayout>
  );
};

export default FinancesPage;

import { motion } from "framer-motion";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import FinanceInsightsStrip from "@/components/finance/FinanceInsightsStrip";
import FinanceKPICards from "@/components/finance/FinanceKPICards";
import NetWorthCard from "@/components/finance/NetWorthCard";
import CashflowComparisonChart from "@/components/finance/CashflowComparisonChart";
import HealthScoreCard from "@/components/finance/HealthScoreCard";
import ExpenseProjectionCard from "@/components/finance/ExpenseProjectionCard";
import AIAnalysisPanel from "@/components/finance/AIAnalysisPanel";
import SmartPlanningCard from "@/components/finance/SmartPlanningCard";
import FinanceAIChat from "@/components/finance/FinanceAIChat";

interface OverviewTabProps {
  transactions: any[];
  totalIncome: number;
  totalExpense: number;
  balance: number;
  insights: any;
  budgetAlerts: any[];
  recurringTotals: { income: number; expense: number; net: number };
  selectedMonth: string;
  monthYear: number;
  monthNum: number;
  dailyTrend: any[];
  obAccounts: any[];
  totalInvestments: number;
  incomeCount: number;
  expenseCount: number;
  analysis: any;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  budgets: any[];
  categoryBreakdown: Record<string, number>;
  savingsRate: number;
  recurring: any[];
  isWidgetEnabled: (id: string) => boolean;
}

const OverviewTab = ({
  transactions, totalIncome, totalExpense, balance, insights,
  budgetAlerts, recurringTotals, selectedMonth, monthYear, monthNum,
  dailyTrend, obAccounts, totalInvestments, incomeCount, expenseCount,
  analysis, isAnalyzing, onAnalyze, budgets, categoryBreakdown, savingsRate, recurring,
  isWidgetEnabled,
}: OverviewTabProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-3"
    >
      {/* Insights Strip */}
      {isWidgetEnabled("insights_strip") && transactions.length > 3 && (
        <FinanceInsightsStrip
          totalIncome={totalIncome}
          totalExpense={totalExpense}
          balance={balance}
          savingsRate={insights.savingsRate}
          expenseChange={insights.expenseChange}
          incomeChange={insights.incomeChange}
          budgetAlerts={budgetAlerts}
          recurringNet={recurringTotals.net}
          daysInMonth={new Date(monthYear, monthNum, 0).getDate()}
          dayOfMonth={Math.min(new Date().getDate(), new Date(monthYear, monthNum, 0).getDate())}
        />
      )}

      {/* KPI Cards */}
      {isWidgetEnabled("kpi_cards") && (
        <FinanceKPICards
          balance={balance}
          totalIncome={totalIncome}
          totalExpense={totalExpense}
          savingsRate={insights.savingsRate}
          incomeChange={insights.incomeChange}
          expenseChange={insights.expenseChange}
          incomeCount={incomeCount}
          expenseCount={expenseCount}
          dailyTrend={dailyTrend}
        />
      )}

      {/* Net Worth */}
      {isWidgetEnabled("net_worth") && (
        <NetWorthCard
          bankAccounts={obAccounts}
          totalInvestments={totalInvestments}
          balance={balance}
          index={2.2}
        />
      )}

      {/* Cashflow Comparison */}
      {isWidgetEnabled("cashflow_chart") && transactions.length > 0 && (
        <CashflowComparisonChart
          currentIncome={totalIncome}
          currentExpense={totalExpense}
          prevIncome={insights.prevMonthTotals?.income ?? null}
          prevExpense={insights.prevMonthTotals?.expense ?? null}
          selectedMonth={selectedMonth}
          dailyTrend={dailyTrend}
          index={2.4}
        />
      )}

      {/* Health Score + Expense Projection side by side on desktop */}
      {transactions.length > 0 && (isWidgetEnabled("health_score") || isWidgetEnabled("expense_projection")) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {isWidgetEnabled("health_score") && (
            <HealthScoreCard
              savingsRate={insights.savingsRate}
              budgets={budgets}
              categoryBreakdown={categoryBreakdown}
              expenseChange={insights.expenseChange}
            />
          )}
          {isWidgetEnabled("expense_projection") && (
            <ExpenseProjectionCard
              selectedMonth={selectedMonth}
              totalIncome={totalIncome}
              totalExpense={totalExpense}
            />
          )}
        </div>
      )}

      {/* AI Analysis + Smart Planning */}
      {transactions.length >= 3 && (isWidgetEnabled("ai_analysis") || isWidgetEnabled("smart_planning")) && (
        <div className="space-y-3">
          {isWidgetEnabled("ai_analysis") && (
            <AIAnalysisPanel
              analysis={analysis}
              isAnalyzing={isAnalyzing}
              onAnalyze={onAnalyze}
            />
          )}
          {isWidgetEnabled("smart_planning") && (
            <SmartPlanningCard
              transactions={transactions}
              budgets={budgets}
              categoryBreakdown={categoryBreakdown}
              totalIncome={totalIncome}
              totalExpense={totalExpense}
              selectedMonth={selectedMonth}
              savingsRate={insights.savingsRate}
              recurring={recurring}
              index={3.6}
            />
          )}
        </div>
      )}

      {/* Finance AI Chat */}
      {isWidgetEnabled("ai_chat") && transactions.length >= 1 && (
        <FinanceAIChat
          transactions={transactions}
          budgets={budgets}
          categoryBreakdown={categoryBreakdown}
          totalIncome={totalIncome}
          totalExpense={totalExpense}
          balance={balance}
          selectedMonth={selectedMonth}
          savingsRate={insights.savingsRate}
          recurring={recurring}
          index={3.9}
        />
      )}
    </motion.div>
  );
};

export default OverviewTab;

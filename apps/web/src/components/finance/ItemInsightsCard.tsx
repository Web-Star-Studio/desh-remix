import { useState, forwardRef } from "react";
import GlassCard from "@/components/dashboard/GlassCard";
import { BarChart3, TrendingUp, TrendingDown, Loader2, RefreshCw, ChevronDown, ChevronUp, Wallet, CreditCard, DollarSign, CalendarDays } from "lucide-react";
import type { KpiMonth } from "@/hooks/finance/usePluggyInsights";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Props {
  kpis: Record<string, any> | null;
  fetching: boolean;
  onFetch: () => void;
  hasConnections: boolean;
}

const formatCurrency = (v: number | null) =>
  v != null ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";

const formatPct = (v: number | null) =>
  v != null ? `${(v * 100).toFixed(1)}%` : "—";

type TabKey = "bank" | "credit" | "income" | "distribution";

export default function ItemInsightsCard({ kpis, fetching, onFetch, hasConnections }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("bank");

  if (!hasConnections) return null;

  const bankData = kpis?.bankAccount || {};
  const creditCardData = kpis?.creditCard || {};
  const hasCreditCard = Object.keys(creditCardData).length > 0;
  const bankMonths = Object.keys(bankData).filter(k => k.startsWith("M")).sort();
  const ccMonths = Object.keys(creditCardData).filter(k => k.startsWith("M")).sort();
  const incomeStats = kpis?.incomeStatistics;
  const incomeReport = kpis?.incomeReport;

  const tabs: { key: TabKey; label: string; icon: React.ElementType; show: boolean }[] = [
    { key: "bank", label: "Conta", icon: Wallet, show: bankMonths.length > 0 },
    { key: "credit", label: "Cartão", icon: CreditCard, show: hasCreditCard },
    { key: "income", label: "Renda", icon: DollarSign, show: !!(incomeStats || incomeReport) },
    { key: "distribution", label: "Padrões", icon: CalendarDays, show: bankMonths.length > 0 },
  ];

  const visibleTabs = tabs.filter(t => t.show);

  return (
    <GlassCard size="auto">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">KPIs Financeiros</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onFetch}
            disabled={fetching}
            className="p-1.5 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
            title="Atualizar KPIs"
          >
            {fetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </button>
          {kpis && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {!kpis ? (
        <p className="text-xs text-muted-foreground">
          Clique em atualizar para analisar os KPIs da sua conexão bancária.
        </p>
      ) : (
        <div className="space-y-3">
          {/* Tabs */}
          {visibleTabs.length > 1 && (
            <div className="flex gap-1 p-0.5 rounded-lg bg-accent/20">
              {visibleTabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-medium transition-colors ${
                      activeTab === tab.key
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Bank Account KPIs */}
          {activeTab === "bank" && bankMonths.length > 0 && (
            <AccountKpis months={bankMonths} data={bankData} expanded={expanded} />
          )}

          {/* Credit Card KPIs */}
          {activeTab === "credit" && hasCreditCard && (
            <AccountKpis months={ccMonths} data={creditCardData} expanded={expanded} isCreditCard />
          )}

          {/* Income Statistics */}
          {activeTab === "income" && (
            <IncomeSection stats={incomeStats} report={incomeReport} />
          )}

          {/* Distribution Patterns */}
          {activeTab === "distribution" && bankMonths.length > 0 && (
            <DistributionSection data={bankData} months={bankMonths} />
          )}
        </div>
      )}
    </GlassCard>
  );
}

function AccountKpis({ months, data, expanded, isCreditCard }: { months: string[]; data: Record<string, any>; expanded: boolean; isCreditCard?: boolean }) {
  const latest = data[months[0]] as KpiMonth;
  if (!latest) return null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KpiBox
          label={isCreditCard ? "Compras" : "Entradas"}
          value={`R$ ${formatCurrency(latest.credit_sum)}`}
          sub={`${latest.credit_count} transações`}
          icon={<TrendingUp className="w-3 h-3 text-emerald-400" />}
        />
        <KpiBox
          label={isCreditCard ? "Pagamentos" : "Saídas"}
          value={`R$ ${formatCurrency(latest.debit_sum)}`}
          sub={`${latest.debit_count} transações`}
          icon={<TrendingDown className="w-3 h-3 text-rose-400" />}
        />
        <KpiBox
          label="Saldo Líquido"
          value={`R$ ${formatCurrency(latest.net_amount)}`}
          sub={latest.net_amount != null && latest.net_amount >= 0 ? "Positivo" : "Negativo"}
          icon={<BarChart3 className="w-3 h-3 text-primary" />}
        />
        <KpiBox
          label="Comprometimento"
          value={formatPct(latest.inflow_commitment)}
          sub="da renda"
          icon={<BarChart3 className="w-3 h-3 text-amber-400" />}
        />
      </div>

      {/* Additional metrics row */}
      {(latest.avg_credit != null || latest.min_balance != null) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <KpiBox label="Média entrada" value={`R$ ${formatCurrency(latest.avg_credit)}`} sub="por transação" icon={<TrendingUp className="w-3 h-3 text-emerald-400/60" />} />
          <KpiBox label="Média saída" value={`R$ ${formatCurrency(latest.avg_debit)}`} sub="por transação" icon={<TrendingDown className="w-3 h-3 text-rose-400/60" />} />
          <KpiBox label="Saldo mín." value={`R$ ${formatCurrency(latest.min_balance)}`} sub="no período" icon={<BarChart3 className="w-3 h-3 text-rose-400/60" />} />
          <KpiBox label="Saldo máx." value={`R$ ${formatCurrency(latest.max_balance)}`} sub="no período" icon={<BarChart3 className="w-3 h-3 text-emerald-400/60" />} />
        </div>
      )}

      {/* Monthly trend */}
      {expanded && months.length > 1 && (
        <div className="space-y-2 pt-2 border-t border-border/30">
          <p className="text-xs font-medium text-muted-foreground">Histórico mensal</p>
          <div className="max-h-48 overflow-y-auto space-y-1.5">
            {months.map((mk) => {
              const m = data[mk] as KpiMonth;
              if (!m) return null;
              return (
                <div key={mk} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-accent/20">
                  <span className="text-muted-foreground font-medium">{mk}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400">+R$ {formatCurrency(m.credit_sum)}</span>
                    <span className="text-rose-400">-R$ {formatCurrency(m.debit_sum)}</span>
                    <span className={m.net_amount != null && m.net_amount >= 0 ? "text-emerald-400" : "text-rose-400"}>
                      = R$ {formatCurrency(m.net_amount)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function IncomeSection({ stats, report }: { stats: any; report: any }) {
  const total = stats?.total;
  const sources = stats?.sources || [];

  return (
    <div className="space-y-3">
      {total && (
        <div className="grid grid-cols-2 gap-2">
          <KpiBox
            label="Renda mensal (30d)"
            value={`R$ ${formatCurrency(total.averageMonthlyIncomeLast30Days)}`}
            sub={`${total.numIncomeTransactions} transações`}
            icon={<DollarSign className="w-3 h-3 text-emerald-400" />}
          />
          <KpiBox
            label="Renda mensal (90d)"
            value={`R$ ${formatCurrency(total.averageMonthlyIncomeLast90Days)}`}
            sub={`${total.daysCoveredWithIncome} dias c/ renda`}
            icon={<DollarSign className="w-3 h-3 text-emerald-400/70" />}
          />
          <KpiBox
            label="Renda mensal (180d)"
            value={`R$ ${formatCurrency(total.averageMonthlyIncomeLast180Days)}`}
            sub="média semestral"
            icon={<TrendingUp className="w-3 h-3 text-emerald-400/50" />}
          />
          <KpiBox
            label="Renda mensal (360d)"
            value={`R$ ${formatCurrency(total.averageMonthlyIncomeLast360Days)}`}
            sub="média anual"
            icon={<TrendingUp className="w-3 h-3 text-primary" />}
          />
        </div>
      )}

      {report && (
        <div className="grid grid-cols-2 gap-2">
          {report.estimatedIncome != null && (
            <KpiBox label="Renda estimada" value={`R$ ${formatCurrency(report.estimatedIncome)}`} sub="via análise" icon={<DollarSign className="w-3 h-3 text-emerald-400" />} />
          )}
          {report.incomeConsistency != null && (
            <KpiBox label="Consistência" value={formatPct(report.incomeConsistency)} sub="regularidade" icon={<BarChart3 className="w-3 h-3 text-primary" />} />
          )}
        </div>
      )}

      {sources.length > 0 && (
        <div className="pt-2 border-t border-border/30">
          <p className="text-xs font-medium text-muted-foreground mb-2">Fontes de renda detectadas</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {sources.map((src: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-accent/20">
                <span className="text-xs text-foreground truncate flex-1 mr-2">{src.transactionDescription}</span>
                <span className="text-xs font-medium text-emerald-400 shrink-0">
                  {src.incomeType || "Renda"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!total && !report && (
        <p className="text-xs text-muted-foreground text-center py-4">
          Dados de renda não disponíveis. Atualize os KPIs para carregar.
        </p>
      )}
    </div>
  );
}

// Wrapped with forwardRef to prevent React warning from parent components
const DistributionSection = forwardRef<HTMLDivElement, { data: Record<string, any>; months: string[] }>(
  function DistributionSection({ data, months }, ref) {
    const latest = data[months[0]];
    if (!latest?.dateRanges) return <p className="text-xs text-muted-foreground">Dados de distribuição não disponíveis.</p>;

    const dateRangeLabels: Record<string, string> = {
      "1-5": "1-5",
      "6-10": "6-10",
      "11-15": "11-15",
      "16-20": "16-20",
      "21-25": "21-25",
      "26-31": "26-31",
    };

    const dateChartData = Object.entries(dateRangeLabels).map(([key, label]) => {
      const r = latest.dateRanges[key] || {};
      return { name: label, despesas: r.debit_amount || 0, receitas: r.credit_amount || 0 };
    }).filter(d => d.despesas > 0 || d.receitas > 0);

    const amountChartData = [
      "0-50", "50-100", "100-200", "200-500", "500-1000", "1000-2000", "2000-5000", "5000-10000",
    ].map(key => {
      const r = latest.amountRanges?.[key] || {};
      const label = key === "5000-10000" ? "5k+" : `R$${key}`;
      return { name: label, count: r.debit_count || 0, amount: r.debit_amount || 0 };
    }).filter(d => d.count > 0);

    return (
      <div ref={ref} className="space-y-4">
        {dateChartData.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Gastos por período do mês</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={dateChartData} barGap={2}>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                  formatter={(value: number, name: string) => [`R$ ${formatCurrency(value)}`, name === "despesas" ? "Despesas" : "Receitas"]}
                />
                <Bar dataKey="despesas" fill="hsl(0, 70%, 55%)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="receitas" fill="hsl(140, 50%, 50%)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {amountChartData.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Distribuição por faixa de valor</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={amountChartData}>
                <XAxis dataKey="name" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                  formatter={(value: number, name: string) => [
                    name === "count" ? `${value} transações` : `R$ ${formatCurrency(value)}`,
                    name === "count" ? "Qtd" : "Valor"
                  ]}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {amountChartData.map((_, i) => (
                    <Cell key={i} fill={`hsl(220, ${40 + i * 8}%, ${55 - i * 3}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {dateChartData.length === 0 && amountChartData.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Sem dados de distribuição para o período mais recente.</p>
        )}
      </div>
    );
  }
);
DistributionSection.displayName = "DistributionSection";

function KpiBox({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: React.ReactNode }) {
  return (
    <div className="p-2 rounded-lg bg-accent/20 text-center">
      <div className="flex items-center justify-center gap-1 mb-0.5">{icon}<span className="text-[10px] text-muted-foreground">{label}</span></div>
      <p className="text-xs font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}
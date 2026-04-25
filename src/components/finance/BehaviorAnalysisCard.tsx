import { useState } from "react";
import GlassCard from "@/components/dashboard/GlassCard";
import { PieChart as PieChartIcon, Loader2, RefreshCw, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";
import type { BehaviorAnalysis } from "@/hooks/finance/usePluggyInsights";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/components/finance/financeConstants";

const COLORS = [
  "hsl(220, 60%, 55%)", "hsl(140, 50%, 50%)", "hsl(35, 80%, 55%)",
  "hsl(280, 50%, 55%)", "hsl(0, 70%, 55%)", "hsl(180, 50%, 50%)",
  "hsl(320, 60%, 55%)", "hsl(60, 60%, 45%)", "hsl(200, 60%, 50%)",
];
interface Props {
  analysis: BehaviorAnalysis | null;
  fetching: boolean;
  onFetch: () => void;
  hasConnections: boolean;
}

export default function BehaviorAnalysisCard({ analysis, fetching, onFetch, hasConnections }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!hasConnections) return null;

  const cats = analysis?.categories || [];
  const hasCats = cats.length > 0;

  // Prepare pie data
  const pieData = cats
    .filter((c: any) => (c.totalAmount || c.amount || 0) > 0)
    .slice(0, 8)
    .map((c: any, i: number) => ({
      name: c.category || c.name || c.description || "Outros",
      value: Math.abs(c.totalAmount || c.amount || 0),
      pct: c.percentage || 0,
      color: COLORS[i % COLORS.length],
    }));

  const topMerchants = analysis?.topMerchants?.slice(0, 6) || [];

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <PieChartIcon className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground text-base">Análise Comportamental</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onFetch}
            disabled={fetching}
            className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="Atualizar análise comportamental"
          >
            {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
          {hasCats && (
            <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {!hasCats ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          {fetching ? "Carregando análise..." : "Clique em atualizar para analisar padrões de gastos por categoria."}
        </p>
      ) : (
        <>
          {/* Pie Chart */}
          <div className="flex items-center gap-4">
            <div className="w-32 h-32 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={55} paddingAngle={2} dataKey="value">
                    {pieData.map((d, i) => (
                      <Cell key={i} fill={d.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => [`R$ ${formatCurrency(v)}`, ""]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              {pieData.slice(0, 5).map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-foreground truncate">{d.name}</span>
                  </div>
                  <span className="text-muted-foreground flex-shrink-0">R$ {formatCurrency(d.value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Expanded: Top Merchants + raw categories */}
          {expanded && (
            <div className="mt-4 space-y-3 border-t border-border/30 pt-3">
              {topMerchants.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Top Comerciantes</h4>
                  <div className="space-y-1.5">
                    {topMerchants.map((m: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-foreground truncate">{m.name || m.merchant || "—"}</span>
                        <span className="text-muted-foreground">
                          R$ {formatCurrency(Math.abs(m.totalAmount || m.amount || 0))}
                          {m.count ? ` (${m.count}x)` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All categories */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Todas as categorias</h4>
                <div className="space-y-1">
                  {cats.map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-foreground">{c.category || c.name || c.description}</span>
                      <div className="flex gap-3 text-muted-foreground">
                        <span>{c.transactionCount || c.count || 0} txs</span>
                        <span>R$ {formatCurrency(Math.abs(c.totalAmount || c.amount || 0))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </GlassCard>
  );
}

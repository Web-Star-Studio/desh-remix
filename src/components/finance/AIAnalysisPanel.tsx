import { motion } from "framer-motion";
import { Brain, Sparkles, AlertOctagon, AlertCircle, TrendingUp, TrendingDown, Lightbulb, Loader2 } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import type { AnalysisResult } from "@/hooks/finance/useFinanceAI";
import { formatCurrency } from "@/components/finance/financeConstants";
interface AIAnalysisPanelProps {
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  index?: number;
}

const AIAnalysisPanel = ({ analysis, isAnalyzing, onAnalyze, index = 3.5 }: AIAnalysisPanelProps) => (
  <AnimatedItem index={index}>
    <GlassCard size="auto" className="mb-4 max-h-[500px] overflow-y-auto scrollbar-thin">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-violet-500/15 flex items-center justify-center">
            <Brain className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <p className="widget-title">Análise IA</p>
        </div>
        <button
          onClick={onAnalyze}
          disabled={isAnalyzing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium bg-violet-500/15 text-violet-400 border border-violet-400/20 hover:bg-violet-500/25 transition-all disabled:opacity-50"
        >
          {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {analysis ? "Atualizar análise" : "Analisar gastos"}
        </button>
      </div>

      {analysis && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Anomaly alerts */}
          {analysis.anomalies.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <AlertOctagon className="w-3 h-3" /> Gastos incomuns
              </p>
              <div className="space-y-1.5">
                {analysis.anomalies.map((a, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${
                      a.severity === "critical"
                        ? "bg-destructive/10 border-destructive/20"
                        : a.severity === "warning"
                        ? "bg-amber-500/10 border-amber-400/20"
                        : "bg-blue-500/10 border-blue-400/20"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      a.severity === "critical" ? "bg-destructive/20" : a.severity === "warning" ? "bg-amber-500/20" : "bg-blue-500/20"
                    }`}>
                      {a.severity === "critical" || a.severity === "warning" ? (
                        <AlertCircle className={`w-3.5 h-3.5 ${a.severity === "critical" ? "text-destructive" : "text-amber-400"}`} />
                      ) : (
                        <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-foreground">{a.category}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                          a.change_pct > 0 ? "bg-destructive/15 text-destructive" : "bg-green-500/15 text-green-400"
                        }`}>
                          {a.change_pct > 0 ? "+" : ""}{a.change_pct.toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{a.message}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Forecast */}
          {analysis.forecast && (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Previsão para o mês
              </p>
              <div className="p-3 rounded-xl bg-foreground/5 border border-foreground/8">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Despesas projetadas</span>
                  <span className="text-sm font-bold text-foreground tabular-nums">R$ {formatCurrency(analysis.forecast.projected_total)}</span>
                </div>
                {analysis.forecast.daily_budget_remaining > 0 && (
                  <div className="p-2 rounded-lg bg-green-500/5 border border-green-500/10 mb-2">
                    <p className="text-[10px] text-green-400">
                      💡 Orçamento diário sugerido: <span className="font-bold">R$ {formatCurrency(analysis.forecast.daily_budget_remaining)}/dia</span>
                    </p>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground italic">{analysis.forecast.summary}</p>
                {analysis.forecast.categories.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {analysis.forecast.categories.slice(0, 5).map((cat, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px]">
                        <span className="text-foreground/60 w-20 truncate">{cat.name}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${analysis.forecast!.projected_total > 0 ? (cat.projected / analysis.forecast!.projected_total) * 100 : 0}%` }}
                            transition={{ duration: 0.6, delay: i * 0.1 }}
                            className={`h-full rounded-full ${cat.trend === "up" ? "bg-destructive" : cat.trend === "down" ? "bg-green-400" : "bg-primary"}`}
                          />
                        </div>
                        <span className="text-muted-foreground tabular-nums w-16 text-right">R$ {formatCurrency(cat.projected)}</span>
                        <span className={`w-3 h-3 flex-shrink-0 ${cat.trend === "up" ? "text-destructive" : cat.trend === "down" ? "text-green-400" : "text-muted-foreground"}`}>
                          {cat.trend === "up" ? <TrendingUp className="w-3 h-3" /> : cat.trend === "down" ? <TrendingDown className="w-3 h-3" /> : <span className="text-[8px]">—</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tips */}
          {analysis.tips.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Lightbulb className="w-3 h-3" /> Dicas inteligentes
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {analysis.tips.map((tip, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="p-2.5 rounded-xl bg-foreground/5 border border-foreground/8 text-[10px] text-foreground/80"
                  >
                    <span className="mr-1">{tip.icon}</span> {tip.text}
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {!analysis && !isAnalyzing && (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Brain className="w-8 h-8 text-muted-foreground/20 mb-2" />
          <p className="text-xs text-muted-foreground">Clique em "Analisar gastos" para obter previsões e alertas personalizados.</p>
        </div>
      )}
      {isAnalyzing && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400 mb-2" />
          <p className="text-xs text-muted-foreground">Analisando seus gastos com IA...</p>
        </div>
      )}
    </GlassCard>
  </AnimatedItem>
);

export default AIAnalysisPanel;

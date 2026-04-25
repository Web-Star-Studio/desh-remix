import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import GlassCard from "@/components/dashboard/GlassCard";
import { ArrowDownLeft, ArrowUpRight, FileText, Repeat, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import type { FinancialInvestmentTransaction } from "@/types/finance";
import { useInvestmentTransactions } from "@/hooks/finance/useFinanceExtended";
import { formatCurrency } from "@/components/finance/financeConstants";
const formatDate = (dateStr: string) => {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short",
  });
};

const TYPE_CONFIG: Record<string, { icon: typeof ArrowDownLeft; label: string; color: string }> = {
  BUY:      { icon: ArrowDownLeft, label: "Aplicação", color: "text-green-400" },
  SELL:     { icon: ArrowUpRight, label: "Resgate", color: "text-red-400" },
  TAX:      { icon: FileText, label: "Imposto", color: "text-amber-400" },
  TRANSFER: { icon: Repeat, label: "Transferência", color: "text-blue-400" },
};

interface InvestmentTransactionsPanelProps {
  investmentId: string;
  investmentName?: string;
  onClose: () => void;
}

const InvestmentTransactionsPanel = ({ investmentId, investmentName, onClose }: InvestmentTransactionsPanelProps) => {
  const { transactions, loading } = useInvestmentTransactions(investmentId, 100);
  const [showAll, setShowAll] = useState(false);

  const displayedTxs = showAll ? transactions : transactions.slice(0, 10);

  const summary = useMemo(() => {
    const buys = transactions.filter(t => t.type === "BUY").reduce((s, t) => s + t.amount, 0);
    const sells = transactions.filter(t => t.type === "SELL").reduce((s, t) => s + t.amount, 0);
    return { buys, sells, count: transactions.length };
  }, [transactions]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="mt-2"
    >
      <GlassCard size="auto" className="max-h-[400px] overflow-y-auto scrollbar-thin">
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">
              Movimentações — {investmentName || "Investimento"}
            </p>
            {!loading && (
              <p className="text-[9px] text-muted-foreground mt-0.5">
                {summary.count} operações • Aplicado: R$ {formatCurrency(summary.buys)} • Resgatado: R$ {formatCurrency(summary.sells)}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs px-2 py-1 rounded hover:bg-foreground/5">
            Fechar
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhuma movimentação encontrada</p>
        ) : (
          <>
            <div className="space-y-1">
              {displayedTxs.map(tx => {
                const config = TYPE_CONFIG[tx.type] || TYPE_CONFIG.BUY;
                const Icon = config.icon;
                return (
                  <div key={tx.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-foreground/[0.03] transition-colors">
                    <div className={`w-6 h-6 rounded-md bg-foreground/5 flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-3 h-3 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground truncate">
                        {config.label}
                        {tx.description && <span className="text-muted-foreground ml-1">— {tx.description}</span>}
                      </p>
                      <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                        <span>{formatDate(tx.date)}</span>
                        {tx.quantity && <span>• {tx.quantity} cotas</span>}
                        {tx.brokerage_number && <span>• Nota: {tx.brokerage_number}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-xs font-semibold tabular-nums ${tx.type === "BUY" ? "text-green-400" : tx.type === "SELL" ? "text-red-400" : "text-foreground"}`}>
                        {tx.type === "BUY" ? "+" : "-"}R$ {formatCurrency(tx.amount)}
                      </p>
                      {tx.net_amount != null && tx.net_amount !== tx.amount && (
                        <p className="text-[9px] text-muted-foreground tabular-nums">
                          Líq. R$ {formatCurrency(tx.net_amount)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {transactions.length > 10 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="w-full text-[10px] text-primary hover:underline py-2 flex items-center justify-center gap-1"
              >
                {showAll ? <><ChevronUp className="w-3 h-3" /> Mostrar menos</> : <><ChevronDown className="w-3 h-3" /> Ver todas ({transactions.length})</>}
              </button>
            )}
          </>
        )}
      </GlassCard>
    </motion.div>
  );
};

export default InvestmentTransactionsPanel;

import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import GlassCard from "@/components/dashboard/GlassCard";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import { CreditCard, ChevronDown, ChevronUp, Calendar, AlertCircle, Receipt } from "lucide-react";
import type { FinancialAccount } from "@/types/finance";
import { formatCurrency } from "@/components/finance/financeConstants";
const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });
};

const FINANCE_CHARGE_LABELS: Record<string, string> = {
  IOF: "IOF",
  OTHER: "Outros encargos",
  MONETARY_CORRECTION: "Correção monetária",
  INTEREST_INSTALLMENT: "Juros parcelado",
  INTEREST_REVOLVING_CREDIT: "Juros rotativo",
  FINE: "Multa",
  INSURANCE_CHARGE: "Seguro",
  OTHER_CHARGES: "Outros encargos",
};

interface CreditCardBillsCardProps {
  accounts: FinancialAccount[];
  index?: number;
}

interface Bill {
  id: string;
  dueDate: string;
  totalAmount: number;
  totalAmountCurrencyCode?: string;
  minimumPaymentAmount?: number;
  allowsInstallments?: boolean;
  financeCharges?: Array<{
    id: string;
    type: string;
    amount: number;
    currencyCode?: string;
    additionalInfo?: string;
  }>;
}

const CreditCardBillsCard = ({ accounts, index = 10.5 }: CreditCardBillsCardProps) => {
  const [expandedAccId, setExpandedAccId] = useState<string | null>(null);

  // Get credit card accounts that have bills data
  const ccAccountsWithBills = useMemo(() => {
    return accounts
      .filter(acc => acc.type === "credit_card" && (acc as any).raw_data?.bills?.length > 0)
      .map(acc => ({
        ...acc,
        bills: ((acc as any).raw_data.bills as Bill[]).sort(
          (a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
        ),
      }));
  }, [accounts]);

  if (ccAccountsWithBills.length === 0) return null;

  const totalBills = ccAccountsWithBills.reduce((s, acc) => {
    const latestBill = acc.bills[0];
    return s + (latestBill?.totalAmount || 0);
  }, 0);

  return (
    <AnimatedItem index={index} className="mt-3">
      <GlassCard size="auto" className="max-h-[500px] overflow-y-auto scrollbar-thin">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-rose-500/15 flex items-center justify-center">
              <CreditCard className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <p className="widget-title">Faturas do Cartão</p>
            <span className="text-[10px] text-muted-foreground">({ccAccountsWithBills.length} cartão{ccAccountsWithBills.length !== 1 ? "ões" : ""})</span>
          </div>
          <div className="text-right">
            <span className="text-sm font-bold text-foreground tabular-nums">
              R$ {formatCurrency(totalBills)}
            </span>
            <p className="text-[9px] text-muted-foreground">fatura atual</p>
          </div>
        </div>

        <div className="space-y-2">
          {ccAccountsWithBills.map(acc => {
            const isExpanded = expandedAccId === acc.id;
            const latestBill = acc.bills[0];
            const isOverdue = latestBill && new Date(latestBill.dueDate) < new Date();
            const totalCharges = latestBill?.financeCharges?.reduce((s, c) => s + (c.amount || 0), 0) || 0;

            return (
              <div key={acc.id} className="rounded-xl border border-foreground/10 bg-foreground/5 overflow-hidden">
                <button
                  onClick={() => setExpandedAccId(isExpanded ? null : acc.id)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-foreground/[0.03] transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {acc.name || "Cartão de Crédito"}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>Vence: {formatDate(latestBill?.dueDate)}</span>
                      {isOverdue && (
                        <span className="flex items-center gap-0.5 text-destructive font-semibold">
                          <AlertCircle className="w-2.5 h-2.5" /> Vencida
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 mr-2">
                    <p className="text-sm font-bold text-foreground tabular-nums">
                      R$ {formatCurrency(latestBill?.totalAmount || 0)}
                    </p>
                    {latestBill?.minimumPaymentAmount != null && (
                      <p className="text-[9px] text-muted-foreground">
                        Mín: R$ {formatCurrency(latestBill.minimumPaymentAmount)}
                      </p>
                    )}
                  </div>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-foreground/10 p-3 space-y-3">
                        {/* Latest bill details */}
                        {latestBill && (
                          <div className="grid grid-cols-2 gap-2">
                            <DetailItem icon={<Calendar className="w-3 h-3" />} label="Vencimento" value={formatDate(latestBill.dueDate)} />
                            <DetailItem icon={<Receipt className="w-3 h-3" />} label="Total da fatura" value={`R$ ${formatCurrency(latestBill.totalAmount)}`} />
                            {latestBill.minimumPaymentAmount != null && (
                              <DetailItem icon={<AlertCircle className="w-3 h-3" />} label="Pgto mínimo" value={`R$ ${formatCurrency(latestBill.minimumPaymentAmount)}`} />
                            )}
                            {latestBill.allowsInstallments && (
                              <DetailItem icon={<CreditCard className="w-3 h-3" />} label="Parcelamento" value="Disponível" />
                            )}
                          </div>
                        )}

                        {/* Finance charges */}
                        {latestBill?.financeCharges && latestBill.financeCharges.length > 0 && totalCharges > 0 && (
                          <div>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Encargos financeiros</p>
                            <div className="space-y-1">
                              {latestBill.financeCharges
                                .filter(c => c.amount > 0)
                                .map((charge) => (
                                  <div key={charge.id} className="flex justify-between text-[10px] px-2 py-1 rounded bg-foreground/[0.03]">
                                    <span className="text-muted-foreground">
                                      {FINANCE_CHARGE_LABELS[charge.type] || charge.type}
                                    </span>
                                    <span className="text-foreground font-medium tabular-nums">
                                      R$ {formatCurrency(charge.amount)}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Bill history */}
                        {acc.bills.length > 1 && (
                          <div>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Histórico de faturas</p>
                            <div className="space-y-1">
                              {acc.bills.slice(1, 6).map(bill => (
                                <div key={bill.id} className="flex items-center justify-between text-[10px] px-2 py-1.5 rounded bg-foreground/[0.03]">
                                  <span className="text-muted-foreground">{formatDate(bill.dueDate)}</span>
                                  <span className="text-foreground font-medium tabular-nums">
                                    R$ {formatCurrency(bill.totalAmount)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Credit info */}
                        {(acc.credit_limit || acc.available_balance != null) && (
                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-foreground/5">
                            {acc.credit_limit != null && (
                              <DetailItem icon={<CreditCard className="w-3 h-3" />} label="Limite total" value={`R$ ${formatCurrency(acc.credit_limit)}`} />
                            )}
                            {acc.available_balance != null && (
                              <DetailItem icon={<CreditCard className="w-3 h-3" />} label="Limite disponível" value={`R$ ${formatCurrency(acc.available_balance)}`} />
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </AnimatedItem>
  );
};

const DetailItem = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-start gap-1.5 p-2 rounded-lg bg-foreground/[0.03]">
    <span className="text-muted-foreground mt-0.5">{icon}</span>
    <div>
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className="text-[11px] text-foreground font-medium">{value}</p>
    </div>
  </div>
);

export default CreditCardBillsCard;

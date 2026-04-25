import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import GlassCard from "@/components/dashboard/GlassCard";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import { Landmark, ChevronDown, ChevronUp, Calendar, Percent, Receipt, AlertCircle } from "lucide-react";
import type { FinancialLoan } from "@/types/finance";
import { formatCurrency } from "@/components/finance/financeConstants";
const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });
};

const LOAN_TYPE_LABELS: Record<string, string> = {
  CREDITO_PESSOAL_COM_CONSIGNACAO: "Consignado",
  CREDITO_PESSOAL_SEM_CONSIGNACAO: "Crédito Pessoal",
  EMPRESTIMO_CARTAO_CONSIGNADO: "Cartão Consignado",
  CHEQUE_ESPECIAL: "Cheque Especial",
  CONTA_GARANTIDA: "Conta Garantida",
  HOME_EQUITY: "Home Equity",
  MICROCREDITO: "Microcrédito",
  OUTROS: "Outros",
};

interface LoansCardProps {
  loans: FinancialLoan[];
  index?: number;
}

const LoansCard = ({ loans, index = 10 }: LoansCardProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loans.length === 0) return null;

  const totalOutstanding = loans.reduce((s, l) => s + (l.outstanding_balance || 0), 0);
  const totalContracted = loans.reduce((s, l) => s + (l.contract_amount || 0), 0);

  return (
    <AnimatedItem index={index} className="mt-3">
      <GlassCard size="auto" className="max-h-[500px] overflow-y-auto scrollbar-thin">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-red-500/15 flex items-center justify-center">
              <Landmark className="w-3.5 h-3.5 text-red-400" />
            </div>
            <p className="widget-title">Empréstimos</p>
            <span className="text-[10px] text-muted-foreground">({loans.length})</span>
          </div>
          <div className="text-right">
            <span className="text-sm font-bold text-foreground tabular-nums">
              R$ {formatCurrency(totalOutstanding)}
            </span>
            <p className="text-[9px] text-muted-foreground">saldo devedor</p>
          </div>
        </div>

        <div className="space-y-2">
          {loans.map(loan => {
            const isExpanded = expandedId === loan.id;
            const progressPct = loan.total_installments && loan.paid_installments
              ? Math.round((loan.paid_installments / loan.total_installments) * 100)
              : null;
            const rawData = loan.raw_data || {};

            return (
              <div key={loan.id} className="rounded-xl border border-foreground/10 bg-foreground/5 overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : loan.id)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-foreground/[0.03] transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <Receipt className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {loan.product_name || "Empréstimo"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {LOAN_TYPE_LABELS[loan.loan_type || ""] || loan.loan_type || "—"}
                      {loan.contract_number && <span className="ml-2">Contrato: {loan.contract_number}</span>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 mr-2">
                    <p className="text-sm font-bold text-foreground tabular-nums">
                      R$ {formatCurrency(loan.outstanding_balance || 0)}
                    </p>
                    {progressPct !== null && (
                      <p className="text-[9px] text-muted-foreground">{progressPct}% pago</p>
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
                        {/* Progress bar */}
                        {progressPct !== null && (
                          <div>
                            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                              <span>{loan.paid_installments} de {loan.total_installments} parcelas</span>
                              <span>{progressPct}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Details grid */}
                        <div className="grid grid-cols-2 gap-2">
                          <DetailItem icon={<DollarIcon />} label="Valor contratado" value={`R$ ${formatCurrency(loan.contract_amount || 0)}`} />
                          <DetailItem icon={<Calendar className="w-3 h-3" />} label="Vencimento" value={formatDate(loan.due_date)} />
                          {loan.cet && <DetailItem icon={<Percent className="w-3 h-3" />} label="CET (a.a.)" value={`${(loan.cet * 100).toFixed(2)}%`} />}
                          {loan.contract_date && <DetailItem icon={<Calendar className="w-3 h-3" />} label="Data contrato" value={formatDate(loan.contract_date)} />}
                          {loan.installment_periodicity && <DetailItem icon={<Receipt className="w-3 h-3" />} label="Periodicidade" value={loan.installment_periodicity} />}
                          {loan.due_installments != null && loan.due_installments > 0 && (
                            <DetailItem icon={<AlertCircle className="w-3 h-3" />} label="Parcelas a vencer" value={String(loan.due_installments)} />
                          )}
                        </div>

                        {/* Interest rates from raw_data */}
                        {rawData.interestRates?.length > 0 && (
                          <div>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Taxas de Juros</p>
                            <div className="space-y-1">
                              {rawData.interestRates.map((rate: any, i: number) => (
                                <div key={i} className="flex justify-between text-[10px] px-2 py-1 rounded bg-foreground/[0.03]">
                                  <span className="text-muted-foreground">
                                    {rate.referentialRateIndexerType || rate.interestRateType || "Taxa"}
                                  </span>
                                  <span className="text-foreground font-medium tabular-nums">
                                    {rate.preFixedRate ? `Pré: ${(rate.preFixedRate * 100).toFixed(2)}%` : ""}
                                    {rate.postFixedRate ? ` Pós: ${(rate.postFixedRate * 100).toFixed(2)}%` : ""}
                                  </span>
                                </div>
                              ))}
                            </div>
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

const DollarIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const DetailItem = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-start gap-1.5 p-2 rounded-lg bg-foreground/[0.03]">
    <span className="text-muted-foreground mt-0.5">{icon}</span>
    <div>
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className="text-[11px] text-foreground font-medium">{value}</p>
    </div>
  </div>
);

export default LoansCard;

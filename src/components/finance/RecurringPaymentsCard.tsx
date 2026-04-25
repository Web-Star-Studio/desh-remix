import { useState } from "react";
import GlassCard from "@/components/dashboard/GlassCard";
import { Repeat, TrendingUp, TrendingDown, Loader2, RefreshCw, Sparkles, Download, Check } from "lucide-react";
import type { RecurringPayment } from "@/hooks/finance/usePluggyInsights";
import { toast } from "@/hooks/use-toast";

interface Props {
  payments: RecurringPayment[];
  fetching: boolean;
  onFetch: () => void;
  hasConnections: boolean;
  onImportRecurring?: (payment: RecurringPayment) => Promise<void>;
}

const formatCurrency = (v: number) =>
  Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function RecurringPaymentsCard({ payments, fetching, onFetch, hasConnections, onImportRecurring }: Props) {
  const [importedSet, setImportedSet] = useState<Set<string>>(new Set());
  const [importingId, setImportingId] = useState<string | null>(null);

  if (!hasConnections) return null;

  const expenses = payments.filter(p => p.type === "expense");
  const incomes = payments.filter(p => p.type === "income");
  const totalRecurringExpense = expenses.reduce((s, p) => s + Math.abs(p.average_amount), 0);
  const totalRecurringIncome = incomes.reduce((s, p) => s + Math.abs(p.average_amount), 0);

  const handleImport = async (payment: RecurringPayment) => {
    if (!onImportRecurring) return;
    const key = payment.description;
    setImportingId(key);
    try {
      await onImportRecurring(payment);
      setImportedSet(prev => new Set(prev).add(key));
      toast({ title: "Importado", description: `"${payment.description}" adicionado às recorrentes.` });
    } catch (e) {
      toast({ title: "Erro ao importar", variant: "destructive" });
    } finally {
      setImportingId(null);
    }
  };

  const handleImportAll = async () => {
    if (!onImportRecurring) return;
    const highConfidence = payments.filter(p => p.regularity_score >= 0.9 && !importedSet.has(p.description));
    for (const p of highConfidence) {
      setImportingId(p.description);
      try {
        await onImportRecurring(p);
        setImportedSet(prev => new Set(prev).add(p.description));
      } catch {}
    }
    setImportingId(null);
    if (highConfidence.length > 0) {
      toast({ title: "Importação concluída", description: `${highConfidence.length} recorrentes importadas.` });
    }
  };

  return (
    <GlassCard size="auto">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Repeat className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Pagamentos Recorrentes Detectados</h3>
          <Sparkles className="w-3 h-3 text-amber-400" />
        </div>
        <div className="flex items-center gap-1.5">
          {onImportRecurring && payments.length > 0 && (
            <button
              onClick={handleImportAll}
              disabled={!!importingId}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-medium transition-colors disabled:opacity-50"
              title="Importar todas com alta regularidade (≥90%)"
            >
              <Download className="w-3 h-3" />
              Importar tudo
            </button>
          )}
          <button
            onClick={onFetch}
            disabled={fetching}
            className="p-1.5 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
            title="Detectar recorrentes"
          >
            {fetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {payments.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Clique em atualizar para detectar automaticamente gastos e receitas recorrentes.
        </p>
      ) : (
        <div className="space-y-3">
          {/* Summary */}
          <div className="flex gap-3">
            <div className="flex-1 p-2 rounded-lg bg-rose-500/10 text-center">
              <p className="text-[10px] text-muted-foreground">Despesas fixas</p>
              <p className="text-sm font-bold text-rose-400">R$ {formatCurrency(totalRecurringExpense)}</p>
              <p className="text-[10px] text-muted-foreground">{expenses.length} detectadas</p>
            </div>
            <div className="flex-1 p-2 rounded-lg bg-emerald-500/10 text-center">
              <p className="text-[10px] text-muted-foreground">Receitas fixas</p>
              <p className="text-sm font-bold text-emerald-400">R$ {formatCurrency(totalRecurringIncome)}</p>
              <p className="text-[10px] text-muted-foreground">{incomes.length} detectadas</p>
            </div>
            <div className="flex-1 p-2 rounded-lg bg-primary/10 text-center">
              <p className="text-[10px] text-muted-foreground">Saldo recorrente</p>
              <p className={`text-sm font-bold ${totalRecurringIncome - totalRecurringExpense >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                R$ {formatCurrency(totalRecurringIncome - totalRecurringExpense)}
              </p>
              <p className="text-[10px] text-muted-foreground">mensal estimado</p>
            </div>
          </div>

          {/* Payments list */}
          <div className="max-h-64 overflow-y-auto space-y-1">
            {payments.map((p, i) => {
              const isImported = importedSet.has(p.description);
              const isImporting = importingId === p.description;
              return (
                <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 transition-colors group">
                  <div className="flex items-center gap-2 min-w-0">
                    {p.type === "expense" ? (
                      <TrendingDown className="w-3 h-3 text-rose-400 shrink-0" />
                    ) : (
                      <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <span className="text-xs text-foreground truncate block">{p.description}</span>
                      <span className="text-[9px] text-muted-foreground">{p.occurrences_count} ocorrências</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className={`text-xs font-medium ${p.type === "expense" ? "text-rose-400" : "text-emerald-400"}`}>
                      R$ {formatCurrency(p.average_amount)}
                    </span>
                    <RegularityBadge score={p.regularity_score} />
                    {onImportRecurring && (
                      <button
                        onClick={() => handleImport(p)}
                        disabled={isImported || isImporting}
                        className={`p-1 rounded transition-colors ${
                          isImported
                            ? "text-emerald-400"
                            : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary"
                        } disabled:cursor-default`}
                        title={isImported ? "Já importado" : "Importar como recorrente"}
                      >
                        {isImporting ? <Loader2 className="w-3 h-3 animate-spin" /> : isImported ? <Check className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </GlassCard>
  );
}

function RegularityBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 95 ? "text-emerald-400 bg-emerald-500/10" : pct >= 85 ? "text-amber-400 bg-amber-500/10" : "text-muted-foreground bg-accent/30";
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${color}`} title={`Regularidade: ${pct}%`}>
      {pct}%
    </span>
  );
}

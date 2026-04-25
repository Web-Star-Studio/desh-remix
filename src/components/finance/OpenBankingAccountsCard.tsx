import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import GlassCard from "@/components/dashboard/GlassCard";
import { Landmark, RefreshCw, Trash2, Loader2, Clock, ChevronDown, ChevronUp, CreditCard, AlertTriangle, X, Wallet, PiggyBank, TrendingUp, KeyRound, Zap, Sparkles } from "lucide-react";
import type { FinancialAccount, FinancialConnection } from "@/types/finance";
import { useRealTimeBalance } from "@/hooks/finance/useFinanceExtended";
import { toast } from "sonner";
import { formatCurrency } from "@/components/finance/financeConstants";

interface OpenBankingAccountsCardProps {
  connections: FinancialConnection[];
  accounts: FinancialAccount[];
  onSync: (conn: FinancialConnection) => void;
  onRemove: (connectionId: string) => void;
  onReconnect?: (conn: FinancialConnection) => void;
  onBalanceRefreshed?: () => void;
  onEnrich?: (accountId: string, accountType: string) => Promise<any>;
  isSyncing?: boolean;
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "Nunca";
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
};
const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: "Conta Corrente",
  savings: "Poupança",
  credit_card: "Cartão de Crédito",
  loan: "Empréstimo",
  investment: "Investimento",
  other: "Outro",
};

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  active:         { bg: "bg-green-500/10", text: "text-green-400", label: "Ativo" },
  syncing:        { bg: "bg-amber-500/10", text: "text-amber-400", label: "Sincronizando" },
  error:          { bg: "bg-destructive/10", text: "text-destructive", label: "Erro" },
  expired:        { bg: "bg-muted/50", text: "text-muted-foreground", label: "Expirado" },
  awaiting_input: { bg: "bg-orange-500/10", text: "text-orange-400", label: "Reautenticar" },
};

const ACCOUNT_TYPE_ICONS: Record<string, typeof Landmark> = {
  checking: Wallet,
  savings: PiggyBank,
  credit_card: CreditCard,
  investment: TrendingUp,
  loan: Landmark,
  other: Landmark,
};

const OpenBankingAccountsCard = ({ connections, accounts, onSync, onRemove, onReconnect, onBalanceRefreshed, onEnrich, isSyncing }: OpenBankingAccountsCardProps) => {
  const [expandedConns, setExpandedConns] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [refreshingAccId, setRefreshingAccId] = useState<string | null>(null);
  const [enrichingAccId, setEnrichingAccId] = useState<string | null>(null);
  const { fetchBalance } = useRealTimeBalance();

  if (connections.length === 0) return null;

  const toggle = (id: string) =>
    setExpandedConns(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleSync = async (conn: FinancialConnection) => {
    setSyncingId(conn.id);
    onSync(conn);
    setTimeout(() => setSyncingId(null), 5000);
  };

  const handleRefreshBalance = async (accountId: string) => {
    setRefreshingAccId(accountId);
    const result = await fetchBalance(accountId);
    if (result?.success) {
      toast.success(`Saldo atualizado: R$ ${result.balance?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
      onBalanceRefreshed?.();
    } else if (result === null) {
      toast.error("Saldo em tempo real não disponível para esta conta");
    }
    setRefreshingAccId(null);
  };

  const handleDeleteConfirm = () => {
    if (!confirmDeleteId) return;
    onRemove(confirmDeleteId);
    setConfirmDeleteId(null);
  };

  return (
    <GlassCard size="auto" className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4 text-primary/60" />
          <p className="widget-title">Open Banking</p>
          <span className="text-[10px] text-muted-foreground">({connections.length} conexão{connections.length !== 1 ? "ões" : ""})</span>
        </div>
      </div>

      <div className="max-h-[320px] overflow-y-auto pr-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {connections.map(conn => {
          const connAccounts = accounts.filter(a => a.connection_id === conn.id);
          const totalBalance = connAccounts.reduce((s, a) => {
            const bal = a.current_balance || 0;
            // Credit card current_balance = fatura (dívida), subtrair do total
            return s + (a.type === "credit_card" ? -Math.abs(bal) : bal);
          }, 0);
          const isExpanded = expandedConns.has(conn.id);
          const status = STATUS_COLORS[conn.status] || STATUS_COLORS.active;
          const isSyncingThis = syncingId === conn.id || conn.status === "syncing";

          return (
            <div key={conn.id} className="rounded-lg border border-foreground/10 bg-foreground/5 overflow-hidden group">
              <div className="flex items-center gap-3 p-3">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                  {conn.institution_logo_url ? (
                    <img src={conn.institution_logo_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <Landmark className="w-5 h-5 text-primary/60" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground font-medium truncate">
                    {conn.institution_name || "Banco conectado"}
                  </p>

                  {connAccounts.length > 0 ? (
                    <p className="text-sm font-semibold text-foreground mt-0.5">
                      R$ {formatCurrency(totalBalance)}
                    </p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground mt-0.5 italic">
                      {conn.status === "syncing"
                        ? (conn.last_synced_at ? "Re-sincronizando..." : "Sincronizando pela primeira vez...")
                        : "Sincronize para ver saldo"}
                    </p>
                  )}
                  {/* Stuck sync detection: syncing for 5+ min without last_synced_at */}
                  {conn.status === "syncing" && !conn.last_synced_at && conn.created_at && (
                    Date.now() - new Date(conn.created_at).getTime() > 5 * 60 * 1000
                  ) && (
                    <button
                      onClick={() => handleSync(conn)}
                      className="flex items-center gap-1 text-[9px] px-2 py-0.5 mt-1 rounded-full bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      Tentar novamente
                    </button>
                  )}

                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{formatDate(conn.last_synced_at)}</span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                      {status.label}
                    </span>
                    {(conn.status === "awaiting_input" || conn.status === "error") && (
                      <button
                        onClick={() => onReconnect ? onReconnect(conn) : handleSync(conn)}
                        className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors"
                      >
                        <KeyRound className="w-2.5 h-2.5" />
                        Reconectar
                      </button>
                    )}
                    {(conn as any).raw_metadata?.next_auto_sync_at && (
                      <div className="flex items-center gap-1 text-[9px] text-muted-foreground/70">
                        <RefreshCw className="w-2 h-2" />
                        <span>Auto: {formatDate((conn as any).raw_metadata.next_auto_sync_at)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  {connAccounts.length > 0 && (
                    <button
                      onClick={() => toggle(conn.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                      title={isExpanded ? "Ocultar contas" : `Ver ${connAccounts.length} conta(s)`}
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  <button
                    onClick={() => handleSync(conn)}
                    disabled={isSyncingThis || isSyncing}
                    className="text-muted-foreground hover:text-primary transition-colors p-1 rounded disabled:opacity-40"
                    title="Re-sincronizar"
                  >
                    {isSyncingThis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(conn.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 rounded"
                    title="Desconectar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Expanded accounts */}
              <AnimatePresence initial={false}>
                {isExpanded && connAccounts.length > 0 && (
                  <motion.div
                    key="breakdown"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-foreground/10 divide-y divide-foreground/5">
                      {connAccounts.map(acc => {
                        const AccIcon = ACCOUNT_TYPE_ICONS[acc.type] || Landmark;
                        const maskedNumber = (acc as any).raw_data?.number
                          ? `••${(acc as any).raw_data.number.slice(-4)}`
                          : null;
                        return (
                        <div key={acc.id} className="flex items-center gap-2.5 px-3 py-2 bg-foreground/[0.03]">
                          <AccIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-foreground truncate">
                              {acc.name || "Conta"}
                              {maskedNumber && <span className="text-muted-foreground ml-1">{maskedNumber}</span>}
                            </p>
                            <p className="text-[9px] text-muted-foreground">
                              {ACCOUNT_TYPE_LABELS[acc.type] ?? acc.type}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {acc.type === "credit_card" ? (
                              <>
                                <p className="text-xs font-medium text-destructive">
                                  Fatura R$ {formatCurrency(acc.current_balance || 0)}
                                </p>
                                {acc.available_balance != null && (
                                  <p className="text-[9px] text-green-400">
                                    Disponível R$ {formatCurrency(acc.available_balance)}
                                  </p>
                                )}
                                {acc.credit_limit != null && (
                                  <p className="text-[9px] text-muted-foreground">
                                    Limite R$ {formatCurrency(acc.credit_limit)}
                                  </p>
                                )}
                              </>
                            ) : (
                              <>
                                <p className="text-xs font-medium text-foreground">
                                  R$ {formatCurrency(acc.current_balance || 0)}
                                </p>
                                {acc.available_balance != null && acc.available_balance !== acc.current_balance && (
                                  <p className="text-[9px] text-green-400">
                                    Disp. R$ {formatCurrency(acc.available_balance)}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            {onEnrich && (
                              <button
                                onClick={async () => {
                                  setEnrichingAccId(acc.id);
                                  await onEnrich(acc.id, acc.type);
                                  setEnrichingAccId(null);
                                }}
                                disabled={enrichingAccId === acc.id}
                                className="p-1 rounded text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
                                title="Enriquecer transações (categorizar + comerciante)"
                              >
                                {enrichingAccId === acc.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Sparkles className="w-3 h-3" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => handleRefreshBalance(acc.id)}
                              disabled={refreshingAccId === acc.id}
                              className="p-1 rounded text-muted-foreground hover:text-amber-400 transition-colors disabled:opacity-40"
                              title="Saldo em tempo real (Open Finance)"
                            >
                              {refreshingAccId === acc.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Zap className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
      </div>

      {/* Delete confirmation */}
      <AnimatePresence>
        {confirmDeleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center"
            onClick={() => setConfirmDeleteId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-background border border-border rounded-xl p-5 w-full max-w-sm mx-4 shadow-xl"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Desconectar banco?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    A conexão será removida. As transações já importadas permanecerão salvas.
                  </p>
                </div>
                <button onClick={() => setConfirmDeleteId(null)} className="ml-auto text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="px-3 py-1.5 text-xs rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors font-medium"
                >
                  Desconectar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
};

export default OpenBankingAccountsCard;

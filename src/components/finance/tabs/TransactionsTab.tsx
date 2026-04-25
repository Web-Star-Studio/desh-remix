import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, X, Trash2, Loader2, Filter, RefreshCw, Repeat, ToggleLeft, ToggleRight,
  CreditCard, ShoppingBag, DollarSign, AlertCircle, Search, Edit3, Sparkles, ClipboardCopy
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart, Line, PieChart, Pie, Cell } from "recharts";
import { Target } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import DeshTooltip from "@/components/ui/DeshTooltip";
import { DeshContextMenu } from "@/components/ui/DeshContextMenu";
import MoveToWorkspace from "@/components/dashboard/MoveToWorkspace";
import WorkspaceBadge from "@/components/dashboard/WorkspaceBadge";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { CATEGORIES, getCategoryMeta, formatCurrency, CATEGORY_META } from "@/components/finance/financeConstants";

interface TransactionsTabProps {
  transactions: any[];
  dailyTrend: any[];
  recurring: any[];
  budgets: any[];
  budgetAlerts: any[];
  categoryBreakdown: Record<string, number>;
  totalExpense: number;
  filterCategory: string;
  setFilterCategory: (v: string) => void;
  filterSource: string;
  setFilterSource: (v: string) => void;
  filterAccount: string;
  setFilterAccount: (v: string) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  onAddTransaction: (desc: string, amount: number, type: string, category: string, date: string) => Promise<void>;
  onUpdateTransaction: (id: string, data: any) => Promise<void>;
  onDeleteTransaction: (id: string) => void;
  onAddRecurring: (desc: string, amount: number, type: string, category: string, day: number) => Promise<void>;
  onToggleRecurring: (id: string) => void;
  onDeleteRecurring: (id: string) => void;
  onGenerateRecurring: () => void;
  onAutoCategorize: () => void;
  isCategorizing: boolean;
  uncategorizedCount: number;
  recurringTotals: { income: number; expense: number; net: number };
  onSetBudgetLimit: (cat: string, limit: number) => void;
  isWidgetEnabled?: (id: string) => boolean;
}

const TransactionsTab = ({
  transactions, dailyTrend, recurring, budgets, budgetAlerts,
  categoryBreakdown, totalExpense,
  filterCategory, setFilterCategory, filterSource, setFilterSource,
  filterAccount, setFilterAccount, searchQuery, setSearchQuery,
  onAddTransaction, onUpdateTransaction, onDeleteTransaction,
  onAddRecurring, onToggleRecurring, onDeleteRecurring, onGenerateRecurring,
  onAutoCategorize, isCategorizing, uncategorizedCount, recurringTotals,
  onSetBudgetLimit,
  isWidgetEnabled = () => true,
}: TransactionsTabProps) => {
  const { activeWorkspaceId } = useWorkspace();
  const [txPage, setTxPage] = useState(1);
  const TX_PER_PAGE = 30;
  const [showAddTx, setShowAddTx] = useState(false);
  const [txDesc, setTxDesc] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txType, setTxType] = useState<"income" | "expense">("expense");
  const [txCategory, setTxCategory] = useState("Outros");
  const [txDate, setTxDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editTxDesc, setEditTxDesc] = useState("");
  const [editTxAmount, setEditTxAmount] = useState("");
  const [editTxCategory, setEditTxCategory] = useState("Outros");
  const [showAddRecurring, setShowAddRecurring] = useState(false);
  const [recDesc, setRecDesc] = useState("");
  const [recAmount, setRecAmount] = useState("");
  const [recType, setRecType] = useState<"income" | "expense">("expense");
  const [recCategory, setRecCategory] = useState("Outros");
  const [recDay, setRecDay] = useState("1");

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const catMatch = filterCategory === "all" || t.category === filterCategory;
      const srcMatch = filterSource === "all" || (t as any).source === filterSource;
      const accMatch = filterAccount === "all" || (t as any).account_name === filterAccount;
      const searchMatch = !searchQuery || t.description.toLowerCase().includes(searchQuery.toLowerCase()) || t.category.toLowerCase().includes(searchQuery.toLowerCase());
      return catMatch && srcMatch && accMatch && searchMatch;
    });
  }, [transactions, filterCategory, filterSource, filterAccount, searchQuery]);

  const filteredTotals = useMemo(() => {
    const inc = filteredTransactions.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const exp = filteredTransactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    return { income: inc, expense: exp, count: filteredTransactions.length };
  }, [filteredTransactions]);

  const txTotalPages = Math.max(1, Math.ceil(filteredTransactions.length / TX_PER_PAGE));
  const safeTxPage = Math.min(txPage, txTotalPages);
  const paginatedTx = filteredTransactions.slice((safeTxPage - 1) * TX_PER_PAGE, safeTxPage * TX_PER_PAGE);

  const groupedTransactions = useMemo(() => {
    const groupMap = new Map<string, typeof paginatedTx>();
    for (const tx of paginatedTx) {
      const dateKey = tx.date;
      if (!groupMap.has(dateKey)) groupMap.set(dateKey, []);
      groupMap.get(dateKey)!.push(tx);
    }
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const groups: { date: string; label: string; dayTotal: number; transactions: typeof paginatedTx }[] = [];
    for (const [date, txs] of groupMap) {
      const label = date === today ? "Hoje" : date === yesterday ? "Ontem" : new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
      const dayTotal = txs.reduce((s, t) => s + (t.type === "income" ? Number(t.amount) : -Number(t.amount)), 0);
      groups.push({ date, label, dayTotal, transactions: txs });
    }
    return groups.sort((a, b) => b.date.localeCompare(a.date));
  }, [paginatedTx]);

  const hasObTransactions = useMemo(() => transactions.some(t => (t as any).source === "openbanking"), [transactions]);
  const activeCategories = useMemo(() => Array.from(new Set(transactions.map(t => t.category))), [transactions]);

  const handleAddTx = async () => {
    if (!txDesc.trim() || !txAmount) return;
    await onAddTransaction(txDesc.trim(), parseFloat(txAmount), txType, txCategory, txDate);
    setTxDesc(""); setTxAmount(""); setTxType("expense"); setTxCategory("Outros");
    setTxDate(new Date().toISOString().split("T")[0]);
    setShowAddTx(false);
  };

  const handleSaveEditTx = async (txId: string) => {
    if (!editTxDesc.trim() || !editTxAmount) return;
    await onUpdateTransaction(txId, {
      description: editTxDesc.trim(),
      amount: Math.abs(parseFloat(editTxAmount)),
      category: editTxCategory,
    });
    setEditingTxId(null);
  };

  const startEditTx = (tx: any) => {
    setEditingTxId(tx.id);
    setEditTxDesc(tx.description);
    setEditTxAmount(String(tx.amount));
    setEditTxCategory(tx.category);
  };

  const handleAddRecurringLocal = async () => {
    if (!recDesc.trim() || !recAmount) return;
    await onAddRecurring(recDesc.trim(), parseFloat(recAmount), recType, recCategory, parseInt(recDay) || 1);
    setRecDesc(""); setRecAmount(""); setRecType("expense"); setRecCategory("Outros"); setRecDay("1");
    setShowAddRecurring(false);
  };

  // Pie data for categories sidebar
  const pieData = Object.entries(categoryBreakdown).map(([name, value], i) => ({
    name, value, color: ["hsl(220,60%,55%)", "hsl(140,50%,50%)", "hsl(35,80%,55%)", "hsl(280,50%,55%)", "hsl(0,0%,60%)", "hsl(0,70%,55%)", "hsl(180,50%,50%)"][i % 7],
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* LEFT: Daily Flow + Transactions + Recurring */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          {/* Daily flow chart */}
          {isWidgetEnabled("tx_daily_chart") && <AnimatedItem index={0}>
            <GlassCard size="auto">
              <p className="widget-title mb-3">Fluxo diário</p>
              {dailyTrend.some(d => d.receita > 0 || d.despesa > 0) ? (() => {
                let cumulative = 0;
                const chartData = dailyTrend.map(d => {
                  cumulative += d.receita - d.despesa;
                  return { ...d, saldo: cumulative };
                });
                return (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <ComposedChart data={chartData}>
                        <defs>
                          <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(140, 50%, 50%)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(140, 50%, 50%)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(0, 70%, 55%)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(0, 70%, 55%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                        <YAxis hide />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                          formatter={(value: number, name: string) => [`R$ ${formatCurrency(value)}`, name === "receita" ? "Receita" : name === "despesa" ? "Despesa" : "Saldo acumulado"]}
                        />
                        <Area type="monotone" dataKey="receita" stroke="hsl(140, 50%, 50%)" fill="url(#colorReceita)" strokeWidth={2} />
                        <Area type="monotone" dataKey="despesa" stroke="hsl(0, 70%, 55%)" fill="url(#colorDespesa)" strokeWidth={2} />
                        <Line type="monotone" dataKey="saldo" stroke="hsl(220, 60%, 55%)" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                      </ComposedChart>
                    </ResponsiveContainer>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded-full" style={{ background: "hsl(140, 50%, 50%)" }} /> Receitas</span>
                      <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded-full" style={{ background: "hsl(0, 70%, 55%)" }} /> Despesas</span>
                      <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded-full" style={{ background: "hsl(220, 60%, 55%)" }} /> Saldo acum.</span>
                    </div>
                  </>
                );
              })() : (
                <div className="flex items-center justify-center h-[200px]">
                  <p className="text-xs text-muted-foreground">Adicione transações para ver o gráfico</p>
                </div>
              )}
            </GlassCard>
          </AnimatedItem>}

          {/* Transactions list */}
          <AnimatedItem index={1}>
            <GlassCard size="auto">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <p className="widget-title">Transações</p>
                  <span className="text-[10px] text-muted-foreground">({filteredTotals.count})</span>
                  {(filterCategory !== "all" || filterSource !== "all" || searchQuery) && filteredTotals.count > 0 && (
                    <span className="text-[9px] text-muted-foreground ml-1">
                      <span className="text-green-400 font-semibold">+R$ {formatCurrency(filteredTotals.income)}</span>
                      <span className="mx-1 text-foreground/20">/</span>
                      <span className="text-destructive font-semibold">-R$ {formatCurrency(filteredTotals.expense)}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {uncategorizedCount > 0 && (
                    <button onClick={onAutoCategorize} disabled={isCategorizing}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-primary/15 text-primary border border-primary/20 hover:bg-primary/25 transition-all disabled:opacity-50">
                      {isCategorizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Auto-categorizar ({uncategorizedCount})
                    </button>
                  )}
                  {activeCategories.length > 1 && (
                    <div className="flex items-center gap-1">
                      <Filter className="w-3 h-3 text-muted-foreground" />
                      <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setTxPage(1); }}
                        className="bg-foreground/5 rounded-lg px-2 py-1 text-[10px] text-foreground outline-none [&>option]:bg-background [&>option]:text-foreground">
                        <option value="all">Todas categ.</option>
                        {activeCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}
                  <button onClick={() => setShowAddTx(!showAddTx)} className="text-primary hover:scale-110 transition-transform">
                    {showAddTx ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setTxPage(1); }}
                  placeholder="Buscar transações..."
                  className="w-full bg-foreground/5 rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/30 transition-all" />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Source filter pills */}
              {hasObTransactions && (
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {(["all", "manual", "openbanking"] as const).map(src => (
                    <button key={src} onClick={() => { setFilterSource(src as any); setFilterAccount("all"); setTxPage(1); }}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all border ${
                        filterSource === src
                          ? src === "openbanking" ? "bg-emerald-500/20 text-emerald-400 border-emerald-400/30"
                            : src === "manual" ? "bg-foreground/10 text-foreground border-foreground/20"
                            : "bg-primary/15 text-primary border-primary/25"
                          : "bg-transparent text-muted-foreground border-foreground/10 hover:border-foreground/20 hover:text-foreground"
                      }`}>
                      {src === "all" ? "Todas" : src === "openbanking" ? "🔗 Open Banking" : "✏️ Manual"}
                    </button>
                  ))}
                </div>
              )}

              {/* Add transaction form */}
              {showAddTx && (
                <div className="mb-4 p-3 rounded-lg bg-foreground/5 space-y-2">
                  <input value={txDesc} onChange={e => setTxDesc(e.target.value)} placeholder="Descrição..."
                    className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" autoFocus />
                  <div className="flex gap-2">
                    <input value={txAmount} onChange={e => setTxAmount(e.target.value)} placeholder="Valor (R$)" type="number"
                      className="flex-1 bg-foreground/5 rounded px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none" />
                    <select value={txType} onChange={e => setTxType(e.target.value as any)}
                      className="bg-foreground/5 rounded px-2 py-1.5 text-xs text-foreground outline-none [&>option]:bg-background [&>option]:text-foreground">
                      <option value="expense">Despesa</option>
                      <option value="income">Receita</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <select value={txCategory} onChange={e => setTxCategory(e.target.value)}
                      className="flex-1 bg-foreground/5 rounded px-2 py-1.5 text-xs text-foreground outline-none [&>option]:bg-background [&>option]:text-foreground">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input value={txDate} onChange={e => setTxDate(e.target.value)} type="date"
                      className="bg-foreground/5 rounded px-2 py-1.5 text-xs text-foreground outline-none" />
                  </div>
                  <button onClick={handleAddTx} className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors">
                    Adicionar
                  </button>
                </div>
              )}

              {/* Budget alerts */}
              {isWidgetEnabled("tx_budget_alerts") && budgetAlerts.length > 0 && (
                <div className="mb-3 space-y-1.5">
                  {budgetAlerts.map(alert => (
                    <motion.div key={alert.category} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${alert.pct >= 100 ? "bg-destructive/10 border-destructive/20" : "bg-amber-500/10 border-amber-400/20"}`}>
                      <AlertCircle className={`w-4 h-4 flex-shrink-0 ${alert.pct >= 100 ? "text-destructive" : "text-amber-400"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-foreground font-medium">
                          {alert.category}: R$ {formatCurrency(alert.spent)} / R$ {formatCurrency(alert.limit)}
                          <span className={`ml-1.5 font-bold ${alert.pct >= 100 ? "text-destructive" : "text-amber-400"}`}>({Math.round(alert.pct)}%)</span>
                        </p>
                      </div>
                      <div className="w-16 h-1.5 rounded-full bg-foreground/10 overflow-hidden flex-shrink-0">
                        <div className={`h-full rounded-full ${alert.pct >= 100 ? "bg-destructive" : "bg-amber-400"}`} style={{ width: `${Math.min(alert.pct, 100)}%` }} />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Transaction list */}
              <div className="space-y-0 max-h-[480px] overflow-y-auto pr-0.5 scrollbar-thin">
                <AnimatePresence initial={false}>
                  {groupedTransactions.map((group) => (
                    <div key={group.date}>
                      <div className="flex items-center justify-between py-1.5 px-1 sticky top-0 bg-background/90 backdrop-blur-sm z-10 border-b border-foreground/5">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{group.label}</span>
                        <span className={`text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-md ${group.dayTotal >= 0 ? "text-green-400 bg-green-500/10" : "text-destructive bg-destructive/10"}`}>
                          {group.dayTotal >= 0 ? "+" : ""}R$ {formatCurrency(Math.abs(group.dayTotal))}
                        </span>
                      </div>
                      {group.transactions.map((tx, i) => {
                        const catMeta = getCategoryMeta(tx.category, tx.type);
                        const CatIcon = catMeta.icon;
                        return (
                          <DeshContextMenu key={tx.id} actions={[
                            { id: "edit", label: "Editar transação", icon: Edit3, onClick: () => startEditTx(tx), disabled: (tx as any).source === "openbanking" },
                            { id: "categorize", label: "Categorizar com IA", icon: Sparkles, onClick: () => onAutoCategorize() },
                            { id: "copy_value", label: "Copiar valor", icon: ClipboardCopy, onClick: () => { navigator.clipboard.writeText(`R$ ${Number(tx.amount).toFixed(2)}`); } },
                            { id: "delete", label: "Excluir", icon: Trash2, destructive: true, dividerAfter: true, onClick: () => onDeleteTransaction(tx.id) },
                          ]}>
                            <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6 }}
                              transition={{ delay: Math.min(i * 0.02, 0.2) }}
                              className="flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-foreground/[0.04] transition-colors group cursor-default">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${catMeta.bg}`}>
                                <CatIcon className={`w-3.5 h-3.5 ${catMeta.text}`} />
                              </div>
                              {editingTxId === tx.id ? (
                                <div className="flex-1 min-w-0 space-y-1.5">
                                  <input value={editTxDesc} onChange={e => setEditTxDesc(e.target.value)}
                                    className="w-full bg-foreground/5 rounded px-2 py-1 text-xs text-foreground outline-none" autoFocus />
                                  <div className="flex gap-1.5">
                                    <input value={editTxAmount} onChange={e => setEditTxAmount(e.target.value)} type="number"
                                      className="w-24 bg-foreground/5 rounded px-2 py-1 text-xs text-foreground outline-none" />
                                    <select value={editTxCategory} onChange={e => setEditTxCategory(e.target.value)}
                                      className="flex-1 bg-foreground/5 rounded px-2 py-1 text-xs text-foreground outline-none [&>option]:bg-background">
                                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <button onClick={() => handleSaveEditTx(tx.id)} className="px-2 py-1 rounded bg-primary/20 text-primary text-[10px] font-medium hover:bg-primary/30">Salvar</button>
                                    <button onClick={() => setEditingTxId(null)} className="px-2 py-1 rounded bg-foreground/5 text-muted-foreground text-[10px] hover:text-foreground">✕</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <p className="text-sm text-foreground truncate font-medium">{tx.description}</p>
                                      {(tx as any).source === "openbanking" ? (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[9px] font-semibold border border-emerald-400/20 flex-shrink-0">🔗 OB</span>
                                      ) : (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-foreground/8 text-muted-foreground text-[9px] font-medium border border-foreground/10 flex-shrink-0">✏️</span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
                                      <span className={`px-1.5 py-0.5 rounded-md ${catMeta.bg} ${catMeta.text} text-[8px] font-medium`}>{tx.category}</span>
                                      {(tx as any).source === "openbanking" && (tx as any).account_name && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-foreground/6 text-muted-foreground text-[9px] border border-foreground/10">
                                          <CreditCard className="w-2.5 h-2.5" />{(tx as any).account_name}
                                        </span>
                                      )}
                                      {!activeWorkspaceId && tx.workspace_id && (
                                        <span className="ml-0.5 inline-flex"><WorkspaceBadge workspaceId={tx.workspace_id} /></span>
                                      )}
                                    </p>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <span className={`text-sm font-bold tabular-nums ${tx.type === "income" ? "text-green-400" : "text-destructive"}`}>
                                      {tx.type === "income" ? "+" : "-"}R$ {formatCurrency(Number(tx.amount))}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-0.5 flex-shrink-0">
                                    {(tx as any).source !== "openbanking" && (
                                      <DeshTooltip label="Editar">
                                        <button onClick={() => startEditTx(tx)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all p-1 rounded hover:bg-primary/10">
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                      </DeshTooltip>
                                    )}
                                    <MoveToWorkspace table="finance_transactions" itemId={tx.id} currentWorkspaceId={tx.workspace_id} />
                                    <button onClick={() => onDeleteTransaction(tx.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 rounded hover:bg-destructive/10">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </>
                              )}
                            </motion.div>
                          </DeshContextMenu>
                        );
                      })}
                    </div>
                  ))}
                </AnimatePresence>
                {filteredTransactions.length === 0 && !showAddTx && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <DollarSign className="w-8 h-8 text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground mb-2">
                      {searchQuery ? `Nenhum resultado para "${searchQuery}"` : filterCategory !== "all" || filterSource !== "all" ? "Nenhuma transação com os filtros selecionados" : "Nenhuma transação neste mês"}
                    </p>
                    {(filterCategory !== "all" || filterSource !== "all" || searchQuery) ? (
                      <button onClick={() => { setFilterCategory("all"); setFilterSource("all"); setFilterAccount("all"); setSearchQuery(""); setTxPage(1); }}
                        className="text-[10px] px-3 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">Limpar filtros</button>
                    ) : (
                      <button onClick={() => setShowAddTx(true)}
                        className="text-[10px] px-3 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Adicionar transação
                      </button>
                    )}
                  </div>
                )}
                {txTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-3 mt-2 border-t border-foreground/10">
                    <span className="text-[10px] text-muted-foreground">{filteredTotals.count} transação{filteredTotals.count !== 1 ? "ões" : ""} · Página {safeTxPage} de {txTotalPages}</span>
                    <div className="flex gap-1">
                      <button onClick={() => setTxPage(p => Math.max(1, p - 1))} disabled={safeTxPage <= 1}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-foreground/5 text-foreground hover:bg-foreground/10 disabled:opacity-40 transition-colors">Anterior</button>
                      <button onClick={() => setTxPage(p => Math.min(txTotalPages, p + 1))} disabled={safeTxPage >= txTotalPages}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-foreground/5 text-foreground hover:bg-foreground/10 disabled:opacity-40 transition-colors">Próxima</button>
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>
          </AnimatedItem>

          {/* Recurring */}
          {isWidgetEnabled("tx_recurring") && <AnimatedItem index={2}>
            <GlassCard size="auto">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-primary/60" />
                  <p className="widget-title">Recorrentes</p>
                  <span className="text-[10px] text-muted-foreground">({recurring.filter(r => r.active).length} ativas)</span>
                </div>
                <div className="flex items-center gap-2">
                  <DeshTooltip label="Gerar transações do mês">
                    <button onClick={onGenerateRecurring} className="text-primary/60 hover:text-primary hover:scale-110 transition-all">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </DeshTooltip>
                  <button onClick={() => setShowAddRecurring(!showAddRecurring)} className="text-primary hover:scale-110 transition-transform">
                    {showAddRecurring ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {recurring.filter(r => r.active).length > 0 && (
                <div className="flex items-center gap-3 mb-3 p-2.5 rounded-xl bg-foreground/5 border border-foreground/8">
                  <div className="flex-1 flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Receitas fixas</p>
                      <p className="text-sm font-bold text-green-400 tabular-nums">R$ {formatCurrency(recurringTotals.income)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Despesas fixas</p>
                      <p className="text-sm font-bold text-destructive tabular-nums">R$ {formatCurrency(recurringTotals.expense)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Saldo fixo</p>
                      <p className={`text-sm font-bold tabular-nums ${recurringTotals.net >= 0 ? "text-green-400" : "text-destructive"}`}>
                        R$ {formatCurrency(Math.abs(recurringTotals.net))}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {showAddRecurring && (
                <div className="mb-4 p-3 rounded-lg bg-foreground/5 space-y-2">
                  <input value={recDesc} onChange={e => setRecDesc(e.target.value)} placeholder="Descrição (ex: Aluguel, Salário)..."
                    className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" autoFocus />
                  <div className="flex gap-2">
                    <input value={recAmount} onChange={e => setRecAmount(e.target.value)} placeholder="Valor (R$)" type="number"
                      className="flex-1 bg-foreground/5 rounded px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none" />
                    <select value={recType} onChange={e => setRecType(e.target.value as any)}
                      className="bg-foreground/5 rounded px-2 py-1.5 text-xs text-foreground outline-none [&>option]:bg-background [&>option]:text-foreground">
                      <option value="expense">Despesa</option>
                      <option value="income">Receita</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <select value={recCategory} onChange={e => setRecCategory(e.target.value)}
                      className="flex-1 bg-foreground/5 rounded px-2 py-1.5 text-xs text-foreground outline-none [&>option]:bg-background [&>option]:text-foreground">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input value={recDay} onChange={e => setRecDay(e.target.value)} placeholder="Dia" type="number" min={1} max={31}
                      className="w-16 bg-foreground/5 rounded px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none" />
                  </div>
                  <button onClick={handleAddRecurringLocal} className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors">
                    Adicionar recorrente
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[300px] overflow-y-auto scrollbar-thin pr-0.5">
                {recurring.map(rec => {
                  const catMeta = getCategoryMeta(rec.category, rec.type);
                  const CatIcon = catMeta.icon;
                  return (
                    <div key={rec.id} className={`flex items-center gap-2 py-2 px-2.5 rounded-lg transition-colors group ${rec.active ? "hover:bg-foreground/[0.04]" : "opacity-50"}`}>
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${catMeta.bg}`}>
                        <CatIcon className={`w-3 h-3 ${catMeta.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground truncate font-medium">{rec.description}</p>
                        <p className="text-[9px] text-muted-foreground">Dia {rec.day_of_month} · {rec.category}</p>
                      </div>
                      <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${rec.type === "income" ? "text-green-400" : "text-destructive"}`}>
                        {rec.type === "income" ? "+" : "-"}R$ {formatCurrency(Number(rec.amount))}
                      </span>
                      <button onClick={() => onToggleRecurring(rec.id)} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                        {rec.active ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      <button onClick={() => onDeleteRecurring(rec.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all flex-shrink-0">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
                {recurring.length === 0 && !showAddRecurring && (
                  <p className="text-xs text-muted-foreground text-center py-4 col-span-full">
                    Nenhuma recorrente. Adicione salário, aluguel, assinaturas, etc.
                  </p>
                )}
              </div>
            </GlassCard>
          </AnimatedItem>}
        </div>

        {/* RIGHT: Categories + Goals + Budgets */}
        <div className="flex flex-col gap-3">
          {/* Category breakdown */}
          {isWidgetEnabled("tx_category_breakdown") && <AnimatedItem index={0}>
            <GlassCard size="auto" className="max-h-[600px] overflow-y-auto scrollbar-thin">
              <p className="widget-title mb-3 sticky top-0 bg-background/80 backdrop-blur-sm z-10 pb-1">Por categoria</p>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={35} paddingAngle={3}>
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-3">
                    {pieData.sort((a, b) => b.value - a.value).map(cat => {
                      const budget = budgets.find(b => b.category === cat.name);
                      const pctUsed = budget && budget.monthly_limit > 0 ? (cat.value / budget.monthly_limit) * 100 : null;
                      const pctOfTotal = totalExpense > 0 ? (cat.value / totalExpense) * 100 : 0;
                      const catMeta = CATEGORY_META[cat.name] ?? { icon: ShoppingBag, bg: "bg-foreground/10", text: "text-muted-foreground" };
                      const CIcon = catMeta.icon;
                      return (
                        <div key={cat.name} className="group p-2 rounded-xl hover:bg-foreground/5 transition-colors">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-lg ${catMeta.bg} flex items-center justify-center flex-shrink-0`}>
                              <CIcon className={`w-3.5 h-3.5 ${catMeta.text}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-foreground truncate">{cat.name}</span>
                                <span className="text-xs font-bold text-foreground tabular-nums">R$ {formatCurrency(cat.value)}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                                  <motion.div initial={{ width: 0 }} animate={{ width: `${pctUsed !== null ? Math.min(pctUsed, 100) : pctOfTotal}%` }}
                                    transition={{ duration: 0.6 }}
                                    className={`h-full rounded-full ${pctUsed !== null ? pctUsed > 100 ? "bg-destructive" : pctUsed > 80 ? "bg-amber-400" : "bg-green-400" : ""}`}
                                    style={pctUsed === null ? { background: cat.color } : undefined} />
                                </div>
                                <span className={`text-[9px] font-semibold tabular-nums w-8 text-right ${pctUsed !== null ? pctUsed > 100 ? "text-destructive" : pctUsed > 80 ? "text-amber-400" : "text-green-400" : "text-muted-foreground"}`}>
                                  {pctUsed !== null ? `${Math.round(pctUsed)}%` : `${Math.round(pctOfTotal)}%`}
                                </span>
                              </div>
                              {budget && budget.monthly_limit > 0 && (
                                <p className="text-[8px] text-muted-foreground mt-0.5">
                                  Limite: R$ {formatCurrency(budget.monthly_limit)}
                                  {pctUsed! >= 100 && <span className="text-destructive ml-1">• Excedido!</span>}
                                  {pctUsed! < 100 && <span className="text-green-400/70 ml-1">• Resta R$ {formatCurrency(budget.monthly_limit - cat.value)}</span>}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Budget setup */}
                  <div className="mt-4 pt-3 border-t border-foreground/5">
                    <p className="text-[10px] text-muted-foreground mb-3 flex items-center gap-1 uppercase tracking-wider font-semibold">
                      <Target className="w-3 h-3" /> Orçamentos por categoria
                    </p>
                    <div className="space-y-2">
                      {CATEGORIES.filter(c => c !== "Renda").map(cat => {
                        const budget = budgets.find(b => b.category === cat);
                        const spent = categoryBreakdown[cat] || 0;
                        const limit = budget?.monthly_limit || 0;
                        const pctUsed = limit > 0 ? (spent / limit) * 100 : 0;
                        const catMeta = CATEGORY_META[cat] ?? { icon: ShoppingBag, bg: "bg-foreground/10", text: "text-muted-foreground" };
                        const CIcon = catMeta.icon;
                        return (
                          <div key={cat} className="p-2 rounded-xl bg-foreground/[0.03] hover:bg-foreground/5 transition-colors">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-lg ${catMeta.bg} flex items-center justify-center flex-shrink-0`}>
                                <CIcon className={`w-3 h-3 ${catMeta.text}`} />
                              </div>
                              <span className="text-[10px] text-foreground font-medium flex-1 truncate">{cat}</span>
                              {limit > 0 && <span className="text-[9px] text-muted-foreground tabular-nums">R$ {formatCurrency(spent)}</span>}
                              <span className="text-muted-foreground/30 text-[9px]">/</span>
                              <input type="number" placeholder="0" defaultValue={limit || ""}
                                onBlur={e => { const val = parseFloat(e.target.value) || 0; if (val !== limit) onSetBudgetLimit(cat, val); }}
                                className="w-20 bg-foreground/5 rounded-lg px-2 py-1 text-[10px] text-foreground placeholder:text-muted-foreground/30 outline-none focus:ring-1 focus:ring-primary/20 tabular-nums text-right" />
                            </div>
                            {limit > 0 && (
                              <div className="flex items-center gap-2 mt-1.5 ml-8">
                                <div className="flex-1 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(pctUsed, 100)}%` }} transition={{ duration: 0.6 }}
                                    className={`h-full rounded-full ${pctUsed > 100 ? "bg-destructive" : pctUsed > 80 ? "bg-amber-400" : "bg-green-400"}`} />
                                </div>
                                <span className={`text-[8px] font-semibold tabular-nums ${pctUsed > 100 ? "text-destructive" : pctUsed > 80 ? "text-amber-400" : "text-green-400"}`}>{Math.round(pctUsed)}%</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-[160px]">
                  <p className="text-xs text-muted-foreground">Sem despesas neste mês</p>
                </div>
              )}
            </GlassCard>
          </AnimatedItem>}
        </div>
      </div>
    </motion.div>
  );
};

export default TransactionsTab;

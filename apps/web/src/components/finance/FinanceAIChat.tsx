import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, Loader2, X, Sparkles, TrendingDown, PiggyBank, BarChart3, Wallet } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import { Streamdown } from "streamdown";
import { invokeAI } from "@/lib/ai-router";
import { toast } from "@/hooks/use-toast";
import type { FinanceTransaction, FinanceBudget } from "@/hooks/finance/useDbFinances";

interface FinanceAIChatProps {
  transactions: FinanceTransaction[];
  budgets: FinanceBudget[];
  categoryBreakdown: Record<string, number>;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  selectedMonth: string;
  savingsRate: number;
  recurring?: Array<{ description: string; amount: number; type: string; active: boolean }>;
  index?: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const QUICK_PROMPTS = [
  { icon: TrendingDown, label: "Onde posso economizar?", message: "Analise meus gastos e me diga onde posso economizar dinheiro este mês." },
  { icon: PiggyBank, label: "Meta de economia", message: "Baseado nos meus gastos, qual seria uma meta de economia realista para este mês?" },
  { icon: BarChart3, label: "Resumo financeiro", message: "Me dê um resumo completo das minhas finanças deste mês com pontos de atenção." },
  { icon: Wallet, label: "Gastos por categoria", message: "Quais categorias estão consumindo mais do meu orçamento? Compare com o que seria ideal." },
];

const FinanceAIChat = ({
  transactions, budgets, categoryBreakdown, totalIncome, totalExpense,
  balance, selectedMonth, savingsRate, recurring, index = 3.8,
}: FinanceAIChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const buildFinanceContext = useCallback(() => {
    const parts: string[] = [];
    parts.push(`Mês: ${selectedMonth}`);
    parts.push(`Receita total: R$${totalIncome.toFixed(2)}`);
    parts.push(`Despesa total: R$${totalExpense.toFixed(2)}`);
    parts.push(`Saldo: R$${balance.toFixed(2)}`);
    parts.push(`Taxa de poupança: ${savingsRate.toFixed(1)}%`);

    if (Object.keys(categoryBreakdown).length > 0) {
      parts.push(`Gastos por categoria: ${Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: R$${v.toFixed(2)}`).join(", ")}`);
    }

    if (budgets.length > 0) {
      const budgetInfo = budgets.filter(b => b.monthly_limit > 0).map(b => {
        const spent = categoryBreakdown[b.category] || 0;
        const pct = ((spent / b.monthly_limit) * 100).toFixed(0);
        return `${b.category}: R$${spent.toFixed(2)}/${b.monthly_limit} (${pct}%)`;
      });
      if (budgetInfo.length > 0) parts.push(`Orçamentos: ${budgetInfo.join(", ")}`);
    }

     parts.push(`Total de transações: ${transactions.length}`);

    // Recurring info
    if (recurring && recurring.length > 0) {
      const activeRec = recurring.filter(r => r.active);
      const recIncome = activeRec.filter(r => r.type === "income").reduce((s, r) => s + r.amount, 0);
      const recExpense = activeRec.filter(r => r.type === "expense").reduce((s, r) => s + r.amount, 0);
      parts.push(`Recorrentes ativas: ${activeRec.length} (Receita fixa: R$${recIncome.toFixed(2)}, Despesa fixa: R$${recExpense.toFixed(2)})`);
    }

    // Top 5 maiores gastos
    const topExpenses = transactions
      .filter(t => t.type === "expense")
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 5);
    if (topExpenses.length > 0) {
      parts.push(`Top 5 maiores gastos: ${topExpenses.map(t => `"${t.description}" R$${Number(t.amount).toFixed(2)} (${t.category})`).join("; ")}`);
    }

    return parts.join("\n");
  }, [transactions, budgets, categoryBreakdown, totalIncome, totalExpense, balance, selectedMonth, savingsRate, recurring]);

  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: "user", content: messageText.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const MAX_RETRIES = 2;
    const RETRY_DELAYS = [1500, 3000];

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const context = buildFinanceContext();
        const conversationHistory = messages.map(m => ({ role: m.role, content: m.content }));

        const data = await invokeAI("finance", {
          action: "chat",
          message: messageText.trim(),
          context,
          conversation_history: conversationHistory,
        });

        if (data?.error) {
          if (data.error.includes("Rate limit")) {
            toast({ title: "Limite de requisições", description: "Tente novamente em alguns instantes.", variant: "destructive" });
          } else if (data.error.includes("Credits") || data.error.includes("402")) {
            toast({ title: "Créditos insuficientes", description: "Adicione créditos para usar a IA.", variant: "destructive" });
          } else {
            throw new Error(data.error);
          }
          setIsLoading(false);
          return;
        }

        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: data?.reply || "Não consegui processar sua pergunta. Tente novamente.",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMsg]);
        setIsLoading(false);
        return; // Success — exit retry loop
      } catch (err: any) {
        // Retry on transient errors
        if (attempt < MAX_RETRIES && (err.message?.includes("fetch") || err.message?.includes("500") || err.message?.includes("network"))) {
          console.debug(`[FinanceAI] Retry ${attempt + 1}/${MAX_RETRIES}`);
          await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
          continue;
        }
        console.error("Finance chat error:", err);
        toast({ title: "Erro", description: err.message || "Falha na comunicação com a IA", variant: "destructive" });
        setIsLoading(false);
        return;
      }
    }
    setIsLoading(false);
  }, [isLoading, messages, buildFinanceContext]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <AnimatedItem index={index}>
      <GlassCard size="auto" className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="widget-title">Assistente Financeiro</p>
          </div>
          <button
            onClick={() => { setIsExpanded(!isExpanded); if (!isExpanded) setTimeout(() => inputRef.current?.focus(), 200); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-400/20 hover:bg-emerald-500/25 transition-all"
          >
            {isExpanded ? <X className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
            {isExpanded ? "Fechar" : "Perguntar à IA"}
          </button>
        </div>

        <AnimatePresence>
          {!isExpanded && messages.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="grid grid-cols-2 gap-1.5">
                {QUICK_PROMPTS.map((prompt) => {
                  const Icon = prompt.icon;
                  return (
                    <button
                      key={prompt.label}
                      onClick={() => { setIsExpanded(true); setTimeout(() => sendMessage(prompt.message), 100); }}
                      className="p-2.5 rounded-xl bg-foreground/5 border border-foreground/8 text-left hover:bg-foreground/10 transition-all group"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-medium text-foreground">{prompt.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Messages */}
              <div className="max-h-[320px] overflow-y-auto space-y-3 mb-3 pr-1 scrollbar-thin">
                {messages.length === 0 && (
                  <div className="text-center py-6">
                    <MessageCircle className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                    <p className="text-[10px] text-muted-foreground">Pergunte qualquer coisa sobre suas finanças!</p>
                    <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                       {QUICK_PROMPTS.map((p) => (
                        <button
                          key={p.label}
                          onClick={() => sendMessage(p.message)}
                          className="px-2.5 py-1 rounded-full text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-400/15 hover:bg-emerald-500/20 transition-all"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <motion.div
                    key={`${msg.role}-${i}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary/15 text-foreground rounded-br-sm"
                        : "bg-foreground/5 text-foreground rounded-bl-sm border border-foreground/8"
                    }`}>
                      {msg.role === "assistant" ? (
                        <Streamdown>{msg.content}</Streamdown>
                      ) : (
                        <span>{msg.content}</span>
                      )}
                      <span className="text-[8px] text-muted-foreground block mt-1 text-right">
                        {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </motion.div>
                ))}

                {isLoading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="px-3 py-2 rounded-2xl rounded-bl-sm bg-foreground/5 border border-foreground/8">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                        <span className="text-[10px] text-muted-foreground">Analisando...</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Pergunte sobre suas finanças..."
                  disabled={isLoading}
                  className="flex-1 px-3 py-2 rounded-xl bg-foreground/5 border border-foreground/10 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-400/30 transition-colors disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-400/20 flex items-center justify-center hover:bg-emerald-500/25 transition-all disabled:opacity-30"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </AnimatedItem>
  );
};

export default FinanceAIChat;

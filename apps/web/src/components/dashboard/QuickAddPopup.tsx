import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ListTodo, StickyNote, CalendarDays, Users, Wallet, ArrowLeft, Plus, RefreshCw } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDashboardActions } from "@/contexts/DashboardContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceFilter } from "@/hooks/workspace/useWorkspaceFilter";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Mode = null | "task" | "note" | "event" | "contact" | "transaction";

const OPTIONS = [
  { mode: "task" as const, icon: ListTodo, label: "Tarefa", color: "text-primary" },
  { mode: "note" as const, icon: StickyNote, label: "Nota", color: "text-amber-500" },
  { mode: "event" as const, icon: CalendarDays, label: "Evento", color: "text-emerald-500" },
  { mode: "contact" as const, icon: Users, label: "Contato", color: "text-violet-500" },
  { mode: "transaction" as const, icon: Wallet, label: "Transação", color: "text-cyan-500" },
];

interface QuickAddPopupProps {
  open: boolean;
  onClose: () => void;
}

const QuickAddPopup = ({ open, onClose }: QuickAddPopupProps) => {
  const isMobile = useIsMobile();
  const [mode, setMode] = useState<Mode>(null);
  const { addTask, addNote, addEvent } = useDashboardActions();
  const { user } = useAuth();
  const { getInsertWorkspaceId } = useWorkspaceFilter();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    sessionStorage.removeItem("desh-intro-seen");
    setTimeout(() => window.location.reload(), 800);
  }, []);

  // Form states
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [eventDate, setEventDate] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [txType, setTxType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("Outros");

  const reset = () => {
    setMode(null);
    setTitle("");
    setContent("");
    setPriority("medium");
    setEventDate("");
    setEmail("");
    setPhone("");
    setAmount("");
    setTxType("expense");
    setCategory("Outros");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!title.trim() && mode !== "transaction") return;

    switch (mode) {
      case "task":
        addTask(title.trim(), priority);
        toast.success("Tarefa adicionada!");
        break;
      case "note":
        addNote(title.trim(), content.trim());
        toast.success("Nota adicionada!");
        break;
      case "event": {
        const d = eventDate ? new Date(eventDate + "T12:00:00") : new Date();
        addEvent(d.getDate(), d.getMonth(), d.getFullYear(), title.trim());
        toast.success("Evento adicionado!");
        break;
      }
      case "contact":
        if (!user) break;
        await supabase.from("contacts").insert({
          name: title.trim(),
          email: email.trim() || "",
          phone: phone.trim() || "",
          user_id: user.id,
          workspace_id: getInsertWorkspaceId(),
        });
        toast.success("Contato adicionado!");
        break;
      case "transaction":
        if (!user || !amount) break;
        await supabase.from("finance_transactions").insert({
          description: title.trim() || "Sem descrição",
          amount: parseFloat(amount),
          type: txType,
          category,
          user_id: user.id,
          workspace_id: getInsertWorkspaceId(),
        });
        toast.success("Transação adicionada!");
        break;
    }
    handleClose();
  };

  if (!open) return null;

  return (
    <div className="absolute top-full right-0 mt-2 z-30 w-72 max-w-[calc(100vw-2rem)]">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -5 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -5 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="glass-card p-3 rounded-xl shadow-xl"
      >
        <AnimatePresence mode="wait">
          {mode === null ? (
            <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p className="text-xs font-semibold text-foreground mb-2">Adicionar rápido</p>
              <div className="grid grid-cols-3 gap-1.5">
                {OPTIONS.map(opt => (
                  <button
                    key={opt.mode}
                    onClick={() => setMode(opt.mode)}
                    className="focusable flex flex-col items-center gap-1 p-2.5 rounded-xl hover:bg-foreground/5 transition-colors"
                  >
                    <opt.icon className={`w-5 h-5 ${opt.color}`} />
                    <span className="text-[10px] font-medium text-foreground/70">{opt.label}</span>
                  </button>
                ))}
                {isMobile && (
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex flex-col items-center gap-1 p-2.5 rounded-xl hover:bg-foreground/5 transition-colors"
                  >
                    <RefreshCw className={`w-5 h-5 text-blue-500 ${refreshing ? "animate-spin" : ""}`} />
                    <span className="text-[10px] font-medium text-foreground/70">Atualizar</span>
                  </button>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => setMode(null)} className="p-1 rounded-md hover:bg-foreground/10 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <p className="text-xs font-semibold text-foreground">
                  {OPTIONS.find(o => o.mode === mode)?.label}
                </p>
              </div>

              <div className="space-y-2">
                {/* Title (all except transaction can skip) */}
                <Input
                  placeholder={mode === "contact" ? "Nome" : mode === "transaction" ? "Descrição" : "Título"}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                  onKeyDown={e => e.key === "Enter" && handleSave()}
                />

                {/* Mode-specific fields */}
                {mode === "task" && (
                  <div className="flex gap-1">
                    {(["low", "medium", "high"] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setPriority(p)}
                        className={`flex-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                          priority === p
                            ? p === "high" ? "bg-destructive/20 text-destructive" : p === "medium" ? "bg-primary/20 text-primary" : "bg-foreground/10 text-foreground"
                            : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
                        }`}
                      >
                        {p === "high" ? "Alta" : p === "medium" ? "Média" : "Baixa"}
                      </button>
                    ))}
                  </div>
                )}

                {mode === "note" && (
                  <Textarea
                    placeholder="Conteúdo"
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    className="min-h-[60px] text-sm"
                  />
                )}

                {mode === "event" && (
                  <Input
                    type="date"
                    value={eventDate}
                    onChange={e => setEventDate(e.target.value)}
                    className="h-8 text-sm"
                  />
                )}

                {mode === "contact" && (
                  <>
                    <Input placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} className="h-8 text-sm" />
                    <Input placeholder="Telefone" value={phone} onChange={e => setPhone(e.target.value)} className="h-8 text-sm" />
                  </>
                )}

                {mode === "transaction" && (
                  <>
                    <Input
                      type="number"
                      placeholder="Valor"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="h-8 text-sm"
                      step="0.01"
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => setTxType("expense")}
                        className={`flex-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                          txType === "expense" ? "bg-destructive/20 text-destructive" : "bg-foreground/5 text-muted-foreground"
                        }`}
                      >
                        Despesa
                      </button>
                      <button
                        onClick={() => setTxType("income")}
                        className={`flex-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                          txType === "income" ? "bg-emerald-500/20 text-emerald-500" : "bg-foreground/5 text-muted-foreground"
                        }`}
                      >
                        Receita
                      </button>
                    </div>
                    <Input
                      placeholder="Categoria"
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </>
                )}

                <button
                  onClick={handleSave}
                  className="focusable w-full py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                >
                  Salvar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default QuickAddPopup;

import { useState, useRef, useEffect } from "react";
import DeshTooltip from "@/components/ui/DeshTooltip";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Send, Zap, ArrowRight, Play, Plus, Pencil, Sparkles, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import GlassCard from "@/components/dashboard/GlassCard";
import { TRIGGER_TYPES, ACTION_TYPES } from "@/hooks/automation/useAutomations";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { toast } from "sonner";
import pandoraAvatar from "@/assets/pandora-avatar.png";

interface AIChatMessage {
  role: "user" | "assistant";
  content: string;
  automation?: any;
}

interface AutomationAIChatProps {
  onClose: () => void;
  onSave: (automation: any, enabled: boolean) => void;
  onEdit: (automation: any) => void;
}

const QUICK_SUGGESTIONS = [
  { text: "Me avise quando um contato ficar sem interação por 15 dias", icon: "👤" },
  { text: "Quando receber email com fatura, criar tarefa urgente", icon: "📧" },
  { text: "Lembrete se eu não treinar até 19h", icon: "💪" },
  { text: "Alerta quando gastar mais de R$300", icon: "💰" },
  { text: "Review semanal toda segunda-feira", icon: "📋" },
  { text: "Criar tarefa quando WhatsApp chegar", icon: "💬" },
  { text: "Nota automática quando concluir tarefa", icon: "✅" },
  { text: "Lembrete de aniversário de contatos", icon: "🎂" },
];

const triggerInfo = (type: string) => TRIGGER_TYPES.find(t => t.value === type);
const actionInfo = (type: string) => ACTION_TYPES.find(a => a.value === type);

const AutomationAIChat = ({ onClose, onSave, onEdit }: AutomationAIChatProps) => {
  const { invoke } = useEdgeFn();
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 150);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const generate = async (prompt: string) => {
    if (!prompt.trim() || loading) return;
    
    const userMsg: AIChatMessage = { role: "user", content: prompt.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const { data: result, error } = await invoke<any>({ fn: "ai-router", body: { module: "automation", prompt: prompt.trim() } });
      if (error || result?.error) {
        const errMsg = result?.error || error || "Erro ao gerar automação";
        setMessages(prev => [...prev, { role: "assistant", content: errMsg }]);
        toast.error(errMsg);
      } else {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `Pronto! Criei a automação **"${result.name}"**. Veja o resumo abaixo:`,
          automation: result,
        }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Erro ao se comunicar com a IA. Tente novamente." }]);
      toast.error("Erro ao gerar automação");
    } finally {
      setLoading(false);
    }
  };

  const lastAutomation = [...messages].reverse().find(m => m.automation)?.automation;

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
      <GlassCard size="auto">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <img src={pandoraAvatar} alt="Pandora" className="w-7 h-7 rounded-full ring-2 ring-primary/30" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Criar automação com a Pandora</p>
            <p className="text-[10px] text-muted-foreground">Descreva o que quer automatizar — eu configuro tudo pra você</p>
          </div>
          <Badge variant="secondary" className="text-[10px]">3 créditos</Badge>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted/50 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chat messages */}
        <div className="max-h-[400px] overflow-y-auto space-y-3 mb-3 scroll-smooth">
          {messages.length === 0 && !loading && (
            <div className="text-center py-4">
              <Sparkles className="w-8 h-8 text-primary/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-1">
                {(() => { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; })()}! Descreva sua automação em linguagem natural
              </p>
              <p className="text-[11px] text-muted-foreground/60">Exemplo: "Me avise quando um contato ficar sem interação por 15 dias"</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-br-md bg-primary/15 text-sm text-foreground">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 items-start">
                  <img src={pandoraAvatar} alt="" className="w-5 h-5 rounded-full mt-1 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="px-3 py-2 rounded-2xl rounded-bl-md bg-muted/40 text-sm text-foreground">
                      {msg.content}
                    </div>
                    {msg.automation && (
                      <>
                        <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Zap className="w-3.5 h-3.5 text-primary" />
                            <p className="text-sm font-medium text-foreground">{msg.automation.name}</p>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="px-1.5 py-0.5 rounded-md bg-muted/50">{triggerInfo(msg.automation.trigger_type)?.icon} {triggerInfo(msg.automation.trigger_type)?.label}</span>
                            <ArrowRight className="w-3 h-3 opacity-40" />
                            <span className="px-1.5 py-0.5 rounded-md bg-muted/50">{actionInfo(msg.automation.action_type)?.icon} {actionInfo(msg.automation.action_type)?.label}</span>
                          </div>
                          {msg.automation.action_config?.title && (
                            <p className="text-[11px] text-muted-foreground/70 mt-1.5">
                              Ação: "{msg.automation.action_config.title}"
                              {msg.automation.action_config.priority && msg.automation.action_config.priority !== "medium" && (
                                <span className="ml-1.5 text-primary/80">• {msg.automation.action_config.priority}</span>
                              )}
                            </p>
                          )}
                          {msg.automation.action_config?.body && (
                            <p className="text-[11px] text-muted-foreground/70 mt-0.5">"{msg.automation.action_config.body}"</p>
                          )}
                          {msg.automation.action_config?.message && (
                            <p className="text-[11px] text-muted-foreground/70 mt-0.5">Msg: "{msg.automation.action_config.message}"</p>
                          )}
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          <Button size="sm" onClick={() => onSave(msg.automation, true)} className="h-7 text-xs">
                            <Play className="w-3 h-3 mr-1" /> Salvar e ativar
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => onSave(msg.automation, false)} className="h-7 text-xs">
                            <Plus className="w-3 h-3 mr-1" /> Salvar desativada
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => onEdit(msg.automation)} className="h-7 text-xs">
                            <Pencil className="w-3 h-3 mr-1" /> Editar
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-2 items-start">
              <img src={pandoraAvatar} alt="" className="w-5 h-5 rounded-full mt-1" />
              <div className="px-3 py-2 rounded-2xl rounded-bl-md bg-muted/40 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                Configurando sua automação...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") generate(input);
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); generate(input); }
              if (e.key === "Escape") { e.preventDefault(); onClose(); }
            }}
            placeholder={messages.length > 0 ? "Peça outra automação ou ajuste..." : "Ex: Me avise quando um contato ficar sem interação por 15 dias..."}
            className="flex-1 rounded-xl bg-muted/50 border-border/30"
            disabled={loading}
          />
          <Button onClick={() => generate(input)} disabled={!input.trim() || loading} size="sm" className="shrink-0">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
          {messages.length > 0 && (
            <DeshTooltip label="Limpar conversa">
              <Button variant="ghost" size="sm" onClick={() => setMessages([])} className="shrink-0 text-muted-foreground">
                <RotateCcw className="w-4 h-4" />
              </Button>
            </DeshTooltip>
          )}
        </div>
        <div className="flex items-center gap-1 mt-1 px-1">
          <p className="text-[10px] text-muted-foreground/50">
            <kbd className="font-mono text-muted-foreground/70">Enter</kbd> enviar • <kbd className="font-mono text-muted-foreground/70">Esc</kbd> fechar
          </p>
        </div>
        {input.length > 0 && (
          <p className={`text-[10px] text-right mt-1 font-mono ${input.length > 500 ? "text-destructive" : "text-muted-foreground/40"}`}>
            {input.length}/500
          </p>
        )}

        {/* Quick suggestions - only when no messages */}
        {messages.length === 0 && !loading && (
          <div className="flex gap-1.5 flex-wrap mt-2.5">
            {QUICK_SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => generate(s.text)}
                className="text-[11px] px-2.5 py-1.5 rounded-full bg-muted/40 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-1">
                <span>{s.icon}</span> {s.text}
              </button>
            ))}
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
};

export default AutomationAIChat;

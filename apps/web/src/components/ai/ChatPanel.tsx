import { useEffect, useMemo, useRef, useState } from "react";
import {
  Send,
  Loader2,
  StopCircle,
  Copy,
  Check,
  Download,
  ImagePlus,
  Mic,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  Sparkles,
  PanelLeft,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import pandoraAvatar from "@/assets/pandora-avatar.png";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { ApiError } from "@/lib/api-client";
import {
  sendChatMessage,
  streamConversationEvents,
  type AgentEventEnvelope,
} from "@/lib/chat-stream";
import type { ApiConversation } from "@/hooks/api/useConversations";
import PersonaModal from "@/components/ai/PersonaModal";

export interface ChatPanelProps {
  conversation: ApiConversation | null;
  onUpdateTitle?: (title: string) => void;
  /** When provided, renders a "open sidebar" button on the left of the header. */
  onOpenSidebar?: () => void;
}

interface UiMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp?: string;
}

const SUGGESTED_PROMPTS = [
  { label: "📊 Resumo do dia", desc: "Visão geral de tudo", message: "Me dê um resumo completo do meu dashboard: tarefas, eventos, finanças e e-mails pendentes." },
  { label: "✅ Organizar tarefas", desc: "Priorização inteligente", message: "Analise minhas tarefas e sugira uma priorização inteligente para hoje." },
  { label: "💰 Análise financeira", desc: "Insights e dicas", message: "Faça uma análise das minhas finanças recentes e sugira melhorias." },
  { label: "🧠 O que você sabe?", desc: "Memórias e contexto", message: "Liste todas as memórias e informações que você tem sobre mim." },
  { label: "📝 Criar nota resumo", desc: "Documentar o dia", message: "Crie uma nota com um resumo de tudo que fizemos hoje nas nossas conversas." },
  { label: "🔍 Buscar na web", desc: "Notícias atuais", message: "Busque na web as notícias mais relevantes de hoje." },
];

const PANDORA_CAPABILITIES = [
  { icon: "📧", title: "E-mails" },
  { icon: "💬", title: "WhatsApp" },
  { icon: "📅", title: "Agenda" },
  { icon: "✅", title: "Tarefas" },
  { icon: "💰", title: "Finanças" },
  { icon: "📝", title: "Notas" },
  { icon: "🖼️", title: "Imagens" },
  { icon: "📊", title: "Relatórios" },
  { icon: "🎨", title: "Temas" },
  { icon: "🔍", title: "Web" },
];

function envelopeToUiMessage(e: AgentEventEnvelope): UiMessage | null {
  if (e.type === "user_message") {
    return { id: e.id, role: "user", text: String(e.payload?.text ?? ""), timestamp: e.createdAt };
  }
  if (e.type === "assistant_message") {
    return { id: e.id, role: "assistant", text: String(e.payload?.content ?? ""), timestamp: e.createdAt };
  }
  return null;
}

function countWords(messages: UiMessage[]): number {
  let total = 0;
  for (const m of messages) total += m.text.trim().split(/\s+/).filter(Boolean).length;
  return total;
}

const TypingIndicator = () => (
  <div className="flex justify-start">
    <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-muted flex items-center gap-1">
      <motion.span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
      <motion.span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }} />
      <motion.span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }} />
    </div>
  </div>
);

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="opacity-0 group-hover/msg:opacity-100 p-1 rounded-xl hover:bg-muted/70 transition-all"
      title="Copiar"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
    </button>
  );
};

const ChatPanel = ({ conversation, onUpdateTitle, onOpenSidebar }: ChatPanelProps) => {
  useAuth();
  const { activeWorkspaceId } = useWorkspace();

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personaOpen, setPersonaOpen] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatchIdx, setSearchMatchIdx] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Re-open SSE on conversation change.
  useEffect(() => {
    setMessages([]);
    setTyping(false);
    setError(null);
    setSearchOpen(false);
    setSearchQuery("");
    if (!conversation) return;

    const controller = new AbortController();
    abortRef.current = controller;

    void streamConversationEvents(conversation.id, {
      signal: controller.signal,
      onEvent: (envelope) => {
        if (envelope.type === "typing") {
          setTyping(true);
          setTimeout(() => setTyping(false), 30_000);
          return;
        }
        if (envelope.type === "error") {
          setTyping(false);
          setError(String(envelope.payload?.content ?? envelope.payload?.metadata?.message ?? "agent error"));
          return;
        }
        const ui = envelopeToUiMessage(envelope);
        if (!ui) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === ui.id)) return prev;
          return [...prev, ui];
        });
        if (ui.role === "assistant") setTyping(false);
      },
      onError: (err) => {
        console.warn("[chat-stream] error", err);
        setError(err.message);
      },
    });

    return () => controller.abort();
  }, [conversation?.id]);

  // Smart auto-scroll: only scroll if user is near bottom.
  const isNearBottomRef = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, typing]);

  // Auto-resize textarea.
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  // Focus input on conversation change.
  useEffect(() => {
    inputRef.current?.focus();
  }, [conversation?.id]);

  // Search shortcuts.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [searchOpen]);

  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return messages.map((m, i) => ({ idx: i, text: m.text })).filter((m) => m.text.toLowerCase().includes(q));
  }, [messages, searchQuery]);

  useEffect(() => {
    if (searchMatches.length > 0 && scrollRef.current) {
      const target = searchMatches[searchMatchIdx];
      if (target == null) return;
      const msgEl = scrollRef.current.querySelector(`[data-msg-idx="${target.idx}"]`);
      msgEl?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [searchMatchIdx, searchMatches]);

  const handleSend = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!conversation || !text || sending) return;
    setInput("");
    setSending(true);
    setError(null);
    setTyping(true);

    const tempId = `tmp_${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, role: "user", text, timestamp: new Date().toISOString() }]);

    try {
      await sendChatMessage(conversation.id, text);
      if (!conversation.title && messages.length === 0) {
        const trimmed = text.length > 60 ? text.slice(0, 57) + "…" : text;
        onUpdateTitle?.(trimmed);
      }
    } catch (err) {
      setTyping(false);
      let msg = (err as Error).message ?? "Falha ao enviar mensagem.";
      if (err instanceof ApiError && err.status === 503) {
        const reason = err.body && typeof err.body === "object" && "reason" in err.body ? String((err.body as { reason: unknown }).reason) : null;
        const hint =
          reason === "profile_not_provisioned"
            ? "agent profile sem hermes_port/adapter_secret"
            : reason === "connection_failed"
              ? "Hermes não respondeu — verifique HERMES_BIN"
              : reason?.startsWith("gateway_")
                ? `Hermes respondeu ${reason.replace("gateway_", "HTTP ")}`
                : "verifique logs do apps/api";
        msg = `Agent indisponível — ${hint}`;
      }
      toast.error(msg);
      setError(msg);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  const handleAbort = () => {
    abortRef.current?.abort();
    setSending(false);
    setTyping(false);
  };

  const handleExportChat = () => {
    if (!conversation || messages.length === 0) return;
    const lines = messages.map((m) => `[${m.role === "user" ? "Você" : "Pandora"}] ${m.text}`);
    const text = `# ${conversation.title ?? "Conversa"}\n# Exportado em ${new Date().toLocaleString("pt-BR")}\n\n${lines.join("\n\n")}`;
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(conversation.title ?? "conversa").replace(/[^a-zA-Z0-9]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Chat exportado!");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isMod = e.ctrlKey || e.metaKey;
    if (e.key === "Enter" && (!e.shiftKey || isMod)) {
      e.preventDefault();
      void handleSend();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (sending) handleAbort();
      return;
    }
    if (isMod && e.key.toLowerCase() === "l") {
      e.preventDefault();
      setInput("");
      inputRef.current?.focus();
      return;
    }
  };

  const wordCount = useMemo(() => countWords(messages), [messages]);
  const isEmpty = messages.length === 0 && !typing && !sending;

  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
  const modKey = isMac ? "⌘" : "Ctrl";

  return (
    <div className="flex flex-col h-full">
      {/* Search overlay */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-border/20 px-3 py-2 flex items-center gap-2 shrink-0"
          >
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchMatchIdx(0);
              }}
              placeholder="Buscar nas mensagens..."
              className="flex-1 text-xs bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            />
            {searchMatches.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>{searchMatchIdx + 1}/{searchMatches.length}</span>
                <button onClick={() => setSearchMatchIdx(Math.max(0, searchMatchIdx - 1))} className="p-0.5 hover:text-foreground">
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setSearchMatchIdx(Math.min(searchMatches.length - 1, searchMatchIdx + 1))} className="p-0.5 hover:text-foreground">
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header bar */}
      {conversation && (
        <div className="px-3 sm:px-6 py-1.5 border-b border-border/10 flex items-center gap-2 shrink-0">
          {onOpenSidebar && (
            <button
              onClick={onOpenSidebar}
              className="p-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Abrir conversas"
              aria-label="Abrir painel de conversas"
            >
              <PanelLeft className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="text-xs text-muted-foreground flex-1">
            {messages.length} msgs • {wordCount} palavras
          </span>
          <button onClick={() => setPersonaOpen(true)} disabled={!activeWorkspaceId}
            className="p-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40"
            title="Editar persona / system prompt">
            <Sparkles className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
            className="p-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title={`Buscar (${modKey}+F)`}>
            <Search className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleExportChat} disabled={messages.length === 0}
            className="p-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40"
            title="Exportar chat">
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-6">
        {isEmpty && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}
            className="py-4 sm:py-8 max-w-lg mx-auto">
            <div className="text-center mb-6">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.4, type: "spring", stiffness: 200 }}
                className="relative inline-block pandora-glow mb-3"
              >
                <img src={pandoraAvatar} alt="Pandora" className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-4 ring-primary/20 shadow-xl relative z-10" />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-400 border-2 border-background z-20" />
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.3 }}
                className="text-lg sm:text-xl font-bold text-foreground mb-1"
              >
                {(() => {
                  const h = new Date().getHours();
                  const greeting = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
                  return <>{greeting}! Eu sou a <span className="text-primary">Pandora</span> ✨</>;
                })()}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45, duration: 0.3 }}
                className="text-xs sm:text-sm text-muted-foreground max-w-xs mx-auto"
              >
                Sua assistente pessoal do DESH. Posso ajudar com tudo isso:
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.4 }}
              className="grid grid-cols-4 gap-2 mb-6"
            >
              {PANDORA_CAPABILITIES.map((cap, i) => (
                <motion.div
                  key={cap.title}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + i * 0.05, duration: 0.25 }}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl bg-muted/30 border border-border/20 hover:bg-muted/50 transition-colors"
                >
                  <span className="text-lg">{cap.icon}</span>
                  <span className="text-[10px] font-medium text-foreground/80 leading-tight text-center">{cap.title}</span>
                </motion.div>
              ))}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.3 }}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Experimente perguntar</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTED_PROMPTS.map((prompt, i) => (
                  <motion.button
                    key={prompt.label}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.85 + i * 0.06, duration: 0.25 }}
                    onClick={() => void handleSend(prompt.message)}
                    className="text-left p-3 rounded-xl border border-border/30 bg-muted/30 hover:bg-primary/10 hover:border-primary/30 transition-all text-xs group/prompt"
                  >
                    <span className="font-medium text-foreground/90 group-hover/prompt:text-foreground">{prompt.label}</span>
                    <span className="block text-[10px] text-muted-foreground mt-0.5">{prompt.desc}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m, i) => {
            const isSearchMatch = searchQuery && searchMatches.some((s) => s.idx === i);
            const isActiveMatch = searchMatches[searchMatchIdx]?.idx === i;
            return (
              <motion.div
                key={m.id}
                data-msg-idx={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} group/msg`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm relative bg-neutral-900 text-white ${
                    m.role === "user" ? "rounded-br-md" : "rounded-bl-md"
                  } ${isActiveMatch ? "ring-2 ring-amber-400" : isSearchMatch ? "ring-1 ring-amber-400/40" : ""}`}
                >
                  {m.role === "assistant" ? (
                    <Streamdown>{m.text}</Streamdown>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  )}
                  {m.timestamp && (
                    <p className={`text-[10px] mt-1 text-white/40 ${m.role === "user" ? "text-right" : ""}`}>
                      {new Date(m.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                  {m.role === "assistant" && m.text && (
                    <div className="flex gap-0.5 mt-1.5 justify-end">
                      <CopyButton text={m.text} />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {typing && messages[messages.length - 1]?.role === "user" && <TypingIndicator />}

        {error && (
          <div className="bg-destructive/10 text-destructive text-xs px-3 py-2 rounded-xl">{error}</div>
        )}
      </div>

      {/* Composer */}
      <div className="px-3 sm:px-6 pb-3 sm:pb-4 pt-2">
        <div className="flex items-end gap-2 rounded-xl border border-border/30 bg-foreground/5 px-3 py-2 focus-within:ring-1 focus-within:ring-primary/30 transition-shadow">
          <button disabled className="p-1.5 rounded-xl transition-all opacity-30 text-muted-foreground shrink-0 mb-0.5" title="Enviar imagem — em breve">
            <ImagePlus className="w-4 h-4" />
          </button>
          <button disabled className="p-1.5 rounded-xl transition-all opacity-30 text-muted-foreground shrink-0 mb-0.5" title="Mensagem por voz — em breve">
            <Mic className="w-4 h-4" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={conversation ? "Digite sua mensagem..." : "Crie uma conversa para começar"}
            disabled={sending || !conversation}
            rows={1}
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50 resize-none min-h-[20px] max-h-[120px]"
          />
          {sending ? (
            <button onClick={handleAbort} className="p-1.5 rounded-xl hover:bg-destructive/10 text-destructive shrink-0 mb-0.5" aria-label="Parar geração">
              <StopCircle className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || !conversation}
              className="p-1.5 rounded-xl transition-colors disabled:opacity-30 hover:bg-primary/10 hover:text-primary shrink-0 mb-0.5"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          )}
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1">
          <p className="text-[10px] text-muted-foreground/60">
            <kbd className="font-mono text-muted-foreground/80">Shift+Enter</kbd> nova linha
            {" • "}
            <kbd className="font-mono text-muted-foreground/80">{modKey}+Enter</kbd> enviar
            {" • "}
            <kbd className="font-mono text-muted-foreground/80">{modKey}+L</kbd> limpar
            {" • "}
            <kbd className="font-mono text-muted-foreground/80">{modKey}+F</kbd> buscar
            {" • "}
            <kbd className="font-mono text-muted-foreground/80">Esc</kbd> parar
          </p>
          {input.length > 0 && (
            <span className={`text-[10px] font-mono ${input.length > 4000 ? "text-destructive" : "text-muted-foreground/50"}`}>
              {input.length.toLocaleString()}/4000
            </span>
          )}
        </div>
      </div>

      {activeWorkspaceId && (
        <PersonaModal workspaceId={activeWorkspaceId} open={personaOpen} onClose={() => setPersonaOpen(false)} />
      )}
    </div>
  );
};

export default ChatPanel;

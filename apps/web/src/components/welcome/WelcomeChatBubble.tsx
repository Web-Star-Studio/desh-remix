import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles } from "lucide-react";
import { Streamdown } from "streamdown";
import pandoraAvatar from "@/assets/pandora-avatar.png";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const WELCOME_MSG: Msg = {
  id: "welcome",
  role: "assistant",
  content:
    "Olá! 👋 Sou a Pandora, assistente de IA do DESH.\n\nPosso te ajudar a entender como o DESH organiza sua vida num só lugar. O que te trouxe aqui hoje?",
};

const QUICK_REPLIES = [
  "O que o DESH faz?",
  "É grátis?",
  "Como funciona a IA?",
  "Quero criar conta",
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

async function streamChat({
  messages,
  onDelta,
  onDone,
  onError,
  signal,
}: {
  messages: { role: string; content: string }[];
  onDelta: (t: string) => void;
  onDone: () => void;
  onError: (e: string) => void;
  signal?: AbortSignal;
}) {
  try {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ action: "welcome-chat", messages }),
      signal,
    });

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => null);
      onError(errBody?.error || "Erro ao processar mensagem.");
      return;
    }
    if (!resp.body) {
      onError("Sem resposta do servidor.");
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      let nl: number;
      while ((nl = buf.indexOf("\n")) !== -1) {
        let line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ") || line.trim() === "") continue;
        const json = line.slice(6).trim();
        if (json === "[DONE]") break;
        try {
          const parsed = JSON.parse(json);
          const c = parsed.choices?.[0]?.delta?.content;
          if (c) onDelta(c);
        } catch {
          /* partial */
        }
      }
    }

    // flush
    if (buf.trim()) {
      for (let raw of buf.split("\n")) {
        if (!raw || !raw.startsWith("data: ")) continue;
        const j = raw.slice(6).trim();
        if (j === "[DONE]") continue;
        try {
          const p = JSON.parse(j);
          const c = p.choices?.[0]?.delta?.content;
          if (c) onDelta(c);
        } catch {}
      }
    }

    onDone();
  } catch (e: any) {
    if (e.name !== "AbortError") {
      onError("Falha na conexão. Tente novamente.");
    }
  }
}

export default function WelcomeChatBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  useEffect(() => {
    scrollBottom();
    requestAnimationFrame(scrollBottom);
  }, [messages, isOpen, scrollBottom]);

  const send = useCallback(
    (text: string) => {
      if (!text.trim() || isStreaming) return;
      setShowQuickReplies(false);
      const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text.trim() };
      const assistantId = crypto.randomUUID();

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      let soFar = "";

      const allMsgs = [...messages, userMsg]
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      streamChat({
        messages: allMsgs,
        signal: controller.signal,
        onDelta: (chunk) => {
          soFar += chunk;
          const content = soFar;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.id === assistantId) {
              return prev.map((m) => (m.id === assistantId ? { ...m, content } : m));
            }
            return [...prev, { id: assistantId, role: "assistant", content }];
          });
        },
        onDone: () => setIsStreaming(false),
        onError: (err) => {
          setMessages((prev) => [
            ...prev,
            { id: assistantId, role: "assistant", content: `⚠️ ${err}` },
          ]);
          setIsStreaming(false);
        },
      });
    },
    [messages, isStreaming]
  );

  return (
    <div className="fixed bottom-6 right-6 z-50 max-md:bottom-4 max-md:right-4" style={{ bottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed md:absolute md:bottom-16 md:right-0 md:w-[360px] md:max-h-[520px] md:rounded-2xl inset-0 md:inset-auto rounded-none md:rounded-2xl overflow-hidden flex flex-col"
            style={{
              background: "rgba(18, 18, 26, 0.97)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10" style={{ paddingTop: "calc(12px + env(safe-area-inset-top, 0px))" }}>
              <div className="flex items-center gap-2.5">
                <img src={pandoraAvatar} alt="Pandora" className="w-8 h-8 rounded-full object-cover ring-1 ring-[#C8956C]/40" />
                <div>
                  <p className="text-sm font-medium text-[#F5F5F7]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    Pandora
                  </p>
                  <p className="text-[10px] text-[#8E8E93]">Assistente IA do DESH</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
                <X className="w-4 h-4 text-[#8E8E93]" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#C8956C]/20 text-[#F5F5F7] rounded-br-md"
                        : "bg-white/5 text-[#F5F5F7] border border-white/10 rounded-bl-md"
                    }`}
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {msg.role === "assistant" ? (
                      <Streamdown>{msg.content}</Streamdown>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {/* Quick replies */}
              {showQuickReplies && !isStreaming && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {QUICK_REPLIES.map((qr) => (
                    <button
                      key={qr}
                      onClick={() => send(qr)}
                      className="text-xs px-3 py-1.5 rounded-full border border-[#C8956C]/40 text-[#E8B98A] hover:bg-[#C8956C]/20 transition-colors"
                    >
                      {qr}
                    </button>
                  ))}
                </div>
              )}

              {/* Streaming indicator */}
              {isStreaming && messages[messages.length - 1]?.role === "user" && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C8956C] animate-pulse" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C8956C] animate-pulse [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C8956C] animate-pulse [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="px-3 py-2.5 border-t border-white/10" style={{ paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))" }}>
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send(input)}
                  placeholder="Pergunte algo sobre o DESH..."
                  disabled={isStreaming}
                  className="flex-1 bg-white/5 rounded-xl px-3 py-2 text-sm text-[#F5F5F7] placeholder:text-[#636366] border border-white/10 focus:outline-none focus:border-[#C8956C]/40 disabled:opacity-50"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                />
                <button
                  onClick={() => send(input)}
                  disabled={isStreaming || !input.trim()}
                  className="p-2 rounded-xl bg-gradient-to-r from-[#C8956C] to-[#E8B98A] text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bubble - hide on mobile when chat is open */}
      {!isOpen && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg relative overflow-hidden"
          style={{ boxShadow: "0 4px 20px rgba(200,149,108,0.3)" }}
        >
          <img src={pandoraAvatar} alt="Pandora" className="w-full h-full object-cover rounded-full" />
          <div className="absolute inset-0 rounded-full ring-2 ring-[#C8956C]/40" />
        </motion.button>
      )}
      {isOpen && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(false)}
          className="hidden md:flex w-14 h-14 rounded-full items-center justify-center shadow-lg relative overflow-hidden"
          style={{ boxShadow: "0 4px 20px rgba(200,149,108,0.3)" }}
        >
          <img src={pandoraAvatar} alt="Pandora" className="w-full h-full object-cover rounded-full" />
          <div className="absolute inset-0 rounded-full ring-2 ring-[#C8956C]/40" />
        </motion.button>
      )}
    </div>
  );
}

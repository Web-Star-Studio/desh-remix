import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Send } from "lucide-react";
import { PandoraMessage } from "./PandoraMessage";
import { PandoraTypingIndicator } from "./PandoraTypingIndicator";
import type { PandoraMsg } from "@/hooks/ai/usePandoraLanding";
import { trackLandingEvent } from "@/lib/landing-analytics";

interface Props {
  messages: PandoraMsg[];
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  unreadCount: number;
  onSend: (text: string) => void;
}

export function PandoraChatBubble({ messages, isOpen, setIsOpen, unreadCount, onSend }: Props) {
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLen = useRef(messages.length);

  useEffect(() => {
    if (messages.length > prevLen.current) {
      const last = messages[messages.length - 1];
      if (last.role === "user") {
        setIsTyping(true);
        // Show typing until next pandora message arrives or timeout
        const t = setTimeout(() => setIsTyping(false), 1200);
        return () => clearTimeout(t);
      } else if (last.role === "pandora") {
        setIsTyping(false);
      }
    }
    prevLen.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    };
    // Immediate attempt
    scrollToBottom();
    // After RAF (DOM paint)
    requestAnimationFrame(scrollToBottom);
    // After animation completes (~300ms spring)
    const t = setTimeout(scrollToBottom, 350);
    return () => clearTimeout(t);
  }, [messages.length, isTyping, isOpen]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    trackLandingEvent("pandora_message_sent", {
      location: "pandora_chat",
      value: text.length,
    });
    onSend(text);
    setInput("");
  };

  const handleToggleOpen = () => {
    const next = !isOpen;
    if (next) trackLandingEvent("pandora_open", { location: "pandora_bubble" });
    setIsOpen(next);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50" style={{ bottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute bottom-16 right-0 w-[350px] max-h-[500px] rounded-2xl overflow-hidden flex flex-col"
            style={{
              background: "rgba(18, 18, 26, 0.95)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C8956C] to-[#E8B98A] flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#F5F5F7]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Pandora</p>
                  <p className="text-[10px] text-[#8E8E93]">Assistente IA do DESH</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
                <X className="w-4 h-4 text-[#8E8E93]" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 min-h-[280px] max-h-[360px]">
              {messages.map((msg) => (
                <PandoraMessage
                  key={msg.id}
                  text={msg.text}
                  role={msg.role}
                  quickReplies={msg.quickReplies}
                  onQuickReply={onSend}
                  timestamp={msg.timestamp}
                />
              ))}
              {isTyping && <PandoraTypingIndicator />}
            </div>

            {/* Input */}
            <div className="px-3 py-2.5 border-t border-white/10">
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Pergunte algo..."
                  className="flex-1 bg-white/5 rounded-xl px-3 py-2 text-sm text-[#F5F5F7] placeholder:text-[#636366] border border-white/10 focus:outline-none focus:border-[#C8956C]/40"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                />
                <button
                  onClick={handleSend}
                  className="p-2 rounded-xl bg-gradient-to-r from-[#C8956C] to-[#E8B98A] text-white hover:opacity-90 transition-opacity"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bubble */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleToggleOpen}
        aria-label={isOpen ? "Fechar chat com Pandora" : "Abrir chat com Pandora"}
        className="w-14 h-14 rounded-full bg-gradient-to-br from-[#C8956C] to-[#E8B98A] flex items-center justify-center shadow-lg relative"
        style={{ boxShadow: "0 4px 20px rgba(200,149,108,0.3)" }}
      >
        <Sparkles className="w-6 h-6 text-white" />
        {unreadCount > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
            {unreadCount}
          </span>
        )}
      </motion.button>
    </div>
  );
}

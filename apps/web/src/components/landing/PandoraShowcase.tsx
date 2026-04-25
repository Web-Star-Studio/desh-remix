import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, BarChart3, CheckSquare, Search, FolderOpen, Send, Sparkles } from "lucide-react";
import { RevealOnScroll } from "./ui/RevealOnScroll";
import { findDemoResponse } from "@/lib/pandora-landing-prompts";
import useTypewriter from "@/hooks/ui/useTypewriter";

const CAPABILITIES = [
  { icon: Mail, text: '"Resuma meus emails urgentes"' },
  { icon: BarChart3, text: '"Quanto gastei este mês?"' },
  { icon: CheckSquare, text: '"Planeje meu dia"' },
  { icon: Search, text: '"Pesquise sobre X na web"' },
  { icon: FolderOpen, text: '"Organize meus arquivos"' },
];

const QUICK_REPLIES = ["Me dê o resumo do meu dia", "Quais emails preciso responder?", "Como estão minhas finanças?"];

function DemoChat() {
  const [chatMessages, setChatMessages] = useState<{ role: string; text: string }[]>([
    { role: "pandora", text: "Oi! Eu sou a Pandora. Me pergunte qualquer coisa sobre sua vida digital e eu mostro como posso ajudar! 💜" },
  ]);
  const [input, setInput] = useState("");
  const [responding, setResponding] = useState(false);

  const lastMsg = chatMessages[chatMessages.length - 1];
  const { displayed: displayText } = useTypewriter({
    text: lastMsg.role === "pandora" ? lastMsg.text : "",
    speed: 15,
    enabled: lastMsg.role === "pandora",
  });

  const handleSend = (text: string) => {
    if (responding || !text.trim()) return;
    const userText = text.trim();
    setChatMessages((prev) => [...prev, { role: "user", text: userText }]);
    setResponding(true);
    setTimeout(() => {
      setChatMessages((prev) => [...prev, { role: "pandora", text: findDemoResponse(userText) }]);
      setResponding(false);
    }, 1000);
    setInput("");
  };

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col h-[460px] sm:h-[420px] w-full"
      style={{
        background: "rgba(18, 18, 26, 0.9)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C8956C] to-[#E8B98A] flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-medium text-[#F5F5F7]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Pandora Demo
        </span>
        <span className="ml-auto w-2 h-2 rounded-full bg-green-400 animate-pulse" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {chatMessages.map((msg, i) => {
          const isLast = i === chatMessages.length - 1;
          const text = isLast && msg.role === "pandora" ? displayText : msg.text;
          return (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-[#C8956C]/20 text-[#F5F5F7] rounded-br-md"
                    : "bg-white/5 text-[#F5F5F7] border border-white/10 rounded-bl-md"
                }`}
              >
                {text}
              </div>
            </div>
          );
        })}
        {responding && (
          <div className="flex gap-1 px-4 py-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-2 h-2 rounded-full bg-[#C8956C]" style={{ animation: `pandora-dot 1.4s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
        )}
      </div>

      <div className="px-3 pb-2">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {QUICK_REPLIES.map((qr) => (
            <button
              key={qr}
              onClick={() => handleSend(qr)}
              className="text-xs px-3 py-1.5 rounded-full border border-[#C8956C]/30 text-[#E8B98A] hover:bg-[#C8956C]/20 transition-colors whitespace-nowrap flex-shrink-0"
            >
              {qr}
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 pb-3">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend(input)}
            placeholder="Pergunte algo..."
            className="flex-1 bg-white/5 rounded-xl px-3 py-2 text-sm text-[#F5F5F7] placeholder:text-[#636366] border border-white/10 focus:outline-none focus:border-[#C8956C]/40"
          />
          <button onClick={() => handleSend(input)} className="p-2 rounded-xl bg-gradient-to-r from-[#C8956C] to-[#E8B98A] text-white">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function PandoraShowcase() {
  return (
    <section id="pandora" className="py-16 sm:py-20 md:py-28 px-4 sm:px-6 relative overflow-hidden" style={{ background: "#12121A" }}>
      {/* Section separator */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "rgba(255,255,255,0.04)" }} />
      <div className="max-w-6xl mx-auto">
        <RevealOnScroll>
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            {/* Left — Text */}
            <div>
              <p className="text-[#C8956C] text-xs sm:text-sm font-medium tracking-widest uppercase mb-3 sm:mb-4" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                Assistente IA
              </p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#F5F5F7] mb-4 sm:mb-6" style={{ fontFamily: "'Playfair Display', serif", lineHeight: 1.1 }}>
                Conheça a{" "}
                <span className="bg-gradient-to-r from-[#C8956C] to-[#E8B98A] bg-clip-text text-transparent">Pandora</span>
              </h2>
              <p className="text-[#8E8E93] text-base sm:text-lg mb-6 sm:mb-8 leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                A Pandora não é um chatbot genérico. Ela conhece seus emails, suas tarefas, seus hábitos, suas finanças, seus contatos.
                Ela é a única IA que tem contexto completo da sua vida.
              </p>

              <div className="space-y-4">
                {CAPABILITIES.map(({ icon: Icon, text }, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    viewport={{ once: true }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#C8956C]/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-[#C8956C]" />
                    </div>
                    <span className="text-[#F5F5F7] text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                      {text}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right — Demo Chat */}
            <div>
              <DemoChat />
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}

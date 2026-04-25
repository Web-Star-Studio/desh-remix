import { Sparkles, Search, Zap, Shield, MessageSquare, ArrowRight } from "lucide-react";
import { RevealOnScroll } from "@/components/landing/ui/RevealOnScroll";
import { GradientText } from "@/components/landing/ui/GradientText";
import { useWelcomeTheme } from "@/components/welcome/WelcomeThemeContext";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

const CAPABILITIES = [
  { icon: MessageSquare, text: "Conversa natural via chat ou WhatsApp" },
  { icon: Search, text: "Busca e analisa seus dados em tempo real" },
  { icon: Zap, text: "Executa ações: cria tarefas, agenda eventos, envia e-mails" },
  { icon: Shield, text: "Privacidade total. Seus dados nunca são compartilhados" },
];

const DEMO_MESSAGES = [
  { role: "user", text: "Quanto gastei com alimentação este mês?" },
  { role: "ai", text: "Você gastou R$ 1.847,30 em alimentação este mês. Isso representa 28% do seu orçamento. Quer que eu crie um alerta quando passar de 80%?" },
  { role: "user", text: "Sim, crie o alerta" },
  { role: "ai", text: "✅ Alerta criado! Você será notificado quando alimentação ultrapassar R$ 2.400,00 (80% do limite)." },
];

function TypingDots({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: color }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

export default function WelcomePandora() {
  const { theme } = useWelcomeTheme();
  const [visibleMessages, setVisibleMessages] = useState(0);
  const [showTyping, setShowTyping] = useState(false);
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    if (!triggered) return;
    if (visibleMessages >= DEMO_MESSAGES.length) return;

    const nextMsg = DEMO_MESSAGES[visibleMessages];
    if (nextMsg.role === "ai") {
      setShowTyping(true);
      const typingTimer = setTimeout(() => {
        setShowTyping(false);
        setVisibleMessages((prev) => prev + 1);
      }, 1200);
      return () => clearTimeout(typingTimer);
    } else {
      const timer = setTimeout(() => {
        setVisibleMessages((prev) => prev + 1);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [visibleMessages, triggered]);

  return (
    <section id="pandora" className="relative py-20 md:py-36 px-4 sm:px-6 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse 60% 40% at 80% 50%, ${theme.accent}0A, transparent 70%)` }}
      />

      <motion.div
        className="absolute w-64 h-64 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${theme.accent}08, transparent 70%)`,
          filter: "blur(60px)",
          top: "10%",
          right: "-5%",
        }}
        animate={{ y: [0, -30, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <RevealOnScroll direction="left">
            <div>
              <motion.p
                className="text-[11px] font-semibold tracking-[0.3em] uppercase mb-4"
                style={{ color: theme.accent }}
              >
                Inteligência Artificial
              </motion.p>

              <h2 className="text-[1.75rem] sm:text-3xl md:text-5xl font-bold mb-5 tracking-tight [text-wrap:balance]" style={{ color: theme.text }}>
                Conheça a{" "}
                <GradientText from={theme.accent} to={theme.accentSecondary}>Pandora</GradientText>
              </h2>
              <p className="text-white/50 text-sm sm:text-lg mb-8 md:mb-10 leading-relaxed">
                Sua assistente pessoal que entende o contexto da sua vida.
                Ela acessa seus dados, executa ações e aprende com você.
              </p>

              <div className="space-y-5">
                {CAPABILITIES.map((cap, i) => (
                  <motion.div
                    key={i}
                    className="flex items-start gap-3 group"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110 backdrop-blur-xl"
                      style={{ background: `${theme.accent}15` }}
                    >
                      <cap.icon size={16} style={{ color: theme.accent }} />
                    </div>
                    <span className="text-sm leading-relaxed pt-1.5" style={{ color: `${theme.text}CC` }}>{cap.text}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </RevealOnScroll>

          <RevealOnScroll direction="right">
            <motion.div
              className="rounded-2xl backdrop-blur-2xl bg-white/[0.04] border border-white/[0.08] p-5 space-y-3 relative overflow-hidden"
              onViewportEnter={() => {
                if (!triggered) {
                  setTriggered(true);
                  setVisibleMessages(1);
                }
              }}
            >
              <div
                className="absolute -top-20 -right-20 w-40 h-40 rounded-full pointer-events-none"
                style={{
                  background: `radial-gradient(circle, ${theme.accent}15, transparent 70%)`,
                  filter: "blur(40px)",
                }}
              />

              <div className="flex items-center gap-2 pb-3 border-b border-white/[0.08] relative z-10">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors duration-500"
                  style={{ background: `linear-gradient(to bottom right, ${theme.accent}, ${theme.accentSecondary})` }}
                >
                  <Sparkles size={14} className="text-[#0A0A0F]" />
                </div>
                <span className="text-sm font-medium" style={{ color: theme.text }}>Pandora</span>
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[10px] text-white/40">online</span>
                </div>
              </div>

              <div className="space-y-3 relative z-10 min-h-[200px]">
                <AnimatePresence mode="popLayout">
                  {DEMO_MESSAGES.slice(0, visibleMessages).map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          msg.role === "user" ? "rounded-br-md" : "rounded-bl-md"
                        }`}
                        style={msg.role === "user" ? {
                          backgroundColor: `${theme.accent}25`,
                          color: theme.text,
                          border: `1px solid ${theme.accent}20`,
                        } : {
                          backgroundColor: "rgba(255,255,255,0.05)",
                          color: `${theme.text}E6`,
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        {msg.text}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {showTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex justify-start"
                  >
                    <div className="rounded-2xl rounded-bl-md bg-white/[0.05] border border-white/[0.06]">
                      <TypingDots color={theme.accent} />
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}

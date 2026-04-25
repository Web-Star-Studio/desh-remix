import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Clock, CreditCard } from "lucide-react";
import { MagneticButton } from "@/components/landing/ui/MagneticButton";
import { GradientText } from "@/components/landing/ui/GradientText";
import { RevealOnScroll } from "@/components/landing/ui/RevealOnScroll";
import { useWelcomeTheme } from "@/components/welcome/WelcomeThemeContext";
import { motion } from "framer-motion";
import { WELCOME_CREDITS } from "@/constants/plans";

const SELLING_POINTS = [
  { icon: Sparkles, text: `${100} créditos grátis` },
  { icon: CreditCard, text: "Sem cartão" },
  { icon: Clock, text: "Ativo em 30s" },
];

export default function WelcomeCTA() {
  const { theme } = useWelcomeTheme();

  return (
    <section className="relative py-16 md:py-24 px-4 sm:px-6 overflow-hidden">
      {/* Ambient glow */}
      <motion.div
        className="absolute w-[500px] h-[300px] rounded-full pointer-events-none left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          background: `radial-gradient(ellipse, ${theme.accent}12, transparent 70%)`,
          filter: "blur(60px)",
        }}
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      <RevealOnScroll>
        <div className="relative z-10 max-w-xl mx-auto text-center">
          {/* Micro-label */}
          <motion.div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.06] bg-white/[0.03] mb-6"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: theme.accent }}
            />
            <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-white/40">
              Comece agora
            </span>
          </motion.div>

          {/* Headline — compact & punchy */}
          <h2
            className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 leading-[1.15] tracking-tight [text-wrap:balance]"
            style={{ color: theme.text }}
          >
            Pare de improvisar.{" "}
            <GradientText from={theme.accent} to={theme.accentSecondary}>
              Organize tudo.
            </GradientText>
          </h2>

          <p className="text-sm text-white/40 mb-8 max-w-sm mx-auto leading-relaxed">
            Junte-se a quem já simplificou tarefas, finanças e rotina em um único dashboard inteligente.
          </p>

          {/* CTA Button */}
          <MagneticButton>
            <Link
              to="/auth?tab=signup"
              className="group relative inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl font-semibold text-sm transition-all duration-500 overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentSecondary})`,
                color: "#0A0A0F",
                boxShadow: `0 0 40px ${theme.accent}30, 0 4px 20px ${theme.accent}20`,
              }}
            >
              <span className="relative z-10">Começar grátis</span>
              <ArrowRight size={16} className="relative z-10 group-hover:translate-x-0.5 transition-transform" />
              <motion.div
                className="absolute inset-0"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)" }}
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 5 }}
              />
            </Link>
          </MagneticButton>

          {/* Selling points — inline */}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:gap-4 mt-6">
            {SELLING_POINTS.map((point, i) => (
              <motion.div
                key={point.text}
                className="flex items-center gap-1.5"
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08 }}
              >
                <point.icon size={11} style={{ color: theme.accent }} className="opacity-50" />
                <span className="text-[11px] text-white/35 font-medium">{point.text}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </RevealOnScroll>
    </section>
  );
}

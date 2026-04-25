import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ChevronDown } from "lucide-react";
import { FloatingOrb } from "./ui/FloatingOrb";
import { GradientText } from "./ui/GradientText";
import { MagneticButton } from "./ui/MagneticButton";
import { useReducedMotion } from "@/hooks/ui/useReducedMotion";
import { trackCtaClick, trackLandingEvent } from "@/lib/landing-analytics";

const words = ["O Dashboard", "Definitivo", "para sua Vida Pessoal"];

export function HeroSection() {
  const navigate = useNavigate();
  const reduced = useReducedMotion();

  const scrollToNext = () => {
    trackCtaClick("hero_secondary", "Ver como funciona");
    document.querySelector("#problem")?.scrollIntoView({ behavior: "smooth" });
  };

  const handlePrimaryCta = () => {
    trackCtaClick("hero_primary", "Começar grátis por 15 dias");
    navigate("/auth");
  };

  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ background: "#0A0A0F" }}>
      {/* Background effects */}
      <div className="absolute inset-0" style={{
        backgroundImage: "radial-gradient(ellipse at 50% 0%, rgba(200,149,108,0.08) 0%, transparent 60%)",
      }} />
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }} />
      {/* Noise texture */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
      }} />

      {/* Floating orbs */}
      <FloatingOrb size={400} top="-5%" left="-10%" delay={0} opacity={0.12} />
      <FloatingOrb size={300} top="60%" right="-8%" delay={3} opacity={0.1} />
      <FloatingOrb size={200} top="30%" left="60%" delay={6} opacity={0.08} />

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center pt-20">
        {/* Headline */}
        <h1 className="font-sans font-bold text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.1] tracking-[-0.02em] text-[#F5F5F7] mb-6">
          {words.map((word, i) => (
            <motion.span
              key={i}
              className="inline-block mr-[0.3em]"
              initial={reduced ? {} : { opacity: 0, y: 20, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.7, delay: 0.3 + i * 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              {word === "Definitivo" || word === "para sua Vida Pessoal" ? (
                <GradientText className="font-sans">{word}</GradientText>
              ) : (
                <>{word}{i < words.length - 1 ? <br className={i === 0 ? "hidden sm:block" : ""} /> : ""}</>
              )}
            </motion.span>
          ))}
        </h1>

        {/* Subheadline */}
        <motion.p
          className="text-base sm:text-lg md:text-xl text-[#8E8E93] max-w-2xl mx-auto leading-relaxed mb-10 font-['DM_Sans',sans-serif]"
          initial={reduced ? {} : { opacity: 0, y: 15, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, delay: 0.8 }}
        >
          Pare de viver em 8 apps diferentes. O DESH é o único lugar onde finanças, tarefas, emails, contatos, hábitos e IA se conectam de verdade.
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={reduced ? {} : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 1.0 }}
        >
          <MagneticButton onClick={handlePrimaryCta}>
            <span className="group px-8 py-4 rounded-2xl text-base font-semibold text-[#0A0A0F] bg-gradient-to-r from-[#C8956C] to-[#E8B98A] hover:opacity-90 transition-all shadow-[0_0_30px_rgba(200,149,108,0.3)] hover:shadow-[0_0_50px_rgba(200,149,108,0.4)] inline-flex items-center gap-2 animate-[glow-pulse_3s_ease-in-out_infinite]">
              Começar grátis por 15 dias
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </MagneticButton>
          <button
            onClick={scrollToNext}
            className="px-7 py-3.5 rounded-2xl text-base font-medium text-[#8E8E93] hover:text-[#F5F5F7] border border-white/[0.08] hover:border-white/[0.15] backdrop-blur-sm transition-all flex items-center gap-2"
            aria-label="Ver como funciona"
          >
            Ver como funciona
            <ChevronDown className="w-4 h-4" />
          </button>
        </motion.div>

        {/* Social proof mini - closer to CTAs */}
        <motion.p
          className="mt-8 text-xs text-[#636366] font-['DM_Sans',sans-serif]"
          initial={reduced ? {} : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
        >
          Mais de 500 profissionais já organizaram sua vida com o DESH
        </motion.p>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <ChevronDown className="w-5 h-5 text-[#636366]" />
      </motion.div>

      {/* Bottom gradient fade for smooth transition */}
      <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none" style={{ background: "linear-gradient(to bottom, transparent, #0A0A0F)" }} />
    </section>
  );
}

import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { FloatingOrb } from "./ui/FloatingOrb";
import { MagneticButton } from "./ui/MagneticButton";
import { RevealOnScroll } from "./ui/RevealOnScroll";
import { trackCtaClick } from "@/lib/landing-analytics";

export function FinalCTA() {
  const navigate = useNavigate();
  const handleClick = () => {
    trackCtaClick("final_cta", "Começar agora. É grátis");
    navigate("/auth");
  };

  return (
    <section id="cta" className="relative py-20 md:py-28 overflow-hidden" style={{ background: "#0A0A0F" }}>
      {/* Central golden orb */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          className="w-[400px] h-[400px] md:w-[600px] md:h-[600px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(200,149,108,0.2) 0%, rgba(200,149,108,0.05) 40%, transparent 70%)",
            filter: "blur(40px)",
          }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Rising particles (like embers) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${2 + (i % 3)}px`,
              height: `${2 + (i % 3)}px`,
              background: `rgba(200, 149, 108, ${0.2 + (i % 4) * 0.1})`,
              left: `${10 + (i * 7) % 80}%`,
              bottom: "-5%",
              animation: `rise-particle ${5 + (i % 4) * 2}s linear ${i * 0.7}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Subtle particles */}
      <FloatingOrb size={150} top="20%" left="10%" delay={0} opacity={0.06} />
      <FloatingOrb size={100} top="70%" right="15%" delay={2} opacity={0.05} />

      <div className="relative z-10 max-w-2xl mx-auto px-4 text-center">
        <RevealOnScroll>
          <h2 className="font-sans font-bold text-[2rem] sm:text-4xl md:text-5xl text-[#F5F5F7] leading-[1.1] tracking-[-0.02em] mb-4 sm:mb-6">
            Pronto para organizar<br />sua vida?
          </h2>
        </RevealOnScroll>
        <RevealOnScroll delay={0.1}>
          <p className="text-sm sm:text-lg text-[#8E8E93] mb-8 sm:mb-10 font-['DM_Sans',sans-serif] px-2">
            Crie sua conta em segundos e descubra uma nova forma de controlar tudo.
          </p>
        </RevealOnScroll>
        <RevealOnScroll delay={0.2}>
          <MagneticButton onClick={handleClick}>
            <span className="group px-6 sm:px-10 py-4 sm:py-5 rounded-2xl text-base sm:text-lg font-semibold text-[#0A0A0F] bg-gradient-to-r from-[#C8956C] to-[#E8B98A] hover:opacity-90 transition-all shadow-[0_0_40px_rgba(200,149,108,0.4)] hover:shadow-[0_0_60px_rgba(200,149,108,0.5)] hover:scale-105 inline-flex items-center gap-2 animate-[glow-pulse_3s_ease-in-out_infinite]">
              Começar agora. É grátis
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </MagneticButton>
        </RevealOnScroll>
      </div>

      {/* Section separator */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "rgba(255,255,255,0.04)" }} />

      <style>{`
        @keyframes rise-particle {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          10% {
            opacity: 0.6;
          }
          90% {
            opacity: 0.3;
          }
          100% {
            transform: translateY(-120vh) translateX(20px);
            opacity: 0;
          }
        }
      `}</style>
    </section>
  );
}

import { Link } from "react-router-dom";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import { MagneticButton } from "@/components/landing/ui/MagneticButton";
import { useWelcomeTheme } from "@/components/welcome/WelcomeThemeContext";
import { useState, useEffect, useCallback } from "react";
import { WELCOME_CREDITS } from "@/constants/plans";
import pandoraAvatar from "@/assets/pandora-avatar.png";

const TYPING_TEXTS = [
  "Quanto gastei esta semana?",
  "Agende reunião para amanhã às 10h",
  "Resuma meus e-mails não lidos",
  "Quais tarefas vencem hoje?",
];

function useTypingEffect(texts: string[], typingSpeed = 50, pauseDuration = 2000) {
  const [displayText, setDisplayText] = useState("");
  const [textIndex, setTextIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentText = texts[textIndex];
    let timeout: NodeJS.Timeout;

    if (!isDeleting && displayText === currentText) {
      timeout = setTimeout(() => setIsDeleting(true), pauseDuration);
    } else if (isDeleting && displayText === "") {
      setIsDeleting(false);
      setTextIndex((prev) => (prev + 1) % texts.length);
    } else {
      const speed = isDeleting ? typingSpeed / 2 : typingSpeed;
      timeout = setTimeout(() => {
        setDisplayText(
          isDeleting
            ? currentText.substring(0, displayText.length - 1)
            : currentText.substring(0, displayText.length + 1)
        );
      }, speed);
    }

    return () => clearTimeout(timeout);
  }, [displayText, textIndex, isDeleting, texts, typingSpeed, pauseDuration]);

  return displayText;
}

function CursorSpotlight({ accent }: { accent: string }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const smoothY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    mouseX.set(e.clientX);
    mouseY.set(e.clientY);
  }, [mouseX, mouseY]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  return (
    <motion.div
      className="fixed pointer-events-none z-[2] hidden md:block"
      style={{
        width: 500,
        height: 500,
        x: useTransform(smoothX, (v) => v - 250),
        y: useTransform(smoothY, (v) => v - 250),
        background: `radial-gradient(circle, ${accent}06, transparent 70%)`,
        filter: "blur(40px)",
      }}
    />
  );
}

export default function WelcomeHero() {
  const { theme } = useWelcomeTheme();
  const typedText = useTypingEffect(TYPING_TEXTS, 45, 2500);

  const stagger = (i: number) => ({
    initial: { opacity: 0, y: 30, filter: "blur(8px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: { duration: 0.8, delay: 0.3 + i * 0.12, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Subtle radial glow */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 70% 50% at 50% 30%, ${theme.accent}0A, transparent 70%)`,
        }}
      />

      <CursorSpotlight accent={theme.accent} />

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center flex flex-col items-center pt-24 sm:pt-20">
        {/* Badge */}
        <motion.div
          {...stagger(0)}
          className="relative inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full mb-8 sm:mb-12"
        >
          {/* Soft neon glow */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              boxShadow: `0 0 15px ${theme.accent}30, 0 0 30px ${theme.accent}15, inset 0 0 15px ${theme.accent}10`,
            }}
          />
          {/* Glassmorphism background */}
          <div className="absolute inset-0 rounded-full backdrop-blur-xl pointer-events-none"
            style={{
              background: `linear-gradient(135deg, ${theme.accent}12, ${theme.accent}06)`,
              border: `1px solid ${theme.accent}30`,
            }}
          />
          {/* Neon pulse animation */}
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ border: `1px solid ${theme.accent}40` }}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Dot */}
          <span
            className="w-1.5 h-1.5 rounded-full relative z-10"
            style={{ background: theme.accent, boxShadow: `0 0 8px ${theme.accent}90` }}
          />
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase relative z-10 text-white">
            Dashboard Inteligente
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1
          className="text-[2.5rem] sm:text-6xl md:text-7xl lg:text-[5.5rem] font-bold tracking-[-0.035em] leading-[1.05] sm:leading-[1] mb-6 [text-wrap:balance]"
          {...stagger(1)}
        >
          <span style={{ color: theme.text }}>Sua vida organizada</span>
          <br />
          <span style={{ color: `${theme.text}40` }}>em um só </span>
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: `linear-gradient(135deg, ${theme.accent}, ${theme.accentSecondary})` }}
          >
            lugar.
          </span>
        </motion.h1>

        {/* Tagline */}
        <motion.div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:gap-6 mb-8" {...stagger(2)}>
          {["Organize.", "Automatize.", "Evolua."].map((word) => (
            <span
              key={word}
              className="text-xs sm:text-base font-medium tracking-wide"
              style={{ color: `${theme.accent}AA` }}
            >
              {word}
            </span>
          ))}
        </motion.div>

        {/* Subtitle */}
        <motion.p
          className="text-sm sm:text-base max-w-lg mx-auto mb-10 leading-relaxed text-white/50"
          {...stagger(3)}
        >
          Finanças, tarefas, e-mails, calendário, contatos e IA. Tudo integrado
          com inteligência artificial que entende você.
        </motion.p>

        {/* Pandora preview */}
        <motion.div
          className="w-full max-w-sm mx-auto mb-12 rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl p-4"
          {...stagger(4)}
        >
          <div className="flex items-center gap-2.5 mb-3">
            <img
              src={pandoraAvatar}
              alt="Pandora"
              className="w-7 h-7 rounded-full object-cover ring-1 ring-white/[0.1]"
            />
            <span className="text-xs font-medium" style={{ color: `${theme.text}60` }}>Pandora IA</span>
          </div>
          <div className="flex items-center">
            <span className="text-sm font-mono" style={{ color: `${theme.text}80` }}>
              {typedText}
            </span>
            <motion.span
              className="w-px h-4 ml-0.5 rounded-full inline-block"
              style={{ backgroundColor: theme.accent }}
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
            />
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          className="flex items-center justify-center"
          {...stagger(5)}
        >
          <MagneticButton>
            <Link
              to="/auth?tab=signup"
              className="group relative inline-flex items-center gap-2 px-6 sm:px-8 py-3.5 rounded-xl font-semibold text-[13px] sm:text-sm transition-all duration-300 overflow-hidden text-center"
              style={{
                background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentSecondary})`,
                color: "#0A0A0F",
                boxShadow: `0 0 40px ${theme.accent}25`,
              }}
            >
              <span className="relative z-10">Testar grátis com {WELCOME_CREDITS} créditos</span>
              <ArrowRight size={15} className="relative z-10 group-hover:translate-x-0.5 transition-transform" />
              <motion.div
                className="absolute inset-0"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)" }}
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 5 }}
              />
            </Link>
          </MagneticButton>
        </motion.div>
      </div>

      {/* Scroll-down indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ delay: 2, duration: 0.8 }}
        whileInView={{ opacity: 0 }}
        viewport={{ once: true, margin: "-200px" }}
      >
        <span className="text-[10px] tracking-[0.2em] uppercase text-white/30">Scroll</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDown size={18} className="text-white/30" />
        </motion.div>
      </motion.div>
    </section>
  );
}

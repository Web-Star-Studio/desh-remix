import { motion, useScroll, useSpring } from "framer-motion";
import { useWelcomeTheme } from "@/components/welcome/WelcomeThemeContext";

export function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleY = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  let accent = "#C8956C";
  let accentSecondary = "#E8B98A";
  try {
    const ctx = useWelcomeTheme();
    accent = ctx.theme.accent;
    accentSecondary = ctx.theme.accentSecondary;
  } catch {
    // Not inside provider — use defaults
  }

  return (
    <motion.div
      className="fixed top-0 right-0 w-[3px] h-full z-50 origin-top pointer-events-none"
      style={{
        scaleY,
        background: `linear-gradient(180deg, ${accent}, ${accentSecondary})`,
        opacity: 0.6,
      }}
      aria-hidden="true"
    />
  );
}

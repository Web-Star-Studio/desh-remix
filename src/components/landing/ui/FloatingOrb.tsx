import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/ui/useReducedMotion";

interface FloatingOrbProps {
  size?: number;
  top?: string;
  left?: string;
  right?: string;
  delay?: number;
  opacity?: number;
}

export function FloatingOrb({ size = 300, top, left, right, delay = 0, opacity = 0.15 }: FloatingOrbProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        top,
        left,
        right,
        background: `radial-gradient(circle, rgba(200, 149, 108, ${opacity}) 0%, transparent 70%)`,
        filter: "blur(60px)",
      }}
      animate={reduced ? {} : {
        y: [0, -20, 0, 15, 0],
        x: [0, 10, -10, 5, 0],
        scale: [1, 1.05, 0.97, 1.02, 1],
      }}
      transition={{
        duration: 12,
        repeat: Infinity,
        delay,
        ease: "easeInOut",
      }}
    />
  );
}

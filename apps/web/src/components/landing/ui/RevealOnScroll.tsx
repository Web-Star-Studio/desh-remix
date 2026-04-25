import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { useReducedMotion } from "@/hooks/ui/useReducedMotion";

interface RevealOnScrollProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "left" | "right" | "none";
}

export function RevealOnScroll({ children, className = "", delay = 0, direction = "up" }: RevealOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduced = useReducedMotion();

  const offset = direction === "up" ? { y: 30 } : direction === "left" ? { x: -30 } : direction === "right" ? { x: 30 } : {};
  const reset = direction === "up" ? { y: 0 } : direction === "left" ? { x: 0 } : direction === "right" ? { x: 0 } : {};

  return (
    <motion.div
      ref={ref}
      initial={reduced ? {} : { opacity: 0, filter: "blur(4px)", ...offset }}
      animate={inView ? { opacity: 1, filter: "blur(0px)", ...reset } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

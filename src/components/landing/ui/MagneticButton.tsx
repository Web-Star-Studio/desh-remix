import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/ui/useReducedMotion";

interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  as?: "button" | "a";
  href?: string;
}

export function MagneticButton({ children, className = "", onClick, as = "button", href }: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const reduced = useReducedMotion();

  const handleMove = (e: React.MouseEvent) => {
    if (reduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * 0.08;
    const y = (e.clientY - rect.top - rect.height / 2) * 0.08;
    setPos({ x, y });
  };

  const handleEnter = () => setHovered(true);
  const handleLeave = () => {
    setPos({ x: 0, y: 0 });
    setHovered(false);
  };

  const Component = as === "a" ? "a" : "button";

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      animate={{
        x: pos.x,
        y: pos.y,
        scale: hovered ? 1.02 : 1,
      }}
      transition={{
        type: "spring",
        stiffness: 150,
        damping: 15,
        mass: 0.5,
      }}
      className="inline-block"
    >
      <Component className={className} onClick={onClick} href={href}>
        {children}
      </Component>
    </motion.div>
  );
}

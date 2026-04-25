import { motion } from "framer-motion";
import { ReactNode, forwardRef } from "react";

interface AnimatedItemProps {
  children: ReactNode;
  index?: number;
  className?: string;
}

const AnimatedItem = forwardRef<HTMLDivElement, AnimatedItemProps>(
  ({ children, index = 0, className }, ref) => (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: 0.25,
        delay: Math.min(index * 0.04, 0.3),
        ease: "easeOut",
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
);

AnimatedItem.displayName = "AnimatedItem";

export default AnimatedItem;

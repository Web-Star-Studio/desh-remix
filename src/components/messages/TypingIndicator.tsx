/**
 * TypingIndicator — Animated typing dots with subtle pulse effect.
 */
import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TypingIndicatorProps {
  senderName?: string;
}

export const TypingIndicator = memo(function TypingIndicator({ senderName }: TypingIndicatorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex justify-start"
    >
      <div className="bg-foreground/10 rounded-2xl rounded-bl-md px-4 py-2.5">
        {senderName && (
          <p className="text-[10px] font-medium text-primary mb-1">{senderName}</p>
        )}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              animate={{ y: [0, -4, 0] }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.15,
                ease: [0.42, 0, 0.58, 1],
              }}
              className="w-2 h-2 rounded-full bg-muted-foreground/60"
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
});

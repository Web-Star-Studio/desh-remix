import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "@/hooks/ui/useReducedMotion";
import deshLogoCoin from "@/assets/desh-logo-coin.png";

interface IntroSplashProps {
  onComplete: () => void;
}

// ── Subtle ambient sound ──
function playAmbientSound() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.ratio.value = 4;
    compressor.connect(ctx.destination);

    // Gentle pad
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.04, now + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
    osc.connect(gain).connect(compressor);
    osc.start(now);
    osc.stop(now + 3);

    setTimeout(() => ctx.close(), 4000);
  } catch {
    // Silently fail
  }
}

const IntroSplash = ({ onComplete }: IntroSplashProps) => {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<"idle" | "enter" | "exit">("idle");
  const soundPlayed = useRef(false);
  const finishedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    sessionStorage.setItem("desh-intro-seen", "1");
    onCompleteRef.current();
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      finish();
      return;
    }
  }, [reducedMotion, finish]);

  // Minimal timeline — ~2.5s total
  useEffect(() => {
    if (reducedMotion) return;
    const timers = [
      setTimeout(() => {
        setPhase("enter");
        if (!soundPlayed.current) {
          soundPlayed.current = true;
          playAmbientSound();
        }
      }, 200),
      setTimeout(() => setPhase("exit"), 1800),
      setTimeout(finish, 2500),
    ];
    return () => timers.forEach(clearTimeout);
  }, [reducedMotion, finish]);

  if (reducedMotion) return null;

  const content = (
    <AnimatePresence>
      {phase !== "exit" ? (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: "hsl(var(--background))" }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Subtle radial gradient */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={phase === "enter" ? { opacity: 1 } : {}}
            transition={{ duration: 1.2 }}
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% 50%, hsl(var(--primary) / 0.04) 0%, transparent 60%)",
            }}
          />

          {/* Minimal center content */}
          <div className="relative flex flex-col items-center justify-center">
            {/* Logo with subtle pulse */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={phase === "enter" ? { scale: 1, opacity: 1 } : {}}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              {/* Soft glow behind logo */}
              <motion.div
                className="absolute inset-0 rounded-full blur-xl"
                style={{
                  background: "hsl(var(--primary) / 0.15)",
                  transform: "scale(1.5)",
                }}
                animate={phase === "enter" ? { opacity: [0.3, 0.5, 0.3] } : {}}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              <img
                src={deshLogoCoin}
                alt="DESH"
                className="relative z-10 w-14 h-14 sm:w-16 sm:h-16"
              />
            </motion.div>

            {/* Brand name — clean, spaced */}
            <motion.div
              className="mt-6 flex items-center gap-1"
              initial={{ opacity: 0, y: 8 }}
              animate={phase === "enter" ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              {["D", "E", "S", "H"].map((letter, i) => (
                <span
                  key={letter}
                  className="text-lg sm:text-xl font-medium tracking-[0.2em]"
                  style={{ color: "hsl(var(--foreground))" }}
                >
                  {letter}
                </span>
              ))}
            </motion.div>

            {/* Minimal accent line */}
            <motion.div
              className="mt-3 h-px"
              initial={{ width: 0, opacity: 0 }}
              animate={phase === "enter" ? { width: 48, opacity: 1 } : {}}
              transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              style={{
                background: "hsl(var(--primary) / 0.4)",
              }}
            />
          </div>
        </motion.div>
      ) : (
        <motion.div
          className="fixed inset-0 z-[9999] pointer-events-none"
          style={{ background: "hsl(var(--background))" }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
};

export default IntroSplash;

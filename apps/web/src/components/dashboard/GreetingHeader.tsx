import React, { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import HeaderActions from "./HeaderActions";
import { useMorningBriefing } from "@/hooks/ai/useMorningBriefing";
import { useDemo } from "@/contexts/DemoContext";
import { Volume2, Loader2, Square, Podcast, Eye } from "lucide-react";
import DeshTooltip from "@/components/ui/DeshTooltip";

function getGreeting(): { text: string; emoji: string } {
  const h = new Date().getHours();
  if (h < 6) return { text: "Boa madrugada", emoji: "🌙" };
  if (h < 12) return { text: "Bom dia", emoji: "☀️" };
  if (h < 18) return { text: "Boa tarde", emoji: "🌤️" };
  return { text: "Boa noite", emoji: "🌙" };
}

function getDateString(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

const GreetingHeader = () => {
  const { profile } = useAuth();
  const { text, emoji } = useMemo(getGreeting, []);
  const dateStr = useMemo(getDateString, []);
  const firstName = profile?.display_name?.split(" ")[0] || null;
  const { status, progress, shouldOffer, generateAndPlay, stop } = useMorningBriefing();
  const { isDemoMode, toggleDemoMode } = useDemo();

  const showBriefingBtn = shouldOffer || status === "generating" || status === "playing";

  return (
    <div className="flex items-center justify-between mb-4 sm:mb-5 md:mb-6 relative z-[200]">
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="min-w-0 flex-1"
      >
        <div className="flex items-center gap-2.5">
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
            className="text-lg sm:text-2xl md:text-3xl"
          >
            {emoji}
          </motion.span>
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-overlay tracking-tight">
              {text}{firstName ? `, ${firstName}` : ""}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[11px] sm:text-xs text-overlay-muted capitalize tracking-wide">
                {dateStr}
              </p>
              {isDemoMode && (
                <DeshTooltip label="Modo demonstração ativo — clique para desativar">
                  <button
                    onClick={toggleDemoMode}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-primary text-[10px] font-semibold animate-pulse hover:bg-primary/30 transition-colors"
                  >
                    <Eye className="w-3 h-3" /> DEMO
                  </button>
                </DeshTooltip>
              )}
            </div>
          </div>
        </div>
        <AnimatePresence>
          {showBriefingBtn && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, y: -5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -5 }}
              transition={{ duration: 0.3 }}
              onClick={status === "playing" ? stop : generateAndPlay}
              disabled={status === "generating"}
              className="hidden sm:inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-full bg-foreground/8 backdrop-blur-sm border border-foreground/10 text-overlay-muted hover:bg-foreground/12 hover:text-overlay transition-all text-[11px] font-medium disabled:opacity-50 group"
            >
              {status === "generating" ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Gerando...</span>
                </>
              ) : status === "playing" ? (
                <>
                  <div className="relative">
                    <Volume2 className="w-3 h-3 animate-pulse" />
                  </div>
                  <span>Ouvindo</span>
                  {progress > 0 && (
                    <span className="text-overlay-muted">{progress}%</span>
                  )}
                  <Square className="w-2.5 h-2.5 ml-0.5 opacity-70 group-hover:opacity-100" />
                </>
              ) : (
                <>
                  <Podcast className="w-3 h-3" />
                  <span>Briefing matinal</span>
                </>
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
      <HeaderActions />
    </div>
  );
};

export default React.memo(GreetingHeader);

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";

interface CalendarAISummaryProps {
  aiSummary: Record<string, unknown> | null;
  onDismiss: () => void;
}

const CalendarAISummary = ({ aiSummary, onDismiss }: CalendarAISummaryProps) => {
  return (
    <AnimatePresence>
      {aiSummary && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-4">
          <GlassCard size="auto">
            <div className="flex items-start justify-between mb-2 gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                <p className="text-sm font-semibold text-foreground">
                  {aiSummary.type === "daily_summary" ? "Resumo do Dia" : "Resumo da Semana"}
                </p>
                {aiSummary.busy_level && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    aiSummary.busy_level === "free" ? "bg-green-500/15 text-green-400" :
                    aiSummary.busy_level === "light" ? "bg-emerald-500/15 text-emerald-400" :
                    aiSummary.busy_level === "moderate" ? "bg-amber-500/15 text-amber-400" :
                    "bg-red-500/15 text-red-400"
                  }`}>
                    {aiSummary.busy_level === "free" ? "Livre 🌿" :
                     aiSummary.busy_level === "light" ? "Leve ☀️" :
                     aiSummary.busy_level === "moderate" ? "Moderado ⚡" :
                     "Ocupado 🔥"}
                  </span>
                )}
              </div>
              <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground transition-colors shrink-0" aria-label="Fechar resumo">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-foreground/80 mb-2 leading-relaxed">{String(aiSummary.summary ?? "")}</p>
            {aiSummary.busiest_day && (
              <p className="text-xs text-muted-foreground mb-2">
                Dia mais ocupado: <strong className="text-foreground/80">{String(aiSummary.busiest_day)}</strong>
              </p>
            )}
            {Array.isArray(aiSummary.tips) && aiSummary.tips.length > 0 && (
              <div className="space-y-1 mb-2">
                {(aiSummary.tips as string[]).map((tip: string, i: number) => (
                  <p key={i} className="flex items-start gap-1.5 text-xs text-foreground/70">
                    <span className="w-1 h-1 rounded-full bg-primary/60 shrink-0 mt-1.5" />
                    {tip}
                  </p>
                ))}
              </div>
            )}
            {aiSummary.category_distribution && Object.keys(aiSummary.category_distribution).length > 0 && (
              <div className="border-t border-border/20 pt-2 flex items-center gap-1.5 flex-wrap">
                {Object.entries(aiSummary.category_distribution).map(([cat, count]) => (
                  <span key={cat} className="text-xs bg-muted/50 px-2 py-0.5 rounded-full text-muted-foreground">
                    {cat} <span className="text-primary font-bold">{count as number}</span>
                  </span>
                ))}
              </div>
            )}
          </GlassCard>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default memo(CalendarAISummary);

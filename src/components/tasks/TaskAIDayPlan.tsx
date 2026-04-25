import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Clock, Sparkles } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";

interface TaskAIDayPlanProps {
  dayPlan: Record<string, any> | null;
  onDismiss: () => void;
}

const TaskAIDayPlan = ({ dayPlan, onDismiss }: TaskAIDayPlanProps) => {
  return (
    <AnimatePresence>
      {dayPlan && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-4">
          <GlassCard size="auto" className="border border-primary/25 max-h-[50vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Plano do Dia — IA</p>
                  <p className="text-[10px] text-muted-foreground">Gerado agora • priorizado por urgência e impacto</p>
                </div>
              </div>
              <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-foreground/10 transition-colors" aria-label="Fechar plano">
                <X className="w-4 h-4" />
              </button>
            </div>
            {dayPlan.plan && Array.isArray(dayPlan.plan) && (
              <div className="relative overflow-y-auto flex-1 min-h-0">
                <div className="absolute left-[52px] top-0 bottom-0 w-px bg-primary/15" />
                <div className="space-y-2">
                  {dayPlan.plan.map((item: any, i: number) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="flex items-start gap-3"
                    >
                      <div className="flex flex-col items-center w-[52px] flex-shrink-0">
                        <span className="text-[10px] font-mono text-primary font-semibold">{item.suggested_time || `#${i + 1}`}</span>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-primary/60 mt-1.5 flex-shrink-0 relative z-10" />
                      <div className="flex-1 bg-foreground/5 rounded-lg px-3 py-2 hover:bg-foreground/8 transition-colors">
                        <p className="text-sm font-medium text-foreground leading-snug">{item.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {item.duration && (
                            <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />{item.duration}
                            </span>
                          )}
                          {item.reason && (
                            <span className="text-[9px] text-primary/60 italic hidden sm:inline">{item.reason}</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
            {dayPlan.tips && (
              <div className="mt-4 pt-3 border-t border-foreground/5">
                <p className="text-xs text-primary/80 italic flex items-start gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  {dayPlan.tips}
                </p>
              </div>
            )}
          </GlassCard>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default memo(TaskAIDayPlan);

import { Calculator, Ruler, CalendarDays, Zap, Copy, Check } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import type { QuickAnswer } from "@/utils/quickAnswers";

const iconMap = {
  math: Calculator,
  conversion: Ruler,
  date: CalendarDays,
  timer: Zap,
};

const labelMap = {
  math: "Cálculo",
  conversion: "Conversão",
  date: "Data & Hora",
  timer: "Timer",
};

const QuickAnswerCard = ({ answer, onDismiss }: { answer: QuickAnswer; onDismiss: () => void }) => {
  const [copied, setCopied] = useState(false);
  const Icon = iconMap[answer.type] || Zap;

  const handleCopy = () => {
    navigator.clipboard.writeText(answer.answer);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5 p-4 mb-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="p-2 rounded-lg bg-primary/15">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">
                {labelMap[answer.type]} Instantâneo
              </span>
              <span className="text-[9px] text-muted-foreground bg-foreground/5 px-1.5 py-0.5 rounded-full">
                sem créditos
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground tracking-tight">{answer.answer}</p>
            {answer.details && (
              <p className="text-xs text-muted-foreground mt-1">{answer.details}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      <div className="mt-3 pt-2 border-t border-primary/10">
        <button
          onClick={onDismiss}
          className="text-[11px] text-primary/70 hover:text-primary transition-colors"
        >
          Buscar resultado completo na web →
        </button>
      </div>
    </motion.div>
  );
};

export default QuickAnswerCard;

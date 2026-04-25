import { Clock } from "lucide-react";
import { motion } from "framer-motion";

export type RecencyValue = "" | "hour" | "day" | "week" | "month";

const recencyOptions: { label: string; value: RecencyValue }[] = [
  { label: "Qualquer data", value: "" },
  { label: "Última hora", value: "hour" },
  { label: "Hoje", value: "day" },
  { label: "Esta semana", value: "week" },
  { label: "Este mês", value: "month" },
];

interface RecencyFilterProps {
  value: RecencyValue;
  onChange: (v: RecencyValue) => void;
  visible: boolean;
}

const RecencyFilter = ({ value, onChange, visible }: RecencyFilterProps) => {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="flex items-center gap-1.5 overflow-x-auto no-scrollbar"
    >
      <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
      {recencyOptions.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all shrink-0 ${
            value === opt.value
              ? "bg-accent text-accent-foreground ring-1 ring-accent/30"
              : "text-muted-foreground hover:bg-foreground/5"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </motion.div>
  );
};

export default RecencyFilter;

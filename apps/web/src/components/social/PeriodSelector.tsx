import { Calendar } from "lucide-react";

export type Period = '7d' | '30d' | '90d';

interface PeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
}

const options: { value: Period; label: string }[] = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
];

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex items-center gap-1 bg-foreground/[0.04] backdrop-blur-sm border border-foreground/[0.04] p-0.5 rounded-xl">
      <Calendar className="h-3.5 w-3.5 text-muted-foreground ml-2.5 mr-1 shrink-0" />
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
            value === opt.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

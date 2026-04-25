import React, { useEffect, useRef, useState, memo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number | null;
  subtitle?: string;
}

function useCountUp(target: number, duration = 800) {
  const [current, setCurrent] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    if (target === 0) { setCurrent(0); return; }
    const start = prevRef.current;
    const diff = target - start;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const val = Math.round(start + diff * eased);
      setCurrent(val);
      if (progress < 1) requestAnimationFrame(step);
      else prevRef.current = target;
    };
    requestAnimationFrame(step);
  }, [target, duration]);

  return current;
}

export const MetricCard = memo(function MetricCard({ label, value, icon, trend, subtitle }: MetricCardProps) {
  const isEmpty = value === "—";
  const numericValue = typeof value === "number" ? value : 0;
  const animatedNum = useCountUp(typeof value === "number" ? numericValue : 0);
  const displayValue = typeof value === "number" ? animatedNum : value;

  return (
    <div className="group relative p-4 rounded-2xl bg-foreground/[0.03] border border-foreground/[0.06] hover:border-primary/20 hover:bg-foreground/[0.05] transition-all duration-300 overflow-hidden">
      {/* Subtle gradient on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <div className="relative flex flex-col gap-2.5">
        {/* Top row: icon + label + trend */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/8 group-hover:bg-primary/12 transition-colors duration-300">
              {icon}
            </div>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
          </div>
          {trend != null && trend !== 0 && (
            <div className={cn(
              "flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full",
              trend > 0
                ? "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400"
                : "text-red-600 bg-red-500/10 dark:text-red-400"
            )}>
              {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(trend).toFixed(1)}%
            </div>
          )}
        </div>

        {/* Value */}
        <p className={cn(
          "text-2xl font-bold tracking-tight transition-colors duration-300",
          isEmpty ? "text-muted-foreground/25" : "text-foreground"
        )}>
          {displayValue}
        </p>

        {subtitle && (
          <p className="text-[10px] text-muted-foreground/70 -mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
});

import { motion } from "framer-motion";

const Pulse = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <div className={`animate-pulse rounded-lg bg-foreground/5 ${className}`} style={style} />
);

export default function FinanceLoadingSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      {/* KPI Cards skeleton */}
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map(i => (
          <div key={i} className="glass-card rounded-xl p-3 space-y-2">
            <Pulse className="h-3 w-16" />
            <Pulse className="h-6 w-24" />
            <Pulse className="h-2 w-full" />
          </div>
        ))}
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border border-foreground/5 p-2.5 space-y-1.5">
            <Pulse className="h-2 w-12" />
            <Pulse className="h-4 w-16" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="glass-card rounded-xl p-4 space-y-3">
        <Pulse className="h-3 w-24" />
        <div className="flex items-end gap-1 h-[180px]">
          {Array.from({ length: 15 }, (_, i) => (
            <Pulse
              key={i}
              className="flex-1"
              style={{ height: `${20 + Math.random() * 60}%` } as any}
            />
          ))}
        </div>
      </div>

      {/* Transactions skeleton */}
      <div className="glass-card rounded-xl p-4 space-y-2">
        <Pulse className="h-3 w-20" />
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-3 py-2">
            <Pulse className="w-7 h-7 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-1">
              <Pulse className="h-3 w-32" />
              <Pulse className="h-2 w-16" />
            </div>
            <Pulse className="h-4 w-20" />
          </div>
        ))}
      </div>
    </motion.div>
  );
}
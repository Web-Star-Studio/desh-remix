import { cn } from "@/lib/utils";
import { ReactNode, HTMLAttributes } from "react";

export type GlassCardSize = "standard" | "compact" | "wide" | "tall" | "double" | "auto";

/**
 * GlassCard Size System (mobile-first):
 * - standard: 1 col, standard height (280/320px)
 * - compact:  1 col, short (140/150/160px) — quotes, life progress
 * - wide:     2 cols, standard height — calendar, profile
 * - tall:     1 col, tall (400/440px) — widgets with lots of vertical content
 * - double:   2 cols, 2 rows — map, XP (needs 2×2 space)
 * - auto:     no constraints
 */
const sizeClasses: Record<GlassCardSize, string> = {
  standard: "min-h-[240px] sm:min-h-[280px] sm:h-[280px] lg:h-[320px]",
  compact: "min-h-[120px] sm:min-h-[140px] sm:h-[150px] lg:h-[160px]",
  wide: "min-h-[240px] sm:col-span-2 sm:min-h-[280px] sm:h-[280px] lg:h-[320px]",
  tall: "min-h-[320px] sm:min-h-[400px] sm:h-[400px] lg:h-[440px]",
  double: "min-h-[320px] sm:min-h-[400px] sm:col-span-2 sm:row-span-2",
  auto: "",
};

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  size?: GlassCardSize;
}

import { forwardRef } from "react";

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ children, className, size = "standard", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "glass-card glass-card-interactive p-3 sm:p-4 flex flex-col overflow-hidden",
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
GlassCard.displayName = "GlassCard";

export { GlassCard };
export default GlassCard;

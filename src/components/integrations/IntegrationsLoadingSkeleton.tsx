import { memo } from "react";

const SKELETON_ITEMS = 5;

export const IntegrationsLoadingSkeleton = memo(function IntegrationsLoadingSkeleton() {
  return (
    <div className="grid gap-2">
      {Array.from({ length: SKELETON_ITEMS }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-xl border border-border/30 bg-background/60 p-3.5 animate-pulse"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-foreground/[0.06] shrink-0" />
            <div className="space-y-2 min-w-0">
              <div className="flex items-center gap-2">
                <div className="h-3.5 w-24 rounded bg-foreground/[0.08]" />
                <div className="h-4 w-16 rounded-full bg-foreground/[0.05]" />
              </div>
              <div className="h-3 w-40 rounded bg-foreground/[0.05]" />
            </div>
          </div>
          <div className="h-8 w-20 rounded-md bg-foreground/[0.05] shrink-0 ml-3" />
        </div>
      ))}
    </div>
  );
});

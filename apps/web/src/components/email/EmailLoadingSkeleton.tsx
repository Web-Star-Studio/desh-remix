import { memo } from "react";

interface EmailLoadingSkeletonProps {
  count?: number;
}

const EmailLoadingSkeleton = memo(({ count = 8 }: EmailLoadingSkeletonProps) => (
  <div className="divide-y divide-foreground/5">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="px-3 py-2.5 flex items-start gap-2.5 animate-pulse" style={{ animationDelay: `${i * 60}ms` }}>
        <div className="w-8 h-8 rounded-full bg-foreground/10 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-3.5 bg-foreground/10 rounded" style={{ width: `${60 + (i * 7) % 40}px` }} />
            <div className="h-3 w-12 bg-foreground/8 rounded ml-auto" />
          </div>
          <div className="h-3 bg-foreground/8 rounded" style={{ width: `${55 + (i * 11) % 30}%` }} />
          <div className="h-2.5 bg-foreground/5 rounded" style={{ width: `${35 + (i * 13) % 25}%` }} />
        </div>
      </div>
    ))}
  </div>
));

EmailLoadingSkeleton.displayName = "EmailLoadingSkeleton";
export default EmailLoadingSkeleton;

import { cn } from "@/lib/utils";

type Variant = "spinner" | "skeleton" | "dots";
type Size = "sm" | "md" | "lg";

interface LoadingSpinnerProps {
  variant?: Variant;
  size?: Size;
  fullPage?: boolean;
  className?: string;
  label?: string;
}

const sizeMap: Record<Size, { spinner: string; dot: string; skeleton: string }> = {
  sm: { spinner: "w-5 h-5 border-2", dot: "w-1.5 h-1.5", skeleton: "h-20" },
  md: { spinner: "w-8 h-8 border-[3px]", dot: "w-2 h-2", skeleton: "h-32" },
  lg: { spinner: "w-12 h-12 border-4", dot: "w-2.5 h-2.5", skeleton: "h-48" },
};

const LoadingSpinner = ({
  variant = "spinner",
  size = "md",
  fullPage = false,
  className,
  label,
}: LoadingSpinnerProps) => {
  const s = sizeMap[size];

  const content = (() => {
    switch (variant) {
      case "dots":
        return (
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={cn(s.dot, "rounded-full bg-primary animate-pulse")}
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        );

      case "skeleton":
        return (
          <div className={cn("w-full space-y-3", className)}>
            <div className={cn("animate-pulse rounded-xl bg-muted", s.skeleton)} />
            <div className="animate-pulse rounded-xl bg-muted h-4 w-3/4" />
            <div className="animate-pulse rounded-xl bg-muted h-4 w-1/2" />
          </div>
        );

      default:
        return (
          <div
            className={cn(
              s.spinner,
              "rounded-full border-primary/30 border-t-primary animate-spin"
            )}
          />
        );
    }
  })();

  if (fullPage) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        {content}
        {label && <p className="text-sm text-muted-foreground">{label}</p>}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-8", className)}>
      {content}
      {label && <p className="text-xs text-muted-foreground">{label}</p>}
    </div>
  );
};

export default LoadingSpinner;

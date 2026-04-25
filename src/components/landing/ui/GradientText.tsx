import { cn } from "@/lib/utils";

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  animate?: boolean;
  from?: string;
  to?: string;
}

export function GradientText({ children, className, animate = true, from, to }: GradientTextProps) {
  const style = from && to
    ? { backgroundImage: `linear-gradient(to right, ${from}, ${to})` }
    : undefined;

  return (
    <span
      className={cn(
        "bg-clip-text text-transparent bg-gradient-to-r relative",
        !style && "from-[#C8956C] via-[#E8B98A] to-[#D4A574]",
        animate && "animate-[gradient-shift_3s_ease_infinite] bg-[length:200%_auto]",
        className
      )}
      style={style}
    >
      {children}
      {animate && (
        <span
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent bg-clip-text text-transparent animate-[text-shimmer_4s_ease-in-out_infinite] bg-[length:200%_100%] pointer-events-none"
          aria-hidden="true"
        >
          {children}
        </span>
      )}
    </span>
  );
}

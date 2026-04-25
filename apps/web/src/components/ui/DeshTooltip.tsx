import { ReactNode, forwardRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DeshTooltipProps {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  className?: string;
}

const DeshTooltip = forwardRef<HTMLDivElement, DeshTooltipProps>(
  ({ label, children, side = "bottom", align = "center", className }, ref) => {
    const isMobile = useIsMobile();

    if (isMobile) return <>{children}</>;

    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>{children}</TooltipTrigger>
          <TooltipContent
            ref={ref}
            side={side}
            align={align}
            className={`z-[9999] bg-background/95 backdrop-blur-md border-border/60 text-foreground text-[11px] font-medium px-2.5 py-1.5 rounded-lg shadow-lg ${className ?? ""}`}
          >
            {label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
);

DeshTooltip.displayName = "DeshTooltip";

export default DeshTooltip;

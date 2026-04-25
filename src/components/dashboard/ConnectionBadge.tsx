// ConnectionBadge – force rebuild v2
import { Wifi, WifiOff, Plug } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DeshTooltip from "@/components/ui/DeshTooltip";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ConnectionBadgeProps {
  isConnected: boolean;
  isLoading?: boolean;
  sourceCount?: number;
  sourceNames?: string[];
  size?: "sm" | "lg";
}

const ConnectionBadge = ({ isConnected, isLoading, sourceCount, sourceNames, size = "sm" }: ConnectionBadgeProps) => {
  const navigate = useNavigate();
  const iconSize = size === "lg" ? "w-4 h-4" : "w-2.5 h-2.5";
  const textSize = size === "lg" ? "text-xs" : "text-[9px]";
  const dotSize = size === "lg" ? "w-2 h-2" : "w-1.5 h-1.5";

  if (isLoading) {
    return (
      <span className={`inline-flex items-center ${textSize} text-muted-foreground`}>
        <span className={`${dotSize} rounded-full bg-primary animate-pulse`} />
      </span>
    );
  }

  if (!isConnected) {
    return (
      <DeshTooltip label="Conectar dados reais">
        <button
          onClick={(e) => { e.stopPropagation(); navigate("/integrations"); }}
          className={`inline-flex items-center ${textSize} text-muted-foreground hover:text-primary transition-colors group`}
        >
          <WifiOff className={`${iconSize} group-hover:hidden`} />
          <Plug className={`${iconSize} hidden group-hover:block`} />
        </button>
      </DeshTooltip>
    );
  }

  const badge = (
    <span className={`inline-flex items-center ${textSize} text-primary cursor-default`}>
      <Wifi className={iconSize} />
    </span>
  );

  if (sourceNames && sourceNames.length > 0) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-56">
            <p className="text-[10px] font-medium mb-1">Contas conectadas:</p>
            <ul className="space-y-0.5">
              {sourceNames.map((name, i) => (
                <li key={i} className="text-[10px] text-muted-foreground truncate">• {name}</li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
};

export default ConnectionBadge;

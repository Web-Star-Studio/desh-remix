import { Wifi, ChevronRight } from "lucide-react";
import { type ConnectedPlatform } from "@/hooks/social/useSocialConnections";
import { DynamicIcon } from "./DynamicIcon";
import { cn } from "@/lib/utils";

export function PlatformRow({ platform, onClick, isSelected }: { platform: ConnectedPlatform; onClick?: () => void; isSelected?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3.5 rounded-xl cursor-pointer transition-all duration-200",
        isSelected
          ? "bg-foreground/[0.06] border border-transparent"
          : "bg-foreground/[0.02] hover:bg-foreground/[0.05] border border-foreground/[0.04]"
      )}
      style={isSelected ? { boxShadow: `0 0 0 1.5px ${platform.color}35, 0 2px 8px ${platform.color}10` } : undefined}
      onClick={onClick}
    >
      <div
        className={cn("w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200", isSelected && "scale-105")}
        style={{ background: `${platform.color}12` }}
      >
        <DynamicIcon name={platform.icon} className="w-4 h-4" color={platform.color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{platform.name}</p>
        {platform.email && <p className="text-[11px] text-muted-foreground/70 truncate">{platform.email}</p>}
      </div>
      <span className="text-[10px] text-emerald-500 font-medium flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/8">
        <Wifi className="w-2.5 h-2.5" /> Ativo
      </span>
      <ChevronRight className={cn(
        "w-3.5 h-3.5 text-muted-foreground/50 transition-transform duration-300",
        isSelected && "rotate-90 text-foreground"
      )} />
    </div>
  );
}

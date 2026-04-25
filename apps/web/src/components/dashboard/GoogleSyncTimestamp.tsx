import { RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  lastSyncedAt: number | null;
  onRefresh?: () => void;
  isLoading?: boolean;
}

function formatTimeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 10) return "agora";
  if (diff < 60) return `${diff}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

const GoogleSyncTimestamp = ({ lastSyncedAt, onRefresh, isLoading }: Props) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!lastSyncedAt) return;
    const timer = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(timer);
  }, [lastSyncedAt]);

  if (!lastSyncedAt && !onRefresh) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onRefresh}
            disabled={isLoading || !onRefresh}
            className="text-muted-foreground/60 hover:text-primary transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-2.5 h-2.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-[10px]">
          {lastSyncedAt ? `Sync ${formatTimeAgo(lastSyncedAt)}` : "Sincronizar agora"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default GoogleSyncTimestamp;

import { useState } from "react";
import { format } from "date-fns";
import { ChevronRight, Trash2 } from "lucide-react";
import { CATEGORY_CONFIG } from "./activityLogConstants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface ActivityLog {
  id: string;
  action: string;
  category: string;
  details: Record<string, unknown>;
  created_at: string;
}

interface Props {
  log: ActivityLog;
  onDelete?: (id: string) => void;
}

const ActivityLogItem = ({ log, onDelete }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const cat = CATEGORY_CONFIG[log.category] || CATEGORY_CONFIG.geral;
  const Icon = cat.icon;
  const time = format(new Date(log.created_at), "HH:mm:ss");
  const detailEntries = Object.entries(log.details || {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== ""
  );
  const hasDetails = detailEntries.length > 0;

  return (
    <div
      className={cn(
        "flex items-start gap-3 py-2.5 px-2 first:pt-1 last:pb-1 group transition-colors rounded-lg",
        expanded && "bg-foreground/[0.03]"
      )}
    >
      <div className={`mt-0.5 p-1.5 rounded-lg bg-foreground/5 ${cat.color}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => hasDetails && setExpanded(!expanded)}
            className={cn(
              "flex items-center gap-1.5 text-sm text-foreground font-medium truncate text-left",
              hasDetails && "cursor-pointer hover:text-primary transition-colors"
            )}
          >
            {hasDetails && (
              <ChevronRight className={cn("w-3 h-3 shrink-0 transition-transform", expanded && "rotate-90")} />
            )}
            <span className="truncate">{log.action}</span>
          </button>
          <span className="text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">{time}</span>
        </div>

        <AnimatePresence>
          {expanded && hasDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-1.5 p-2 rounded-lg bg-foreground/[0.03] border border-border/20 space-y-1">
                {detailEntries.map(([key, val]) => (
                  <div key={key} className="flex gap-2 text-[11px]">
                    <span className="text-muted-foreground/70 font-medium shrink-0">{key}:</span>
                    <span className="text-muted-foreground break-all">
                      {typeof val === "string" ? val : JSON.stringify(val)}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!expanded && hasDetails && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            {detailEntries.slice(0, 3).map(([key, val]) => (
              <span key={key} className="text-[11px] text-muted-foreground">
                <span className="text-muted-foreground/60">{key}:</span>{" "}
                {typeof val === "string" ? (val.length > 40 ? val.slice(0, 40) + "…" : val) : JSON.stringify(val)}
              </span>
            ))}
            {detailEntries.length > 3 && (
              <span className="text-[10px] text-muted-foreground/50">+{detailEntries.length - 3} mais</span>
            )}
          </div>
        )}
      </div>

      <span className={`text-[10px] px-1.5 py-0.5 rounded-full bg-foreground/5 ${cat.color} shrink-0`}>
        {cat.label}
      </span>

      {onDelete && (
        <Button
          size="sm"
          variant="ghost"
          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(log.id)}
          title="Excluir este log"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
};

export default ActivityLogItem;

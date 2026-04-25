import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import React from "react";

interface CalendarDayTooltipProps {
  hoveredDayKey: string | null;
  tooltipAnchor: { x: number; y: number } | null;
  eventTitlesByDay: Record<string, string[]>;
  eventCountByDay: Record<string, number>;
  tooltipTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  setHoveredDayKey: (key: string | null) => void;
  setTooltipAnchor: (anchor: { x: number; y: number } | null) => void;
}

const CalendarDayTooltip = ({
  hoveredDayKey, tooltipAnchor, eventTitlesByDay, eventCountByDay,
  tooltipTimeoutRef, setHoveredDayKey, setTooltipAnchor,
}: CalendarDayTooltipProps) => {
  return (
    <AnimatePresence>
      {hoveredDayKey && tooltipAnchor && eventTitlesByDay[hoveredDayKey]?.length > 0 && (
        <motion.div
          key={hoveredDayKey}
          initial={{ opacity: 0, y: 4, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.96 }}
          transition={{ duration: 0.12 }}
          onMouseEnter={() => { if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current); }}
          onMouseLeave={() => { setHoveredDayKey(null); setTooltipAnchor(null); }}
          className="fixed z-[9999] pointer-events-auto"
          style={{
            left: tooltipAnchor.x,
            top: tooltipAnchor.y - 8,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="bg-popover border border-border/60 rounded-xl shadow-xl backdrop-blur-md px-3 py-2 min-w-[140px] max-w-[200px]">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              {(eventCountByDay[hoveredDayKey] || 0)} evento{(eventCountByDay[hoveredDayKey] || 0) !== 1 ? "s" : ""}
            </p>
            <div className="space-y-0.5">
              {eventTitlesByDay[hoveredDayKey]?.map((title, i) => (
                <p key={i} className="text-xs text-foreground/80 truncate">• {title}</p>
              ))}
              {(eventCountByDay[hoveredDayKey] || 0) > 5 && (
                <p className="text-xs text-muted-foreground">+{(eventCountByDay[hoveredDayKey] || 0) - 5} mais</p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default memo(CalendarDayTooltip);

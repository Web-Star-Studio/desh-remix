import { useCallback, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Loader2 } from "lucide-react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  className?: string;
  /** Minimum pull distance to trigger refresh (px) */
  threshold?: number;
}

/**
 * PullToRefresh — Wraps scrollable content with a pull-down-to-refresh gesture.
 * Only activates when the content is scrolled to the very top.
 * Native-feel spring animation.
 */
const PullToRefresh = ({ onRefresh, children, className, threshold = 80 }: PullToRefreshProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pullY = useMotionValue(0);
  const opacity = useTransform(pullY, [0, threshold], [0, 1]);
  const scale = useTransform(pullY, [0, threshold], [0.5, 1]);
  const rotate = useTransform(pullY, [0, threshold * 2], [0, 360]);

  const isAtTop = useCallback(() => {
    if (!scrollRef.current) return true;
    return scrollRef.current.scrollTop <= 0;
  }, []);

  const handleDragEnd = useCallback(async (_: any, info: PanInfo) => {
    if (info.offset.y >= threshold && isAtTop() && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    pullY.set(0);
  }, [threshold, isAtTop, isRefreshing, onRefresh, pullY]);

  return (
    <div className={className} style={{ position: "relative", overflow: "hidden" }}>
      {/* Pull indicator */}
      <motion.div
        className="absolute top-0 left-0 right-0 flex items-center justify-center z-10 pointer-events-none"
        style={{ opacity, height: threshold }}
      >
        <motion.div style={{ scale }}>
          {isRefreshing ? (
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          ) : (
            <motion.div style={{ rotate }}>
              <div className="w-6 h-6 rounded-full border-2 border-primary/50 border-t-primary" />
            </motion.div>
          )}
        </motion.div>
      </motion.div>

      <motion.div
        ref={scrollRef}
        drag={isRefreshing ? false : "y"}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.4, bottom: 0 }}
        onDrag={(_, info) => {
          if (isAtTop() && info.offset.y > 0) {
            pullY.set(info.offset.y);
          }
        }}
        onDragEnd={handleDragEnd}
        style={{ y: useTransform(pullY, [0, threshold * 2], [0, threshold * 0.5]) }}
        className="h-full overflow-y-auto mobile-scroll touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  );
};

export default PullToRefresh;

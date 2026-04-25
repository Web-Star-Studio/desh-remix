/**
 * NoteReadingProgress — Thin progress bar showing scroll position in the editor.
 * Only visible when content overflows.
 */
import { memo, useState, useEffect, useCallback } from "react";

interface NoteReadingProgressProps {
  containerRef: React.RefObject<HTMLElement | null>;
}

export const NoteReadingProgress = memo(function NoteReadingProgress({ containerRef }: NoteReadingProgressProps) {
  const [progress, setProgress] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const maxScroll = scrollHeight - clientHeight;
    setHasOverflow(maxScroll > 20);
    if (maxScroll <= 0) { setProgress(0); return; }
    setProgress(Math.min(100, Math.round((scrollTop / maxScroll) * 100)));
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    // Check on mount
    handleScroll();
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  if (!hasOverflow) return null;

  return (
    <div className="h-0.5 w-full bg-foreground/5 flex-shrink-0">
      <div
        className="h-full bg-primary/40 transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
});

/**
 * MessageInputMetrics — Live character/word counter for chat input.
 */
import { memo, useMemo } from "react";

interface MessageInputMetricsProps {
  text: string;
  maxChars?: number;
}

export const MessageInputMetrics = memo(function MessageInputMetrics({ text, maxChars = 4096 }: MessageInputMetricsProps) {
  const metrics = useMemo(() => {
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    const charCount = text.length;
    const isNearLimit = charCount > maxChars * 0.9;
    const isOverLimit = charCount > maxChars;
    return { wordCount, charCount, isNearLimit, isOverLimit };
  }, [text, maxChars]);

  if (metrics.charCount === 0) return null;

  return (
    <div className="flex items-center gap-2 px-1 py-0.5 text-[10px] text-muted-foreground/60">
      <span>{metrics.wordCount} palavra{metrics.wordCount !== 1 ? "s" : ""}</span>
      <span className="text-foreground/10">·</span>
      <span className={metrics.isOverLimit ? "text-destructive font-medium" : metrics.isNearLimit ? "text-amber-500" : ""}>
        {metrics.charCount.toLocaleString("pt-BR")}/{maxChars.toLocaleString("pt-BR")}
      </span>
    </div>
  );
});

import { useMemo, memo } from "react";
import { Clock } from "lucide-react";
import type { PlatformPost } from "@/hooks/social/usePlatformData";

interface PostingHeatmapProps {
  posts: PlatformPost[];
}

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

export const PostingHeatmap = memo(function PostingHeatmap({ posts }: PostingHeatmapProps) {
  const heatmapData = useMemo(() => {
    // grid[day][hourBucket] = { count, totalEngagement }
    const grid: { count: number; engagement: number }[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 8 }, () => ({ count: 0, engagement: 0 }))
    );

    let maxEngagement = 0;

    for (const post of posts) {
      if (!post.timestamp) continue;
      const d = new Date(post.timestamp);
      if (isNaN(d.getTime())) continue;
      const day = d.getDay();
      const hourBucket = Math.floor(d.getHours() / 3);
      const engagement = (post.likes ?? 0) + (post.comments ?? 0) + (post.shares ?? 0);
      grid[day][hourBucket].count += 1;
      grid[day][hourBucket].engagement += engagement;
      if (grid[day][hourBucket].engagement > maxEngagement) {
        maxEngagement = grid[day][hourBucket].engagement;
      }
    }

    return { grid, maxEngagement };
  }, [posts]);

  if (heatmapData.maxEngagement === 0) return null;

  const getOpacity = (engagement: number) => {
    if (engagement === 0) return 0;
    return Math.max(0.15, engagement / heatmapData.maxEngagement);
  };

  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Clock className="w-3 h-3" /> Melhores Horários para Postar
      </h4>
      <div className="p-3 rounded-xl bg-foreground/[0.03] border border-foreground/5">
        {/* Header row */}
        <div className="grid grid-cols-[40px_repeat(8,1fr)] gap-1 mb-1">
          <div />
          {HOURS.map(h => (
            <div key={h} className="text-center text-[9px] text-muted-foreground font-medium">
              {String(h).padStart(2, '0')}h
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-[40px_repeat(8,1fr)] gap-1">
          {DAYS.map((day, dayIdx) => (
            <>
              <div key={`label-${dayIdx}`} className="text-[10px] text-muted-foreground font-medium flex items-center">
                {day}
              </div>
              {heatmapData.grid[dayIdx].map((cell, hourIdx) => {
                const opacity = getOpacity(cell.engagement);
                return (
                  <div
                    key={`${dayIdx}-${hourIdx}`}
                    className="aspect-square rounded-md relative group cursor-default"
                    style={{
                      background: cell.engagement > 0
                        ? `hsl(var(--primary) / ${opacity})`
                        : 'hsl(var(--foreground) / 0.03)',
                    }}
                    title={cell.count > 0 ? `${cell.count} post(s), ${cell.engagement} interações` : 'Sem dados'}
                  >
                    {/* Tooltip on hover */}
                    {cell.count > 0 && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-popover border border-border rounded-lg text-[10px] text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                        {cell.count} post(s) · {cell.engagement} interações
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-end gap-1.5 mt-2">
          <span className="text-[9px] text-muted-foreground">Menos</span>
          {[0.1, 0.3, 0.5, 0.7, 1].map((o, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-sm"
              style={{ background: `hsl(var(--primary) / ${o})` }}
            />
          ))}
          <span className="text-[9px] text-muted-foreground">Mais</span>
        </div>
      </div>
    </div>
  );
});

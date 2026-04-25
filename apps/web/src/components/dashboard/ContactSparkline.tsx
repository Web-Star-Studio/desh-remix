import { useMemo } from "react";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";

export interface SparklineProps {
  contactId: string;
  allInteractions: { contact_id: string; interaction_date: string; type: string }[];
  score: number;
  /** Number of weeks to show, default 12 (~3 months) */
  weeks?: number;
}

/** Tiny sparkline showing weekly interaction count over the last N weeks */
export function Sparkline({ contactId, allInteractions, score, weeks = 12 }: SparklineProps) {
  const data = useMemo(() => {
    const now = Date.now();
    const buckets = Array.from({ length: weeks }, (_, i) => {
      const weekStart = now - (weeks - 1 - i) * 7 * 86400000;
      const weekEnd = weekStart + 7 * 86400000;
      const count = allInteractions.filter(r => {
        if (r.contact_id !== contactId) return false;
        const t = new Date(r.interaction_date).getTime();
        return t >= weekStart && t < weekEnd;
      }).length;
      return { count };
    });
    return buckets;
  }, [contactId, allInteractions, weeks]);

  const hasData = data.some(d => d.count > 0);
  if (!hasData) return null;

  // Pick colour from score
  const color =
    score >= 80 ? "hsl(var(--primary))"
    : score >= 55 ? "hsl(var(--primary))"
    : score >= 30 ? "hsl(38 92% 50%)"
    : "hsl(var(--muted-foreground))";

  return (
    <div className="w-16 h-5 flex-shrink-0" title="Evolução de interações — últimos 3 meses">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 1, right: 0, left: 0, bottom: 1 }}>
          <defs>
            <linearGradient id={`sg-${contactId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="bg-background/90 border border-foreground/10 rounded px-1.5 py-0.5 text-[9px] text-foreground shadow-sm">
                  {payload[0].value} interação{Number(payload[0].value) !== 1 ? "ões" : ""}
                </div>
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#sg-${contactId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

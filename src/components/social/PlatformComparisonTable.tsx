import { Trophy, Medal } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import { formatNumber } from "./utils";
import { cn } from "@/lib/utils";

interface PlatformData {
  name: string;
  followers: number;
  engagement: number;
  posts: number;
  color: string;
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1 rounded-full bg-foreground/[0.05] overflow-hidden mt-1">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.6 }}
      />
    </div>
  );
}

export function PlatformComparisonTable({ platformChartData }: { platformChartData: PlatformData[] }) {
  const filtered = platformChartData
    .filter(d => d.followers > 0 || d.engagement > 0 || d.posts > 0)
    .sort((a, b) => b.followers - a.followers);

  if (filtered.length === 0) return null;

  const maxFollowers = Math.max(...filtered.map(p => p.followers));
  const maxEngagement = Math.max(...filtered.map(p => p.engagement));

  return (
    <GlassCard size="auto">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2.5 mb-4">
        <div className="p-1 rounded-md bg-amber-500/10">
          <Trophy className="w-3.5 h-3.5 text-amber-500" />
        </div>
        Comparativo entre Plataformas
      </h3>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-foreground/[0.06]">
              <th className="text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider py-2.5 pr-3 pl-1 w-8">#</th>
              <th className="text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider py-2.5 pr-4">Plataforma</th>
              <th className="text-right text-[10px] font-medium text-muted-foreground uppercase tracking-wider py-2.5 px-3 w-[140px]">Seguidores</th>
              <th className="text-right text-[10px] font-medium text-muted-foreground uppercase tracking-wider py-2.5 px-3 w-[140px]">Engajamento</th>
              <th className="text-right text-[10px] font-medium text-muted-foreground uppercase tracking-wider py-2.5 pl-3 w-[90px]">Posts</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, idx) => (
              <tr
                key={p.name}
                className="border-b border-foreground/[0.03] last:border-0 hover:bg-foreground/[0.02] transition-colors"
              >
                <td className="py-3.5 pr-3 pl-1">
                  {idx === 0 ? (
                    <Medal className="w-4 h-4 text-amber-500" />
                  ) : idx === 1 ? (
                    <Medal className="w-4 h-4 text-zinc-400" />
                  ) : (
                    <span className="text-xs text-muted-foreground font-medium pl-0.5">{idx + 1}</span>
                  )}
                </td>
                <td className="py-3.5 pr-4">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{
                        background: p.color,
                        boxShadow: `0 0 8px ${p.color}30`,
                      }}
                    />
                    <span className="font-medium text-foreground text-sm">{p.name}</span>
                  </div>
                </td>
                <td className="py-3.5 px-3">
                  <div>
                    <div className="text-right">
                      <span className={cn(
                        "font-semibold tabular-nums text-sm",
                        idx === 0 ? "text-foreground" : "text-foreground/75"
                      )}>
                        {formatNumber(p.followers)}
                      </span>
                    </div>
                    <ProgressBar value={p.followers} max={maxFollowers} color={p.color} />
                  </div>
                </td>
                <td className="py-3.5 px-3">
                  <div>
                    <div className="text-right">
                      <span className={cn(
                        "font-semibold tabular-nums text-sm",
                        p.engagement === maxEngagement && p.engagement > 0 ? "text-foreground" : "text-foreground/75"
                      )}>
                        {p.engagement > 0 ? `${p.engagement.toFixed(1)}%` : "—"}
                      </span>
                    </div>
                    {p.engagement > 0 && <ProgressBar value={p.engagement} max={maxEngagement} color={p.color} />}
                  </div>
                </td>
                <td className="text-right py-3.5 pl-3 tabular-nums text-foreground/75 font-medium text-sm">
                  {p.posts > 0 ? formatNumber(p.posts) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

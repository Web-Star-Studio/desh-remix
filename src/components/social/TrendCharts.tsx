import { memo } from "react";
import { TrendingUp, Users } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import { formatNumber } from "./utils";
import { useSocialTrend } from "@/hooks/social/useSocialTrend";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { Period } from "./PeriodSelector";

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

const tooltipStyle = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '12px',
  fontSize: '12px',
  boxShadow: '0 8px 24px -4px hsl(var(--foreground) / 0.08)',
};

export const TrendCharts = memo(function TrendCharts({ period }: { period: Period }) {
  const { trendData, hasTrend } = useSocialTrend(period);

  if (!hasTrend) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Followers trend */}
      <GlassCard size="auto">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
          <div className="p-1 rounded-md bg-primary/10">
            <Users className="w-3.5 h-3.5 text-primary" />
          </div>
          Evolução de Seguidores
        </h3>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="gradFollowers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatDate}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatNumber(v)}
                width={40}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={formatDate}
                formatter={(value: number) => [formatNumber(value), "Seguidores"]}
              />
              <Area
                type="monotone"
                dataKey="followers"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#gradFollowers)"
                dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      {/* Engagement trend */}
      <GlassCard size="auto">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
          <div className="p-1 rounded-md bg-violet-500/10">
            <TrendingUp className="w-3.5 h-3.5 text-violet-500" />
          </div>
          Evolução do Engajamento
        </h3>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="gradEngagement" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatDate}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                unit="%"
                width={36}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={formatDate}
                formatter={(value: number) => [`${value.toFixed(1)}%`, "Engajamento"]}
              />
              <Area
                type="monotone"
                dataKey="engagement"
                stroke="#8b5cf6"
                strokeWidth={2}
                fill="url(#gradEngagement)"
                dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </div>
  );
});

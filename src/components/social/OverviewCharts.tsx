import GlassCard from "@/components/dashboard/GlassCard";
import { formatNumber } from "./utils";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

interface PlatformData {
  name: string;
  followers: number;
  engagement: number;
  posts: number;
  color: string;
}

const tooltipStyle = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '12px',
  fontSize: '12px',
  boxShadow: '0 8px 24px -4px hsl(var(--foreground) / 0.08)',
};

export function OverviewCharts({ platformChartData }: { platformChartData: PlatformData[] }) {
  const withFollowers = platformChartData.filter(d => d.followers > 0);
  const withEngagement = platformChartData.filter(d => d.engagement > 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Followers distribution donut */}
      <GlassCard size="auto">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          Distribuição de Seguidores
        </h3>
        <div className="h-52 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={withFollowers}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={78}
                paddingAngle={4}
                dataKey="followers"
                strokeWidth={0}
              >
                {withFollowers.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} opacity={0.85} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number) => [formatNumber(value), "Seguidores"]}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-xl font-bold text-foreground tabular-nums">
                {formatNumber(withFollowers.reduce((s, d) => s + d.followers, 0))}
              </p>
              <p className="text-[10px] text-muted-foreground">total</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-2">
          {withFollowers.map(d => (
            <div key={d.name} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="text-[10px] text-muted-foreground">{d.name}</span>
              <span className="text-[10px] font-medium text-foreground/60 tabular-nums">{formatNumber(d.followers)}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Engagement bar chart */}
      <GlassCard size="auto">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
          Engajamento por Plataforma
        </h3>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={withEngagement} barSize={28} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
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
                formatter={(value: number) => [`${value.toFixed(1)}%`, "Engajamento"]}
                cursor={{ fill: 'hsl(var(--foreground) / 0.03)' }}
              />
              <Bar dataKey="engagement" radius={[8, 8, 0, 0]}>
                {withEngagement.map((entry, index) => (
                  <Cell key={`bar-${index}`} fill={entry.color} opacity={0.75} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </div>
  );
}

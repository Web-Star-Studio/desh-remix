import { useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { format, subDays, startOfDay, startOfWeek, startOfMonth, subWeeks, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

type Period = "daily" | "weekly" | "monthly";

interface UserGrowthChartProps {
  users: { created_at: string }[];
}

const UserGrowthChart = ({ users }: UserGrowthChartProps) => {
  const [period, setPeriod] = useState<Period>("daily");

  const chartData = useMemo(() => {
    if (!users.length) return [];

    const buildData = (
      intervals: number,
      getStart: (i: number) => Date,
      getEnd: (i: number) => Date,
      formatLabel: (d: Date) => string,
    ) => {
      const data: { label: string; count: number; cumulative: number }[] = [];
      // Count users created BEFORE the chart period for the correct cumulative base
      const periodStart = getStart(intervals - 1);
      let cumulative = users.filter(u => new Date(u.created_at) < periodStart).length;
      for (let i = intervals - 1; i >= 0; i--) {
        const start = getStart(i);
        const end = getEnd(i);
        const count = users.filter(u => {
          const d = new Date(u.created_at);
          return d >= start && d < end;
        }).length;
        cumulative += count;
        data.push({ label: formatLabel(start), count, cumulative });
      }
      return data;
    };

    if (period === "daily") {
      return buildData(
        30,
        i => startOfDay(subDays(new Date(), i)),
        i => startOfDay(subDays(new Date(), i - 1)),
        d => format(d, "dd/MM", { locale: ptBR }),
      );
    }
    if (period === "weekly") {
      return buildData(
        12,
        i => startOfWeek(subWeeks(new Date(), i), { locale: ptBR }),
        i => startOfWeek(subWeeks(new Date(), i - 1), { locale: ptBR }),
        d => format(d, "dd/MM", { locale: ptBR }),
      );
    }
    return buildData(
      12,
      i => startOfMonth(subMonths(new Date(), i)),
      i => startOfMonth(subMonths(new Date(), i - 1)),
      d => format(d, "MMM", { locale: ptBR }),
    );
  }, [users, period]);

  const periods: { id: Period; label: string }[] = [
    { id: "daily", label: "Diário" },
    { id: "weekly", label: "Semanal" },
    { id: "monthly", label: "Mensal" },
  ];

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Crescimento de Usuários</h3>
        <div className="flex gap-1 bg-white/[0.06] p-0.5 rounded-lg">
          {periods.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                period === p.id
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(0,0,0,0.7)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                fontSize: "11px",
                padding: "8px 12px",
                color: "white",
                backdropFilter: "blur(12px)",
              }}
              labelStyle={{ color: "white", fontWeight: 600 }}
              itemStyle={{ color: "rgba(255,255,255,0.7)" }}
              formatter={(value: number, name: string) => [
                value,
                name === "count" ? "Novos" : "Acumulado",
              ]}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#colorCount)"
              name="count"
            />
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth={1}
              strokeDasharray="4 4"
              fill="none"
              name="cumulative"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default UserGrowthChart;

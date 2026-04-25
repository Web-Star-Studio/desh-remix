import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from "recharts";

export interface MonthlyChartProps {
  contactId: string;
  allInteractions: { contact_id: string; interaction_date: string; type: string }[];
  /** Number of months to show, default 6 */
  months?: number;
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  call:    { label: "Ligação",  color: "hsl(var(--chart-2))" },
  email:   { label: "E-mail",  color: "hsl(var(--primary))" },
  meeting: { label: "Reunião", color: "hsl(var(--chart-4))" },
  note:    { label: "Nota",    color: "hsl(var(--muted-foreground))" },
};

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0);
  return (
    <div className="bg-background/95 border border-foreground/10 rounded-xl px-3 py-2 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        p.value > 0 && (
          <div key={p.dataKey} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: p.fill }} />
            <span className="text-muted-foreground">{p.name}:</span>
            <span className="font-medium text-foreground tabular-nums">{p.value}</span>
          </div>
        )
      ))}
      {total > 0 && (
        <div className="flex items-center gap-2 pt-1 border-t border-foreground/10">
          <span className="text-muted-foreground">Total:</span>
          <span className="font-bold text-foreground tabular-nums">{total}</span>
        </div>
      )}
    </div>
  );
};

export function ContactMonthlyChart({ contactId, allInteractions, months = 6 }: MonthlyChartProps) {
  const data = useMemo(() => {
    const now = new Date();
    return Array.from({ length: months }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const label = `${MONTH_NAMES[month]}/${String(year).slice(2)}`;

      const monthInts = allInteractions.filter(r => {
        if (r.contact_id !== contactId) return false;
        const intDate = new Date(r.interaction_date);
        return intDate.getFullYear() === year && intDate.getMonth() === month;
      });

      const entry: Record<string, any> = { month: label, total: monthInts.length };
      Object.keys(TYPE_CONFIG).forEach(type => {
        entry[type] = monthInts.filter(r => r.type === type).length;
      });
      return entry;
    });
  }, [contactId, allInteractions, months]);

  const hasData = data.some(d => d.total > 0);
  const maxVal = Math.max(...data.map(d => d.total), 1);

  return (
    <div className="w-full">
      {/* Summary chips */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {Object.entries(TYPE_CONFIG).map(([type, cfg]) => {
          const total = data.reduce((s, d) => s + (d[type] || 0), 0);
          if (total === 0) return null;
          return (
            <span key={type} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-foreground/5">
              <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: cfg.color }} />
              <span className="text-muted-foreground">{cfg.label}:</span>
              <span className="font-semibold text-foreground tabular-nums">{total}</span>
            </span>
          );
        })}
        {!hasData && (
          <span className="text-[10px] text-muted-foreground italic">Nenhuma interação nos últimos {months} meses</span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barGap={2}>
          <CartesianGrid
            vertical={false}
            strokeDasharray="3 3"
            stroke="hsl(var(--foreground) / 0.06)"
          />
          <XAxis
            dataKey="month"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            dy={4}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            domain={[0, Math.ceil(maxVal * 1.2) || 1]}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--foreground) / 0.04)", radius: 4 }} />
          <Legend
            iconType="square"
            iconSize={8}
            wrapperStyle={{ fontSize: "9px", paddingTop: "6px" }}
            formatter={(value) => (
              <span style={{ color: "hsl(var(--muted-foreground))" }}>
                {TYPE_CONFIG[value]?.label || value}
              </span>
            )}
          />
          {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
            <Bar
              key={type}
              dataKey={type}
              name={type}
              stackId="a"
              fill={cfg.color}
              radius={type === "note" ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              isAnimationActive
              animationDuration={600}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

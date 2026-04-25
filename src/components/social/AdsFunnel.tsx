import { formatNumber } from "./utils";

interface FunnelData {
  impressions: number;
  clicks: number;
  conversions: number;
}

interface AdsFunnelProps {
  data: FunnelData;
}

export function AdsFunnel({ data }: AdsFunnelProps) {
  if (data.impressions === 0) return null;

  const ctr = data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0;
  const convRate = data.clicks > 0 ? (data.conversions / data.clicks) * 100 : 0;

  const steps = [
    { label: "Impressões", value: data.impressions, width: 100 },
    { label: "Cliques", value: data.clicks, width: data.impressions > 0 ? Math.max(20, (data.clicks / data.impressions) * 100) : 0 },
    { label: "Conversões", value: data.conversions, width: data.impressions > 0 ? Math.max(10, (data.conversions / data.impressions) * 100) : 0 },
  ];

  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-3">
          <span className="text-[11px] font-medium text-muted-foreground w-20 shrink-0 text-right">{step.label}</span>
          <div className="flex-1 relative">
            <div
              className="h-8 rounded-lg flex items-center px-3 transition-all duration-500"
              style={{
                width: `${step.width}%`,
                background: i === 0
                  ? 'hsl(var(--primary) / 0.15)'
                  : i === 1
                  ? 'hsl(var(--primary) / 0.3)'
                  : 'hsl(var(--primary) / 0.5)',
              }}
            >
              <span className="text-xs font-bold text-foreground tabular-nums">
                {formatNumber(step.value)}
              </span>
            </div>
          </div>
          {/* Conversion rate between steps */}
          {i === 0 && ctr > 0 && (
            <span className="text-[10px] text-muted-foreground w-14 shrink-0">{ctr.toFixed(1)}% CTR</span>
          )}
          {i === 1 && convRate > 0 && (
            <span className="text-[10px] text-muted-foreground w-14 shrink-0">{convRate.toFixed(1)}% conv</span>
          )}
          {((i === 0 && ctr === 0) || (i === 1 && convRate === 0) || i === 2) && (
            <span className="w-14 shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

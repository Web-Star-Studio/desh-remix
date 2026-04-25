import { CheckCircle2, Plug } from "lucide-react";

interface Props {
  connectedCount: number;
  totalCount: number;
  loading?: boolean;
}

export function IntegrationsProgressBar({ connectedCount, totalCount, loading }: Props) {
  const pct = totalCount > 0 ? (connectedCount / totalCount) * 100 : 0;

  return (
    <div className="rounded-xl border border-border/30 bg-background/60 backdrop-blur-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plug className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            {loading && connectedCount === 0
              ? "Carregando serviços..."
              : `${connectedCount} de ${totalCount} serviços conectados`}
          </span>
          {loading && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-[pulse_1s_ease-in-out_infinite]" />
              Atualizando
            </span>
          )}
        </div>
        {connectedCount > 0 && !loading && (
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">{Math.round(pct)}%</span>
          </div>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-foreground/[0.08] overflow-hidden">
        {loading ? (
          <div className="h-full w-full rounded-full bg-gradient-to-r from-transparent via-primary/40 to-transparent animate-[shimmer_1.5s_ease-in-out_infinite]" />
        ) : (
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}

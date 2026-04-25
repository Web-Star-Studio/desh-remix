import { AlertTriangle, DatabaseZap, RefreshCw, StopCircle, X, Loader2, CheckCircle2, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AccountSyncInfo {
  email: string;
  color: string;
  lastSyncedAt?: string | null;
  totalSynced?: number;
}

interface GmailSyncPanelProps {
  isSyncing: boolean;
  isLoadingCache: boolean;
  syncCompleted: boolean;
  syncHasMore: boolean;
  hasCache: boolean;
  cachedCount: number;
  syncProgress: { synced: number; totalSynced: number };
  syncState: { totalSynced?: number; lastSyncedAt?: string } | null;
  syncError?: { message: string; timestamp: number; retryCount: number } | null;
  activeFolder: string;
  onStartSync: (folder: string) => void;
  onContinueSync: (folder: string) => void;
  onStopSync: () => void;
  onIncrementalSync: (folder: string) => void;
  onClearError?: () => void;
  accountSyncInfo?: AccountSyncInfo[];
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "nunca";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return "agora";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}min`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h`;
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

const GmailSyncPanel = ({
  isSyncing, syncCompleted, syncHasMore, hasCache, cachedCount,
  syncProgress, syncState, syncError, activeFolder,
  onStartSync, onContinueSync, onStopSync, onIncrementalSync, onClearError,
  accountSyncInfo,
}: GmailSyncPanelProps) => {
  if (syncError && !isSyncing) {
    return (
      <div className="mt-2 inline-flex items-center gap-1.5 py-0.5 px-2 rounded-md bg-destructive/10 border border-destructive/20 flex-wrap max-w-full">
        <AlertTriangle className="w-2.5 h-2.5 text-destructive shrink-0" />
        <span className="text-[11px] text-destructive font-medium truncate max-w-[200px] sm:max-w-none">
          Erro: {syncError.message}
          {syncError.retryCount > 1 && <span className="text-muted-foreground ml-1">({syncError.retryCount}x)</span>}
        </span>
        <button onClick={() => onIncrementalSync(activeFolder)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors shrink-0">
          <RefreshCw className="w-2.5 h-2.5" /> Tentar
        </button>
        {onClearError && (
          <button onClick={onClearError} className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <X className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 inline-flex items-center gap-1.5 py-0.5 px-2 rounded-md bg-foreground/8 border border-foreground/15 flex-wrap max-w-full">
      {isSyncing ? (
        <>
          <Loader2 className="w-2.5 h-2.5 text-primary shrink-0 animate-spin" />
          <span className="text-[11px] text-foreground font-medium truncate">Sincronizando... {syncProgress.totalSynced}</span>
          <Progress value={syncProgress.totalSynced > 0 ? Math.min(100, syncProgress.synced / Math.max(1, syncProgress.totalSynced) * 100) : 0} className="w-16 h-1" />
          <button onClick={onStopSync} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-foreground/10 text-muted-foreground hover:text-foreground hover:bg-foreground/15 transition-colors shrink-0">
            <StopCircle className="w-2.5 h-2.5" /> Parar
          </button>
        </>
      ) : syncCompleted ? (
        <>
          <CheckCircle2 className="w-2.5 h-2.5 text-green-500 shrink-0" />
          <span className="text-[11px] text-foreground">
            <span className="text-primary font-medium">{syncState?.totalSynced ?? cachedCount}</span> sync
            {syncState?.lastSyncedAt && <span className="text-muted-foreground ml-1">· {formatRelativeTime(syncState.lastSyncedAt)}</span>}
          </span>
          {/* Per-account status dots */}
          {accountSyncInfo && accountSyncInfo.length > 1 && (
            <TooltipProvider delayDuration={300}>
              <div className="inline-flex items-center gap-0.5 ml-0.5">
                {accountSyncInfo.map((acct, i) => (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <span className="w-2 h-2 rounded-full shrink-0 cursor-help" style={{ backgroundColor: acct.color }} />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      <p className="font-medium">{acct.email}</p>
                      <p className="text-muted-foreground">
                        {acct.totalSynced ?? 0} msgs · {formatRelativeTime(acct.lastSyncedAt)}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          )}
          <button onClick={() => onIncrementalSync(activeFolder)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-foreground/10 text-muted-foreground hover:text-foreground hover:bg-foreground/15 transition-colors shrink-0">
            <RefreshCw className="w-2.5 h-2.5" /> Atualizar
          </button>
        </>
      ) : syncHasMore ? (
        <>
          <Clock className="w-2.5 h-2.5 text-yellow-500 shrink-0" />
          <span className="text-[11px] text-muted-foreground">Pausado · {syncState?.totalSynced ?? 0} carregados</span>
          <button onClick={() => onContinueSync(activeFolder)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-primary/15 text-primary hover:bg-primary/25 transition-colors shrink-0">
            <RefreshCw className="w-2.5 h-2.5" /> Continuar
          </button>
        </>
      ) : (
        <>
          <DatabaseZap className="w-2.5 h-2.5 text-primary shrink-0 animate-pulse" />
          <span className="text-[11px] text-muted-foreground">{hasCache ? `${cachedCount} em cache` : "Sincronizar histórico"}</span>
          <button onClick={() => onStartSync(activeFolder)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-primary/20 text-primary hover:bg-primary/30 font-medium transition-colors shrink-0">
            <DatabaseZap className="w-2.5 h-2.5" /> Sync
          </button>
        </>
      )}
    </div>
  );
};

export default GmailSyncPanel;

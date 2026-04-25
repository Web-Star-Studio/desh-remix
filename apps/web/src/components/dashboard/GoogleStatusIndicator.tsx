import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, CheckCircle2, WifiOff } from "lucide-react";
import { useComposioConnection } from "@/hooks/integrations/useComposioConnection";
import { invalidateAllGoogleCache } from "@/hooks/integrations/useGoogleServiceData";

const SYNC_CACHE_KEY = "desh-google-last-sync";

/** Reads/writes a unified "last sync" timestamp across all Google services */
function getLastSync(): number | null {
  try {
    const raw = localStorage.getItem(SYNC_CACHE_KEY);
    return raw ? parseInt(raw, 10) : null;
  } catch { return null; }
}

export function recordGoogleSync() {
  try { localStorage.setItem(SYNC_CACHE_KEY, String(Date.now())); } catch {}
}

function formatTimeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 10) return "agora";
  if (diff < 60) return `${diff}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

const GOOGLE_TOOLKITS = ["gmail", "googlecalendar", "googletasks", "googledrive", "googlecontacts"];

const GoogleStatusIndicator = () => {
  const { connectedToolkits, isConnected } = useComposioConnection();
  const [lastSync, setLastSync] = useState<number | null>(getLastSync);
  const [tick, setTick] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const hasAnyGoogle = GOOGLE_TOOLKITS.some(t => isConnected(t));

  const handleRefresh = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRefreshing(true);
    invalidateAllGoogleCache();
    setTimeout(() => setIsRefreshing(false), 2000);
  }, []);

  // Refresh display every 30s
  useEffect(() => {
    const id = setInterval(() => {
      setLastSync(getLastSync());
      setTick(t => t + 1);
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  // Listen for storage changes (when service data updates)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SYNC_CACHE_KEY && e.newValue) {
        setLastSync(parseInt(e.newValue, 10));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!hasAnyGoogle) {
    return (
      <Link to="/integrations" className="inline-flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
        <WifiOff className="w-2.5 h-2.5" />
        Google desconectado
      </Link>
    );
  }

  const googleCount = connectedToolkits.filter(t =>
    GOOGLE_TOOLKITS.includes(t.toLowerCase())
  ).length;

  return (
    <span className="inline-flex items-center gap-1.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
      <Link to="/integrations" className="inline-flex items-center gap-1.5 text-[10px] text-white/60 hover:text-white/90 transition-colors">
        <CheckCircle2 className="w-2.5 h-2.5 text-green-400/80 flex-shrink-0" />
        <span className="text-white/70">Google ({googleCount} serviços)</span>
        {lastSync && (
          <>
            <span className="text-white/30">·</span>
            <span className="text-white/40">{formatTimeAgo(lastSync)}</span>
          </>
        )}
      </Link>
      <button
        onClick={handleRefresh}
        title="Forçar sincronização"
        className="text-white/40 hover:text-white/80 transition-colors"
      >
        <RefreshCw className={`w-2.5 h-2.5 ${isRefreshing ? "animate-spin text-white/70" : ""}`} />
      </button>
    </span>
  );
};

export default GoogleStatusIndicator;

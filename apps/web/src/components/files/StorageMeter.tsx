import { useState, useEffect, memo } from "react";
import { useFileStorage } from "@/hooks/files/useFileStorage";
import GlassCard from "@/components/dashboard/GlassCard";
import { motion } from "framer-motion";
import {
  HardDrive, FileText, Image, Video, Music, Archive,
  Copy, Loader2, TrendingUp,
} from "lucide-react";

const categoryConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  document: { icon: FileText, color: "bg-blue-500", label: "Documentos" },
  image: { icon: Image, color: "bg-emerald-500", label: "Imagens" },
  video: { icon: Video, color: "bg-purple-500", label: "Vídeos" },
  audio: { icon: Music, color: "bg-pink-500", label: "Áudio" },
  archive: { icon: Archive, color: "bg-amber-500", label: "Arquivos" },
};

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
};

interface StorageStats {
  total_files: number;
  total_size: number;
  trashed_files: number;
  trashed_size: number;
  by_category: { category: string; count: number; size: number }[];
  duplicates: number;
}

const StorageMeter = memo(() => {
  const { getStats } = useFileStorage();
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const result = await getStats();
        if (result?.stats) setStats(result.stats as StorageStats);
      } finally {
        setLoading(false);
      }
    })();
  }, [getStats]);

  if (loading) {
    return (
      <GlassCard className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </GlassCard>
    );
  }

  if (!stats) return null;

  const LIMIT = 5 * 1073741824; // 5 GB
  const usagePercent = Math.min((stats.total_size / LIMIT) * 100, 100);

  return (
    <GlassCard className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-primary" />
          Armazenamento
        </h3>
        <span className="text-xs text-muted-foreground">
          {formatBytes(stats.total_size)} / {formatBytes(LIMIT)}
        </span>
      </div>

      {/* Stacked category bar */}
      <div className="w-full h-3 rounded-full bg-foreground/10 overflow-hidden flex">
        {stats.by_category?.length > 0 ? (
          stats.by_category.map((cat) => {
            const pct = LIMIT > 0 ? (cat.size / LIMIT) * 100 : 0;
            const config = categoryConfig[cat.category] || { color: "bg-muted-foreground/40" };
            return (
              <motion.div
                key={cat.category}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(pct, 0.5)}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={`h-full ${config.color} first:rounded-l-full last:rounded-r-full`}
                title={`${cat.category}: ${formatBytes(cat.size)}`}
              />
            );
          })
        ) : (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${usagePercent}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`h-full rounded-full ${
              usagePercent > 90 ? "bg-destructive" : usagePercent > 70 ? "bg-yellow-500" : "bg-primary"
            }`}
          />
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-2 rounded-lg bg-foreground/8">
          <p className="text-lg font-bold text-foreground">{stats.total_files}</p>
          <p className="text-[10px] text-muted-foreground">Arquivos</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-foreground/8">
          <p className="text-lg font-bold text-foreground">{stats.trashed_files}</p>
          <p className="text-[10px] text-muted-foreground">Na lixeira</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-foreground/8">
          <p className="text-lg font-bold text-foreground">{stats.duplicates}</p>
          <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
            <Copy className="w-3 h-3" /> Duplicatas
          </p>
        </div>
      </div>

      {/* By category with colored dots */}
      {stats.by_category?.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Por categoria</p>
          {stats.by_category.map((cat) => {
            const config = categoryConfig[cat.category] || { icon: FileText, color: "bg-muted-foreground", label: cat.category };
            const Icon = config.icon;
            const catPercent = stats.total_size > 0 ? (cat.size / stats.total_size) * 100 : 0;
            return (
              <div key={cat.category} className="flex items-center gap-2 text-xs">
                <div className={`w-2 h-2 rounded-full ${config.color} shrink-0`} />
                <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{config.label}</span>
                <span className="text-muted-foreground">{cat.count}</span>
                <span className="text-muted-foreground w-16 text-right">{formatBytes(cat.size)}</span>
                <div className="w-12 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${config.color}`}
                    style={{ width: `${catPercent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trashed size note */}
      {stats.trashed_size > 0 && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          {formatBytes(stats.trashed_size)} na lixeira — esvaziar para liberar espaço
        </p>
      )}
    </GlassCard>
  );
});

StorageMeter.displayName = "StorageMeter";

export default StorageMeter;

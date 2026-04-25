import { useState, useEffect } from "react";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  History, Download, Loader2, FileText, Upload,
} from "lucide-react";

interface Version {
  id: string;
  name: string;
  version: number;
  size_bytes: number;
  created_at: string;
}

interface VersionHistoryProps {
  fileId: string;
  onClose: () => void;
}

const formatSize = (bytes: number) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const VersionHistory = ({ fileId, onClose }: VersionHistoryProps) => {
  const { invoke } = useEdgeFn();
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await invoke<{ versions: Version[] }>({
        fn: "files-storage",
        body: { action: "list-versions", fileId },
      });
      if (data?.versions) setVersions(data.versions);
      setLoading(false);
    })();
  }, [fileId, invoke]);

  const handleDownload = async (version: Version) => {
    const { data, error } = await invoke<{ url: string; name: string }>({
      fn: "files-storage",
      body: { action: "get-download-url", fileId: version.id },
    });
    if (data?.url) {
      const a = document.createElement("a");
      a.href = data.url;
      a.download = data.name;
      a.click();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <History className="w-4 h-4 text-primary" />
          Histórico de Versões
        </h4>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
          Fechar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        </div>
      ) : versions.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Nenhuma versão anterior</p>
      ) : (
        <div className="space-y-1">
          <AnimatePresence>
            {versions.map((v, i) => (
              <motion.div
                key={v.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="group flex items-center gap-2 p-2 rounded-lg hover:bg-muted/40 transition-all"
              >
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">v{v.version}</span>
                    {i === 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-primary/10 text-primary font-medium">
                        Atual
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(v.created_at).toLocaleString("pt-BR")} · {formatSize(v.size_bytes)}
                  </p>
                </div>
                <button
                  onClick={() => handleDownload(v)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-muted text-muted-foreground"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default VersionHistory;

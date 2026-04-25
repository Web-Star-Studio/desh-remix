import { useState, useEffect, useCallback, memo } from "react";
import { useFileStorage } from "@/hooks/files/useFileStorage";
import { toast } from "@/hooks/use-toast";
import GlassCard from "@/components/dashboard/GlassCard";
import {
  Inbox, Download, Mail, MessageSquare, FolderInput,
  Loader2, XCircle, CheckSquare, Square, RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FileInboxItem {
  id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  r2_temp_key: string | null;
  source: string;
  source_label: string | null;
  sender: string | null;
  mime_type: string;
  size_bytes: number;
  status: string;
  imported_file_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const sourceConfig: Record<string, { icon: any; label: string; color: string }> = {
  email: { icon: Mail, label: "E-mail", color: "text-orange-400" },
  whatsapp: { icon: MessageSquare, label: "WhatsApp", color: "text-green-400" },
  drive: { icon: FolderInput, label: "Drive", color: "text-blue-400" },
  other: { icon: Inbox, label: "Outro", color: "text-muted-foreground" },
};

const formatSize = (bytes: number) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const FileInbox = memo(() => {
  const [items, setItems] = useState<FileInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { listInbox, importInboxItem, ignoreInboxItem } = useFileStorage();

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listInbox();
      if (result?.items) setItems(result.items as FileInboxItem[]);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [listInbox]);

  useEffect(() => { fetchInbox(); }, [fetchInbox]);

  const markProcessing = (id: string) => setProcessingIds((p) => new Set(p).add(id));
  const unmarkProcessing = (id: string) => setProcessingIds((p) => { const n = new Set(p); n.delete(id); return n; });

  const handleDismiss = async (id: string) => {
    markProcessing(id);
    try {
      await ignoreInboxItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      toast({ title: "Arquivo ignorado" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      unmarkProcessing(id);
    }
  };

  const handleImport = async (item: FileInboxItem) => {
    markProcessing(item.id);
    try {
      await importInboxItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(item.id); return n; });
      toast({ title: "Arquivo importado!", description: item.file_name });
    } catch (err: any) {
      toast({ title: "Erro ao importar", description: err.message, variant: "destructive" });
    } finally {
      unmarkProcessing(item.id);
    }
  };

  /* ── Batch actions ── */

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map((i) => i.id)));
  };

  const handleBatchImport = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      const item = items.find((i) => i.id === id);
      if (item) await handleImport(item);
    }
  };

  const handleBatchDismiss = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Ignorar ${selectedIds.size} arquivo(s)?`)) return;
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await handleDismiss(id);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <GlassCard className="flex flex-col items-center justify-center py-12 text-center gap-2">
        <Inbox className="w-10 h-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Nenhum arquivo pendente</p>
        <p className="text-xs text-muted-foreground/60">
          Arquivos recebidos por e-mail ou WhatsApp aparecerão aqui
        </p>
        <button onClick={fetchInbox} className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <RefreshCw className="w-3 h-3" /> Atualizar
        </button>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Inbox className="w-4 h-4 text-primary" />
          Inbox de Arquivos
          <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
            {items.length}
          </span>
        </h3>
        <div className="flex items-center gap-1">
          <button onClick={fetchInbox} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" title="Atualizar">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Batch action bar */}
      {selectedIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 mb-2"
        >
          <span className="text-xs font-medium text-primary">{selectedIds.size} selecionado(s)</span>
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={handleBatchImport}
              className="px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20"
            >
              Importar todos
            </button>
            <button
              onClick={handleBatchDismiss}
              className="px-2.5 py-1 rounded-md text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              Ignorar todos
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="p-1 rounded-md hover:bg-muted text-muted-foreground">
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Select all */}
      <button onClick={selectAll} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1">
        {selectedIds.size === items.length && items.length > 0 ? (
          <CheckSquare className="w-3.5 h-3.5 text-primary" />
        ) : (
          <Square className="w-3.5 h-3.5" />
        )}
        {selectedIds.size === items.length && items.length > 0 ? "Desselecionar" : "Selecionar tudo"}
      </button>

      <AnimatePresence mode="popLayout">
        {items.map((item) => {
          const src = sourceConfig[item.source] || sourceConfig.other;
          const SrcIcon = src.icon;
          const isProcessing = processingIds.has(item.id);
          const isSelected = selectedIds.has(item.id);

          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className={`group flex items-center gap-3 p-3 rounded-xl bg-muted/20 hover:bg-muted/40 border transition-all ${
                isSelected ? "border-primary/30 bg-primary/5" : "border-transparent hover:border-border/50"
              }`}
            >
              {/* Checkbox */}
              <button onClick={() => toggleSelect(item.id)} className="shrink-0">
                {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
              </button>
              <SrcIcon className={`w-5 h-5 shrink-0 ${src.color}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.file_name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {src.label}
                  {item.sender && ` · ${item.sender}`}
                  {item.size_bytes > 0 && ` · ${formatSize(item.size_bytes)}`}
                  {" · "}
                  {new Date(item.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleImport(item)}
                  disabled={isProcessing}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-all disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} Importar
                </button>
                <button
                  onClick={() => handleDismiss(item.id)}
                  disabled={isProcessing}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
});

FileInbox.displayName = "FileInbox";

export default FileInbox;
import { useState, useEffect, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, RotateCcw, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Snapshot {
  id: string;
  content: string;
  title: string;
  timestamp: Date;
}

interface NoteVersionHistoryProps {
  noteId: string;
  currentContent: string;
  currentTitle: string;
  onRestore: (content: string) => void;
}

const MAX_SNAPSHOTS = 10;
const SNAPSHOT_INTERVAL = 60_000; // 1 minute

const NoteVersionHistory = memo(({ noteId, currentContent, currentTitle, onRestore }: NoteVersionHistoryProps) => {
  const [open, setOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const lastSnapshotRef = useRef<number>(0);
  const contentRef = useRef(currentContent);
  contentRef.current = currentContent;

  // Take periodic snapshots
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastSnapshotRef.current < SNAPSHOT_INTERVAL) return;
      if (!contentRef.current.trim()) return;

      lastSnapshotRef.current = now;
      setSnapshots(prev => {
        const snap: Snapshot = {
          id: `${noteId}-${now}`,
          content: contentRef.current,
          title: currentTitle,
          timestamp: new Date(),
        };
        return [snap, ...prev].slice(0, MAX_SNAPSHOTS);
      });
    }, SNAPSHOT_INTERVAL);

    return () => clearInterval(interval);
  }, [noteId, currentTitle]);

  // Reset snapshots when note changes
  useEffect(() => {
    setSnapshots([]);
    lastSnapshotRef.current = 0;
  }, [noteId]);

  const formatTime = (d: Date) => {
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return "agora";
    if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className={`p-2 rounded-xl transition-colors ${open ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
        aria-label="Histórico de versões"
        title="Histórico de versões"
      >
        <History className="w-3.5 h-3.5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-b border-border/20"
          >
            <div className="px-4 py-3 max-h-48 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> Versões recentes ({snapshots.length})
                </p>
                <button onClick={() => setOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              </div>
              {snapshots.length === 0 ? (
                <p className="text-xs text-muted-foreground/50 py-2">
                  Versões serão salvas automaticamente a cada minuto de edição.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {snapshots.map(snap => (
                    <div key={snap.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-foreground truncate">{snap.title}</p>
                        <p className="text-[10px] text-muted-foreground">{formatTime(snap.timestamp)}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs gap-1"
                        onClick={() => {
                          onRestore(snap.content);
                          setOpen(false);
                        }}
                      >
                        <RotateCcw className="w-3 h-3" /> Restaurar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

NoteVersionHistory.displayName = "NoteVersionHistory";
export default NoteVersionHistory;

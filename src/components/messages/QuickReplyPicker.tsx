/**
 * QuickReplyPicker — Dropdown that shows saved quick replies + management.
 */
import { memo, useState } from "react";
import { Zap, Plus, Trash2, Edit2, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuickReplies } from "@/hooks/messages/useQuickReplies";
import DeshTooltip from "@/components/ui/DeshTooltip";

interface QuickReplyPickerProps {
  onSelect: (text: string) => void;
}

export const QuickReplyPicker = memo(function QuickReplyPicker({ onSelect }: QuickReplyPickerProps) {
  const { replies, add, update, remove } = useQuickReplies();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");

  const handleAdd = async () => {
    if (!newTitle.trim() || !newBody.trim()) return;
    await add(newTitle.trim(), newBody.trim());
    setNewTitle("");
    setNewBody("");
    setAdding(false);
  };

  return (
    <div className="relative">
      <DeshTooltip label="Respostas rápidas">
        <button
          onClick={() => setOpen(!open)}
          className={`p-2 rounded-lg hover:bg-foreground/5 transition-colors flex-shrink-0 ${
            open ? "text-primary" : "text-muted-foreground hover:text-primary"
          }`}
        >
          <Zap className="w-4 h-4" />
        </button>
      </DeshTooltip>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="absolute bottom-full left-0 mb-2 w-72 max-h-80 rounded-xl border border-border/40 bg-background/95 backdrop-blur-xl shadow-xl shadow-black/20 overflow-hidden z-40"
          >
            <div className="p-2 border-b border-foreground/5 flex items-center justify-between">
              <span className="text-xs font-medium text-foreground/80">Respostas Rápidas</span>
              <button
                onClick={() => { setAdding(!adding); setEditingId(null); }}
                className="p-1 rounded hover:bg-foreground/10 text-muted-foreground hover:text-primary transition-colors"
              >
                {adding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="overflow-y-auto max-h-60">
              {/* Add form */}
              <AnimatePresence>
                {adding && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="p-2 border-b border-foreground/5 space-y-1.5 overflow-hidden"
                  >
                    <input
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      placeholder="Título (ex: Saudação)"
                      className="w-full text-xs bg-foreground/5 rounded-lg px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground outline-none"
                      autoFocus
                    />
                    <textarea
                      value={newBody}
                      onChange={e => setNewBody(e.target.value)}
                      placeholder="Texto da resposta..."
                      rows={2}
                      className="w-full text-xs bg-foreground/5 rounded-lg px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground outline-none resize-none"
                    />
                    <button
                      onClick={handleAdd}
                      disabled={!newTitle.trim() || !newBody.trim()}
                      className="w-full text-xs bg-primary text-primary-foreground rounded-lg py-1.5 hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      Salvar
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {replies.length === 0 && !adding && (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Nenhuma resposta salva.<br />
                  Clique em + para criar.
                </p>
              )}

              {replies.map(r => (
                <button
                  key={r.id}
                  onClick={() => { onSelect(r.body); setOpen(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-foreground/5 transition-colors border-b border-foreground/5 last:border-b-0 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">{r.title}</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); remove(r.id); }}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{r.body}</p>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

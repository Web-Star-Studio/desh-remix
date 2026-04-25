import { useState } from "react";
import { Users, X, Mail, Shield, Eye, Edit3, Trash2, Loader2, Share2 } from "lucide-react";
import DeshTooltip from "@/components/ui/DeshTooltip";
import type { NoteShareRecord, NotePresenceRecord } from "@/hooks/notes/useNoteSharing";

interface NoteShareDialogProps {
  open: boolean;
  onClose: () => void;
  shares: NoteShareRecord[];
  loading: boolean;
  onShare: (email: string, permission: "view" | "edit") => Promise<void>;
  onRemove: (shareId: string) => Promise<void>;
  onUpdatePermission: (shareId: string, permission: "view" | "edit") => Promise<void>;
}

export function NoteShareDialog({ open, onClose, shares, loading, onShare, onRemove, onUpdatePermission }: NoteShareDialogProps) {
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"view" | "edit">("view");

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    await onShare(email.trim(), permission);
    setEmail("");
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-96 max-h-[80vh] overflow-y-auto rounded-2xl border border-border/50 bg-popover shadow-2xl shadow-black/30 animate-in fade-in-0 zoom-in-95 duration-150 p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Compartilhar nota</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Add share form */}
        <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="E-mail do colaborador"
              className="w-full pl-8 pr-3 py-2 text-sm bg-foreground/5 rounded-xl border border-border/30 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <select
            value={permission}
            onChange={e => setPermission(e.target.value as "view" | "edit")}
            className="text-xs bg-foreground/5 rounded-xl border border-border/30 px-2 py-2 text-foreground outline-none"
          >
            <option value="view">Visualizar</option>
            <option value="edit">Editar</option>
          </select>
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="px-3 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Convidar"}
          </button>
        </form>

        {/* Current shares */}
        {shares.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium mb-2">Pessoas com acesso</p>
            {shares.map(share => (
              <div key={share.id} className="flex items-center justify-between p-2.5 rounded-xl bg-foreground/5 group">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {(share.user_email || share.shared_with_id).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-foreground truncate">{share.user_email || share.shared_with_id.slice(0, 8)}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      {share.permission === "edit" ? (
                        <><Edit3 className="w-2.5 h-2.5" /> Pode editar</>
                      ) : (
                        <><Eye className="w-2.5 h-2.5" /> Pode visualizar</>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DeshTooltip label={share.permission === "edit" ? "Alterar para visualizar" : "Alterar para editar"}>
                    <button
                      onClick={() => onUpdatePermission(share.id, share.permission === "edit" ? "view" : "edit")}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Shield className="w-3 h-3" />
                    </button>
                  </DeshTooltip>
                  <DeshTooltip label="Remover acesso">
                    <button
                      onClick={() => onRemove(share.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </DeshTooltip>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <Users className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Ninguém mais tem acesso a esta nota</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Presence bar (avatars of who's online) ──────────────────────

interface NotePresenceBarProps {
  presence: NotePresenceRecord[];
  editLock: NotePresenceRecord | null;
}

export function NotePresenceBar({ presence, editLock }: NotePresenceBarProps) {
  if (presence.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      {editLock && (
        <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
          <Edit3 className="w-2.5 h-2.5" />
          {editLock.user_name || "Alguém"} editando
        </span>
      )}
      <div className="flex -space-x-1.5">
        {presence.slice(0, 5).map(p => (
          <DeshTooltip key={p.user_id} label={`${p.user_name || p.user_email || "Anônimo"}${p.is_editing ? " (editando)" : " (visualizando)"}`}>
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-background ${
                p.is_editing
                  ? "bg-amber-500/25 text-amber-300 ring-1 ring-amber-500/50"
                  : "bg-primary/20 text-primary ring-1 ring-primary/30"
              }`}
            >
              {(p.user_name || p.user_email || "?").charAt(0).toUpperCase()}
            </div>
          </DeshTooltip>
        ))}
      </div>
      {presence.length > 5 && (
        <span className="text-[10px] text-muted-foreground">+{presence.length - 5}</span>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { WorkspaceShareModule, SharePermission } from "@/types/common";
import { MODULE_OPTIONS } from "@/hooks/workspace/useWorkspaceShares";
import {
  X, Send, Eye, Pencil, CheckCircle2,
  Globe, Lock,
} from "lucide-react";
import { MODULE_ICONS } from "./moduleIcons";

interface Workspace {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface Friend {
  user_id: string;
  display_name?: string;
  avatar_url?: string;
  email?: string | null;
}

interface ShareFormModalProps {
  open: boolean;
  onClose: () => void;
  workspaces: Workspace[];
  friends: Friend[];
  activeWorkspaceId?: string;
  onSubmit: (data: {
    shared_with: string;
    workspace_id: string;
    permission: SharePermission;
    share_all: boolean;
    modules: WorkspaceShareModule[];
  }) => Promise<void>;
}

export default function ShareFormModal({
  open, onClose, workspaces, friends, activeWorkspaceId, onSubmit,
}: ShareFormModalProps) {
  const [workspaceId, setWorkspaceId] = useState(activeWorkspaceId || "");
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [modules, setModules] = useState<WorkspaceShareModule[]>([]);
  const [friendId, setFriendId] = useState("");
  const [permission, setPermission] = useState<SharePermission>("view");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setWorkspaceId(activeWorkspaceId || workspaces[0]?.id || "");
      setMode("full");
      setModules([]);
      setFriendId("");
      setPermission("view");
    }
  }, [open, activeWorkspaceId]);

  const toggleModule = (mod: WorkspaceShareModule) => {
    setModules(prev => prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit({
        shared_with: friendId,
        workspace_id: workspaceId,
        permission,
        share_all: mode === "full",
        modules: mode === "full" ? [] : modules,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = friendId && workspaceId && friends.length > 0 && (mode === "full" || modules.length > 0) && !submitting;

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            className="glass-card p-6 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Compartilhar Workspace</h3>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Select workspace */}
            <div className="mb-4">
              <label className="text-xs text-muted-foreground mb-2 block">Workspace</label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto scrollbar-thin">
                {workspaces.map(ws => (
                  <button key={ws.id} onClick={() => setWorkspaceId(ws.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                      workspaceId === ws.id ? "bg-primary/15 border border-primary/30" : "bg-foreground/5 border border-transparent hover:bg-foreground/10"
                    }`}>
                    <span className="text-lg">{ws.icon}</span>
                    <span className="text-sm text-foreground font-medium">{ws.name}</span>
                    {workspaceId === ws.id && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Share mode */}
            <div className="mb-4">
              <label className="text-xs text-muted-foreground mb-2 block">Modo de compartilhamento</label>
              <div className="flex gap-2">
                <button onClick={() => setMode("full")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    mode === "full" ? "bg-primary/15 text-primary border border-primary/30" : "bg-foreground/5 text-muted-foreground border border-transparent"
                  }`}>
                  <Globe className="w-4 h-4" /> Completo
                </button>
                <button onClick={() => setMode("partial")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    mode === "partial" ? "bg-primary/15 text-primary border border-primary/30" : "bg-foreground/5 text-muted-foreground border border-transparent"
                  }`}>
                  <Lock className="w-4 h-4" /> Parcial
                </button>
              </div>
            </div>

            {/* Module selection */}
            {mode === "partial" && (
              <div className="mb-4">
                <label className="text-xs text-muted-foreground mb-2 block">Módulos para compartilhar</label>
                <p className="text-[10px] text-muted-foreground/70 mb-2">Produtividade</p>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {MODULE_OPTIONS.filter(o => o.group === "produtividade").map(opt => {
                    const Icon = MODULE_ICONS[opt.value];
                    const selected = modules.includes(opt.value);
                    return (
                      <button key={opt.value} onClick={() => toggleModule(opt.value)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl text-xs transition-all ${
                          selected ? "bg-primary/15 text-primary border border-primary/30" : "bg-foreground/5 text-muted-foreground border border-transparent hover:text-foreground"
                        }`}>
                        <Icon className="w-5 h-5" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground/70 mb-2">Financeiro</p>
                <div className="grid grid-cols-3 gap-2">
                  {MODULE_OPTIONS.filter(o => o.group === "financeiro").map(opt => {
                    const Icon = MODULE_ICONS[opt.value];
                    const selected = modules.includes(opt.value);
                    return (
                      <button key={opt.value} onClick={() => toggleModule(opt.value)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl text-xs transition-all ${
                          selected ? "bg-primary/15 text-primary border border-primary/30" : "bg-foreground/5 text-muted-foreground border border-transparent hover:text-foreground"
                        }`}>
                        <Icon className="w-5 h-5" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Friend select */}
            <div className="mb-4">
              <label className="text-xs text-muted-foreground mb-2 block">Amigo</label>
              {friends.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3 bg-foreground/5 rounded-xl">Adicione amigos primeiro na aba "Amigos"</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin">
                  {friends.map(f => (
                    <button key={f.user_id} onClick={() => setFriendId(f.user_id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                        friendId === f.user_id ? "bg-primary/15 border border-primary/30" : "bg-foreground/5 border border-transparent hover:bg-foreground/10"
                      }`}>
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm shrink-0">
                        {f.avatar_url ? <img src={f.avatar_url} loading="lazy" className="w-8 h-8 rounded-full object-cover" alt="" /> : "👤"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{f.display_name || f.email || "Usuário"}</p>
                        {f.email && f.display_name && <p className="text-[10px] text-muted-foreground truncate">{f.email}</p>}
                      </div>
                      {friendId === f.user_id && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Permission */}
            <div className="mb-6">
              <label className="text-xs text-muted-foreground mb-2 block">Permissão</label>
              <div className="flex gap-2">
                <button onClick={() => setPermission("view")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    permission === "view" ? "bg-foreground/10 text-foreground border border-foreground/20" : "bg-foreground/5 text-muted-foreground border border-transparent"
                  }`}>
                  <Eye className="w-4 h-4" /> Visualizar
                </button>
                <button onClick={() => setPermission("edit")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    permission === "edit" ? "bg-primary/15 text-primary border border-primary/30" : "bg-foreground/5 text-muted-foreground border border-transparent"
                  }`}>
                  <Pencil className="w-4 h-4" /> Editar
                </button>
              </div>
            </div>

            <button onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
              {submitting ? (
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <><Send className="w-4 h-4" /> Compartilhar</>
              )}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

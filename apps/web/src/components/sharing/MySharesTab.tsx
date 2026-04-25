import { useState } from "react";
import { motion } from "framer-motion";
import DeshTooltip from "@/components/ui/DeshTooltip";
import type { WorkspaceShare, WorkspaceShareModule, SharePermission } from "@/types/common";
import { MODULE_OPTIONS } from "@/hooks/workspace/useWorkspaceShares";
import {
  Eye, Pencil, Settings2, XCircle, Trash2, Plus,
  Globe, Lock, AlertTriangle, Sparkles,
} from "lucide-react";
import { MODULE_ICONS } from "./moduleIcons";
import ModuleBadges from "./ModuleBadges";
import { stagger, fadeUp } from "./animations";

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  accepted: { label: "Ativo", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  rejected: { label: "Recusado", cls: "bg-destructive/10 text-destructive" },
  revoked: { label: "Revogado", cls: "bg-foreground/10 text-muted-foreground" },
};



interface MySharesTabProps {
  myShares: WorkspaceShare[];
  onOpenShareForm: () => void;
  revokeShare: (id: string) => void;
  deleteShare: (id: string) => void;
  updatePermission: (id: string, perm: SharePermission) => void;
  updateModules: (id: string, shareAll: boolean, modules: WorkspaceShareModule[]) => void;
}

export default function MySharesTab({
  myShares, onOpenShareForm, revokeShare, deleteShare, updatePermission, updateModules,
}: MySharesTabProps) {
  const [editingShare, setEditingShare] = useState<string | null>(null);
  const [editModules, setEditModules] = useState<WorkspaceShareModule[]>([]);
  const [editShareAll, setEditShareAll] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleStartEditModules = (share: WorkspaceShare) => {
    setEditingShare(share.id);
    setEditShareAll(share.share_all);
    setEditModules(share.modules as WorkspaceShareModule[]);
  };

  const handleSaveModules = async () => {
    if (!editingShare) return;
    await updateModules(editingShare, editShareAll, editShareAll ? [] : editModules);
    setEditingShare(null);
  };

  const toggleEditModule = (mod: WorkspaceShareModule) => {
    setEditModules(prev => prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]);
  };

  const handleRevoke = (id: string) => {
    if (confirmRevoke === id) { revokeShare(id); setConfirmRevoke(null); }
    else { setConfirmRevoke(id); setTimeout(() => setConfirmRevoke(null), 3000); }
  };

  const handleDelete = (id: string) => {
    if (confirmDelete === id) { deleteShare(id); setConfirmDelete(null); }
    else { setConfirmDelete(id); setTimeout(() => setConfirmDelete(null), 3000); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
            <Eye className="w-3.5 h-3.5 text-primary" />
          </div>
          Meus Compartilhamentos
          <span className="text-xs text-muted-foreground font-normal">({myShares.length})</span>
        </h3>
        {myShares.length > 0 && (
          <button onClick={onOpenShareForm}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-all active:scale-95">
            <Plus className="w-3.5 h-3.5" /> Novo
          </button>
        )}
      </div>

      {myShares.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-7 h-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground mb-1">Nenhum compartilhamento ativo</p>
          <p className="text-xs text-muted-foreground/60 mb-4">Compartilhe workspaces com seus amigos</p>
          <button onClick={onOpenShareForm} className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all active:scale-95">
            <Plus className="w-4 h-4 inline mr-1.5" /> Compartilhar Workspace
          </button>
        </div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
          {myShares.map(share => {
            const st = STATUS_MAP[share.status] || STATUS_MAP.pending;
            return (
              <motion.div key={share.id} variants={fadeUp}
                className="glass-card p-4 hover:border-border/30 transition-all group">
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ring-1 ring-foreground/5" style={{ background: `${share.workspace_color || 'hsl(var(--primary))'}15` }}>
                    {share.workspace_icon || "📁"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{share.workspace_name || "Workspace"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      → {share.recipient_name || "Usuário"}
                      {share.recipient_email && share.recipient_name !== share.recipient_email ? ` · ${share.recipient_email}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                      share.permission === "edit" ? "bg-primary/10 text-primary" : "bg-foreground/10 text-muted-foreground"
                    }`}>
                      {share.permission === "edit" ? <><Pencil className="w-2.5 h-2.5" /> Editar</> : <><Eye className="w-2.5 h-2.5" /> Ver</>}
                    </span>
                  </div>
                </div>

                <div className="mb-2.5">
                  <ModuleBadges share={share} />
                </div>

                {/* Edit modules inline */}
                {editingShare === share.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                    className="mb-3 p-3 rounded-xl bg-foreground/[0.03] border border-border/20">
                    <div className="flex gap-2 mb-2">
                      <button onClick={() => { setEditShareAll(true); setEditModules([]); }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${editShareAll ? "bg-primary/15 text-primary border border-primary/30" : "bg-foreground/5 text-muted-foreground border border-transparent"}`}>
                        <Globe className="w-3 h-3 inline mr-1" /> Completo
                      </button>
                      <button onClick={() => setEditShareAll(false)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${!editShareAll ? "bg-primary/15 text-primary border border-primary/30" : "bg-foreground/5 text-muted-foreground border border-transparent"}`}>
                        <Lock className="w-3 h-3 inline mr-1" /> Parcial
                      </button>
                    </div>
                    {!editShareAll && (
                      <div className="grid grid-cols-3 gap-1.5">
                        {MODULE_OPTIONS.map(opt => {
                          const Icon = MODULE_ICONS[opt.value];
                          const selected = editModules.includes(opt.value);
                          return (
                            <button key={opt.value} onClick={() => toggleEditModule(opt.value)}
                              className={`flex flex-col items-center gap-1 p-2 rounded-lg text-[10px] transition-all ${
                                selected ? "bg-primary/15 text-primary border border-primary/30" : "bg-foreground/5 text-muted-foreground border border-transparent hover:bg-foreground/10"
                              }`}>
                              <Icon className="w-4 h-4" />
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex gap-2 mt-2">
                      <button onClick={handleSaveModules} className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all active:scale-95">Salvar</button>
                      <button onClick={() => setEditingShare(null)} className="py-1.5 px-3 rounded-lg bg-foreground/5 text-muted-foreground text-xs hover:bg-foreground/10 transition-colors">Cancelar</button>
                    </div>
                  </motion.div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1 pt-1 border-t border-border/10">
                  {share.status === "accepted" && (
                    <>
                      <DeshTooltip label="Editar módulos">
                        <button onClick={() => handleStartEditModules(share)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                          <Settings2 className="w-3.5 h-3.5" />
                        </button>
                      </DeshTooltip>
                      {share.permission === "view" && (
                        <DeshTooltip label="Dar permissão de edição">
                          <button onClick={() => updatePermission(share.id, "edit")}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </DeshTooltip>
                      )}
                      {share.permission === "edit" && (
                        <DeshTooltip label="Restringir para apenas ver">
                          <button onClick={() => updatePermission(share.id, "view")}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </DeshTooltip>
                      )}
                      <div className="flex-1" />
                      <DeshTooltip label={confirmRevoke === share.id ? "Confirmar revogação" : "Revogar acesso"}>
                        <button onClick={() => handleRevoke(share.id)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            confirmRevoke === share.id
                              ? "text-destructive bg-destructive/10"
                              : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          }`}>
                          {confirmRevoke === share.id ? <AlertTriangle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        </button>
                      </DeshTooltip>
                    </>
                  )}
                  {share.status === "pending" && (
                    <>
                      <div className="flex-1" />
                      <DeshTooltip label={confirmRevoke === share.id ? "Confirmar cancelamento" : "Cancelar convite"}>
                        <button onClick={() => handleRevoke(share.id)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            confirmRevoke === share.id
                              ? "text-destructive bg-destructive/10"
                              : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          }`}>
                          {confirmRevoke === share.id ? <AlertTriangle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        </button>
                      </DeshTooltip>
                    </>
                  )}
                  {(share.status === "revoked" || share.status === "rejected") && (
                    <>
                      <div className="flex-1" />
                      <DeshTooltip label={confirmDelete === share.id ? "Confirmar exclusão" : "Excluir"}>
                        <button onClick={() => handleDelete(share.id)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            confirmDelete === share.id
                              ? "text-destructive bg-destructive/10"
                              : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          }`}>
                          {confirmDelete === share.id ? <AlertTriangle className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </DeshTooltip>
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}

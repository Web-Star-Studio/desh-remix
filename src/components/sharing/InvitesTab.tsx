import { useState } from "react";
import { motion } from "framer-motion";
import type { WorkspaceShare } from "@/types/common";
import {
  UserPlus, Share2, CheckCircle2, XCircle, Clock, Sparkles, X, AlertTriangle,
} from "lucide-react";
import ModuleBadges from "./ModuleBadges";
import DeshTooltip from "@/components/ui/DeshTooltip";
import { stagger, fadeUp } from "./animations";

interface PendingRequest {
  id: string;
  from_display_name?: string;
  from_avatar_url?: string;
  from_email?: string;
}

interface SentRequest {
  id: string;
  to_display_name?: string;
  to_email?: string;
}

interface InvitesTabProps {
  pendingRequests: PendingRequest[];
  sentRequests: SentRequest[];
  pendingInvites: WorkspaceShare[];
  acceptRequest: (id: string) => void;
  rejectRequest: (id: string) => void;
  cancelRequest: (id: string) => void;
  acceptShare: (id: string) => void;
  rejectShare: (id: string) => void;
}

export default function InvitesTab({
  pendingRequests, sentRequests, pendingInvites,
  acceptRequest, rejectRequest, cancelRequest, acceptShare, rejectShare,
}: InvitesTabProps) {
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

  const handleCancel = (id: string) => {
    if (confirmCancel === id) { cancelRequest(id); setConfirmCancel(null); }
    else { setConfirmCancel(id); setTimeout(() => setConfirmCancel(null), 3000); }
  };

  return (
    <div className="space-y-6">
      {/* Friend requests */}
      {pendingRequests.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
              <UserPlus className="w-3.5 h-3.5 text-primary" />
            </div>
            Solicitações de Amizade
            <span className="text-xs text-muted-foreground font-normal">({pendingRequests.length})</span>
          </h3>
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2">
            {pendingRequests.map(req => (
              <motion.div key={req.id} variants={fadeUp}
                className="glass-card p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-lg shrink-0 ring-2 ring-background">
                  {req.from_avatar_url ? <img src={req.from_avatar_url} loading="lazy" className="w-11 h-11 rounded-full object-cover" alt="" /> : "👤"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{req.from_display_name || req.from_email || "Usuário"}</p>
                  {req.from_email && req.from_display_name && req.from_email !== req.from_display_name && (
                    <p className="text-[10px] text-muted-foreground truncate">{req.from_email}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">quer ser seu amigo</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => acceptRequest(req.id)}
                    className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />Aceitar
                  </button>
                  <button onClick={() => rejectRequest(req.id)}
                    className="px-3 py-2 rounded-lg bg-foreground/5 text-muted-foreground text-xs font-medium hover:bg-foreground/10 transition-colors flex items-center gap-1">
                    <XCircle className="w-3 h-3" />Recusar
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {/* Workspace share invites */}
      {pendingInvites.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
              <Share2 className="w-3.5 h-3.5 text-primary" />
            </div>
            Compartilhamentos Pendentes
            <span className="text-xs text-muted-foreground font-normal">({pendingInvites.length})</span>
          </h3>
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2">
            {pendingInvites.map(invite => (
              <motion.div key={invite.id} variants={fadeUp} className="glass-card p-4">
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ring-1 ring-foreground/5" style={{ background: `${invite.workspace_color || 'hsl(var(--primary))'}15` }}>
                    {invite.workspace_icon || "📁"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{invite.workspace_name || "Workspace"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      de {invite.owner_name || "Usuário"}
                      {invite.owner_email && invite.owner_name !== invite.owner_email ? ` · ${invite.owner_email}` : ""}
                      {" · "}{invite.permission === "edit" ? "Pode editar" : "Apenas ver"}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => acceptShare(invite.id)}
                      className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />Aceitar
                    </button>
                    <button onClick={() => rejectShare(invite.id)}
                      className="px-3 py-2 rounded-lg bg-foreground/5 text-muted-foreground text-xs font-medium hover:bg-foreground/10 transition-colors flex items-center gap-1">
                      <XCircle className="w-3 h-3" />Recusar
                    </button>
                  </div>
                </div>
                <ModuleBadges share={invite} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {pendingRequests.length === 0 && pendingInvites.length === 0 && (
        <div className="glass-card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-7 h-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground mb-1">Nenhum convite pendente 🎉</p>
          <p className="text-xs text-muted-foreground/60">Novos convites aparecerão aqui automaticamente</p>
        </div>
      )}

      {/* Sent friend requests — with cancel action */}
      {sentRequests.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-muted/50 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            Enviados
            <span className="text-xs text-muted-foreground font-normal">({sentRequests.length})</span>
          </h3>
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2">
            {sentRequests.map(req => (
              <motion.div key={req.id} variants={fadeUp}
                className="glass-card p-4 flex items-center gap-3 group">
                <div className="w-9 h-9 rounded-full bg-foreground/10 flex items-center justify-center text-sm shrink-0">👤</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{req.to_display_name || req.to_email || "Usuário"}</p>
                  {req.to_email && req.to_display_name && req.to_email !== req.to_display_name && (
                    <p className="text-[10px] text-muted-foreground truncate">{req.to_email}</p>
                  )}
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Aguardando</span>
                <DeshTooltip label={confirmCancel === req.id ? "Confirmar cancelamento" : "Cancelar solicitação"}>
                  <button onClick={() => handleCancel(req.id)}
                    className={`p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${
                      confirmCancel === req.id
                        ? "text-destructive bg-destructive/10 !opacity-100"
                        : "text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
                    }`}>
                    {confirmCancel === req.id ? <AlertTriangle className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  </button>
                </DeshTooltip>
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}
    </div>
  );
}

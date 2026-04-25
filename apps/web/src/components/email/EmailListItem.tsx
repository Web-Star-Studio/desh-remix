import { forwardRef, memo, useMemo } from "react";
import { Star, Paperclip, CheckSquare, Square, Eye, Reply, Forward, Archive, Trash2, MailOpen, Mail, MailMinus, AlertCircle, Clock } from "lucide-react";
import { DeshContextMenu } from "@/components/ui/DeshContextMenu";
import { EmailItem, AI_CATEGORY_STYLES, getAvatarInfo } from "./types";
import type { EmailCategoryMap } from "@/hooks/email/useEmailAI";
import WorkspaceBadge from "@/components/dashboard/WorkspaceBadge";

interface EmailListItemProps {
  email: EmailItem;
  isSelected: boolean;
  isBatchSelected: boolean;
  selectionMode: boolean;
  emailCategories: EmailCategoryMap;
  onSelect: (id: string) => void;
  onToggleRead?: (id: string) => void;
  onToggleStar?: (id: string) => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  onReply?: (email: EmailItem) => void;
  onForward?: (email: EmailItem) => void;
  onUnsubscribe?: (email: EmailItem) => void;
}

const EmailListItem = memo(forwardRef<HTMLButtonElement, EmailListItemProps>(({
  email,
  isSelected,
  isBatchSelected,
  selectionMode,
  emailCategories,
  onSelect,
  onToggleRead,
  onToggleStar,
  onArchive,
  onDelete,
  onReply,
  onForward,
  onUnsubscribe,
}, ref) => {
  const { initials, color } = getAvatarInfo(email.from, email.email);
  const cat = emailCategories[email.id];
  const catStyle = cat ? AI_CATEGORY_STYLES[cat.category] || AI_CATEGORY_STYLES.outro : null;

  // Smart priority: urgente + requires_action = high priority visual
  const isHighPriority = cat?.priority === "alta" || (cat?.category === "urgente");
  const needsAction = cat?.requires_action;

  // Relative time hint
  const timeHint = useMemo(() => {
    if (!email.date) return null;
    const now = new Date();
    const d = new Date(email.date);
    if (isNaN(d.getTime())) return null;
    const diffH = (now.getTime() - d.getTime()) / 3600000;
    if (diffH < 1) return "agora";
    if (diffH < 24) return `${Math.floor(diffH)}h`;
    return null;
  }, [email.date]);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", email.id);
    e.dataTransfer.effectAllowed = "link";
  };

  return (
    <DeshContextMenu actions={[
      { id: "open", label: "Abrir e-mail", icon: Eye, onClick: () => onSelect(email.id) },
      { id: "reply", label: "Responder", icon: Reply, onClick: () => onReply?.(email) },
      { id: "forward", label: "Encaminhar", icon: Forward, onClick: () => onForward?.(email) },
      { id: "mark_read", label: email.unread ? "Marcar como lido" : "Marcar como não lido", icon: email.unread ? MailOpen : Mail, onClick: () => onToggleRead?.(email.id) },
      { id: "star", label: email.starred ? "Remover estrela" : "Marcar com estrela", icon: Star, onClick: () => onToggleStar?.(email.id) },
      { id: "archive", label: "Arquivar", icon: Archive, onClick: () => onArchive?.(email.id) },
      { id: "unsubscribe", label: "Descadastrar", icon: MailMinus, destructive: true, onClick: () => onUnsubscribe?.(email) },
      { id: "delete", label: "Excluir", icon: Trash2, destructive: true, dividerAfter: true, onClick: () => onDelete?.(email.id) },
    ]}>
      <button
        ref={ref}
        onClick={() => onSelect(email.id)}
        draggable
        onDragStart={handleDragStart}
        className={`w-full text-left px-3 py-2.5 border-b border-foreground/5 transition-colors flex items-start gap-2.5 ${
          isSelected ? "bg-primary/10" : email.unread ? "bg-primary/3 hover:bg-primary/5" : "hover:bg-foreground/3"
        } ${isBatchSelected ? "ring-1 ring-primary/30 bg-primary/8" : ""}`}>
        {selectionMode && (
          <div className="mt-1 shrink-0">
            {isBatchSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground" />}
          </div>
        )}
        <div className="relative flex-shrink-0 mt-0.5">
          <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold ${isHighPriority ? "ring-2 ring-destructive/40" : ""}`}>
            {initials}
          </div>
          {email.accountColor && (
            <div
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background"
              style={{ backgroundColor: email.accountColor }}
              title={email.accountEmail || ""}
            />
          )}
          {isHighPriority && !email.accountColor && (
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-destructive flex items-center justify-center">
              <AlertCircle className="w-2 h-2 text-destructive-foreground" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`text-sm truncate ${email.unread ? "font-semibold text-foreground" : "text-foreground/70"}`}>{email.from}</span>
            {email.accountEmail && (
              <span className="text-[10px] text-muted-foreground/50 truncate max-w-[100px] hidden sm:inline" title={email.accountEmail}>
                {email.accountEmail}
              </span>
            )}
            <span className="text-xs text-muted-foreground flex-shrink-0 ml-auto">{email.date}</span>
          </div>
          <p className={`text-xs truncate mb-0.5 ${email.unread ? "text-foreground/90 font-medium" : "text-muted-foreground"}`}>{email.subject}</p>
          <p className="text-xs text-muted-foreground/60 truncate">{email.body}</p>
          <div className="flex items-center gap-1 mt-1">
            {email.starred && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
            {email.hasAttachment && <Paperclip className="w-3 h-3 text-muted-foreground" />}
            {needsAction && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-500">
                <AlertCircle className="w-2.5 h-2.5" /> Ação
              </span>
            )}
            {timeHint && email.unread && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/50">
                <Clock className="w-2.5 h-2.5" /> {timeHint}
              </span>
            )}
            <WorkspaceBadge workspaceId={(email as any).workspaceId} />
            {catStyle && (
              <span className={`ml-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium border ${catStyle.badge}`}>
                {catStyle.label}
                {cat?.requires_action && <span>⚡</span>}
              </span>
            )}
            {!cat && email.unread && <div className="w-1.5 h-1.5 rounded-full bg-primary ml-auto" />}
          </div>
        </div>
      </button>
    </DeshContextMenu>
  );
}));

EmailListItem.displayName = "EmailListItem";

export default EmailListItem;


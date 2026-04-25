import { memo, useState } from "react";
import { Pin, BellOff, Archive, UserPlus, Trash2, CheckSquare, MailOpen, Mail, MoreVertical } from "lucide-react";
import { DeshContextMenu, type DeshContextAction } from "@/components/ui/DeshContextMenu";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface ConversationContextMenuProps {
  pinned: boolean;
  muted: boolean;
  archived: boolean;
  hasUnread: boolean;
  showSaveContact: boolean;
  onTogglePin: () => void;
  onToggleMute: () => void;
  onToggleArchive: () => void;
  onToggleReadStatus: () => void;
  onSaveContact: () => void;
  onSelect: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}

function buildActions(props: Omit<ConversationContextMenuProps, "children">): DeshContextAction[] {
  return [
    { id: "pin", label: props.pinned ? "Desafixar" : "Fixar no topo", icon: Pin, onClick: props.onTogglePin },
    { id: "mute", label: props.muted ? "Ativar notificações" : "Silenciar", icon: BellOff, onClick: props.onToggleMute },
    { id: "read", label: props.hasUnread ? "Marcar como lido" : "Marcar como não lido", icon: props.hasUnread ? MailOpen : Mail, onClick: props.onToggleReadStatus },
    { id: "archive", label: props.archived ? "Desarquivar" : "Arquivar", icon: Archive, onClick: props.onToggleArchive },
    ...(props.showSaveContact ? [{ id: "save-contact", label: "Salvar como contato", icon: UserPlus, onClick: props.onSaveContact }] : []),
    { id: "select", label: "Selecionar", icon: CheckSquare, onClick: props.onSelect, dividerAfter: true },
    { id: "delete", label: "Excluir conversa", icon: Trash2, onClick: props.onDelete, destructive: true },
  ];
}

export const ConversationContextMenu = memo(function ConversationContextMenu(props: ConversationContextMenuProps) {
  const { children, ...actionProps } = props;
  const actions = buildActions(actionProps);

  return <DeshContextMenu actions={actions}>{children}</DeshContextMenu>;
});

/** Dropdown triggered by a 3-dot button on hover */
export const ConversationDropdownMenu = memo(function ConversationDropdownMenu(
  props: Omit<ConversationContextMenuProps, "children"> & { className?: string }
) {
  const [open, setOpen] = useState(false);
  const actions = buildActions(props);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => { e.stopPropagation(); }}
          className={`p-1 rounded-full bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground shadow-sm border border-foreground/5 transition-opacity ${props.className ?? ""}`}
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[180px] rounded-xl border border-border/40 bg-background/95 backdrop-blur-xl shadow-xl shadow-black/20 p-1"
        onClick={(e) => e.stopPropagation()}
      >
        {actions.map((action) => (
          <div key={action.id}>
            <DropdownMenuItem
              onClick={() => { action.onClick(); setOpen(false); }}
              disabled={action.disabled}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${
                action.destructive
                  ? "text-destructive focus:text-destructive focus:bg-destructive/10"
                  : "text-foreground/80 focus:text-foreground focus:bg-muted/60"
              }`}
            >
              <action.icon className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1">{action.label}</span>
            </DropdownMenuItem>
            {action.dividerAfter && <DropdownMenuSeparator className="my-0.5" />}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

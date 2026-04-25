import { memo, useState } from "react";
import { Reply, Forward, Star, Trash2, Copy, SmilePlus, MoreVertical, Pin } from "lucide-react";
import { DeshContextMenu, type DeshContextAction } from "@/components/ui/DeshContextMenu";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface MessageContextMenuProps {
  messageId: string;
  isMe: boolean;
  isStarred?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReply: () => void;
  onForward: () => void;
  onReact: () => void;
  onStar: () => void;
  onDeleteForMe: () => void;
  onDeleteForAll: () => void;
  onCopy: () => void;
  children: React.ReactNode;
}

function buildActions(props: Omit<MessageContextMenuProps, "children" | "messageId" | "open" | "onOpenChange">): DeshContextAction[] {
  return [
    { id: "reply", label: "Responder", icon: Reply, onClick: props.onReply },
    { id: "react", label: "Reagir", icon: SmilePlus, onClick: props.onReact },
    { id: "star", label: props.isStarred ? "Desafixar" : "Fixar", icon: Pin, onClick: props.onStar },
    { id: "forward", label: "Encaminhar", icon: Forward, onClick: props.onForward },
    { id: "copy", label: "Copiar", icon: Copy, onClick: props.onCopy, dividerAfter: true },
    { id: "delete-me", label: "Apagar para mim", icon: Trash2, destructive: true, onClick: props.onDeleteForMe },
    ...(props.isMe ? [{ id: "delete-all", label: "Apagar para todos", icon: Trash2, destructive: true, onClick: props.onDeleteForAll }] : []),
  ];
}

/** Right-click context menu for messages */
export const MessageContextMenu = memo(function MessageContextMenu({
  isMe, isStarred, onReply, onForward, onReact, onStar, onDeleteForMe, onDeleteForAll, onCopy, children,
}: MessageContextMenuProps) {
  return (
    <DeshContextMenu actions={buildActions({ isMe, isStarred, onReply, onForward, onReact, onStar, onDeleteForMe, onDeleteForAll, onCopy })}>
      {children}
    </DeshContextMenu>
  );
});

/** Dropdown triggered by the 3-dot button on hover (like WhatsApp Web) */
export const MessageDropdownMenu = memo(function MessageDropdownMenu(
  props: Omit<MessageContextMenuProps, "children"> & { className?: string }
) {
  const [open, setOpen] = useState(false);
  const actions = buildActions(props);

  return (
    <DropdownMenu open={open} onOpenChange={(v) => { setOpen(v); props.onOpenChange(v); }}>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => { e.stopPropagation(); }}
          className={`p-1 rounded-full bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground shadow-sm border border-foreground/5 transition-opacity ${props.className ?? ""}`}
        >
          <MoreVertical className="w-3 h-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[170px] rounded-xl border border-border/40 bg-background/95 backdrop-blur-xl shadow-xl shadow-black/20 p-1"
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

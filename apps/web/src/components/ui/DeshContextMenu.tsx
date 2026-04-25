import React, { forwardRef } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";

export interface DeshContextAction {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  dividerAfter?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  shortcut?: string;
}

interface DeshContextMenuProps {
  actions: DeshContextAction[];
  children: React.ReactNode;
}

export function DeshContextMenu({ actions, children }: DeshContextMenuProps) {
  if (actions.length === 0) return <>{children}</>;

  return (
    <ContextMenu>
      <ContextMenuTrigger className="contents">{children}</ContextMenuTrigger>
      <ContextMenuContent className="min-w-[180px] rounded-xl border border-border/40 bg-background/95 backdrop-blur-xl shadow-xl shadow-black/20 p-1">
        {actions.map((action) => (
          <React.Fragment key={action.id}>
            <ContextMenuItem
              onClick={action.onClick}
              disabled={action.disabled}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${
                action.destructive
                  ? "text-destructive focus:text-destructive focus:bg-destructive/10"
                  : "text-foreground/80 focus:text-foreground focus:bg-muted/60"
              }`}
            >
              <action.icon className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1">{action.label}</span>
              {action.shortcut && (
                <ContextMenuShortcut className="text-[10px] text-muted-foreground/60">
                  {action.shortcut}
                </ContextMenuShortcut>
              )}
            </ContextMenuItem>
            {action.dividerAfter && <ContextMenuSeparator className="my-0.5" />}
          </React.Fragment>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}

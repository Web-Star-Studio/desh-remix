import { cn } from "@/lib/utils";

/** Shared surface for shell-attached menus (workspace, widgets, notifications-style panels). */
export const shellMenuSurfaceClass =
  "border border-border/80 bg-background/95 text-foreground shadow-2xl backdrop-blur-xl";

export function shellDropdownContentClass(extra?: string) {
  return cn(
    "z-[300] overflow-hidden rounded-2xl p-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
    shellMenuSurfaceClass,
    extra,
  );
}

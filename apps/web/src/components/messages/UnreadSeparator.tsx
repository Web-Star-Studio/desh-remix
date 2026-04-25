/**
 * UnreadSeparator — Visual divider showing where unread messages begin.
 */
import { memo } from "react";
import { ArrowDown } from "lucide-react";

interface UnreadSeparatorProps {
  count: number;
}

export const UnreadSeparator = memo(function UnreadSeparator({ count }: UnreadSeparatorProps) {
  return (
    <div className="flex items-center gap-3 py-2 my-1">
      <div className="flex-1 h-px bg-primary/30" />
      <span className="text-[10px] text-primary font-semibold px-2 py-0.5 bg-primary/10 rounded-full flex items-center gap-1">
        <ArrowDown className="w-3 h-3" />
        {count} não lida{count > 1 ? "s" : ""}
      </span>
      <div className="flex-1 h-px bg-primary/30" />
    </div>
  );
});

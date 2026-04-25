/**
 * PinnedMessagesBar — Shows pinned messages at the top of the chat.
 * Clicking a pinned message scrolls to it.
 */
import { memo, useState } from "react";
import { Pin, ChevronDown, ChevronUp, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ChatMessage } from "@/lib/messageUtils";

interface PinnedMessagesBarProps {
  pinnedMessages: ChatMessage[];
  onScrollToMessage: (messageId: string) => void;
  onUnpin: (messageId: string) => void;
}

export const PinnedMessagesBar = memo(function PinnedMessagesBar({
  pinnedMessages, onScrollToMessage, onUnpin,
}: PinnedMessagesBarProps) {
  const [expanded, setExpanded] = useState(false);

  if (pinnedMessages.length === 0) return null;

  const displayMsg = pinnedMessages[0];

  return (
    <div className="border-b border-foreground/5 bg-foreground/[0.02]">
      <button
        onClick={() => pinnedMessages.length > 1 ? setExpanded(!expanded) : onScrollToMessage(displayMsg.id)}
        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-foreground/5 transition-colors"
      >
        <Pin className="w-3.5 h-3.5 text-primary flex-shrink-0 rotate-45" />
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs text-foreground truncate">{displayMsg.text || "📎 Mídia"}</p>
          <p className="text-[10px] text-muted-foreground">{displayMsg.sender} • {displayMsg.time}</p>
        </div>
        {pinnedMessages.length > 1 && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            {pinnedMessages.length} fixadas
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </span>
        )}
      </button>

      <AnimatePresence>
        {expanded && pinnedMessages.length > 1 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {pinnedMessages.slice(1).map(msg => (
              <div
                key={msg.id}
                className="px-3 py-1.5 flex items-center gap-2 hover:bg-foreground/5 transition-colors cursor-pointer border-t border-foreground/5"
                onClick={() => onScrollToMessage(msg.id)}
              >
                <Pin className="w-3 h-3 text-muted-foreground flex-shrink-0 rotate-45" />
                <p className="text-xs text-foreground truncate flex-1">{msg.text || "📎 Mídia"}</p>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">{msg.time}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onUnpin(msg.id); }}
                  className="p-0.5 rounded hover:bg-foreground/10 text-muted-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

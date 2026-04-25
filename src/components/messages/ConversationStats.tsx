/**
 * ConversationStats — Quick stats bar showing conversation metrics.
 * Displays total conversations, unread count, platform breakdown, and response time hint.
 */
import { memo, useMemo } from "react";
import { MessageSquare, Bell, Clock, Users } from "lucide-react";
import type { Conversation } from "@/lib/messageUtils";

interface ConversationStatsProps {
  conversations: Conversation[];
}

export const ConversationStats = memo(function ConversationStats({ conversations }: ConversationStatsProps) {
  const stats = useMemo(() => {
    const active = conversations.filter(c => !c.archived);
    const totalUnread = active.reduce((sum, c) => sum + c.unread, 0);
    const groups = active.filter(c => c.channelId?.endsWith("@g.us")).length;
    const platforms = new Map<string, number>();
    active.forEach(c => platforms.set(c.platform, (platforms.get(c.platform) || 0) + 1));

    // Find most recent conversation time
    const sorted = [...active].sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    const lastActivity = sorted[0]?.lastMessageAt;
    let lastActivityLabel = "";
    if (lastActivity) {
      const diffMin = Math.floor((Date.now() - lastActivity) / 60000);
      if (diffMin < 1) lastActivityLabel = "agora";
      else if (diffMin < 60) lastActivityLabel = `${diffMin}min`;
      else if (diffMin < 1440) lastActivityLabel = `${Math.floor(diffMin / 60)}h`;
      else lastActivityLabel = `${Math.floor(diffMin / 1440)}d`;
    }

    return { total: active.length, totalUnread, groups, lastActivityLabel };
  }, [conversations]);

  if (stats.total === 0) return null;

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 border-b border-foreground/5 text-[10px] text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <MessageSquare className="w-3 h-3" />
        {stats.total}
      </span>
      {stats.totalUnread > 0 && (
        <span className="inline-flex items-center gap-1 text-primary font-medium">
          <Bell className="w-3 h-3" />
          {stats.totalUnread} não lida{stats.totalUnread > 1 ? "s" : ""}
        </span>
      )}
      {stats.groups > 0 && (
        <span className="inline-flex items-center gap-1">
          <Users className="w-3 h-3" />
          {stats.groups} grupo{stats.groups > 1 ? "s" : ""}
        </span>
      )}
      {stats.lastActivityLabel && (
        <span className="inline-flex items-center gap-1 ml-auto">
          <Clock className="w-3 h-3" />
          {stats.lastActivityLabel}
        </span>
      )}
    </div>
  );
});

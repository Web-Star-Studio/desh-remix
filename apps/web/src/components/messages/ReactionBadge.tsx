import { memo } from "react";

interface Reaction {
  emoji: string;
  fromMe?: boolean;
}

interface ReactionBadgeProps {
  reactions: Reaction[];
}

export const ReactionBadge = memo(function ReactionBadge({ reactions }: ReactionBadgeProps) {
  if (!reactions || reactions.length === 0) return null;

  // Group by emoji
  const grouped = reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex items-center gap-0.5 mt-0.5">
      {Object.entries(grouped).map(([emoji, count]) => (
        <span key={emoji} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-foreground/5 text-[10px] border border-foreground/5">
          {emoji}
          {count > 1 && <span className="text-muted-foreground">{count}</span>}
        </span>
      ))}
    </div>
  );
});

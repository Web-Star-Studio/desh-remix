import { memo } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import type { QuickReply } from "@/hooks/common/useInboxAI";

interface InboxQuickRepliesProps {
  replies: QuickReply[];
  loading: boolean;
  onSelect: (text: string) => void;
  onGenerate: () => void;
}

const toneLabel: Record<string, string> = {
  formal: "Formal",
  casual: "Casual",
  assertive: "Assertivo",
};

const toneColor: Record<string, string> = {
  formal: "bg-sky-500/10 text-sky-500",
  casual: "bg-emerald-500/10 text-emerald-500",
  assertive: "bg-amber-500/10 text-amber-500",
};

const InboxQuickReplies = memo(({ replies, loading, onSelect, onGenerate }: InboxQuickRepliesProps) => {
  if (loading) {
    return (
      <div className="flex items-center gap-1.5 mt-1">
        <Loader2 className="w-3 h-3 animate-spin text-primary" />
        <span className="text-[10px] text-muted-foreground">Gerando respostas...</span>
      </div>
    );
  }

  if (replies.length === 0) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onGenerate(); }}
        className="flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors"
      >
        <MessageSquare className="w-2.5 h-2.5" /> Resposta rápida com IA
      </button>
    );
  }

  return (
    <div className="flex flex-wrap gap-1 mt-1.5" onClick={(e) => e.stopPropagation()}>
      {replies.map((reply, i) => (
        <button
          key={i}
          onClick={() => onSelect(reply.text)}
          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors hover:opacity-80 ${toneColor[reply.tone] || toneColor.casual}`}
          title={`${toneLabel[reply.tone]}: ${reply.text}`}
        >
          {reply.text.length > 40 ? reply.text.slice(0, 40) + "…" : reply.text}
        </button>
      ))}
    </div>
  );
});

InboxQuickReplies.displayName = "InboxQuickReplies";

export default InboxQuickReplies;

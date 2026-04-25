import { memo, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Send, Loader2 } from "lucide-react";

interface Conversation {
  id: string;
  name: string;
  channelId: string;
  avatar: string;
}

interface ForwardMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversations: Conversation[];
  onForward: (toContactId: string, conversationName: string) => Promise<void>;
  messagePreview: string;
}

export const ForwardMessageDialog = memo(function ForwardMessageDialog({
  open, onOpenChange, conversations, onForward, messagePreview,
}: ForwardMessageDialogProps) {
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return conversations;
    const q = search.toLowerCase();
    return conversations.filter(c => c.name.toLowerCase().includes(q));
  }, [conversations, search]);

  const handleForward = async (convo: Conversation) => {
    setSending(true);
    try {
      await onForward(convo.channelId, convo.name);
      onOpenChange(false);
      setSearch("");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Encaminhar mensagem</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Preview */}
          <div className="bg-foreground/5 rounded-lg p-2 border-l-2 border-primary">
            <p className="text-xs text-muted-foreground truncate">{messagePreview}</p>
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar conversa..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 text-sm"
              autoFocus
            />
          </div>
          {/* List */}
          <div className="max-h-[300px] overflow-y-auto space-y-0.5">
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma conversa encontrada</p>
            )}
            {filtered.map(convo => (
              <button
                key={convo.id}
                onClick={() => handleForward(convo)}
                disabled={sending}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-foreground/5 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center text-sm overflow-hidden flex-shrink-0">
                  {convo.avatar.startsWith("http") ? (
                    <img src={convo.avatar} alt="" className="w-full h-full object-cover" />
                  ) : convo.avatar}
                </div>
                <span className="text-sm text-foreground flex-1 truncate">{convo.name}</span>
                <Send className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

import { useEffect, useState } from "react";
import { PanelLeftClose } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePageMeta } from "@/contexts/PageMetaContext";
import {
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useUpdateConversation,
  type ApiConversation,
} from "@/hooks/api/useConversations";
import ChatPanel from "@/components/ai/ChatPanel";
import ChatSidebar from "@/components/ai/ChatSidebar";

const AIPage = () => {
  const isMobile = useIsMobile();
  const { activeWorkspaceId } = useWorkspace();
  const { data: conversations, isLoading } = useConversations(activeWorkspaceId);
  const createMut = useCreateConversation(activeWorkspaceId);
  const updateMut = useUpdateConversation(activeWorkspaceId);
  const deleteMut = useDeleteConversation(activeWorkspaceId);
  const createConversation = createMut.mutate;
  const isCreatingConversation = createMut.isPending;

  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showLeftPanel, setShowLeftPanel] = useState(!isMobile);

  // Auto-select most recent or auto-create on first visit.
  useEffect(() => {
    if (!conversations) return;
    if (activeConvId && conversations.find((c) => c.id === activeConvId)) return;
    if (conversations.length > 0) {
      setActiveConvId(conversations[0].id);
      return;
    }
    if (!isCreatingConversation && activeWorkspaceId) {
      createConversation({}, { onSuccess: (c) => setActiveConvId(c.id) });
    }
  }, [conversations, activeConvId, activeWorkspaceId, isCreatingConversation, createConversation]);

  // Reset on workspace switch.
  useEffect(() => {
    setActiveConvId(null);
  }, [activeWorkspaceId]);

  const activeConversation: ApiConversation | null =
    conversations?.find((c) => c.id === activeConvId) ?? null;

  const handleNewConversation = () => {
    if (!activeWorkspaceId) return;
    createMut.mutate({}, { onSuccess: (c) => setActiveConvId(c.id) });
  };

  const handleDelete = (id: string) => {
    deleteMut.mutate(id, {
      onSuccess: () => {
        if (activeConvId === id) setActiveConvId(null);
      },
    });
  };

  const handleRename = (id: string, title: string) => {
    updateMut.mutate({ id, patch: { title } });
  };

  const handleUpdateTitle = (title: string) => {
    if (!activeConvId) return;
    updateMut.mutate({ id: activeConvId, patch: { title } });
  };

  // Title goes to the shell-level top bar via PageMetaContext.
  usePageMeta({ title: "Pandora" });

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-1 min-h-0 gap-3 p-3 overflow-hidden">
          {showLeftPanel && !isMobile && (
            <div className="w-72 glass-card flex flex-col shrink-0 overflow-hidden">
              <div className="p-3 border-b border-border/20 flex items-center gap-2">
                <h2 className="text-xs font-semibold text-foreground flex-1">
                  Conversas
                </h2>
                <button
                  onClick={() => setShowLeftPanel(false)}
                  className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Fechar painel de conversas"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
              <ChatSidebar
                conversations={conversations ?? []}
                activeId={activeConvId}
                loading={isLoading}
                onNew={handleNewConversation}
                onSelect={setActiveConvId}
                onDelete={handleDelete}
                onRename={handleRename}
              />
            </div>
          )}

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <ChatPanel
            conversation={activeConversation}
            onUpdateTitle={handleUpdateTitle}
            onOpenSidebar={
              !showLeftPanel && !isMobile ? () => setShowLeftPanel(true) : undefined
            }
          />
        </div>
      </div>
    </div>
  );
};

export default AIPage;

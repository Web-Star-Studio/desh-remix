import pandoraAvatar from "@/assets/pandora-avatar.png";
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PanelLeftClose, PanelRightClose, PanelLeft, PanelRight, Menu, Settings2, ArrowLeft, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAIConversations, type AIMessage } from "@/hooks/ai/useAIConversations";
import { useAIAgents, type AIAgent } from "@/hooks/ai/useAIAgents";
import { useAIProjects } from "@/hooks/ai/useAIProjects";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspace } from "@/contexts/WorkspaceContext";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import ConversationSidebar from "@/components/ai/ConversationSidebar";
import ChatPanel from "@/components/ai/ChatPanel";
import ContextPanel from "@/components/ai/ContextPanel";
import AgentForm from "@/components/ai/AgentForm";
import ProjectForm from "@/components/ai/ProjectForm";
import AgentTemplateLibrary from "@/components/ai/AgentTemplateLibrary";
import PageLayout from "@/components/dashboard/PageLayout";
import PageHeader from "@/components/dashboard/PageHeader";

const AIPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [filterProjectId, setFilterProjectId] = useState<string | null>(null);
  const [filterAgentId, setFilterAgentId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentIdRaw] = useState<string | null>(() => {
    return localStorage.getItem("desh-selected-agent-id") || null;
  });
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AIAgent | null>(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [showLeftPanel, setShowLeftPanel] = useState(!isMobile);
  const [showRightPanel, setShowRightPanel] = useState(!isMobile);
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false);
  const [mobileRightOpen, setMobileRightOpen] = useState(false);
  const [memories, setMemories] = useState<Array<{ id: string; content: string; category: string }>>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<Array<{ id: string; title: string; category: string }>>([]);

  // Swipe support — use refs to avoid re-registering listeners
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const mobileLeftOpenRef = useRef(mobileLeftOpen);
  mobileLeftOpenRef.current = mobileLeftOpen;
  const mobileRightOpenRef = useRef(mobileRightOpen);
  mobileRightOpenRef.current = mobileRightOpen;

  const { conversations, create: createConv, update: updateConv, remove: removeConv } = useAIConversations(filterProjectId, filterAgentId);
  const { agents, create: createAgent, update: updateAgent, remove: removeAgent, defaultAgent } = useAIAgents();
  const { projects, create: createProject } = useAIProjects();
  const { activeWorkspace, activeWorkspaceId } = useWorkspace();

  // Rule 2 — Reset conversation when workspace changes
  const prevWorkspaceRef = useRef(activeWorkspaceId);
  useEffect(() => {
    if (prevWorkspaceRef.current !== activeWorkspaceId && prevWorkspaceRef.current !== undefined) {
      // Workspace changed — create new conversation
      setActiveConvId(null);
      autoCreatedRef.current = false;
    }
    prevWorkspaceRef.current = activeWorkspaceId;
  }, [activeWorkspaceId]);

  // Expose workspace context for ChatPanel to access (avoids prop drilling through complex chain)
  useEffect(() => {
    (window as any).__deshWorkspaceContext = { activeWorkspaceId };
    return () => { delete (window as any).__deshWorkspaceContext; };
  }, [activeWorkspaceId]);

  // Persist selectedAgentId to localStorage + user_data
  const setSelectedAgentId = useCallback((id: string | null) => {
    setSelectedAgentIdRaw(id);
    if (id) {
      localStorage.setItem("desh-selected-agent-id", id);
    } else {
      localStorage.removeItem("desh-selected-agent-id");
    }
    // Persist to DB (fire-and-forget)
    if (user) {
      Promise.resolve(supabase.from("user_data").select("id").eq("user_id", user.id).eq("data_type", "ai_selected_agent").maybeSingle()).then(({ data: existing }) => {
        if (existing) {
          Promise.resolve(supabase.from("user_data").update({ data: { agent_id: id } }).eq("id", existing.id)).catch(() => {});
        } else if (id) {
          Promise.resolve(supabase.from("user_data").insert({ user_id: user.id, data_type: "ai_selected_agent", data: { agent_id: id } })).catch(() => {});
        }
      }).catch(() => {});
    }
  }, [user]);

  // Restore selectedAgentId from DB on first load, default to "Assistente Geral"
  useEffect(() => {
    if (!user || agents.length === 0) return;
    const stored = localStorage.getItem("desh-selected-agent-id");
    // Validate stored ID exists in agents
    if (stored && agents.find(a => a.id === stored)) {
      setSelectedAgentIdRaw(stored);
      return;
    }
    // Try DB
    Promise.resolve(supabase.from("user_data").select("data").eq("user_id", user.id).eq("data_type", "ai_selected_agent").maybeSingle()).then(({ data: row }) => {
      const dbId = (row?.data as any)?.agent_id;
      if (dbId && agents.find(a => a.id === dbId)) {
        setSelectedAgentIdRaw(dbId);
        localStorage.setItem("desh-selected-agent-id", dbId);
      } else if (defaultAgent) {
        // Default to "Assistente Geral"
        setSelectedAgentIdRaw(defaultAgent.id);
        localStorage.setItem("desh-selected-agent-id", defaultAgent.id);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, agents.length]);

  const activeConversation = conversations.find(c => c.id === activeConvId) || null;
  const activeAgent = agents.find(a => a.id === selectedAgentId) || null;
  const activeProject = projects.find(p => p.id === selectedProjectId) || null;

  // Auto-create a new conversation when page opens with no active conversation
  const autoCreatedRef = useRef(false);
  useEffect(() => {
    if (!user || autoCreatedRef.current) return;
    // Wait until conversations query has resolved (isLoading would be false)
    // If there's already an active conversation, skip
    if (activeConvId && conversations.find(c => c.id === activeConvId)) return;
    // If there are existing conversations and none is selected, select the most recent
    if (conversations.length > 0 && !activeConvId) {
      setActiveConvId(conversations[0].id);
      return;
    }
    // No conversations at all — auto-create one
    if (conversations.length === 0) {
      autoCreatedRef.current = true;
      createConv.mutateAsync({
        agent_id: selectedAgentId,
        project_id: selectedProjectId,
        messages: [],
      }).then(conv => {
        setActiveConvId(conv.id);
      }).catch(() => {
        autoCreatedRef.current = false;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, conversations.length, activeConvId]);

  const memoriesFetchedRef = useRef(false);
  useEffect(() => {
    if (!user || memoriesFetchedRef.current) return;
    memoriesFetchedRef.current = true;
    Promise.all([
      supabase.from("ai_memories").select("id,content,category").eq("user_id", user.id).limit(50),
      supabase.from("ai_knowledge_base" as any).select("id,title,category").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(30),
    ]).then(([memRes, kbRes]) => {
      setMemories(memRes.data || []);
      setKnowledgeBase((kbRes.data as any[]) || []);
    });
  }, [user]);

  // Swipe gestures for mobile — register once, use refs to avoid stale closures
  useEffect(() => {
    if (!isMobile) return;
    const el = chatAreaRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
      const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
      touchStartRef.current = null;
      if (Math.abs(dy) > Math.abs(dx)) return;
      const threshold = 60;
      if (dx > threshold && !mobileLeftOpenRef.current && !mobileRightOpenRef.current) setMobileLeftOpen(true);
      if (dx < -threshold && !mobileRightOpenRef.current && !mobileLeftOpenRef.current) setMobileRightOpen(true);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [isMobile]);

  const handleNewConversation = useCallback(async () => {
    const conv = await createConv.mutateAsync({
      agent_id: selectedAgentId,
      project_id: selectedProjectId,
      messages: [],
    });
    setActiveConvId(conv.id);
    if (isMobile) setMobileLeftOpen(false);
  }, [createConv, selectedAgentId, selectedProjectId, isMobile]);

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConvId(id);
    if (isMobile) setMobileLeftOpen(false);
  }, [isMobile]);

  const handleUpdateMessages = useCallback((msgs: AIMessage[]) => {
    if (!activeConvId) return;
    updateConv.mutate({ id: activeConvId, messages: msgs });
  }, [activeConvId, updateConv]);

  const handleUpdateTitle = useCallback((title: string) => {
    if (!activeConvId) return;
    updateConv.mutate({ id: activeConvId, title });
  }, [activeConvId, updateConv]);

  const handleSaveAgent = useCallback(async (agentData: any) => {
    if (editingAgent) {
      await updateAgent.mutateAsync({ id: editingAgent.id, ...agentData });
    } else {
      const newAgent = await createAgent.mutateAsync(agentData);
      setSelectedAgentId(newAgent.id);
    }
    setEditingAgent(null);
  }, [editingAgent, createAgent, updateAgent]);

  const handleSaveProject = useCallback(async (projectData: any) => {
    const newProject = await createProject.mutateAsync(projectData);
    setSelectedProjectId(newProject.id);
  }, [createProject]);

  const sidebarContent = (
    <ConversationSidebar
      conversations={conversations}
      agents={agents}
      projects={projects}
      activeId={activeConvId}
      onSelect={handleSelectConversation}
      onNew={handleNewConversation}
      onDelete={(id) => { removeConv.mutate(id); if (activeConvId === id) setActiveConvId(null); }}
      onTogglePin={(id, pinned) => updateConv.mutate({ id, pinned })}
      onRename={(id, title) => updateConv.mutate({ id, title })}
      filterProjectId={filterProjectId}
      filterAgentId={filterAgentId}
      onFilterProject={setFilterProjectId}
      onFilterAgent={setFilterAgentId}
    />
  );

  const contextContent = (
    <ContextPanel
      agent={activeAgent}
      project={activeProject}
      agents={agents.filter(a => !a.is_template && (a.workspace_id === activeWorkspaceId || !a.workspace_id))}
      projects={projects}
      memories={memories}
      knowledgeBase={knowledgeBase}
      conversations={conversations}
      onNewAgent={() => { setEditingAgent(null); setShowAgentForm(true); }}
      onBrowseTemplates={() => setShowTemplateLibrary(true)}
      onNewProject={() => setShowProjectForm(true)}
      onEditAgent={(a) => { setEditingAgent(a); setShowAgentForm(true); }}
      onSelectAgent={(id) => setSelectedAgentId(id)}
      onSelectProject={(id) => setSelectedProjectId(id)}
      onDeleteMemory={(id) => setMemories(prev => prev.filter(m => m.id !== id))}
      onDeleteKnowledge={(id) => setKnowledgeBase(prev => prev.filter(k => k.id !== id))}
      onDeleteAgent={(id) => { removeAgent.mutate(id); if (selectedAgentId === id) setSelectedAgentId(defaultAgent?.id || null); }}
    />
  );

  // MOBILE LAYOUT
  if (isMobile) {
    return (
      <PageLayout noPadding maxWidth="full">
        <div className="flex flex-col h-[calc(100dvh-4rem-env(safe-area-inset-bottom,0px))] min-h-0">
          {/* Mobile Header */}
          <div className="flex items-center gap-2 px-3 py-3 border-b border-border/20 flex-shrink-0">
            <button onClick={() => navigate("/")} className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground transition-colors touch-target" aria-label="Voltar">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setMobileLeftOpen(true)} className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground transition-colors" aria-label="Abrir conversas">
              <PanelLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Sparkles className="w-4 h-4 text-primary shrink-0" />
              <h1 className="text-sm font-semibold text-foreground truncate drop-shadow-sm">
                {activeAgent ? `${activeAgent.icon} ${activeAgent.name}` : "Pandora"}
              </h1>
            </div>
            <button onClick={() => setMobileRightOpen(true)} className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground transition-colors" aria-label="Abrir contexto">
              <Settings2 className="w-4 h-4" />
            </button>
          </div>

          {/* Chat area with swipe */}
          <div ref={chatAreaRef} className="flex-1 min-h-0">
            <ChatPanel
              conversation={activeConversation}
              agent={activeAgent}
              onUpdateMessages={handleUpdateMessages}
              onUpdateTitle={handleUpdateTitle}
            />
          </div>

          {/* Left Sheet - Conversations */}
          <Sheet open={mobileLeftOpen} onOpenChange={setMobileLeftOpen}>
            <SheetContent side="left" className="w-[85vw] max-w-sm p-0">
              <SheetTitle className="sr-only">Conversas</SheetTitle>
              <div className="h-full flex flex-col">
                <div className="p-3 border-b border-border/30">
                  <h2 className="text-sm font-semibold text-foreground">Conversas</h2>
                </div>
                {sidebarContent}
              </div>
            </SheetContent>
          </Sheet>

          {/* Right Sheet - Context */}
          <Sheet open={mobileRightOpen} onOpenChange={setMobileRightOpen}>
            <SheetContent side="right" className="w-[85vw] max-w-sm p-0">
              <SheetTitle className="sr-only">Contexto</SheetTitle>
              <div className="h-full flex flex-col">
                <div className="p-3 border-b border-border/30">
                  <h2 className="text-sm font-semibold text-foreground">Contexto</h2>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {contextContent}
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Forms */}
          <AgentForm open={showAgentForm} onClose={() => { setShowAgentForm(false); setEditingAgent(null); }} onSave={handleSaveAgent} initial={editingAgent || undefined} />
          <ProjectForm open={showProjectForm} onClose={() => setShowProjectForm(false)} onSave={handleSaveProject} />
          <AgentTemplateLibrary open={showTemplateLibrary} onClose={() => setShowTemplateLibrary(false)} industry={activeWorkspace?.industry || undefined} onAgentCreated={(id) => setSelectedAgentId(id)} />
        </div>
      </PageLayout>
    );
  }

  // DESKTOP LAYOUT
  return (
    <PageLayout noPadding maxWidth="full">
      <div className="flex flex-col h-[calc(100vh)] min-h-0">
        {/* Desktop Header — consistent with PageHeader style */}
        <div className="px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4 pb-2 flex-shrink-0">
          <PageHeader
            title="Pandora"
            icon={<img src={pandoraAvatar} alt="Pandora" className="w-6 h-6 rounded-full object-cover" />}
            subtitle={
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                {activeAgent ? `${activeAgent.icon} ${activeAgent.name}` : "Assistente pessoal do DESH"}
                {conversations.length > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary/70 font-medium">
                    {conversations.length} {conversations.length === 1 ? "conversa" : "conversas"}
                  </span>
                )}
              </span>
            }
            actions={
              <div className="flex items-center gap-1">
                {!showLeftPanel && (
                  <button onClick={() => setShowLeftPanel(true)} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" aria-label="Abrir conversas">
                    <PanelLeft className="w-4 h-4" />
                  </button>
                )}
                {!showRightPanel && (
                  <button onClick={() => setShowRightPanel(true)} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" aria-label="Abrir contexto">
                    <PanelRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            }
          />
        </div>

        {/* Panels */}
        <div className="flex flex-1 min-h-0 gap-3 px-3 sm:px-4 lg:px-6 pb-24 md:pb-4 overflow-hidden">
          {showLeftPanel && (
            <div className="w-72 glass-card flex flex-col shrink-0 overflow-hidden">
              <div className="p-3 border-b border-border/20 flex items-center gap-2">
                <h2 className="text-xs font-semibold text-foreground flex-1">Conversas</h2>
                <button onClick={() => setShowLeftPanel(false)} className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground transition-colors" aria-label="Fechar painel de conversas">
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
              {sidebarContent}
            </div>
          )}

          <div className="flex-1 flex flex-col min-w-0 glass-card overflow-hidden">
            <ChatPanel conversation={activeConversation} agent={activeAgent} onUpdateMessages={handleUpdateMessages} onUpdateTitle={handleUpdateTitle} />
          </div>

          {showRightPanel && (
            <div className="w-64 glass-card flex flex-col shrink-0 overflow-hidden">
              <div className="p-3 border-b border-border/20 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-foreground">Contexto</h3>
                <button onClick={() => setShowRightPanel(false)} className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground transition-colors" aria-label="Fechar contexto">
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </div>
              {contextContent}
            </div>
          )}
        </div>

        <AgentForm open={showAgentForm} onClose={() => { setShowAgentForm(false); setEditingAgent(null); }} onSave={handleSaveAgent} initial={editingAgent || undefined} />
        <ProjectForm open={showProjectForm} onClose={() => setShowProjectForm(false)} onSave={handleSaveProject} />
        <AgentTemplateLibrary open={showTemplateLibrary} onClose={() => setShowTemplateLibrary(false)} industry={activeWorkspace?.industry || undefined} onAgentCreated={(id) => setSelectedAgentId(id)} />
      </div>
    </PageLayout>
  );
};

export default AIPage;

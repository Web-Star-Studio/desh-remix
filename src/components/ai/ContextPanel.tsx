import { Plus, Bot, FolderOpen, Brain, Settings2, Trash2, Zap, BookOpen, Search, X, BarChart3, Download, Trash, Sparkles } from "lucide-react";
import SkillsPanel from "./SkillsPanel";
import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AIAgent } from "@/hooks/ai/useAIAgents";
import type { AIProject } from "@/hooks/ai/useAIProjects";
import type { AIConversation } from "@/hooks/ai/useAIConversations";
import AIStatsPanel from "./AIStatsPanel";

interface ContextPanelProps {
  agent: AIAgent | null;
  project: AIProject | null;
  agents: AIAgent[];
  projects: AIProject[];
  memories: Array<{ id: string; content: string; category: string }>;
  knowledgeBase?: Array<{ id: string; title: string; category: string }>;
  conversations?: AIConversation[];
  onNewAgent: () => void;
  onBrowseTemplates?: () => void;
  onNewProject: () => void;
  onEditAgent: (agent: AIAgent) => void;
  onSelectAgent: (id: string | null) => void;
  onSelectProject: (id: string | null) => void;
  onDeleteMemory?: (id: string) => void;
  onDeleteKnowledge?: (id: string) => void;
  onDeleteAgent?: (id: string) => void;
}

const ContextPanel = ({
  agent, project, agents, projects, memories, knowledgeBase = [], conversations = [],
  onNewAgent, onBrowseTemplates, onNewProject, onEditAgent, onSelectAgent, onSelectProject,
  onDeleteMemory, onDeleteKnowledge, onDeleteAgent,
}: ContextPanelProps) => {
  const [kbSearch, setKbSearch] = useState("");
  const [memSearch, setMemSearch] = useState("");
  const [deletingMemId, setDeletingMemId] = useState<string | null>(null);
  const [deletingKbId, setDeletingKbId] = useState<string | null>(null);
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    agent: true, project: true, kb: true, memories: true, stats: true,
  });

  const toggleSection = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const filteredKb = useMemo(() => {
    if (!kbSearch) return knowledgeBase;
    const q = kbSearch.toLowerCase();
    return knowledgeBase.filter(k => k.title.toLowerCase().includes(q) || k.category.toLowerCase().includes(q));
  }, [knowledgeBase, kbSearch]);

  const filteredMem = useMemo(() => {
    if (!memSearch) return memories;
    const q = memSearch.toLowerCase();
    return memories.filter(m => m.content.toLowerCase().includes(q) || m.category.toLowerCase().includes(q));
  }, [memories, memSearch]);

  const handleDeleteMemory = useCallback(async (id: string) => {
    try {
      await supabase.from("ai_memories").delete().eq("id", id);
      onDeleteMemory?.(id);
      toast.success("Memória excluída");
    } catch { toast.error("Erro ao excluir memória"); }
    setDeletingMemId(null);
  }, [onDeleteMemory]);

  const handleDeleteKnowledge = useCallback(async (id: string) => {
    try {
      await supabase.from("ai_knowledge_base" as any).delete().eq("id", id);
      onDeleteKnowledge?.(id);
      toast.success("Documento excluído");
    } catch { toast.error("Erro ao excluir documento"); }
    setDeletingKbId(null);
  }, [onDeleteKnowledge]);

  const handleDeleteAgent = useCallback(async (id: string) => {
    try {
      onDeleteAgent?.(id);
      if (agent?.id === id) onSelectAgent(null);
      toast.success("Agente excluído");
    } catch { toast.error("Erro ao excluir agente"); }
    setDeletingAgentId(null);
  }, [onDeleteAgent, agent, onSelectAgent]);

  const handleExportMemories = useCallback(() => {
    if (memories.length === 0) { toast.error("Nenhuma memória para exportar"); return; }
    const data = memories.map(m => `[${m.category}] ${m.content}`).join("\n");
    const blob = new Blob([data], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `desh-memories-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Memórias exportadas!");
  }, [memories]);

  const handleClearAllMemories = useCallback(async () => {
    if (memories.length === 0) return;
    try {
      const ids = memories.map(m => m.id);
      await supabase.from("ai_memories").delete().in("id", ids);
      ids.forEach(id => onDeleteMemory?.(id));
      toast.success(`${ids.length} memórias excluídas`);
    } catch { toast.error("Erro ao limpar memórias"); }
  }, [memories, onDeleteMemory]);

  // Categorize memories
  const memoryCategories = useMemo(() => {
    const map = new Map<string, number>();
    memories.forEach(m => map.set(m.category, (map.get(m.category) || 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [memories]);

  return (
    <div className="flex flex-col h-full p-3 space-y-4 overflow-y-auto">
      {/* Active Agent */}
      <div>
        <button onClick={() => toggleSection("agent")} className="flex items-center justify-between mb-2 w-full text-left">
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5" /> Agente
          </h3>
          <span className="text-xs text-muted-foreground">{expandedSections.agent ? "▾" : "▸"}</span>
        </button>
        <AnimatePresence>
          {expandedSections.agent && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="flex items-center justify-end gap-1 mb-1">
                {onBrowseTemplates && (
                  <button onClick={onBrowseTemplates} className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg hover:bg-muted/70 transition-colors text-muted-foreground" title="Usar template">
                    <Sparkles className="w-3 h-3" />
                    <span className="text-[10px]">Templates</span>
                  </button>
                )}
                <button onClick={onNewAgent} className="p-1 rounded-xl hover:bg-muted/70 transition-colors" title="Novo agente">
                  <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
              {agent ? (
                <motion.div key={agent.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="p-2.5 rounded-xl border border-border/30 bg-muted/50 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                      style={{ background: agent.color || "hsl(35, 80%, 50%)" }}>
                      {agent.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{agent.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{agent.description || agent.model}</p>
                    </div>
                    <button onClick={() => onEditAgent(agent)} className="p-1 rounded-xl hover:bg-muted/70">
                      <Settings2 className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground flex items-center gap-0.5">
                      <Zap className="w-3 h-3" /> {agent.model.split("/").pop()}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground">
                      temp: {agent.temperature}
                    </span>
                  </div>
                  {agent.system_prompt && (
                    <p className="text-xs text-muted-foreground/60 italic truncate" title={agent.system_prompt}>
                      💬 {agent.system_prompt.substring(0, 60)}...
                    </p>
                  )}
                </motion.div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Nenhum agente selecionado</p>
              )}
              <div className="mt-2 space-y-0.5">
                {agents.map(a => {
                  const isDefault = a.name === "Assistente Geral";
                  return (
                    <div key={a.id} className="flex items-center gap-0.5 group">
                      <button onClick={() => onSelectAgent(a.id)}
                        className={`flex-1 text-left px-2.5 py-1.5 rounded-xl text-xs transition-colors flex items-center gap-1.5 ${agent?.id === a.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50 text-foreground/70"}`}>
                        <span className="text-sm">{a.icon}</span> {a.name}
                      </button>
                      {onDeleteAgent && !isDefault && (
                        deletingAgentId === a.id ? (
                          <div className="flex gap-0.5 shrink-0">
                            <button onClick={() => handleDeleteAgent(a.id)} className="p-0.5 text-destructive"><Trash2 className="w-3 h-3" /></button>
                            <button onClick={() => setDeletingAgentId(null)} className="p-0.5 text-muted-foreground text-xs">✕</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeletingAgentId(a.id)}
                            className="p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive shrink-0 transition-opacity">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Active Project */}
      <div>
        <button onClick={() => toggleSection("project")} className="flex items-center justify-between mb-2 w-full text-left">
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5" /> Projeto
          </h3>
          <span className="text-xs text-muted-foreground">{expandedSections.project ? "▾" : "▸"}</span>
        </button>
        <AnimatePresence>
          {expandedSections.project && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="flex items-center justify-end mb-1">
                <button onClick={onNewProject} className="p-1 rounded-xl hover:bg-muted/70 transition-colors" title="Novo projeto">
                  <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
              {project ? (
                <motion.div key={project.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="p-2.5 rounded-xl border border-border/30 bg-muted/50">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{project.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{project.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{project.description}</p>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Nenhum projeto selecionado</p>
              )}
              <div className="mt-2 space-y-0.5">
                <button onClick={() => onSelectProject(null)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs transition-colors ${!project ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50 text-foreground/70"}`}>
                  📂 Sem projeto
                </button>
                {projects.map(p => (
                  <button key={p.id} onClick={() => onSelectProject(p.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs transition-colors flex items-center gap-1.5 ${project?.id === p.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50 text-foreground/70"}`}>
                    <span className="text-sm">{p.icon}</span> {p.name}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Skills */}
      <div>
        <button onClick={() => toggleSection("skills")} className="flex items-center justify-between mb-2 w-full text-left">
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> Skills
          </h3>
          <span className="text-xs text-muted-foreground">{expandedSections.skills ? "▾" : "▸"}</span>
        </button>
        <AnimatePresence>
          {expandedSections.skills && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <SkillsPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Knowledge Base */}
      <div>
        <button onClick={() => toggleSection("kb")} className="flex items-center justify-between mb-2 w-full text-left">
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" /> Base de Conhecimento ({knowledgeBase.length})
          </h3>
          <span className="text-xs text-muted-foreground">{expandedSections.kb ? "▾" : "▸"}</span>
        </button>
        <AnimatePresence>
          {expandedSections.kb && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              {knowledgeBase.length > 3 && (
                <div className="relative mb-1.5">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <input value={kbSearch} onChange={e => setKbSearch(e.target.value)} placeholder="Filtrar documentos..."
                    className="w-full text-xs bg-muted/50 border border-border/30 rounded-xl pl-7 pr-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
                </div>
              )}
              {filteredKb.length === 0 ? (
                <div className="text-center py-3">
                  <BookOpen className="w-5 h-5 mx-auto mb-1 text-muted-foreground/20" />
                  <p className="text-xs text-muted-foreground">{kbSearch ? "Nenhum resultado" : "Nenhum documento salvo"}</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">Peça à IA para salvar informações</p>
                </div>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {filteredKb.slice(0, 12).map(k => (
                    <div key={k.id} className="text-xs text-foreground/70 px-2 py-1.5 rounded-xl bg-muted/50 hover:bg-muted/70 transition-colors flex items-center gap-1 group">
                      <div className="flex-1 min-w-0">
                        <span className="text-primary/60 font-medium">[{k.category}]</span> {k.title}
                      </div>
                      {deletingKbId === k.id ? (
                        <div className="flex gap-0.5 shrink-0">
                          <button onClick={() => handleDeleteKnowledge(k.id)} className="p-0.5 text-destructive"><Trash2 className="w-3 h-3" /></button>
                          <button onClick={() => setDeletingKbId(null)} className="p-0.5 text-muted-foreground text-xs">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeletingKbId(k.id)} className="p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive shrink-0">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Memories */}
      <div>
        <button onClick={() => toggleSection("memories")} className="flex items-center justify-between mb-2 w-full text-left">
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5" /> Memórias ({memories.length})
          </h3>
          <span className="text-xs text-muted-foreground">{expandedSections.memories ? "▾" : "▸"}</span>
        </button>
        <AnimatePresence>
          {expandedSections.memories && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              {/* Memory actions */}
              {memories.length > 0 && (
                <div className="flex gap-1 mb-1.5">
                  <button onClick={handleExportMemories}
                    className="text-xs px-2 py-1 rounded-lg bg-muted/50 text-muted-foreground hover:bg-muted/70 flex items-center gap-1 transition-colors">
                    <Download className="w-3 h-3" /> Exportar
                  </button>
                  <button onClick={handleClearAllMemories}
                    className="text-xs px-2 py-1 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/15 flex items-center gap-1 transition-colors">
                    <Trash className="w-3 h-3" /> Limpar todas
                  </button>
                </div>
              )}
              {memories.length > 3 && (
                <div className="relative mb-1.5">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <input value={memSearch} onChange={e => setMemSearch(e.target.value)} placeholder="Filtrar memórias..."
                    className="w-full text-xs bg-muted/50 border border-border/30 rounded-xl pl-7 pr-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
                </div>
              )}
              {/* Category chips */}
              {memoryCategories.length > 1 && (
                <div className="flex gap-1 flex-wrap mb-1.5">
                  {memoryCategories.map(([cat, count]) => (
                    <button key={cat} onClick={() => setMemSearch(memSearch === cat ? "" : cat)}
                      className={`text-xs px-2 py-0.5 rounded-full transition-colors ${memSearch === cat ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground hover:bg-muted/70"}`}>
                      {cat} ({count})
                    </button>
                  ))}
                </div>
              )}
              {filteredMem.length === 0 ? (
                <div className="text-center py-4">
                  <Brain className="w-6 h-6 mx-auto mb-1.5 text-muted-foreground/20" />
                  <p className="text-xs text-muted-foreground">{memSearch ? "Nenhum resultado" : "Nenhuma memória salva"}</p>
                </div>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {filteredMem.slice(0, 15).map(m => (
                    <div key={m.id} className="text-xs text-foreground/70 px-2 py-1.5 rounded-xl bg-muted/50 hover:bg-muted/70 transition-colors flex items-center gap-1 group">
                      <div className="flex-1 min-w-0">
                        <span className="text-primary/60 font-medium">[{m.category}]</span> {m.content}
                      </div>
                      {deletingMemId === m.id ? (
                        <div className="flex gap-0.5 shrink-0">
                          <button onClick={() => handleDeleteMemory(m.id)} className="p-0.5 text-destructive"><Trash2 className="w-3 h-3" /></button>
                          <button onClick={() => setDeletingMemId(null)} className="p-0.5 text-muted-foreground text-xs">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeletingMemId(m.id)} className="p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive shrink-0">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Stats Panel */}
      <div>
        <button onClick={() => toggleSection("stats")} className="flex items-center justify-between mb-2 w-full text-left">
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Estatísticas</h3>
          <span className="text-xs text-muted-foreground">{expandedSections.stats ? "▾" : "▸"}</span>
        </button>
        {expandedSections.stats && <AIStatsPanel conversations={conversations} memories={memories} />}
      </div>
    </div>
  );
};

export default ContextPanel;

import { useState } from "react";
import { Plus, Zap, Search, Shield, ToggleLeft, ToggleRight, Pencil, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAISkills, SKILL_CATEGORIES, type AISkill } from "@/hooks/ai/useAISkills";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import SkillFormModal from "./SkillFormModal";

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  SKILL_CATEGORIES.map(c => [c.value, c.label])
);

const SkillsPanel = () => {
  const { activeWorkspaceId } = useWorkspace();
  const { skills, activeSkills, totalTokens, update, remove, isLoading } = useAISkills(activeWorkspaceId);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingSkill, setEditingSkill] = useState<AISkill | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = search
    ? skills.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase()) ||
        s.category.toLowerCase().includes(search.toLowerCase())
      )
    : skills;

  const handleToggle = async (skill: AISkill) => {
    try {
      await update.mutateAsync({ id: skill.id, is_active: !skill.is_active });
      toast.success(skill.is_active ? "Skill desativado" : "Skill ativado");
    } catch {
      toast.error("Erro ao atualizar skill");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      toast.success("Skill excluído");
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir");
    }
    setDeletingId(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-primary" /> Skills
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeSkills.length} skills ativos · ~{totalTokens} tokens
          </p>
        </div>
        <button
          onClick={() => { setEditingSkill(null); setShowForm(true); }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> Criar skill
        </button>
      </div>

      {/* Search */}
      {skills.length > 4 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar skills..."
            className="w-full text-xs bg-muted/50 border border-border/30 rounded-xl pl-8 pr-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 rounded-xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8">
          <Zap className="w-8 h-8 mx-auto mb-2 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">
            {search ? "Nenhum skill encontrado" : "Nenhum skill criado ainda"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <AnimatePresence mode="popLayout">
            {filtered.map(skill => (
              <motion.div
                key={skill.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`p-3 rounded-xl border transition-all ${
                  skill.is_active
                    ? "border-border/30 bg-muted/50"
                    : "border-border/10 bg-muted/20 opacity-60"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg shrink-0">{skill.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium truncate">{skill.name}</p>
                      {skill.is_system && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-0.5 shrink-0">
                          <Shield className="w-2.5 h-2.5" /> Sistema
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{skill.description}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/70 text-muted-foreground">
                        {CATEGORY_LABELS[skill.category] || skill.category}
                      </span>
                      {skill.token_estimate && (
                        <span className="text-[10px] text-muted-foreground/60">
                          ~{skill.token_estimate}t
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggle(skill)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title={skill.is_active ? "Desativar" : "Ativar"}
                    >
                      {skill.is_active ? (
                        <ToggleRight className="w-5 h-5 text-primary" />
                      ) : (
                        <ToggleLeft className="w-5 h-5" />
                      )}
                    </button>
                    {!skill.is_system && (
                      <div className="flex gap-0.5">
                        <button
                          onClick={() => { setEditingSkill(skill); setShowForm(true); }}
                          className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        {deletingId === skill.id ? (
                          <div className="flex gap-0.5">
                            <button onClick={() => handleDelete(skill.id)} className="p-0.5 text-destructive">
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <button onClick={() => setDeletingId(null)} className="p-0.5 text-muted-foreground text-[10px]">✕</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingId(skill.id)}
                            className="p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Form Modal */}
      <SkillFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditingSkill(null); }}
        initial={editingSkill}
      />
    </div>
  );
};

export default SkillsPanel;

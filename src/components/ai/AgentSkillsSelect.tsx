import { useState, useMemo } from "react";
import { Zap, X, Info } from "lucide-react";
import { useAISkills, type AISkill } from "@/hooks/ai/useAISkills";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  selectedSkillIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

const MAX_SKILLS = 5;

const AgentSkillsSelect = ({ selectedSkillIds, onChange, disabled }: Props) => {
  const { activeWorkspaceId } = useWorkspace();
  const { skills } = useAISkills(activeWorkspaceId);
  const [expanded, setExpanded] = useState(false);

  const activeSkills = useMemo(() => skills.filter(s => s.is_active), [skills]);

  const selectedSkills = useMemo(
    () => activeSkills.filter(s => selectedSkillIds.includes(s.id)),
    [activeSkills, selectedSkillIds]
  );

  const availableSkills = useMemo(
    () => activeSkills.filter(s => !selectedSkillIds.includes(s.id)),
    [activeSkills, selectedSkillIds]
  );

  const toggleSkill = (id: string) => {
    if (disabled) return;
    if (selectedSkillIds.includes(id)) {
      onChange(selectedSkillIds.filter(sid => sid !== id));
    } else {
      if (selectedSkillIds.length >= MAX_SKILLS) return;
      onChange([...selectedSkillIds, id]);
    }
  };

  const totalTokens = selectedSkills.reduce((sum, s) => sum + (s.token_estimate || 0), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium text-foreground">Skills ({selectedSkillIds.length}/{MAX_SKILLS})</span>
          <span className="text-[10px] text-muted-foreground">~{totalTokens}t</span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-primary hover:underline"
        >
          {expanded ? "Recolher" : "Gerenciar"}
        </button>
      </div>

      {/* Selected skills chips */}
      {selectedSkills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedSkills.map(skill => (
            <span
              key={skill.id}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-primary/10 text-primary"
            >
              {skill.icon} {skill.name}
              {!disabled && (
                <button onClick={() => toggleSkill(skill.id)} className="hover:text-primary/70">
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Expanded selection */}
      {expanded && (
        <div className="space-y-2 p-2 rounded-xl border border-border/30 bg-muted/30">
          {/* Info box - Rule 4 */}
          <div className="flex items-start gap-1.5 p-2 rounded-lg bg-primary/5 border border-primary/10">
            <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Este skill será injetado quando a mensagem contiver palavras relacionadas ao trigger.
              Não é injetado em toda mensagem.
            </p>
          </div>

          {availableSkills.length === 0 && selectedSkillIds.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">Nenhum skill disponível</p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {availableSkills.map(skill => (
                <button
                  key={skill.id}
                  onClick={() => toggleSkill(skill.id)}
                  disabled={disabled || selectedSkillIds.length >= MAX_SKILLS}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-2 ${
                    selectedSkillIds.length >= MAX_SKILLS
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-muted/70"
                  }`}
                >
                  <span className="text-sm">{skill.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{skill.name}</span>
                    {skill.trigger_description && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="ml-1 text-muted-foreground/50 text-[10px]">ⓘ</span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-xs">Trigger: {skill.trigger_description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  {skill.is_system && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary shrink-0">Sistema</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentSkillsSelect;

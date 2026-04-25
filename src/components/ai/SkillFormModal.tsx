import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAISkills, SKILL_CATEGORIES, type AISkill } from "@/hooks/ai/useAISkills";
import { useWorkspace } from "@/contexts/WorkspaceContext";

const ICONS = ["⚡", "📋", "🤝", "📊", "💰", "✍️", "⚖️", "💬", "🎯", "🔬", "🚀", "💡", "🛡️", "📣", "🧠", "🖥️", "👥", "📈"];

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: AISkill | null;
}

const SkillFormModal = ({ open, onClose, initial }: Props) => {
  const { activeWorkspaceId } = useWorkspace();
  const { create, update } = useAISkills(activeWorkspaceId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("⚡");
  const [category, setCategory] = useState("other");
  const [instructions, setInstructions] = useState("");
  const [triggerDesc, setTriggerDesc] = useState("");

  useEffect(() => {
    if (open) {
      setName(initial?.name || "");
      setDescription(initial?.description || "");
      setIcon(initial?.icon || "⚡");
      setCategory(initial?.category || "other");
      setInstructions(initial?.instructions || "");
      setTriggerDesc(initial?.trigger_description || "");
    }
  }, [initial, open]);

  const isEditing = !!initial?.id;
  const isSystem = initial?.is_system === true;
  const tokenEstimate = Math.ceil(instructions.length / 4);
  const charsRemaining = 2000 - instructions.length;

  const handleSave = async () => {
    if (!name.trim() || !description.trim() || !instructions.trim()) {
      toast.error("Preencha nome, descrição e instruções");
      return;
    }
    if (instructions.length > 2000) {
      toast.error("Instruções devem ter no máximo 2000 caracteres");
      return;
    }

    try {
      if (isEditing) {
        await update.mutateAsync({
          id: initial!.id,
          name,
          description,
          icon,
          category,
          instructions,
          trigger_description: triggerDesc || null,
        });
        toast.success("Skill atualizado");
      } else {
        await create.mutateAsync({
          name,
          description,
          icon,
          category,
          instructions,
          trigger_description: triggerDesc || undefined,
          workspace_id: activeWorkspaceId,
        });
        toast.success("Skill criado");
      }
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar skill");
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Skill" : "Novo Skill"}</DialogTitle>
        </DialogHeader>

        {isSystem && (
          <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/10">
            <p className="text-xs text-muted-foreground">
              🛡️ Skills de sistema são somente leitura.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {/* Icon */}
          <div>
            <Label className="text-xs text-muted-foreground">Ícone</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {ICONS.map(i => (
                <button
                  key={i}
                  onClick={() => !isSystem && setIcon(i)}
                  disabled={isSystem}
                  className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all ${
                    icon === i ? "ring-2 ring-primary scale-110" : "hover:bg-accent"
                  } ${isSystem ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <Label htmlFor="skill-name">Nome</Label>
            <Input
              id="skill-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Análise de Proposta"
              disabled={isSystem}
            />
          </div>

          {/* Category */}
          <div>
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory} disabled={isSystem}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[9999]" position="popper" sideOffset={4}>
                {SKILL_CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="skill-desc">Descrição</Label>
            <Input
              id="skill-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Breve descrição do que o skill faz"
              disabled={isSystem}
            />
          </div>

          {/* Trigger Description */}
          <div>
            <Label htmlFor="skill-trigger">Palavras-chave de ativação</Label>
            <Input
              id="skill-trigger"
              value={triggerDesc}
              onChange={e => setTriggerDesc(e.target.value)}
              placeholder="Ex: analisar proposta revisar orçamento estimativa"
              disabled={isSystem}
            />
            <p className="text-xs text-muted-foreground/60 mt-1">
              Separadas por espaço. O skill é injetado quando ≥2 palavras aparecem na mensagem.
            </p>
          </div>

          {/* Instructions */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label htmlFor="skill-instructions">Instruções</Label>
              <span className={`text-xs ${charsRemaining < 200 ? "text-destructive" : "text-muted-foreground"}`}>
                {instructions.length}/2000 · ~{tokenEstimate} tokens
              </span>
            </div>
            <Textarea
              id="skill-instructions"
              value={instructions}
              onChange={e => setInstructions(e.target.value.slice(0, 2000))}
              placeholder="Instruções detalhadas que serão injetadas no prompt quando o skill for ativado..."
              rows={6}
              disabled={isSystem}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            {!isSystem && (
              <Button onClick={handleSave} disabled={!name.trim() || !instructions.trim()}>
                {isEditing ? "Salvar" : "Criar"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SkillFormModal;

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { AIProject } from "@/hooks/ai/useAIProjects";

const ICONS = [
  "📁", "🚀", "📱", "🎯", "💼", "🏠", "🎓", "🎨", "📊", "🔧",
  "⚡", "🌍", "🧪", "🎮", "🛒", "🏆", "🎵", "💎", "🌈", "🐱",
  "🍀", "🔥", "❤️", "🧠", "📝", "🛡️", "🎪", "🏄", "🌙", "☀️",
  "🦊", "🐝", "🌟", "📚", "💡", "🌟",
];
const COLORS = [
  "hsl(220, 80%, 50%)", "hsl(35, 80%, 50%)", "hsl(150, 60%, 40%)",
  "hsl(280, 70%, 50%)", "hsl(0, 70%, 50%)", "hsl(45, 90%, 50%)",
  "hsl(340, 80%, 50%)", "hsl(90, 60%, 40%)", "hsl(315, 70%, 50%)",
  "hsl(180, 60%, 45%)", "hsl(250, 60%, 60%)", "hsl(200, 80%, 50%)",
];

interface ProjectFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (project: { name: string; description?: string; color?: string; icon?: string }) => void;
  initial?: Partial<AIProject>;
}

const ProjectForm = ({ open, onClose, onSave, initial }: ProjectFormProps) => {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [icon, setIcon] = useState(initial?.icon || "📁");
  const [color, setColor] = useState(initial?.color || "hsl(220, 80%, 50%)");

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name, description, color, icon });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Editar Projeto" : "Novo Projeto"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Ícone</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {ICONS.map(i => (
                  <button key={i} onClick={() => setIcon(i)}
                    className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all ${icon === i ? "ring-2 ring-primary scale-110" : "hover:bg-accent"}`}>{i}</button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <Label htmlFor="proj-name">Nome</Label>
              <Input id="proj-name" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Marketing Q1" />
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Cor</Label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-all ${color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : ""}`}
                  style={{ background: c }} />
              ))}
              <label className="w-7 h-7 rounded-full cursor-pointer border-2 border-dashed border-foreground/20 hover:border-foreground/40 transition-colors flex items-center justify-center overflow-hidden" style={{ background: COLORS.includes(color) ? 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' : color }} title="Cor personalizada">
                <input type="color" value={color.startsWith('#') ? color : '#8b5cf6'} onChange={e => setColor(e.target.value)} className="opacity-0 absolute w-0 h-0" />
                {COLORS.includes(color) && <span className="text-[10px] text-white font-bold drop-shadow">+</span>}
              </label>
            </div>
          </div>

          <div>
            <Label htmlFor="proj-desc">Descrição</Label>
            <Input id="proj-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Breve descrição do projeto" />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!name.trim()}>Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectForm;

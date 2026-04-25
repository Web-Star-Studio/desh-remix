import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const colorOptions = [
  "hsl(220, 80%, 50%)", "hsl(0, 80%, 50%)", "hsl(150, 70%, 40%)",
  "hsl(280, 70%, 55%)", "hsl(35, 90%, 50%)", "hsl(190, 80%, 45%)",
  "hsl(340, 80%, 50%)", "hsl(45, 90%, 55%)", "hsl(90, 60%, 40%)",
  "hsl(315, 70%, 50%)", "hsl(180, 60%, 45%)", "hsl(250, 60%, 60%)",
];

const iconOptions = [
  "📁", "💼", "📚", "🔬", "🎯", "💡", "🏠", "🎨", "⚡", "🌍",
  "🚀", "🧪", "🎮", "📊", "🛒", "🎓", "🏆", "🎵", "📱", "💎",
  "🔧", "🌈", "🐱", "🍀", "🔥", "❤️", "🧠", "📝", "🛡️", "🎪",
  "🏄", "🌙", "☀️", "🦊", "🐝", "🌟",
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, color: string, icon: string) => void;
  initial?: { name: string; color: string; icon: string };
}

export default function SearchProjectForm({ open, onClose, onSave, initial }: Props) {
  const [name, setName] = useState(initial?.name || "");
  const [color, setColor] = useState(initial?.color || colorOptions[0]);
  const [icon, setIcon] = useState(initial?.icon || iconOptions[0]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim(), color, icon);
    setName("");
    setColor(colorOptions[0]);
    setIcon(iconOptions[0]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar Projeto" : "Novo Projeto"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nome do projeto"
            onKeyDown={e => e.key === "Enter" && handleSave()}
            autoFocus
          />
          <div>
            <p className="text-xs text-muted-foreground mb-2">Cor</p>
            <div className="flex gap-2 flex-wrap">
              {colorOptions.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-all ${color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-105"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <label className="w-7 h-7 rounded-full cursor-pointer border-2 border-dashed border-foreground/20 hover:border-foreground/40 transition-colors flex items-center justify-center overflow-hidden" style={{ background: colorOptions.includes(color) ? 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' : color }} title="Cor personalizada">
                <input type="color" value={color.startsWith('#') ? color : '#8b5cf6'} onChange={e => setColor(e.target.value)} className="opacity-0 absolute w-0 h-0" />
                {colorOptions.includes(color) && <span className="text-[10px] text-white font-bold drop-shadow">+</span>}
              </label>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Ícone</p>
            <div className="flex gap-2 flex-wrap">
              {iconOptions.map(ic => (
                <button
                  key={ic}
                  onClick={() => setIcon(ic)}
                  className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all ${icon === ic ? "bg-primary/20 ring-1 ring-primary" : "hover:bg-foreground/5"}`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

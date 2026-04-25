import { useState, memo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, X, Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface NoteWordGoalProps {
  currentWords: number;
}

const STORAGE_KEY = "desh-note-word-goal";

function readGoal(): number | null {
  const v = localStorage.getItem(STORAGE_KEY);
  return v ? parseInt(v, 10) : null;
}

const presets = [250, 500, 1000, 2000, 5000];

const NoteWordGoal = memo(({ currentWords }: NoteWordGoalProps) => {
  const [goal, setGoal] = useState<number | null>(readGoal);
  const [editing, setEditing] = useState(false);
  const [customValue, setCustomValue] = useState("");

  const saveGoal = useCallback((v: number | null) => {
    setGoal(v);
    if (v) localStorage.setItem(STORAGE_KEY, String(v));
    else localStorage.removeItem(STORAGE_KEY);
    setEditing(false);
  }, []);

  const pct = goal ? Math.min(100, Math.round((currentWords / goal) * 100)) : 0;
  const reached = goal ? currentWords >= goal : false;

  if (!goal && !editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        title="Definir meta de palavras"
      >
        <Target className="w-3 h-3" />
      </button>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <Target className="w-3 h-3 text-muted-foreground" />
        {presets.map(p => (
          <button
            key={p}
            onClick={() => saveGoal(p)}
            className="px-1.5 py-0.5 rounded text-[10px] bg-muted/50 text-muted-foreground hover:bg-primary/15 hover:text-primary transition-colors"
          >
            {p}
          </button>
        ))}
        <input
          type="number"
          value={customValue}
          onChange={e => setCustomValue(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && customValue) saveGoal(parseInt(customValue)); }}
          placeholder="..."
          className="w-12 text-[10px] bg-muted/50 rounded px-1.5 py-0.5 text-foreground outline-none border border-border/30 focus:border-primary/40"
        />
        <button onClick={() => { setEditing(false); }} className="p-0.5 text-muted-foreground hover:text-foreground">
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors" title="Alterar meta">
        <Target className="w-3 h-3" />
      </button>
      <div className="w-16 relative">
        <Progress value={pct} className={`h-1.5 ${reached ? "[&>div]:bg-green-500" : "[&>div]:bg-primary"}`} />
      </div>
      <span className={`text-[10px] font-medium ${reached ? "text-green-500" : "text-muted-foreground/60"}`}>
        {reached && <Check className="w-3 h-3 inline mr-0.5" />}
        {currentWords}/{goal}
      </span>
      <button onClick={() => saveGoal(null)} className="p-0.5 text-muted-foreground/40 hover:text-destructive transition-colors" title="Remover meta">
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  );
});

NoteWordGoal.displayName = "NoteWordGoal";
export default NoteWordGoal;

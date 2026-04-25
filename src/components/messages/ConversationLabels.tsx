/**
 * ConversationLabels — Colored tag badges for conversations.
 * Labels are stored in the existing `labels` array on whatsapp_conversations.
 */
import { memo, useState } from "react";
import { Tag, X, Plus, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Predefined label colors
export const LABEL_PRESETS = [
  { key: "cliente", label: "Cliente", color: "bg-blue-500" },
  { key: "urgente", label: "Urgente", color: "bg-red-500" },
  { key: "suporte", label: "Suporte", color: "bg-amber-500" },
  { key: "lead", label: "Lead", color: "bg-green-500" },
  { key: "pessoal", label: "Pessoal", color: "bg-purple-500" },
  { key: "financeiro", label: "Financeiro", color: "bg-emerald-500" },
  { key: "trabalho", label: "Trabalho", color: "bg-cyan-500" },
  { key: "follow-up", label: "Follow-up", color: "bg-orange-500" },
] as const;

const SYSTEM_LABELS = ["pinned", "archived", "muted"];

export function getLabelColor(key: string): string {
  return LABEL_PRESETS.find(l => l.key === key)?.color || "bg-muted-foreground";
}

export function getLabelName(key: string): string {
  return LABEL_PRESETS.find(l => l.key === key)?.label || key;
}

/** Small inline badges showing conversation labels */
export const LabelBadges = memo(function LabelBadges({ labels }: { labels: string[] }) {
  const userLabels = labels.filter(l => !SYSTEM_LABELS.includes(l));
  if (userLabels.length === 0) return null;

  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {userLabels.slice(0, 3).map(l => (
        <span
          key={l}
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium text-white ${getLabelColor(l)}`}
        >
          {getLabelName(l)}
        </span>
      ))}
      {userLabels.length > 3 && (
        <span className="text-[9px] text-muted-foreground">+{userLabels.length - 3}</span>
      )}
    </div>
  );
});

/** Label picker popover for assigning labels */
interface LabelPickerProps {
  currentLabels: string[];
  onUpdate: (labels: string[]) => void;
}

export const LabelPicker = memo(function LabelPicker({ currentLabels, onUpdate }: LabelPickerProps) {
  const [open, setOpen] = useState(false);
  const userLabels = currentLabels.filter(l => !SYSTEM_LABELS.includes(l));
  const systemLabels = currentLabels.filter(l => SYSTEM_LABELS.includes(l));

  const toggleLabel = (key: string) => {
    const has = userLabels.includes(key);
    const newUserLabels = has ? userLabels.filter(l => l !== key) : [...userLabels, key];
    onUpdate([...systemLabels, ...newUserLabels]);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1 rounded hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
        title="Etiquetas"
      >
        <Tag className="w-3.5 h-3.5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-border/40 bg-background/95 backdrop-blur-xl shadow-xl shadow-black/20 p-1 z-40"
          >
            {LABEL_PRESETS.map(preset => {
              const active = userLabels.includes(preset.key);
              return (
                <button
                  key={preset.key}
                  onClick={() => toggleLabel(preset.key)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                    active ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${preset.color}`} />
                  <span className="flex-1 text-left">{preset.label}</span>
                  {active && <Check className="w-3 h-3 text-primary" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Columns2, Star } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";

interface CompareItem {
  id: string;
  name: string;
  fields: Record<string, string>;
}

interface Props {
  items: CompareItem[];
  onClose: () => void;
  accentColor?: string;
}

const ComparePanel = ({ items, onClose, accentColor = "primary" }: Props) => {
  const allKeys = useMemo(() => {
    const keys = new Set<string>();
    items.forEach(item => Object.keys(item.fields).forEach(k => keys.add(k)));
    return [...keys];
  }, [items]);

  if (items.length < 2) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-x-4 bottom-4 z-50 max-w-3xl mx-auto"
    >
      <GlassCard size="auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Columns2 className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Comparação</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-foreground/5 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left py-2 px-2 text-muted-foreground font-medium border-b border-foreground/5 w-28" />
                {items.map(item => (
                  <th key={item.id} className="text-left py-2 px-2 font-semibold text-foreground border-b border-foreground/5 min-w-[140px]">
                    {item.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allKeys.map(key => (
                <tr key={key} className="hover:bg-foreground/[0.02]">
                  <td className="py-1.5 px-2 text-muted-foreground font-medium border-b border-foreground/5">{key}</td>
                  {items.map(item => (
                    <td key={item.id} className="py-1.5 px-2 text-foreground/80 border-b border-foreground/5">
                      {item.fields[key] || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </motion.div>
  );
};

export default ComparePanel;

// Hook for managing compare state
export function useCompare(maxItems = 3) {
  const [selected, setSelected] = useState<CompareItem[]>([]);
  const [showPanel, setShowPanel] = useState(false);

  const toggle = (item: CompareItem) => {
    setSelected(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) return prev.filter(i => i.id !== item.id);
      if (prev.length >= maxItems) return prev;
      return [...prev, item];
    });
  };

  const isSelected = (id: string) => selected.some(i => i.id === id);

  const compare = () => {
    if (selected.length >= 2) setShowPanel(true);
  };

  const close = () => {
    setShowPanel(false);
    setSelected([]);
  };

  return { selected, toggle, isSelected, compare, close, showPanel, canCompare: selected.length >= 2 };
}

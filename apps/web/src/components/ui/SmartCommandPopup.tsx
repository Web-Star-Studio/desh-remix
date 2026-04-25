import React, { useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Hash, Command } from "lucide-react";
import type { SmartCommandItem, TriggerType } from "@/lib/smartCommandsData";
import type { PopupPlacement } from "@/hooks/ui/useSmartCommands";
import { useIsMobile } from "@/hooks/use-mobile";

interface SmartCommandPopupProps {
  open: boolean;
  items: SmartCommandItem[];
  selectedIndex: number;
  trigger: TriggerType | null;
  position: { top: number; left: number };
  onSelect: (item: SmartCommandItem) => void;
  onClose: () => void;
  placement?: PopupPlacement;
}

const TRIGGER_LABELS: Record<TriggerType, { label: string; icon: typeof User }> = {
  "@": { label: "Menções", icon: User },
  "/": { label: "Comandos", icon: Command },
  "#": { label: "Tags", icon: Hash },
};

const CATEGORY_COLORS: Record<string, string> = {
  Contato: "bg-blue-500/15 text-blue-400",
  Tarefa: "bg-amber-500/15 text-amber-400",
  Nota: "bg-emerald-500/15 text-emerald-400",
  Projeto: "bg-violet-500/15 text-violet-400",
  Tag: "bg-pink-500/15 text-pink-400",
  IA: "bg-primary/15 text-primary",
  Formatar: "bg-foreground/10 text-foreground/70",
  Inserir: "bg-foreground/10 text-foreground/70",
  Ação: "bg-orange-500/15 text-orange-400",
};

const POPUP_HEIGHT = 320; // max-h-80 = 20rem = 320px
const POPUP_WIDTH = 288; // w-72 = 18rem = 288px

const SmartCommandPopup = React.forwardRef<HTMLDivElement, SmartCommandPopupProps>(({
  open, items, selectedIndex, trigger, position, onSelect, onClose, placement = "below",
}, _ref) => {
  const listRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const triggerInfo = trigger ? TRIGGER_LABELS[trigger] : null;

  const computedStyle = useMemo(() => {
    if (placement === "below") {
      return { top: position.top, left: position.left };
    }
    
    if (placement === "above" || placement === "above-left") {
      // Open above: anchor bottom of popup to the top of input
      const style: React.CSSProperties = {
        bottom: window.innerHeight - position.top + 4,
      };

      if (isMobile || placement === "above") {
        // On mobile: align left with input, but clamp to viewport
        style.left = Math.max(8, Math.min(position.left, window.innerWidth - POPUP_WIDTH - 8));
      } else {
        // Desktop above-left: position to the left of the chat container
        style.right = window.innerWidth - position.left + 8;
        // Clamp to not go off-screen left
        const computedLeft = window.innerWidth - (window.innerWidth - position.left + 8) - POPUP_WIDTH;
        if (computedLeft < 8) {
          delete style.right;
          style.left = Math.max(8, Math.min(position.left, window.innerWidth - POPUP_WIDTH - 8));
        }
      }

      return style;
    }

    return { top: position.top, left: position.left };
  }, [placement, position, isMobile]);

  const animationY = placement === "above" || placement === "above-left" ? 4 : -4;

  return (
    <AnimatePresence>
      {open && items.length > 0 && (
        <motion.div
          data-smart-command-popup
          initial={{ opacity: 0, y: animationY, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: animationY, scale: 0.97 }}
          transition={{ duration: 0.15 }}
          className="fixed z-[9999] w-72 max-h-80 overflow-hidden rounded-xl border border-border/60 bg-popover/95 backdrop-blur-xl shadow-xl"
          style={computedStyle}
        >
          {/* Header */}
          {triggerInfo && (
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/30">
              <triggerInfo.icon className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{triggerInfo.label}</span>
            </div>
          )}

          {/* Items */}
          <div ref={listRef} className="overflow-y-auto max-h-64 py-1">
            {items.map((item, i) => {
              const Icon = item.icon;
              const catColor = CATEGORY_COLORS[item.category] || "bg-foreground/10 text-foreground/70";
              return (
                <button
                  key={item.id}
                  onClick={() => onSelect(item)}
                  onMouseEnter={() => {}}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                    i === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-foreground"
                  }`}
                >
                  <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${catColor}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">
                        {trigger === "/" ? `/${item.label}` : item.label}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${catColor}`}>
                        {item.category}
                      </span>
                    </div>
                    {item.description && (
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{item.description}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer hint */}
          <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border/30 text-[10px] text-muted-foreground/60">
            <span><kbd className="bg-foreground/5 rounded px-1 py-0.5 font-mono">↑↓</kbd> navegar</span>
            <span><kbd className="bg-foreground/5 rounded px-1 py-0.5 font-mono">↵</kbd> selecionar</span>
            <span><kbd className="bg-foreground/5 rounded px-1 py-0.5 font-mono">Esc</kbd> fechar</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

SmartCommandPopup.displayName = "SmartCommandPopup";

export default SmartCommandPopup;

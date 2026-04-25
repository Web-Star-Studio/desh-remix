import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings2, Eye, EyeOff, ChevronUp, ChevronDown, RotateCcw, X } from "lucide-react";
import { useFinanceWidgetPrefs, type FinanceWidgetConfig } from "@/hooks/finance/useFinanceWidgetPrefs";
import { Switch } from "@/components/ui/switch";

interface FinanceCustomizePanelProps {
  prefs: ReturnType<typeof useFinanceWidgetPrefs>;
}

const TAB_LABELS: Record<string, string> = {
  overview: "Visão Geral",
  transactions: "Transações",
  investments: "Investimentos",
  openbanking: "Open Banking",
};

const FinanceCustomizePanel = ({ prefs }: FinanceCustomizePanelProps) => {
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("overview");

  const { widgets, toggleWidget, moveWidget, resetDefaults, getTabWidgets } = prefs;
  const tabs = ["overview", "transactions", "investments", "openbanking"];

  const enabledCount = widgets.filter(w => w.enabled).length;
  const totalCount = widgets.length;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-card text-foreground/60 hover:text-foreground transition-colors text-xs font-medium"
        title="Personalizar módulos"
      >
        <Settings2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Personalizar</span>
      </button>

      {/* Slide-over panel */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l border-border z-50 flex flex-col shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Personalizar Painel</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {enabledCount}/{totalCount} módulos ativos
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={resetDefaults}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Restaurar padrões"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Resetar
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tab selector */}
              <div className="flex gap-1 px-5 py-3 border-b border-border overflow-x-auto no-scrollbar">
                {tabs.map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveSection(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      activeSection === tab
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {TAB_LABELS[tab]}
                    <span className="ml-1.5 text-[10px] opacity-60">
                      {getTabWidgets(tab).filter(w => w.enabled).length}/{getTabWidgets(tab).length}
                    </span>
                  </button>
                ))}
              </div>

              {/* Widget list */}
              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
                {getTabWidgets(activeSection).map((widget, idx, arr) => (
                  <WidgetRow
                    key={widget.id}
                    widget={widget}
                    isFirst={idx === 0}
                    isLast={idx === arr.length - 1}
                    onToggle={() => toggleWidget(widget.id)}
                    onMoveUp={() => moveWidget(widget.id, "up")}
                    onMoveDown={() => moveWidget(widget.id, "down")}
                  />
                ))}
              </div>

              {/* Footer hint */}
              <div className="px-5 py-3 border-t border-border">
                <p className="text-[11px] text-muted-foreground text-center">
                  Alterações são salvas automaticamente
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

function WidgetRow({
  widget,
  isFirst,
  isLast,
  onToggle,
  onMoveUp,
  onMoveDown,
}: {
  widget: FinanceWidgetConfig;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
        widget.enabled
          ? "border-border bg-card"
          : "border-transparent bg-muted/40 opacity-60"
      }`}
    >
      {/* Reorder arrows */}
      <div className="flex flex-col gap-0.5">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronUp className="w-3 h-3" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {widget.enabled ? (
            <Eye className="w-3.5 h-3.5 text-primary shrink-0" />
          ) : (
            <EyeOff className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          )}
          <span className="text-sm font-medium text-foreground truncate">{widget.label}</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 pl-5">{widget.description}</p>
      </div>

      {/* Toggle */}
      <Switch
        checked={widget.enabled}
        onCheckedChange={onToggle}
        className="shrink-0"
      />
    </div>
  );
}

export default FinanceCustomizePanel;

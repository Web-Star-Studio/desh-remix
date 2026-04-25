import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, X, Loader2, AlertTriangle, Brain, ChevronDown, ChevronUp,
  Zap, Tag, ArrowRight, MessageSquare, Focus, Eye, EyeOff,
} from "lucide-react";
import type { InboxAIAnalysis, SmartGroup } from "@/hooks/common/useInboxAI";

interface InboxAIPanelProps {
  analysis: InboxAIAnalysis | null;
  loading: boolean;
  onClose: () => void;
  onAnalyze: () => void;
  onGroupClick?: (group: SmartGroup) => void;
  onActionClick?: (itemId: string, actionType: string) => void;
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
  itemTitleMap?: Record<string, string>;
}

const Section = ({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full text-left mb-1.5"
      >
        {open ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronUp className="w-3 h-3 text-muted-foreground" />}
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const InboxAIPanel = ({ analysis, loading, onClose, onAnalyze, onGroupClick, onActionClick, focusMode, onToggleFocusMode, itemTitleMap = {} }: InboxAIPanelProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="glass-card rounded-xl p-4 mb-4 border border-primary/20 max-h-[80vh] overflow-y-auto"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Análise Inteligente</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {onToggleFocusMode && analysis && (
            <button
              onClick={onToggleFocusMode}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                focusMode
                  ? "bg-primary text-primary-foreground"
                  : "glass-card text-muted-foreground hover:text-foreground border border-foreground/10"
              }`}
              title="Modo Foco: mostra apenas itens prioritários sugeridos pela IA"
            >
              {focusMode ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {focusMode ? "Sair do Foco" : "Modo Foco"}
            </button>
          )}
          {!loading && !analysis && (
            <button
              onClick={onAnalyze}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Sparkles className="w-3 h-3" /> Analisar
            </button>
          )}
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Analisando seu inbox com IA...</span>
        </div>
      )}

      {analysis && (
        <div className="space-y-3">
          {/* Urgent Alert */}
          {analysis.urgentAlert && (
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0 animate-pulse" />
              <p className="text-xs text-destructive font-medium">{analysis.urgentAlert}</p>
            </motion.div>
          )}

          {/* Summary */}
          <div className="p-2.5 rounded-lg bg-foreground/5 border border-foreground/10">
            <p className="text-xs text-foreground/80 leading-relaxed">{analysis.summary}</p>
          </div>

          {/* Smart Groups */}
          {(analysis.smartGroups ?? []).length > 0 && (
            <Section title="Agrupamentos inteligentes">
              <div className="flex flex-wrap gap-2">
                {(analysis.smartGroups ?? []).map((group, i) => (
                  <button
                    key={i}
                    onClick={() => onGroupClick?.(group)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium glass-card hover:bg-foreground/5 transition-colors border border-foreground/10"
                    title={group.reason}
                  >
                    <span>{group.icon}</span>
                    <span className="text-foreground">{group.label}</span>
                    <span className="text-muted-foreground/60 text-[10px]">({group.itemIds?.length ?? 0})</span>
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* Auto-triage Labels */}
          {(analysis.autoTriageLabels ?? []).length > 0 && (
            <Section title="Auto-triagem" defaultOpen={false}>
              <div className="flex flex-wrap gap-1.5">
                {(analysis.autoTriageLabels ?? []).slice(0, 12).map((triage, i) => {
                  const colorMap: Record<string, string> = {
                    red: "bg-red-500/10 text-red-500 border-red-500/20",
                    blue: "bg-sky-500/10 text-sky-500 border-sky-500/20",
                    green: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                    yellow: "bg-amber-500/10 text-amber-500 border-amber-500/20",
                    purple: "bg-purple-500/10 text-purple-500 border-purple-500/20",
                  };
                  return (
                    <span
                      key={i}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${colorMap[triage.color] || colorMap.blue}`}
                    >
                      <Tag className="w-2.5 h-2.5" /> {triage.label}
                    </span>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Suggested Actions */}
          {(analysis.suggestedActions ?? []).length > 0 && (
            <Section title="Ações sugeridas pela IA">
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {(analysis.suggestedActions ?? []).slice(0, 8).map((sa, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-foreground/5 border border-foreground/10">
                    <Zap className="w-3 h-3 text-primary shrink-0" />
                    <span className="text-[11px] text-foreground/70 truncate flex-1">{itemTitleMap[sa.itemId] || sa.itemId}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {(sa.actions ?? []).map((action, ai) => (
                        <button
                          key={ai}
                          onClick={() => onActionClick?.(sa.itemId, action.type)}
                          className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        >
                          <span>{action.icon}</span> {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Priority overrides */}
          {(analysis.priorityOverrides ?? []).length > 0 && (
            <Section title={`${(analysis.priorityOverrides ?? []).length} item(ns) repriorizado(s)`} defaultOpen={false}>
              <div className="space-y-1">
                {(analysis.priorityOverrides ?? []).map((po, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                      <ArrowRight className="w-3 h-3 text-amber-500 shrink-0" />
                      <span className="text-[10px] text-foreground/70 truncate flex-1">{itemTitleMap[po.itemId] || po.itemId}</span>
                      <span className="text-[10px] text-amber-600 font-medium shrink-0">→ P{po.newPriority}</span>
                      <span className="text-[9px] text-muted-foreground truncate max-w-[120px]">{po.reason}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Re-analyze button */}
          <button
            onClick={onAnalyze}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
          >
            <Sparkles className="w-3 h-3" /> Re-analisar
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default InboxAIPanel;

import { Brain, X, Sparkles, Users, TrendingUp, Zap, AlertTriangle, BarChart3, Mail, ArrowRight } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";

interface InboxIntelligenceData {
  total_unread: number;
  urgent_count: number;
  main_senders: string[];
  categories?: Array<{ name: string; count: number; icon: string }>;
  priority_emails?: Array<{ index: number; from: string; subject: string; urgency: "critical" | "high" | "medium"; reason: string }>;
  suggested_actions: Array<{ action: string; description: string; email_count: number; impact?: "high" | "medium" | "low" }>;
  inbox_score: number;
  insight: string;
  trends?: { newsletter_percentage: number; needs_response: number; pattern: string };
  focus_email_index?: number;
}

interface InboxIntelligencePanelProps {
  show: boolean;
  onClose: () => void;
  data: InboxIntelligenceData | null;
}

const urgencyStyles: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: "bg-red-500/10 border-red-500/20", text: "text-red-500", label: "Crítico" },
  high: { bg: "bg-orange-500/10 border-orange-500/20", text: "text-orange-500", label: "Alto" },
  medium: { bg: "bg-yellow-500/10 border-yellow-500/20", text: "text-yellow-500", label: "Médio" },
};

const impactStyles: Record<string, string> = {
  high: "bg-green-500/10 text-green-600 border-green-500/20",
  medium: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  low: "bg-muted text-muted-foreground border-foreground/5",
};

const InboxIntelligencePanel = ({ show, onClose, data }: InboxIntelligencePanelProps) => (
  <AnimatePresence>
    {show && data && (
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
        <GlassCard size="auto" className="mb-3 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Análise Inteligente</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                {data.total_unread + data.urgent_count} itens
              </span>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>

          <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
            {/* Inbox Score + Stats Row */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">Saúde da Inbox</span>
                  <span className={`text-sm font-bold ${data.inbox_score >= 80 ? "text-green-500" : data.inbox_score >= 50 ? "text-yellow-500" : "text-red-500"}`}>
                    {data.inbox_score}/100
                  </span>
                </div>
                <Progress value={data.inbox_score} className="h-2" />
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-center">
                  <span className="text-sm font-bold text-foreground block">{data.total_unread}</span>
                  <span className="text-[10px] text-muted-foreground">não lidos</span>
                </div>
                {data.urgent_count > 0 && (
                  <div className="text-center">
                    <span className="text-sm font-bold text-orange-500 block">{data.urgent_count}</span>
                    <span className="text-[10px] text-muted-foreground">urgentes</span>
                  </div>
                )}
              </div>
            </div>

            {/* Insight */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/80">{data.insight}</p>
            </div>

            {/* Priority Emails */}
            {data.priority_emails && data.priority_emails.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-xs font-semibold text-foreground">E-mails Prioritários</span>
                </div>
                <div className="space-y-1.5">
                  {data.priority_emails.map((pe, i) => {
                    const style = urgencyStyles[pe.urgency] || urgencyStyles.medium;
                    return (
                      <div key={i} className={`p-2.5 rounded-lg border ${style.bg}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${style.text} bg-background/50`}>
                            {style.label}
                          </span>
                          <span className="text-xs font-medium text-foreground truncate">{pe.from}</span>
                        </div>
                        <p className="text-xs text-foreground/80 font-medium truncate">{pe.subject}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{pe.reason}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Categories */}
            {data.categories && data.categories.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-foreground">Categorias</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {data.categories.map((cat, i) => (
                    <div key={i} className="flex items-center gap-1.5 p-2 rounded-lg bg-foreground/3 border border-foreground/5">
                      <span className="text-sm">{cat.icon}</span>
                      <div className="min-w-0">
                        <span className="text-[11px] font-medium text-foreground block truncate">{cat.name}</span>
                        <span className="text-[10px] text-muted-foreground">{cat.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trends */}
            {data.trends && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-foreground/3 border border-foreground/5">
                  <Mail className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[11px] text-foreground">
                    <strong>{data.trends.needs_response}</strong> aguardam resposta
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-foreground/3 border border-foreground/5">
                  <TrendingUp className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[11px] text-foreground">
                    <strong>{data.trends.newsletter_percentage}%</strong> newsletters
                  </span>
                </div>
              </div>
            )}

            {/* Trend Pattern */}
            {data.trends?.pattern && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/50 border border-foreground/5">
                <TrendingUp className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground">{data.trends.pattern}</p>
              </div>
            )}

            {/* Main senders */}
            {data.main_senders.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Principais remetentes</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {data.main_senders.slice(0, 5).map((sender, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-foreground/5 text-xs text-foreground/70 border border-foreground/10">{sender}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested actions */}
            {data.suggested_actions.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-foreground mb-1.5 block">Ações sugeridas</span>
                <div className="space-y-1.5">
                  {data.suggested_actions.map((action, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-foreground/3 border border-foreground/5">
                      <ArrowRight className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="text-xs font-medium text-foreground">{action.action}</p>
                          {action.impact && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${impactStyles[action.impact] || impactStyles.low}`}>
                              {action.impact === "high" ? "Alto impacto" : action.impact === "medium" ? "Médio" : "Baixo"}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">{action.description}</p>
                      </div>
                      {action.email_count > 0 && (
                        <span className="text-[10px] text-muted-foreground bg-foreground/5 px-1.5 py-0.5 rounded shrink-0">{action.email_count}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </GlassCard>
      </motion.div>
    )}
  </AnimatePresence>
);

export default InboxIntelligencePanel;

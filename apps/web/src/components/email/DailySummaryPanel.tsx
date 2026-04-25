import { CalendarDays, Loader2, X, Sparkles, Mail, MailOpen, AlertTriangle, Zap, TrendingUp, Star, Reply } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";

interface DailySummaryData {
  overall_insight: string;
  total_today: number;
  unread_today: number;
  productivity_score?: number;
  verdict?: string;
  spotlight?: {
    email_index: number;
    from: string;
    subject: string;
    why: string;
    urgency: "critical" | "high" | "medium";
  };
  alerts?: Array<{
    icon: string;
    message: string;
    severity: "critical" | "warning" | "info";
  }>;
  categories: Array<{
    name: string;
    icon?: string;
    count: number;
    unread: number;
    urgency?: "critical" | "high" | "medium" | "low";
    top_senders?: string[];
    response_needed?: number;
    suggested_actions: Array<{ label: string; description: string }>;
  }>;
}

interface DailySummaryPanelProps {
  show: boolean;
  onClose: () => void;
  data: DailySummaryData | null;
  loading: boolean;
}

const URGENCY_CONFIG = {
  critical: { bg: "bg-red-500/10", text: "text-red-500", label: "Crítico" },
  high: { bg: "bg-amber-500/10", text: "text-amber-500", label: "Alto" },
  medium: { bg: "bg-blue-500/10", text: "text-blue-500", label: "Médio" },
  low: { bg: "bg-muted", text: "text-muted-foreground", label: "Baixo" },
};

const ALERT_SEVERITY = {
  critical: "bg-red-500/10 border-red-500/20 text-red-600",
  warning: "bg-amber-500/10 border-amber-500/20 text-amber-600",
  info: "bg-blue-500/10 border-blue-500/20 text-blue-600",
};

const getScoreColor = (score: number) => {
  if (score >= 80) return "text-green-500";
  if (score >= 50) return "text-amber-500";
  return "text-red-500";
};

const getScoreBarColor = (score: number) => {
  if (score >= 80) return "[&>div]:bg-green-500";
  if (score >= 50) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-red-500";
};

const DailySummaryPanel = ({ show, onClose, data, loading }: DailySummaryPanelProps) => (
  <AnimatePresence>
    {show && (
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
        <GlassCard size="auto" className="mb-3 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Resumo do Dia</h3>
              {data?.verdict && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{data.verdict}</span>
              )}
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-sm">Analisando até 60 e-mails do dia...</span>
            </div>
          ) : data ? (
            <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
              {/* Insight + Score Row */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground/80">{data.overall_insight}</p>
                </div>
                {data.productivity_score != null && (
                  <div className="shrink-0 text-center">
                    <span className={`text-lg font-bold ${getScoreColor(data.productivity_score)}`}>{data.productivity_score}</span>
                    <p className="text-[10px] text-muted-foreground">score</p>
                  </div>
                )}
              </div>

              {/* Productivity Score Bar */}
              {data.productivity_score != null && (
                <div className="px-1">
                  <Progress value={data.productivity_score} className={`h-1.5 ${getScoreBarColor(data.productivity_score)}`} />
                </div>
              )}

              {/* Stats Row */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{data.total_today}</span>
                  <span className="text-xs text-muted-foreground">hoje</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MailOpen className="w-3.5 h-3.5 text-primary" />
                  <span className="text-sm font-medium text-primary">{data.unread_today}</span>
                  <span className="text-xs text-muted-foreground">não lidos</span>
                </div>
              </div>

              {/* Alerts */}
              {data.alerts && data.alerts.length > 0 && (
                <div className="space-y-1.5">
                  {data.alerts.map((alert, i) => (
                    <div key={i} className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${ALERT_SEVERITY[alert.severity]}`}>
                      <span>{alert.icon}</span>
                      <span className="font-medium">{alert.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Spotlight Email */}
              {data.spotlight && (
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Star className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-semibold text-foreground">E-mail em Destaque</span>
                    {data.spotlight.urgency && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${URGENCY_CONFIG[data.spotlight.urgency].bg} ${URGENCY_CONFIG[data.spotlight.urgency].text}`}>
                        {URGENCY_CONFIG[data.spotlight.urgency].label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-foreground truncate">{data.spotlight.subject}</p>
                  <p className="text-[11px] text-muted-foreground truncate">De: {data.spotlight.from}</p>
                  <p className="text-[11px] text-primary mt-1">{data.spotlight.why}</p>
                </div>
              )}

              {/* Categories Grid */}
              <div className="grid gap-2 sm:grid-cols-2">
                {data.categories.map((cat, i) => {
                  const urgency = cat.urgency ? URGENCY_CONFIG[cat.urgency] : null;
                  return (
                    <div key={i} className="p-2.5 rounded-lg bg-foreground/[0.03] border border-foreground/5">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          {cat.icon && <span className="text-xs">{cat.icon}</span>}
                          <span className="text-xs font-semibold text-foreground capitalize">{cat.name}</span>
                          {urgency && cat.urgency !== "low" && (
                            <span className={`text-[9px] px-1 py-0.5 rounded ${urgency.bg} ${urgency.text} font-medium`}>
                              {urgency.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">{cat.count}</span>
                          {cat.unread > 0 && <span className="text-xs text-primary font-medium">{cat.unread} novos</span>}
                        </div>
                      </div>
                      {cat.top_senders && cat.top_senders.length > 0 && (
                        <p className="text-[11px] text-muted-foreground truncate mb-1">De: {cat.top_senders.slice(0, 3).join(", ")}</p>
                      )}
                      {(cat.response_needed ?? 0) > 0 && (
                        <div className="flex items-center gap-1 mb-1">
                          <Reply className="w-2.5 h-2.5 text-amber-500" />
                          <span className="text-[11px] text-amber-600 font-medium">{cat.response_needed} aguardando resposta</span>
                        </div>
                      )}
                      {cat.suggested_actions.length > 0 && (
                        <div className="space-y-0.5 mt-1">
                          {cat.suggested_actions.slice(0, 2).map((action, j) => (
                            <div key={j} className="flex items-start gap-1">
                              <span className="text-primary text-xs mt-0.5">→</span>
                              <span className="text-xs text-foreground/70"><span className="font-medium text-foreground/90">{action.label}</span> {action.description}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado disponível</p>
          )}
        </GlassCard>
      </motion.div>
    )}
  </AnimatePresence>
);

export default DailySummaryPanel;

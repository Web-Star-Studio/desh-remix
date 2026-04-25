import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useProactiveInsights, type AIInsight } from "@/hooks/ai/useProactiveInsights";
import PageLayout from "@/components/dashboard/PageLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Info, AlertTriangle, CheckCircle, X, ChevronRight, CheckCheck, Filter,
  Sparkles, Brain, Wallet, Clock, TrendingUp, Users, Target, Calendar, PiggyBank, Lightbulb, RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const typeConfig = {
  info: { icon: Info, bg: "bg-primary/10 border-primary/20", text: "text-primary", label: "Informativo" },
  warning: { icon: AlertTriangle, bg: "bg-yellow-500/10 border-yellow-500/20", text: "text-yellow-600 dark:text-yellow-400", label: "Alerta" },
  success: { icon: CheckCircle, bg: "bg-green-500/10 border-green-500/20", text: "text-green-600 dark:text-green-400", label: "Sucesso" },
};

const insightIconMap: Record<string, any> = {
  "alert-triangle": AlertTriangle,
  clock: Clock,
  wallet: Wallet,
  "trending-up": TrendingUp,
  users: Users,
  target: Target,
  calendar: Calendar,
  "piggy-bank": PiggyBank,
  lightbulb: Lightbulb,
};

const insightSeverityConfig = {
  info: { bg: "bg-blue-500/10 border-blue-500/20", text: "text-blue-500", glow: "shadow-blue-500/5" },
  warning: { bg: "bg-amber-500/10 border-amber-500/20", text: "text-amber-500", glow: "shadow-amber-500/5" },
  success: { bg: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-500", glow: "shadow-emerald-500/5" },
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { broadcasts, visible, dismissed, dismiss, dismissAll, loading } = useNotifications();
  const { insights, loading: insightsLoading, dismissInsight, dismissAllInsights, analyzeNow } = useProactiveInsights();
  const [filterType, setFilterType] = useState<"all" | "info" | "warning" | "success">("all");
  const [activeTab, setActiveTab] = useState<"all" | "insights">("all");

  const formatTime = (d: string) => {
    try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: ptBR }); }
    catch { return d; }
  };

  const filtered = broadcasts.filter(b => filterType === "all" || b.type === filterType);
  const newNotifs = filtered.filter(b => visible.some(v => v.id === b.id));
  const oldNotifs = filtered.filter(b => dismissed.some(d => d.id === b.id));

  const handleClick = (b: any) => {
    if (b.action_url) navigate(b.action_url);
  };

  return (
    <PageLayout maxWidth="7xl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-xl bg-primary/10">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Notificações</h1>
            <p className="text-xs text-muted-foreground">
              {newNotifs.length + insights.length} nova{(newNotifs.length + insights.length) !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 glass-card rounded-xl p-1 mb-4 w-fit">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 press-scale ${
            activeTab === "all" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Bell className="w-3.5 h-3.5" /> Avisos
          {newNotifs.length > 0 && (
            <span className="bg-primary/20 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">{newNotifs.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("insights")}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 press-scale ${
            activeTab === "insights" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Brain className="w-3.5 h-3.5" /> Insights IA
          {insights.length > 0 && (
            <span className="bg-amber-500/20 text-amber-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{insights.length}</span>
          )}
        </button>
      </div>

      {/* ---- INSIGHTS TAB ---- */}
      {activeTab === "insights" && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={analyzeNow}
              disabled={insightsLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground glass-card hover:bg-foreground/5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${insightsLoading ? "animate-spin" : ""}`} />
              {insightsLoading ? "Analisando..." : "Analisar agora"}
            </button>
            {insights.length > 1 && (
              <button
                onClick={dismissAllInsights}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground glass-card hover:bg-foreground/5 transition-colors ml-auto"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Dispensar todas
              </button>
            )}
          </div>

          {insightsLoading && insights.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="glass-card rounded-2xl p-4 animate-pulse">
                  <div className="h-3 w-40 bg-foreground/10 rounded mb-2" />
                  <div className="h-2.5 w-56 bg-foreground/5 rounded" />
                </div>
              ))}
            </div>
          ) : insights.length > 0 ? (
            <div className="space-y-2">
              <AnimatePresence>
                {insights.map((insight, idx) => {
                  const sevConfig = insightSeverityConfig[insight.severity] || insightSeverityConfig.info;
                  const IconComp = insightIconMap[insight.icon] || Lightbulb;
                  return (
                    <motion.div
                      key={insight.id}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`glass-card border ${sevConfig.bg} rounded-xl px-4 py-3 flex items-start gap-3 ${sevConfig.glow} shadow-sm ${
                        insight.action_url ? "cursor-pointer hover:bg-foreground/5 transition-colors" : ""
                      }`}
                      onClick={() => insight.action_url && navigate(insight.action_url)}
                    >
                      <div className={`mt-0.5 p-1.5 rounded-lg ${sevConfig.bg}`}>
                        <IconComp className={`w-4 h-4 ${sevConfig.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-500/70">Insight IA</span>
                        </div>
                        <p className={`text-xs font-semibold ${sevConfig.text}`}>{insight.title}</p>
                        <p className="text-xs text-foreground/70 mt-0.5">{insight.message}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">{formatTime(insight.created_at)}</p>
                      </div>
                      {insight.action_url && <ChevronRight className="w-4 h-4 text-muted-foreground/50 mt-1 flex-shrink-0" />}
                      <button
                        onClick={e => { e.stopPropagation(); dismissInsight(insight.id); }}
                        className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mt-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-8 text-center">
              <Brain className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum insight ativo</p>
              <p className="text-xs text-muted-foreground/60 mt-1">A IA analisa seus dados a cada 30 min</p>
            </div>
          )}
        </div>
      )}

      {/* ---- BROADCASTS TAB ---- */}
      {activeTab === "all" && (
        <>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="flex items-center gap-1 glass-card rounded-xl p-1">
              <Filter className="w-3.5 h-3.5 text-muted-foreground ml-2" />
              {(["all", "info", "warning", "success"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filterType === t ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "all" ? "Todas" : typeConfig[t].label}
                </button>
              ))}
            </div>
            {newNotifs.length > 1 && (
              <button
                onClick={dismissAll}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground glass-card hover:bg-foreground/5 transition-colors ml-auto"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Dispensar todas
              </button>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="glass-card rounded-2xl p-4 animate-pulse">
                  <div className="h-3 w-32 bg-foreground/10 rounded mb-2" />
                  <div className="h-2.5 w-48 bg-foreground/5 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {newNotifs.length > 0 && (
                <div className="space-y-2 mb-6">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Novas</p>
                  <AnimatePresence>
                    {newNotifs.map(b => {
                      const config = typeConfig[b.type] || typeConfig.info;
                      const Icon = config.icon;
                      return (
                        <motion.div
                          key={b.id}
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className={`glass-card border ${config.bg} rounded-xl px-4 py-3 flex items-start gap-3 ${
                            b.action_url ? "cursor-pointer hover:bg-foreground/5 transition-colors" : ""
                          }`}
                          onClick={() => handleClick(b)}
                        >
                          <div className={`mt-0.5 ${config.text}`}><Icon className="w-4 h-4" /></div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold ${config.text}`}>{b.title}</p>
                            <p className="text-xs text-foreground/70 mt-0.5">{b.message}</p>
                            <p className="text-[10px] text-muted-foreground/60 mt-1">{formatTime(b.created_at)}</p>
                          </div>
                          {b.action_url && <ChevronRight className="w-4 h-4 text-muted-foreground/50 mt-1 flex-shrink-0" />}
                          <button onClick={e => { e.stopPropagation(); dismiss(b.id); }} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mt-0.5">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}

              {oldNotifs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Anteriores</p>
                  {oldNotifs.map(b => {
                    const config = typeConfig[b.type] || typeConfig.info;
                    const Icon = config.icon;
                    return (
                      <div
                        key={b.id}
                        className={`glass-card rounded-xl px-4 py-3 flex items-start gap-3 opacity-60 ${
                          b.action_url ? "cursor-pointer hover:opacity-80 transition-opacity" : ""
                        }`}
                        onClick={() => handleClick(b)}
                      >
                        <div className={`mt-0.5 ${config.text}`}><Icon className="w-3.5 h-3.5" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-foreground/70">{b.title}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{b.message}</p>
                          <p className="text-[9px] text-muted-foreground/60 mt-1">{formatTime(b.created_at)}</p>
                        </div>
                        {b.action_url && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 mt-1 flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}

              {filtered.length === 0 && (
                <div className="glass-card rounded-2xl p-8 text-center">
                  <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </PageLayout>
  );
};

export default NotificationsPage;

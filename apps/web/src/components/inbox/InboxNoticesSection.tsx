import { memo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Filter, Info, AlertTriangle, CheckCircle,
  ChevronRight, X, CheckCheck, RotateCcw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

type NoticeFilter = "all" | "info" | "warning" | "success";

interface Broadcast {
  id: string;
  title: string;
  message: string;
  type: string;
  action_url?: string | null;
  created_at: string;
}

const NOTICE_FILTERS: { key: NoticeFilter; label: string }[] = [
  { key: "all",     label: "Todos" },
  { key: "info",    label: "Informativo" },
  { key: "warning", label: "Alerta" },
  { key: "success", label: "Sucesso" },
];

const noticeConfig = {
  info:    { icon: Info,          bg: "bg-primary/10 border-primary/20",          text: "text-primary" },
  warning: { icon: AlertTriangle, bg: "bg-yellow-500/10 border-yellow-500/20",    text: "text-yellow-500" },
  success: { icon: CheckCircle,   bg: "bg-emerald-500/10 border-emerald-500/20",  text: "text-emerald-500" },
};

const formatTime = (d: string) => {
  try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: ptBR }); }
  catch { return d; }
};

interface InboxNoticesSectionProps {
  newNotices: Broadcast[];
  oldNotices: Broadcast[];
  loading: boolean;
  noticeFilter: NoticeFilter;
  onNoticeFilterChange: (f: NoticeFilter) => void;
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onUndismiss: (id: string) => void;
  isMainAll: boolean;
}

const InboxNoticesSection = memo(({
  newNotices, oldNotices, loading,
  noticeFilter, onNoticeFilterChange,
  onDismiss, onDismissAll, onUndismiss,
  isMainAll,
}: InboxNoticesSectionProps) => {
  const navigate = useNavigate();

  const handleUndismiss = useCallback(async (id: string) => {
    await onUndismiss(id);
    toast({ title: "Aviso restaurado" });
  }, [onUndismiss]);

  return (
    <div className={isMainAll ? "mt-2" : ""}>
      {isMainAll && (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2">Avisos</p>
      )}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-1 glass-card rounded-xl p-1">
          <Filter className="w-3.5 h-3.5 text-muted-foreground ml-2" />
          {NOTICE_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => onNoticeFilterChange(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                noticeFilter === f.key ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {newNotices.length > 1 && (
          <button
            onClick={onDismissAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground glass-card hover:bg-foreground/5 transition-colors ml-auto"
          >
            <CheckCheck className="w-3.5 h-3.5" /> Dispensar todas
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="glass-card rounded-2xl p-4 animate-pulse">
              <div className="h-3 w-32 bg-foreground/10 rounded mb-2" />
              <div className="h-2.5 w-48 bg-foreground/5 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {newNotices.length > 0 && (
            <div className="space-y-2 mb-4">
              {!isMainAll && (
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Novas</p>
              )}
              <AnimatePresence>
                {newNotices.map(b => {
                  const cfg = noticeConfig[b.type as keyof typeof noticeConfig] || noticeConfig.info;
                  const Icon = cfg.icon;
                  return (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className={`glass-card border ${cfg.bg} rounded-xl px-4 py-3 flex items-start gap-3 ${
                        b.action_url ? "cursor-pointer hover:bg-foreground/5 transition-colors" : ""
                      }`}
                      onClick={() => b.action_url && navigate(b.action_url)}
                    >
                      <div className={`mt-0.5 ${cfg.text}`}><Icon className="w-4 h-4" /></div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold ${cfg.text}`}>{b.title}</p>
                        <p className="text-xs text-foreground/70 mt-0.5">{b.message}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">{formatTime(b.created_at)}</p>
                      </div>
                      {b.action_url && <ChevronRight className="w-4 h-4 text-muted-foreground/50 mt-1 flex-shrink-0" />}
                      <button
                        onClick={e => { e.stopPropagation(); onDismiss(b.id); }}
                        className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mt-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}

          {oldNotices.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Anteriores</p>
              {oldNotices.map(b => {
                const cfg = noticeConfig[b.type as keyof typeof noticeConfig] || noticeConfig.info;
                const Icon = cfg.icon;
                return (
                  <div
                    key={b.id}
                    className={`glass-card rounded-xl px-4 py-3 flex items-start gap-3 opacity-60 group ${
                      b.action_url ? "cursor-pointer hover:opacity-80 transition-opacity" : ""
                    }`}
                    onClick={() => b.action_url && navigate(b.action_url)}
                  >
                    <div className={`mt-0.5 ${cfg.text}`}><Icon className="w-3.5 h-3.5" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-foreground/70">{b.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{b.message}</p>
                      <p className="text-[9px] text-muted-foreground/60 mt-1">{formatTime(b.created_at)}</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleUndismiss(b.id); }}
                      className="flex-shrink-0 p-1 rounded-lg hover:bg-foreground/10 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all"
                      title="Restaurar aviso"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    {b.action_url && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 mt-1 flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          )}

          {newNotices.length === 0 && oldNotices.length === 0 && (
            <div className="glass-card rounded-2xl p-8 text-center">
              <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum aviso</p>
            </div>
          )}
        </>
      )}
    </div>
  );
});

InboxNoticesSection.displayName = "InboxNoticesSection";

export default InboxNoticesSection;

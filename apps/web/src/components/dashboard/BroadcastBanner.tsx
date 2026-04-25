import { useNotifications } from "@/contexts/NotificationsContext";
import { X, Info, AlertTriangle, CheckCircle, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

const typeConfig = {
  info: { icon: Info, bg: "bg-primary/10 border-primary/20", text: "text-primary" },
  warning: { icon: AlertTriangle, bg: "bg-yellow-500/10 border-yellow-500/20", text: "text-yellow-600 dark:text-yellow-400" },
  success: { icon: CheckCircle, bg: "bg-green-500/10 border-green-500/20", text: "text-green-600 dark:text-green-400" },
};

const BroadcastBanner = () => {
  const navigate = useNavigate();
  const { visible, dismiss } = useNotifications();

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {visible.map(b => {
          const config = typeConfig[b.type] || typeConfig.info;
          const Icon = config.icon;
          return (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              transition={{ duration: 0.25 }}
              className={`glass-card border ${config.bg} rounded-xl px-4 py-3 flex items-start gap-3 ${
                b.action_url ? "cursor-pointer hover:bg-foreground/5 transition-colors" : ""
              }`}
              onClick={() => b.action_url && navigate(b.action_url)}
            >
              <div className={`mt-0.5 ${config.text}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${config.text}`}>{b.title}</p>
                <p className="text-xs text-foreground/70 mt-0.5">{b.message}</p>
              </div>
              {b.action_url && (
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
              )}
              <button
                onClick={(e) => { e.stopPropagation(); dismiss(b.id); }}
                className="focusable text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mt-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default BroadcastBanner;

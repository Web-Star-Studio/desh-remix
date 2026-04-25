import { AlertTriangle, Bell, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SocialAlert } from "@/hooks/social/useSocialAlerts";

interface SocialAlertsBannerProps {
  alerts: SocialAlert[];
  onAcknowledge: (id: string) => void;
}

const severityConfig: Record<string, { icon: React.ReactNode; bg: string; border: string; text: string; accent: string }> = {
  critical: {
    icon: <AlertTriangle className="w-4 h-4" />,
    bg: "bg-destructive/10",
    border: "border-destructive/20",
    text: "text-destructive",
    accent: "bg-destructive",
  },
  warning: {
    icon: <Bell className="w-4 h-4" />,
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    text: "text-orange-600 dark:text-orange-400",
    accent: "bg-orange-500",
  },
  info: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    bg: "bg-primary/10",
    border: "border-primary/20",
    text: "text-primary",
    accent: "bg-primary",
  },
};

export function SocialAlertsBanner({ alerts, onAcknowledge }: SocialAlertsBannerProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.slice(0, 3).map((alert, i) => {
        const config = severityConfig[alert.severity] || severityConfig.info;
        return (
          <div
            key={alert.id}
            className={`flex items-start gap-3 p-3 rounded-xl border ${config.bg} ${config.border} transition-all animate-in slide-in-from-top-2 fade-in duration-300 relative overflow-hidden`}
            style={{ animationDelay: `${i * 100}ms` }}
          >
            {/* Left accent bar */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${config.accent} rounded-l-xl`} />

            <div className={`shrink-0 mt-0.5 ${config.text} ml-1`}>{config.icon}</div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${config.text}`}>{alert.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => onAcknowledge(alert.id)}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

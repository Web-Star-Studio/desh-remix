import { LucideIcon, ArrowRight } from "lucide-react";
import { ReactNode, forwardRef } from "react";
import { useNavigate } from "react-router-dom";

interface WidgetEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Shorthand: renders a "Conectar agora" button navigating to this path */
  connectTo?: string;
  connectLabel?: string;
}

const WidgetEmptyState = forwardRef<HTMLDivElement, WidgetEmptyStateProps>(
  ({ icon: Icon, title, description, action, connectTo, connectLabel }, ref) => {
    const navigate = useNavigate();

    return (
      <div ref={ref} className="flex-1 flex flex-col items-center justify-center gap-2.5 py-6 text-center">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
          connectTo ? "bg-primary/8 border border-dashed border-primary/20 animate-pulse" : "bg-primary/10"
        }`}>
          <Icon className="w-5.5 h-5.5 text-primary/40" />
        </div>
        <div>
          <p className="text-xs font-medium text-foreground/60">{title}</p>
          {description && (
            <p className="text-[10px] text-muted-foreground max-w-[200px] leading-relaxed mt-0.5">{description}</p>
          )}
        </div>
        {action && <div className="mt-1">{action}</div>}
        {connectTo && !action && (
          <button
            onClick={() => navigate(connectTo)}
            className="focusable mt-1 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-medium hover:bg-primary/25 transition-colors"
          >
            {connectLabel || "Conectar agora"}
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }
);

WidgetEmptyState.displayName = "WidgetEmptyState";

export default WidgetEmptyState;

import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import HeaderActions from "./HeaderActions";
import DeshTooltip from "@/components/ui/DeshTooltip";

/**
 * PageHeader — Standard page header with back button, title, and optional actions.
 * Responsive typography: text-xl on mobile, text-2xl on sm, text-3xl on md+.
 */
interface PageHeaderProps {
  title: string;
  icon?: ReactNode;
  backTo?: string;
  actions?: ReactNode;
  subtitle?: ReactNode;
  className?: string;
  /** Hide the shared header action buttons (notifications, +, AI, profile) */
  hideHeaderActions?: boolean;
}

const PageHeader = ({ title, icon, backTo = "/", actions, subtitle, className, hideHeaderActions = false }: PageHeaderProps) => {
  const navigate = useNavigate();

  return (
    <div className={cn("mb-4 sm:mb-6", className)}>
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <DeshTooltip label="Voltar à página anterior" side="right">
          <button
            onClick={() => navigate(backTo)}
            className="focusable flex items-center gap-2 text-overlay-muted hover:text-overlay transition-colors touch-target press-scale"
          >
            <ArrowLeft className="w-4 h-4" /> <span className="text-sm">Voltar</span>
          </button>
        </DeshTooltip>
        {!hideHeaderActions && <HeaderActions />}
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {icon}
          <h1 className="text-xl sm:text-2xl md:text-3xl font-sans font-semibold text-overlay truncate">
            {title}
          </h1>
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {actions}
          </div>
        )}
      </div>
      {subtitle && (
        <div className="mt-1.5 text-sm text-overlay-muted">
          {subtitle}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
